import { AssetService } from "@rbxts/services";
import { Coord, Mapbox } from "shared/libraries/mapbox";
import { tileToBBOX } from "shared/libraries/tilebelt";
import { TileInterface } from "../tile-interface";
import { MeshTile } from "./mesh-tile";

// Given 4 vertex IDs, adds a new normal and 2 triangles, making a sharp quad
function addSharpQuad(eMesh: EditableMesh, vid0: number, vid1: number, vid2: number, vid3: number, x: number, y: number, w: number, h: number) {
	w -= 1;
	h -= 1;

	const nid = eMesh.AddNormal(); // This creates a normal ID which is automatically computed
	const uv0 = eMesh.AddUV(new Vector2(y / h, 1 - (x + 1) / w).div(2));
	const uv1 = eMesh.AddUV(new Vector2(y / h, 1 - x / w).div(2));
	const uv3 = eMesh.AddUV(new Vector2((y + 1) / h, 1 - (x + 1) / w).div(2));
	const uv2 = eMesh.AddUV(new Vector2((y + 1) / h, 1 - x / w).div(2));

	const fid1 = eMesh.AddTriangle(vid0, vid1, vid2);
	eMesh.SetFaceNormals(fid1, [nid, nid, nid]);
	eMesh.SetFaceUVs(fid1, [uv0, uv1, uv2]);

	const fid2 = eMesh.AddTriangle(vid0, vid2, vid3);
	eMesh.SetFaceNormals(fid2, [nid, nid, nid]);
	eMesh.SetFaceUVs(fid2, [uv0, uv2, uv3]);
}

function addSmoothQuad(eMesh: EditableMesh, vid0: number, vid1: number, vid2: number, vid3: number, x: number, y: number, w: number, h: number) {
	w -= 1;
	h -= 1;

	// Compute a smooth normal for the entire quad
	const normal = new Vector3(0, 0, 1); // Assuming the quad is on the XY plane
	const nid0 = eMesh.AddNormal(normal);
	const nid1 = eMesh.AddNormal(normal);
	const nid2 = eMesh.AddNormal(normal);
	const nid3 = eMesh.AddNormal(normal);

	// Generate UV coordinates
	const uv0 = eMesh.AddUV(new Vector2(y / h, 1 - (x + 1) / w).div(2));
	const uv1 = eMesh.AddUV(new Vector2(y / h, 1 - x / w).div(2));
	const uv3 = eMesh.AddUV(new Vector2((y + 1) / h, 1 - (x + 1) / w).div(2));
	const uv2 = eMesh.AddUV(new Vector2((y + 1) / h, 1 - x / w).div(2));

	// Create triangles and assign per-vertex normals
	const fid1 = eMesh.AddTriangle(vid0, vid1, vid2);
	eMesh.SetFaceNormals(fid1, [nid0, nid1, nid2]);
	eMesh.SetFaceUVs(fid1, [uv0, uv1, uv2]);

	const fid2 = eMesh.AddTriangle(vid0, vid2, vid3);
	eMesh.SetFaceNormals(fid2, [nid0, nid2, nid3]);
	eMesh.SetFaceUVs(fid2, [uv0, uv2, uv3]);
}

function getSubMatrix<T extends defined>(
	matrix: T[][],
	x1: number,
	y1: number,
	x2: number,
	y2: number
): T[][] {
	const subMatrix: T[][] = [];

	for (let y = y1; y <= y2; y++) {
		if (y >= matrix.size()) break;
		const row: T[] = [];
		for (let x = x1; x <= x2; x++) {
			if (x >= matrix[y].size()) break;

			row.push(matrix[y][x]);
		}
		subMatrix.push(row);
	}

	return subMatrix;
}

function reduceMatrixResolution<T extends defined>(matrix: T[][], factor: number): T[][] {
	if (factor < 1) throw ("Factor must be at least 1");

	const rows = matrix.size();
	// eslint-disable-next-line roblox-ts/lua-truthiness
	const cols = matrix[0]?.size() || 0;
	if (rows === 0 || cols === 0) return [];

	const reducedMatrix: T[][] = [];

	for (let i = 0; i < rows; i += factor) {
		if (i + factor >= rows) i = rows - 1; // Ensure last row is always included
		const newRow: T[] = [];

		for (let j = 0; j < cols; j += factor) {
			if (j + factor >= cols) j = cols - 1; // Ensure last column is always included
			newRow.push(matrix[i][j]);
		}
		reducedMatrix.push(newRow);
	}

	return reducedMatrix;
}

export const METERS_TO_STUDS = 3.936;
export const EARTH_RADIUS = 6378137;
export const SCALE_FACTOR = 1 / 25;
export const HEIGHT_SCALE = 1;

function generateImage(image: EditableImage, color: Mapbox.ImageMatrix) {
	const dims = [color.size(), color[0].size()];
	const totalDim = dims[0] * dims[1] * 4;

	let len = 0;

	const colorBuffer = color.reduce((accumulator, row) => {
		row.forEach(([r, g, b]) => {
			buffer.writeu8(accumulator, len, r);
			buffer.writeu8(accumulator, len + 1, g);
			buffer.writeu8(accumulator, len + 2, b);
			buffer.writeu8(accumulator, len + 3, 255); // write 255 for opaque

			len += 4;
		}); return accumulator;
	}, buffer.create(totalDim));

	image.WritePixelsBuffer(Vector2.zero, new Vector2(color.size(), color[0].size()), colorBuffer);
}

export class TerrainTile extends MeshTile<number[][]> {
	private vertices: number[][];
	private image = AssetService.CreateEditableImage();

	constructor(position: [number, number, number], data: number[][], originOffset: CFrame, color: Mapbox.ImageMatrix, i: TileInterface) {
		data = reduceMatrixResolution(data, 4);

		super(position, data, originOffset);

		const bounds = tileToBBOX(position);
		const gridWidth = (bounds[3] - bounds[1]) / (data.size() - 1);
		const gridHeight = (bounds[2] - bounds[0]) / (data[0].size() - 1);

		const dims = [data.size(), data[0].size()];

		this.vertices = [];

		const uvs = [];

		for (let x = 0; x < dims[0]; x++) {
			this.vertices[x] = [];

			for (let y = 0; y < dims[1]; y++) {
				const final = (EARTH_RADIUS + HEIGHT_SCALE * data[dims[0] - 1 - x][y]) * SCALE_FACTOR;
				const pos = Coord.coordToVector3(new Vector2(bounds[1] + gridWidth * x, bounds[0] + gridHeight * y), this.originOffset, final * METERS_TO_STUDS);

				this.vertices[x][y] = this.mesh.AddVertex(pos);

				const uv = this.mesh.AddUV(new Vector2(x / (dims[0] - 1), y / (dims[1] - 1)));

				uvs[this.vertices[x][y]] = uv;
			}
		}

		for (let x = 0; x < this.vertices.size() - 1; x++) {
			for (let y = 0; y < this.vertices[x].size() - 1; y++) {
				addSmoothQuad(this.mesh,
					this.vertices[x + 1][y],
					this.vertices[x][y],
					this.vertices[x][y + 1],
					this.vertices[x + 1][y + 1],
					x,
					y,
					dims[0],
					dims[1]
				);
			}
		}

		this.applyMesh();

		generateImage(this.image, color);

		this.meshPart!.TextureContent = Content.fromObject(this.image);
		// debug
		this.meshPart!.Name = `${position[2]}/${position[0]}/${position[1]}`;

		const v = new Instance("BoolValue");

		v.Changed.Connect(() => i.handleTileClick(this.meshPart!.Name));
		v.Parent = this.meshPart;
	}

	protected dispose(): void {

	}
}