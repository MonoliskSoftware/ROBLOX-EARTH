import Object from '@rbxts/object-utils';
import { Workspace } from '@rbxts/services';
import { DEFAULT_CONFIG } from 'shared/config';
import { Coord, Mapbox } from 'shared/libraries/mapbox';
import { MapboxStore } from 'shared/libraries/mapbox/store';
import { TerrainRGB } from 'shared/libraries/terrainrgb';
import { EARTH_RADIUS, METERS_TO_STUDS, TerrainTile } from './tiles/terrain';

// Define TileState type for clarity
type TileState = {
	id: string;
	z: number;
	x: number;
	y: number;
	visible: boolean;
	loaded: boolean;
	subdivided: boolean;
	childrenVisible: boolean;
	children: TileState[];
	data: {
		imagery: Mapbox.ImageMatrix | undefined;
		elevation: Mapbox.HeightMatrix | undefined;
	} | undefined;
	mesh: TerrainTile | undefined;
};

export class TileInterface {
	private currentState: 'INITIAL' | 'LOADING_ROOT' | 'RENDERING_ROOT' | 'IDLE' | 'LOADING' | 'SUBDIVIDING';
	private loadedTiles: Map<string, TileState>;
	private rootTile: TileState | undefined;

	private nextPos: Coord;
	private pos: Coord;
	private zoom: number;
	private nextZoom: number;
	private initialZoom: number;

	private updatePromise: Promise<void> | undefined;
	private willUpdate = false;

	// Queue for tile clicks
	private clickQueue: string[] = [];
	private processingClicks = false;

	private posZoom: number;

	constructor(pos: Coord, zoom: number, posZoom: number, initialZoom?: number) {
		// Initialize state machine properties
		this.currentState = 'INITIAL';
		this.loadedTiles = new Map();
		this.rootTile = undefined;

		// Initialize position and zoom properties
		this.pos = pos;
		this.nextPos = pos;
		this.zoom = zoom;
		this.nextZoom = zoom;

		this.posZoom = posZoom

		// Set initial zoom level
		this.initialZoom = initialZoom !== undefined ? initialZoom : zoom;

		// Start the state machine
		this.start();
	}

	/**
	 * Initialize the state machine and load the initial tiles at the specified zoom level
	 */
	private async start() {
		this.currentState = 'LOADING_ROOT';

		// Calculate which tile covers our current position at the initial zoom level
		const initialTilePosition = pointToTile(this.pos.longitude, this.pos.latitude, this.initialZoom);
		const initialX = initialTilePosition[0];
		const initialY = initialTilePosition[1];
		const initialZ = this.initialZoom;

		// Load the initial tile directly at the specified zoom level
		this.rootTile = await this.loadTile(initialZ, initialX, initialY);
		const rootTileId = `${initialZ}/${initialX}/${initialY}`;
		this.loadedTiles.set(rootTileId, this.rootTile);

		this.currentState = 'RENDERING_ROOT';
		this.renderTile(this.rootTile);

		this.currentState = 'IDLE';

		// If the target zoom is higher than the initial zoom, continue loading more detailed tiles
		if (this.zoom > this.initialZoom) {
			await this.zoomToLevel(this.zoom, this.rootTile);
		}

		if (this.posZoom > this.zoom) {
			for (let i = this.zoom; i <= this.posZoom; i++) {
				const tilePosition = pointToTile(this.pos.longitude, this.pos.latitude, i);

				await this.handleTileClick(`${i}/${tilePosition[0]}/${tilePosition[1]}`)
			}
		}
	}

	/**
	 * Handle a click on a specific tile by adding it to the queue
	 */
	public async handleTileClick(tileId: string): Promise<void> {
		// Add the clicked tile to the queue
		this.clickQueue.push(tileId);

		// Start processing the queue if not already processing
		if (!this.processingClicks) {
			this.processClickQueue();
		}
	}

	/**
	 * Process the click queue sequentially
	 */
	private async processClickQueue(): Promise<void> {
		if (this.processingClicks) return;

		this.processingClicks = true;

		while (this.clickQueue.size() > 0) {
			const tileId = this.clickQueue.shift();

			if (tileId !== undefined) {
				await this.processTileClick(tileId);
			}
		}

		this.processingClicks = false;
	}

	/**
	 * Process a single tile click
	 */
	private async processTileClick(tileId: string): Promise<void> {
		// Skip if we're in a state that cannot handle clicks
		if (this.currentState === 'INITIAL' || this.currentState === 'LOADING_ROOT' || this.currentState === 'RENDERING_ROOT') {
			return;
		}

		const tile = this.loadedTiles.get(tileId);
		if (!tile) return;

		// Set the current state to processing
		const previousState = this.currentState;
		this.currentState = 'SUBDIVIDING';

		try {
			// Load child tiles
			if (!tile.subdivided) await this.subdivide(tile);

			// Toggle visibility of children
			this.toggleChildTiles(tile);
		} catch (error) {
			warn(`Error processing tile click for ${tileId}: ${error}`);
		} finally {
			// Restore the previous state
			this.currentState = previousState;
		}
	}

	/**
	 * Recursively subdivide tiles to reach a specific zoom level
	 */
	private async zoomToLevel(targetZoom: number, currentTile?: TileState): Promise<void> {
		const tile = currentTile || this.rootTile;
		if (!tile) return;

		if (tile.z >= targetZoom) return;

		if (!tile.subdivided) {
			await this.subdivide(tile);
		}

		// Toggle visibility of children
		this.toggleChildTiles(tile);

		// Recursively subdivide all children to reach the target zoom
		for (const child of tile.children) {
			await this.zoomToLevel(targetZoom, child);
		}
	}

	/**
	 * Create child tiles for a parent tile
	 */
	private async subdivide(tile: TileState): Promise<void> {
		// Generate child tile IDs based on slippy map convention
		const z = tile.z + 1;
		const x = tile.x * 2;
		const y = tile.y * 2;

		// Four children in a quadtree structure
		const childTileIds = [
			`${z}/${x}/${y}`,
			`${z}/${x + 1}/${y}`,
			`${z}/${x}/${y + 1}`,
			`${z}/${x + 1}/${y + 1}`
		];

		tile.children = [];

		// Load all child tiles in parallel
		const loadPromises = childTileIds.map(async (id) => {
			const [cz, cx, cy] = id.split('/').map(n => tonumber(n));
			const childTile = await this.loadTile(cz!, cx!, cy!);
			this.loadedTiles.set(id, childTile);
			tile.children.push(childTile);
			return childTile;
		});

		// Wait for all child tiles to load
		await Promise.all(loadPromises);

		// Mark parent as subdivided and update rendering
		tile.subdivided = true;
		this.updateTileVisibility(tile);
	}

	/**
	 * Toggle visibility of child tiles
	 */
	private toggleChildTiles(tile: TileState): void {
		// Toggle visibility state of children
		tile.childrenVisible = !tile.childrenVisible;
		this.updateTileVisibility(tile);
	}

	/**
	 * Update tile visibility based on parent-child relationships
	 */
	private updateTileVisibility(tile: TileState): void {
		if (tile.subdivided) {
			// If children are visible, hide parent and show children
			tile.visible = !tile.childrenVisible;

			tile.children.forEach(child => {
				child.visible = tile.childrenVisible;
				// Recursively update if this child has its own children
				if (child.subdivided) {
					this.updateTileVisibility(child);
				}
			});

			// Update rendering
			this.applyVisibilityChanges();
		}
	}

	/**
	 * Apply visibility changes to the 3D scene
	 */
	private applyVisibilityChanges(): void {
		// Update the 3D scene to reflect visibility changes
		for (const [tileId, tile] of Object.entries(this.loadedTiles)) {
			this.updateTileRender(tile);
		}
	}

	/**
	 * Load a tile's data and create its mesh
	 */
	private async loadTile(z: number, x: number, y: number): Promise<TileState> {
		this.currentState = 'LOADING';

		// Create new tile state object
		const tile: TileState = {
			id: `${z}/${x}/${y}`,
			z, x, y,
			visible: true,
			loaded: false,
			subdivided: false,
			childrenVisible: false,
			children: [],
			data: {
				imagery: undefined,
				elevation: undefined
			},
			mesh: undefined
		};

		try {
			// Fetch tile data
			const [elevation, imagery] = await Promise.all([
				MapboxStore.getRasterTile([x, y, z]),
				MapboxStore.getColorTile([x, y, z])
			]);

			// Process the data
			const heightMatrix = TerrainRGB.createTileMatrix(elevation);

			// Create the offset for positioning
			const offset = Coord.coordToVector3(this.pos, undefined, EARTH_RADIUS * DEFAULT_CONFIG.scaleFactor * METERS_TO_STUDS);
			const finalOffset = CFrame.lookAt(offset, Vector3.zero)
				.mul(CFrame.fromEulerAnglesXYZ(math.pi / 2, 0, 0))
				.Inverse();

			// Create the terrain tile
			tile.mesh = new TerrainTile([x, y, z], heightMatrix, finalOffset, imagery!, this);
			tile.data = { imagery, elevation: heightMatrix };
			tile.loaded = true;

			// Parent the tile to make it visible
			if (tile.mesh) {
				tile.mesh.parent();
			}

			this.currentState = 'IDLE';
			return tile;
		} catch (error) {
			warn(`Failed to load tile ${z}/${x}/${y}: ${error}`);

			{
				const g = new Instance("Folder");

				g.Name = `${z}/${x}/${y}`;
				g.Parent = Workspace;

				const v = new Instance("BoolValue");

				v.Changed.Connect(() => this.handleTileClick(g.Name));
				v.Parent = g;
			}

			this.currentState = 'IDLE';
			return tile;
		}
	}

	/**
	 * Update the visibility of a tile in the renderer
	 */
	private updateTileRender(tile: TileState): void {
		if (!tile.mesh) return;

		if (tile.visible && tile.loaded) {
			// Show this tile
			tile.mesh.parent();
		} else {
			// Hide this tile
			tile.mesh.unparent();
		}
	}

	/**
	 * Render a single tile
	 */
	private renderTile(tile: TileState): void {
		this.updateTileRender(tile);
	}

	/**
	 * Set the position and trigger an update
	 */
	public async setPosition(pos: Coord): Promise<void> {
		this.nextPos = pos;

		await this.updatePromise;
		await this.queueUpdate();
	}

	/**
	 * Set the zoom level and trigger an update
	 */
	public async setZoom(zoom: number): Promise<void> {
		this.nextZoom = zoom;

		await this.updatePromise;
		await this.queueUpdate();
	}

	/**
	 * Queue an update if one isn't already in progress
	 */
	private async queueUpdate(): Promise<void> {
		if (this.willUpdate) return;

		this.willUpdate = true;

		await this.update();
	}

	/**
	 * Update the tile interface based on new position or zoom
	 */
	private async update(): Promise<void> {
		this.pos = this.nextPos;
		this.zoom = this.nextZoom;

		// Find which new tiles we need at the current zoom level
		const tilePosition = pointToTile(this.pos.longitude, this.pos.latitude, this.zoom);
		const targetTileId = `${this.zoom}/${tilePosition[0]}/${tilePosition[1]}`;

		// If we already have this tile loaded, just make sure it's visible
		const targetTile = this.loadedTiles.get(targetTileId);
		if (targetTile) {
			// Make this tile and its ancestors visible
			this.makePathVisible(targetTile);
		} else {
			// Need to load new tiles - first make sure we're at the right zoom level
			if (this.rootTile) {
				await this.zoomToLevel(this.zoom, this.rootTile);

				// Now find and load the specific tile we need
				const tileAtPosition = this.loadedTiles.get(targetTileId);
				if (tileAtPosition) {
					this.makePathVisible(tileAtPosition);
				} else {
					// Try to find the closest ancestor we have loaded
					const closestAncestor = this.findClosestLoadedAncestor(this.zoom, tilePosition[0], tilePosition[1]);
					if (closestAncestor) {
						await this.subdividePathTo(closestAncestor, this.zoom, tilePosition[0], tilePosition[1]);
					}
				}
			}
		}

		this.willUpdate = false;
	}

	/**
	 * Make a tile and its ancestors visible
	 */
	private makePathVisible(tile: TileState): void {
		// Find the path from root to this tile
		const path: TileState[] = [];
		let current: TileState | undefined = tile;

		while (current) {
			path.unshift(current);

			// Find parent (using parent tile coordinates)
			const parentZ = current.z - 1;
			if (parentZ < this.initialZoom) break; // Don't go below initial zoom level

			const parentX = math.floor(current.x / 2);
			const parentY = math.floor(current.y / 2);
			const parentId = `${parentZ}/${parentX}/${parentY}`;

			current = this.loadedTiles.get(parentId);
		}

		// Make the path visible
		for (let i = 0; i < path.size() - 1; i++) {
			const parent = path[i];

			if (!parent.subdivided) {
				// This shouldn't happen in theory, but handle it gracefully
				continue;
			}

			parent.childrenVisible = true;
			parent.visible = false;
		}

		// Make the target tile visible
		if (path.size() > 0) {
			const targetTile = path[path.size() - 1];
			targetTile.visible = true;
		}

		this.applyVisibilityChanges();
	}

	/**
	 * Find the closest loaded ancestor of a tile
	 */
	private findClosestLoadedAncestor(z: number, x: number, y: number): TileState | undefined {
		// Check if the tile itself is loaded
		const tileId = `${z}/${x}/${y}`;
		if (this.loadedTiles.has(tileId)) {
			return this.loadedTiles.get(tileId) || undefined;
		}

		// Search for ancestors, but don't go below the initial zoom level
		for (let currentZ = z - 1; currentZ >= this.initialZoom; currentZ--) {
			const scale = 2 ** (z - currentZ);
			const ancestorX = math.floor(x / scale);
			const ancestorY = math.floor(y / scale);
			const ancestorId = `${currentZ}/${ancestorX}/${ancestorY}`;

			if (this.loadedTiles.has(ancestorId)) {
				return this.loadedTiles.get(ancestorId) || undefined;
			}
		}

		// Return the root tile as fallback
		return this.rootTile;
	}

	/**
	 * Subdivide tiles along a path to reach a target tile
	 */
	private async subdividePathTo(startTile: TileState, targetZ: number, targetX: number, targetY: number): Promise<void> {
		let currentTile = startTile;

		while (currentTile.z < targetZ) {
			if (!currentTile.subdivided) {
				await this.subdivide(currentTile);
			}

			// Calculate which child we need to follow
			const nextZ = currentTile.z + 1;
			const scale = 2 ** (targetZ - nextZ);
			const nextX = math.floor(targetX / scale) % 2; // 0 or 1
			const nextY = math.floor(targetY / scale) % 2; // 0 or 1

			// Find the child to follow
			const childIndex = nextY * 2 + nextX;
			if (currentTile.children.size() <= childIndex) {
				break; // Something went wrong
			}

			// Move to next tile in path
			currentTile = currentTile.children[childIndex];
		}

		// Make the final path visible
		this.makePathVisible(currentTile);
	}

	/**
	 * Unload tiles that are too far from the current view to save memory
	 */
	private unloadUnusedTiles(): void {
		// Implementation depends on your specific requirements
		// This could:
		// 1. Unload tiles that are at a much different zoom level than current
		// 2. Unload tiles that are geographically distant
		// 3. Keep a maximum number of tiles loaded and remove least recently used
	}
}

// Helper function to convert lon/lat to tile coordinates
function pointToTile(lon: number, lat: number, zoom: number): [number, number, number] {
	const scale = 2 ** zoom;
	const rad = math.pi / 180;
	const x = math.floor((lon + 180) / 360 * scale);
	const y = math.floor(
		(1 - math.log(math.tan(lat * rad) + 1 / math.cos(lat * rad)) / math.pi) / 2 * scale
	);
	return [x, y, zoom];
}