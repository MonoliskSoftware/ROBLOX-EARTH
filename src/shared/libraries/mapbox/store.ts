import { MapboxRemote } from "shared/mapbox-remote";
import { Mapbox } from ".";
import { Tile } from "../tilebelt";

const empty = {};

export class MapboxStore {
	private static rasterTiles: Mapbox.ImageMatrix[][][] = [];
	private static streetTiles: Mapbox.StreetTile[][][] = [];
	private static colorTiles: Mapbox.ImageMatrix[][][] = [];

	private static readonly colorStyle = Mapbox.ColorMapSet.LARGE;

	public static async getRasterTile(tile: Tile): Promise<Mapbox.ImageMatrix | undefined> {
		return this.getStoredTile(this.rasterTiles, tile) ?? this.storeTile(this.rasterTiles, tile, this.convert(await MapboxRemote.generateRasterTile(tile)));
	}

	public static async getColorTile(tile: Tile): Promise<Mapbox.ImageMatrix | undefined> {
		return this.getStoredTile(this.colorTiles, tile) ?? this.storeTile(this.colorTiles, tile, await MapboxRemote.generateColorMap(tile, this.colorStyle));
	}

	private static storeTile<T extends defined>(store: T[][][], tile: Tile, item: T) {
		if (!store[tile[0]]) store[tile[0]] = [];
		if (!store[tile[0]][tile[1]]) store[tile[0]][tile[1]] = [];

		store[tile[0]][tile[1]][tile[2]] = item;

		return item;
	}

	private static getStoredTile<T extends defined>(store: T[][][], tile: Tile): T | undefined {
		const item = store[tile[0]]?.[tile[1]]?.[tile[2]];

		return item !== empty ? item : undefined;
	}

	private static convert<T extends defined>(item: T | undefined): T {
		return item === undefined ? empty as T : item;
	}
}