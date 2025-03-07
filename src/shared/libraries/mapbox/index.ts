import { fetch } from "../fetch";
import { GeoJsonObject } from "../geojson";
import { Tile } from "../tilebelt";

function roundTo(num: number, places: number) {
	return math.round(num * 10 ** places) / 10 ** places;
}

function getLatString(lat: number) {
	if (lat > 0) {
		return " N";
	} else if (lat < 0) {
		return " S";
	}

	return "";
}

function getLongString(long: number) {
	if (long > 0) {
		return " E";
	} else if (long < 0) {
		return " W";
	}

	return "";
}

export namespace Mapbox {
	export const heightmap_endpoint = "http://localhost:8787/api/mapbox/height";
	export const streetmap_endpoint = "http://localhost:8787/api/mapbox/streets";
	export const colormap_endpoint = "http://localhost:8787/api/mapbox/color";

	export enum RasterTileSet {
		TERRAIN_RGB = "mapbox.terrain-rgb",
		TERRAIN_DEM = "mapbox.terrain-dem"
	}

	export enum ColorMapSet {
		LARGE = "large",
		SMALL = "small"
	}

	export interface StreetTile {
		road: GeoJsonObject[];
		building: GeoJsonObject[]
	}

	export type HeightMatrix = number[][];
	export type ImageMatrix = number[][][];

	export async function generateRasterTile(tile: Tile): Promise<ImageMatrix | undefined> {
		const rez = await fetch(`${heightmap_endpoint}?x=${tile[0]}&y=${tile[1]}&z=${tile[2]}`);

		return (await rez.json() as { matrix: ImageMatrix }).matrix;
	}

	export async function generateStreetMap(tile: Tile): Promise<StreetTile> {
		const rez = await fetch(`${streetmap_endpoint}?x=${tile[0]}&y=${tile[1]}&z=${tile[2]}`);

		return await rez.json() as StreetTile;
	}

	export async function generateColorMap(tile: Tile, style: ColorMapSet): Promise<ImageMatrix> {
		const rez = await fetch(`${colormap_endpoint}/${style}?x=${tile[0]}&y=${tile[1]}&z=${tile[2]}`);

		return (await rez.json() as { matrix: ImageMatrix }).matrix;
	}
}

const empty = {};

export class MapboxStore {
	private static rasterTiles: Mapbox.ImageMatrix[][][] = [];
	private static streetTiles: Mapbox.StreetTile[][][] = [];
	private static colorTiles: Mapbox.ImageMatrix[][][] = [];

	private static readonly colorStyle = Mapbox.ColorMapSet.LARGE;

	public static async getRasterTile(tile: Tile): Promise<Mapbox.ImageMatrix | undefined> {
		return this.getStoredTile(this.rasterTiles, tile) ?? this.storeTile(this.rasterTiles, tile, this.convert(await Mapbox.generateRasterTile(tile)));
	}

	public static async getColorTile(tile: Tile): Promise<Mapbox.ImageMatrix | undefined> {
		return this.getStoredTile(this.colorTiles, tile) ?? this.storeTile(this.colorTiles, tile, await Mapbox.generateColorMap(tile, this.colorStyle));
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

export type GPSCoord = Coord | Vector2;

export class Coord {
	readonly latitude: number;
	readonly longitude: number;
	readonly X: number;
	readonly Y: number;

	constructor(latitude: number, longitude: number) {
		this.latitude = latitude;
		this.longitude = longitude;
		this.X = latitude;
		this.Y = longitude;
	}

	toString() {
		const lat = roundTo(this.latitude, 4);
		const long = roundTo(this.longitude, 4);

		return `${math.abs(lat)}° ${getLatString(lat)}, ${math.abs(long)}° ${getLongString(long)}`
	}

	public static coordToVector3(coord: GPSCoord, origin: CFrame = CFrame.identity, radius: number): Vector3 {
		const latRad = (coord.X * math.pi) / 180;
		const lonRad = -(coord.Y * math.pi) / 180;

		const x = radius * math.cos(latRad) * math.cos(lonRad);
		const y = radius * math.sin(latRad);
		const z = radius * math.cos(latRad) * math.sin(lonRad);

		return origin.mul(new Vector3(x, y, z));
	}

	public toVector3(pos: CFrame, radius: number) {
		return Coord.coordToVector3(this, pos, radius);
	}
}