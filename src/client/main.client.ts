import { DEFAULT_CONFIG } from "shared/config";
import { TileInterface } from "shared/earth/tile-interface";

const config = DEFAULT_CONFIG;
const int = new TileInterface(config.position, config.zoom, config.targetZoom, config.baseZoom);