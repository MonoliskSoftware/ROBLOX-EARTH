import { ReplicatedStorage, RunService } from "@rbxts/services";
import { Mapbox } from "./libraries/mapbox";
import { Tile } from "./libraries/tilebelt";

export namespace MapboxRemote {
	// Remote Function names
	const RasterTileRemote = "MapboxRemote_RasterTile";
	const StreetMapRemote = "MapboxRemote_StreetMap";
	const ColorMapRemote = "MapboxRemote_ColorMap";

	// RemoteFunction instances
	let rasterTileFunc: RemoteFunction;
	let streetMapFunc: RemoteFunction;
	let colorMapFunc: RemoteFunction;

	// Server-side setup function
	export function setupServer() {
		// Create RemoteFunctions
		rasterTileFunc = new Instance("RemoteFunction");
		rasterTileFunc.Name = RasterTileRemote;
		rasterTileFunc.Parent = ReplicatedStorage;

		streetMapFunc = new Instance("RemoteFunction");
		streetMapFunc.Name = StreetMapRemote;
		streetMapFunc.Parent = ReplicatedStorage;

		colorMapFunc = new Instance("RemoteFunction");
		colorMapFunc.Name = ColorMapRemote;
		colorMapFunc.Parent = ReplicatedStorage;

		// Set up server handlers
		rasterTileFunc.OnServerInvoke = ((player: Player, x: number, y: number, z: number) => (async () => {
			const tile: Tile = [x, y, z];
			return await Mapbox.generateRasterTile(tile);
		})().await()[1]) as Callback;

		streetMapFunc.OnServerInvoke = ((player: Player, x: number, y: number, z: number) => (async () => {
			const tile: Tile = [x, y, z];
			return await Mapbox.generateStreetMap(tile);
		})().await()[1]) as Callback;

		colorMapFunc.OnServerInvoke = ((player: Player, x: number, y: number, z: number, style: Mapbox.ColorMapSet) => (async () => {
			const tile: Tile = [x, y, z];
			return await Mapbox.generateColorMap(tile, style);
		})().await()[1]) as Callback;

		print("MapboxRemote: Server functions registered");
	}

	// Client-side functions that proxy to server
	export async function generateRasterTile(tile: Tile): Promise<Mapbox.ImageMatrix | undefined> {
		// When running on server, call directly
		if (RunService.IsServer()) {
			return await Mapbox.generateRasterTile(tile);
		}

		// When on client, use RemoteFunction
		const remote = ReplicatedStorage.FindFirstChild(RasterTileRemote) as RemoteFunction;
		return remote.InvokeServer(tile[0], tile[1], tile[2]) as Mapbox.ImageMatrix | undefined;
	}

	export async function generateStreetMap(tile: Tile): Promise<Mapbox.StreetTile> {
		// When running on server, call directly
		if (RunService.IsServer()) {
			return await Mapbox.generateStreetMap(tile);
		}

		// When on client, use RemoteFunction
		const remote = ReplicatedStorage.FindFirstChild(StreetMapRemote) as RemoteFunction;
		return remote.InvokeServer(tile[0], tile[1], tile[2]) as Mapbox.StreetTile;
	}

	export async function generateColorMap(tile: Tile, style: Mapbox.ColorMapSet): Promise<Mapbox.ImageMatrix> {
		// When running on server, call directly
		if (RunService.IsServer()) {
			return await Mapbox.generateColorMap(tile, style);
		}

		// When on client, use RemoteFunction
		const remote = ReplicatedStorage.FindFirstChild(ColorMapRemote) as RemoteFunction;
		return remote.InvokeServer(tile[0], tile[1], tile[2], style) as Mapbox.ImageMatrix;
	}
}