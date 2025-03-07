import { Mapbox } from "shared/libraries/mapbox";
import { MeshTile } from "./mesh-tile";

export class StreetTile extends MeshTile<Mapbox.StreetTile> {
	protected dispose(): void {

	}
}