import { TileInterface } from "shared/earth/tile-interface";
import { Coord } from "shared/libraries/mapbox";

const coord = new Coord(40.7128, -74.0060);
const zoom = 0;

const int = new TileInterface(coord, zoom);

const posVal = new Instance("Vector3Value");

posVal.Name = "Coord";
posVal.Value = new Vector3(coord.X, coord.Y, 0);
posVal.Parent = script;

const zoomVal = new Instance("NumberValue");

zoomVal.Name = "Zoom";
zoomVal.Value = zoom;
zoomVal.Parent = script;

posVal.Changed.Connect(pos => int.setPosition(new Coord(pos.X, pos.Y)));
zoomVal.Changed.Connect(zoom => int.setZoom(zoom));