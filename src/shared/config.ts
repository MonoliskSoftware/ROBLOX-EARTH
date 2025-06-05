import { Coord } from "shared/libraries/mapbox";

export interface EarthConfig {
	/**
	 * The targetZoom is the zoom level that the target coordinate should reach.
	 */
	readonly targetZoom: number;
	/**
	 * Minimum zoom level around the target coordinate that should be rendered. 
	 */
	readonly baseZoom?: number;
	/**
	 * Goal zoom level of surrounding tiles. If this is less than {@link baseZoom}, and baseZoom is defined, all tiles will be subdivided to this level.
	 */
	readonly zoom: number;
	/**
	 * Target coordinate
	 */
	readonly position: Coord;
	/**
	 * Scale factor
	 */
	readonly scaleFactor: number;
}

export const DEFAULT_CONFIG: EarthConfig = {
	targetZoom: 13,
	baseZoom: 9,
	zoom: 13,
	scaleFactor: 1 / 100,
	position: new Coord(38.89764737969643, -77.03650835547353)
}