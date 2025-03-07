import { Coord, Mapbox, MapboxStore } from "shared/libraries/mapbox";
import { TerrainRGB } from "shared/libraries/terrainrgb";
import { pointToTile } from "shared/libraries/tilebelt";
import { EARTH_RADIUS, SCALE_FACTOR, TerrainTile } from "./tiles/terrain";

export class TileInterface {
	private nextPos: Coord;
	private nextZoom: number;

	private pos: Coord;
	private zoom: number;
	private margins: number = 0;
	private tiles: TerrainTile[][] | undefined;

	private updatePromise: Promise<void> | undefined;

	private willUpdate = false;

	constructor(pos: Coord, zoom: number) {
		this.pos = pos;
		this.zoom = zoom;
		this.nextPos = pos;
		this.nextZoom = zoom;

		this.update();
	}

	private async update() {
		this.pos = this.nextPos;
		this.zoom = this.nextZoom;

		const oldTiles = this.tiles ? table.clone(this.tiles) : undefined;

		const tilePosition = pointToTile(this.pos.longitude, this.pos.latitude, this.zoom);

		this.willUpdate = false;

		this.updatePromise = new Promise<TerrainTile[][]>((resolve, reject) => {
			const output: TerrainTile[][] = [];
			const promises: Promise<any>[] = [];
			const offset = Coord.coordToVector3(this.pos, undefined, EARTH_RADIUS * SCALE_FACTOR);
			const finalOffset = CFrame.lookAt(offset, Vector3.zero).mul(CFrame.fromEulerAnglesXYZ(math.pi / 2, 0, 0)).Inverse();
			const xRange = new NumberRange(math.clamp(tilePosition[0] - this.margins, 0, 2 ** tilePosition[2] - 1), math.clamp(tilePosition[0] + this.margins, 0, 2 ** tilePosition[2] - 1));
			const yRange = new NumberRange(math.clamp(tilePosition[1] - this.margins, 0, 2 ** tilePosition[2] - 1), math.clamp(tilePosition[1] + this.margins, 0, 2 ** tilePosition[2] - 1));

			for (let x = xRange.Min; x <= xRange.Max; x++) {
				output[x] = [];

				for (let y = yRange.Min; y <= yRange.Max; y++) {
					const finalTilePosition = [x, y, tilePosition[2]] as [number, number, number];
					const heightMapPromise = Promise.all([
						MapboxStore.getRasterTile(finalTilePosition),
						MapboxStore.getColorTile(finalTilePosition)
					]).then(([height, color]) => [TerrainRGB.createTileMatrix(height), color] as [Mapbox.HeightMatrix, Mapbox.ImageMatrix]).then(([height, color]) => output[x][y] = new TerrainTile(finalTilePosition, height, finalOffset, color));

					promises.push(heightMapPromise);
				}
			}

			Promise.all(promises).then(() => resolve(output));
		}).then(tiles => {
			tiles.forEach(row => row.forEach(cell => cell.parent()));

			oldTiles?.forEach(row => row.forEach(cell => cell.destroy()));
			oldTiles?.clear();

			this.tiles = tiles;

			this.willUpdate = false;
		}, reason => warn(reason));
	}

	public async setPosition(pos: Coord): Promise<void> {
		this.nextPos = pos;

		await this.updatePromise;
		await this.queueUpdate();
	}

	public async setZoom(zoom: number): Promise<void> {
		this.nextZoom = zoom;

		await this.updatePromise;
		await this.queueUpdate();
	}

	private async queueUpdate() {
		if (this.willUpdate) return;

		this.willUpdate = true;

		await this.update();
	}
}