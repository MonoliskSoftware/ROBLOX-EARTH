import { AssetService } from "@rbxts/services";
import { EARTH_RADIUS, METERS_TO_STUDS } from "shared/earth/tiles/terrain";
import { Coord } from "../mapbox";

function alignLookVectorToZ(cf: CFrame): CFrame {
	const currentLook = cf.LookVector;
	const targetLook = Vector3.zAxis;

	// Axis to rotate around (perpendicular to both)
	const axis = currentLook.Cross(targetLook);
	const angle = math.acos(currentLook.Dot(targetLook));

	// If already aligned, return as-is
	if (angle === 0 || axis.Magnitude === 0) {
		return cf;
	}

	// Rotation to align look vector
	const rotation = CFrame.fromAxisAngle(axis.Unit, angle);
	return rotation.mul(cf);
}

// CFrame.lookAt(Vector3.zero, P):Inverse()*CFrame.new(-P)
function getMoveToNorthPoleCFrame(P: Vector3): CFrame {
	return CFrame.fromEulerAnglesXYZ(math.pi / 2, 0, 0).mul(CFrame.lookAlong(Vector3.zero, P).Inverse().mul(new CFrame(P.mul(-1))));
	// const look = CFrame.lookAt(Vector3.zero, P);
	// const final = look.sub(look.Position).Inverse();
	// print(P)
	// print(final.LookVector);
	// return new CFrame(P.mul(-1)).mul(look.sub(look.Position).Inverse());
	// return new CFrame(P.mul(-1)).mul(CFrame.lookAt(Vector3.zero, P).Inverse());
	// const R = P.Magnitude;
	// const targetPos = new Vector3(0, R, 0);

	// // Surface normal at point P (assumes sphere centered at origin)
	// const normal = P.Unit;

	// // Desired forward direction after transformation
	// const localForward = new Vector3(0, 0, 1);

	// // Calculate right vector using cross product
	// const right = localForward.Cross(normal).Unit;

	// // Construct the CFrame using fromMatrix
	// return CFrame.fromMatrix(targetPos, right, normal, localForward);
}

function scale(cframe: CFrame, mul: number) {
	return new CFrame(cframe.Position.mul(mul)).mul(cframe.sub(cframe.Position));
}

export const mainCoord = new Coord(40.64257462046939, -73.77675633571651);
export const SCALE_FACTOR = METERS_TO_STUDS / 1;
export const position = mainCoord.toVector3(CFrame.identity, EARTH_RADIUS);
export const ORIGIN_RELATIVE = getMoveToNorthPoleCFrame(position);

export function applyTextureToMesh(
	textureMatrix: number[][][],
	imageSize?: Vector2
): EditableImage {
	const height = textureMatrix.size();
	const width = textureMatrix[0].size();

	const totalBytes = width * height * 4;
	let len = 0;

	const bufferData = buffer.create(totalBytes);

	for (let y = 0; y < height; y++) {
		const row = textureMatrix[y];
		for (let x = 0; x < width; x++) {
			const [r, g, b] = row[x];

			buffer.writeu8(bufferData, len, r);
			buffer.writeu8(bufferData, len + 1, g);
			buffer.writeu8(bufferData, len + 2, b);
			buffer.writeu8(bufferData, len + 3, 255); // alpha

			len += 4;
		}
	}

	const size = imageSize ?? new Vector2(width, height);
	const editableImage = AssetService.CreateEditableImage();
	editableImage.WritePixelsBuffer(Vector2.zero, size, bufferData);

	// Assuming mesh is UV mapped correctly and material setup is handled elsewhere
	return editableImage;
}

export function createEditableMeshFromData(meshData: {
	positions: number[],
	normals?: number[],
	uvs?: number[],
	indices: number[],
	origin: number[],
	texture: number
}, mul: Vector2): EditableMesh {
	const mesh = AssetService.CreateEditableMesh();

	const vertexIds: number[] = [];
	const normalIds: number[] = [];
	const uvIds: number[] = [];

	const primitiveOrigin = ORIGIN_RELATIVE.mul(new CFrame(meshData.origin[0], meshData.origin[1], meshData.origin[2]));

	// Add vertices
	for (let i = 0; i < meshData.positions.size(); i += 3) {
		const pos = new Vector3(meshData.positions[i], meshData.positions[i + 1], meshData.positions[i + 2]);
		vertexIds.push(mesh.AddVertex(scale(primitiveOrigin.mul(new CFrame(pos)), SCALE_FACTOR).Position));
	}

	// Add normals if present
	if (meshData.normals) {
		for (let i = 0; i < meshData.normals.size(); i += 3) {
			const normal = new Vector3(meshData.normals[i], meshData.normals[i + 1], meshData.normals[i + 2]);
			vertexIds.push(mesh.AddNormal(scale(primitiveOrigin.mul(new CFrame(normal)), SCALE_FACTOR).Position));
		}
	}

	// Add UVs if present
	if (meshData.uvs) {
		for (let i = 0; i < meshData.uvs.size(); i += 2) {
			const uv = new Vector2(meshData.uvs[i] * mul.X, meshData.uvs[i + 1] * mul.Y);
			uvIds.push(mesh.AddUV(uv));
		}
	}

	// Add faces
	for (let i = 0; i < meshData.indices.size(); i += 3) {
		const i0 = meshData.indices[i];
		const i1 = meshData.indices[i + 1];
		const i2 = meshData.indices[i + 2];

		const faceId = mesh.AddTriangle(vertexIds[i0], vertexIds[i1], vertexIds[i2]);

		if (normalIds.size() > 0) {
			mesh.SetFaceNormals(faceId, [normalIds[i0], normalIds[i1], normalIds[i2]]);
		}
		if (uvIds.size() > 0) {
			mesh.SetFaceUVs(faceId, [uvIds[i0], uvIds[i1], uvIds[i2]]);
		}
	}

	return mesh;
}
