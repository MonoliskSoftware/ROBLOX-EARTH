import Object from "@rbxts/object-utils";
import { AssetService, TweenService, Workspace } from "@rbxts/services";
import { EARTH_RADIUS, METERS_TO_STUDS } from "shared/earth/tiles/terrain";
import { applyTextureToMesh, generateEditableMeshFromData, ORIGIN_RELATIVE, scale, SCALE_FACTOR } from "shared/libraries/rbmesh";

export type GoogleTileData = {
	meshes: {
		primitives: { positions: number[]; normals?: number[] | undefined; uvs?: number[] | undefined; indices: number[]; origin: number[]; texture: number }[]
	}[],
	textures: { [key: string]: number[][][] }
}

function getMulFromZoom(zoom: number) {
	if (zoom < 13) {
		return Vector2.one.mul(0.5)
	} else if (zoom < 16) {
		return new Vector2(0.5, 1)
	} else {
		return Vector2.one;
	}
}

type Primitive = {
	mesh: EditableMesh,
	texture: EditableImage,
	meshPart: MeshPart
}

export class TileRenderer {
	private primitives = new Array<Primitive>();

	constructor(private readonly path: string, private readonly tileData: GoogleTileData) {
		for (let i = 0; i < tileData.meshes[0].primitives.size(); i++) {
			const meshData = tileData.meshes[0].primitives[i];
			const textureData = tileData.textures[meshData.texture];

			try {
				const meshes = generateEditableMeshFromData(meshData, new Vector2(textureData[0].size() / 512, textureData.size() / 512));
				const textures = new Map(Object.entries(tileData.textures).map(([id, data]) => [id, applyTextureToMesh(data)]));

				for (const [origin, mesh] of meshes) {
					const texture = textures.get(meshData.texture)!;
					const meshPart = AssetService.CreateMeshPartAsync(Content.fromObject(mesh));

					meshPart.Parent = script;
					meshPart.Anchored = true;
					meshPart.TextureContent = Content.fromObject(texture);
					meshPart.Name = `${path}.${this.primitives.size()}`;
					meshPart.CFrame = origin;

					const primitive = {
						mesh,
						texture,
						meshPart
					} satisfies Primitive;

					this.primitives.push(primitive);
				}
			} catch (e) {
				warn(`Failed to load primitive ${i} of tile ${path}: ${e}`);

				const meshPart = new Instance("MeshPart");
				const primitiveOrigin = ORIGIN_RELATIVE.mul(new CFrame(meshData.origin[0], meshData.origin[1], meshData.origin[2]));

				meshPart.Position = scale(primitiveOrigin, SCALE_FACTOR).Position
				meshPart.Anchored = true;
				meshPart.Size = Vector3.one.mul((EARTH_RADIUS * METERS_TO_STUDS) / path.size());
				meshPart.Name = `${path}.${this.primitives.size()}`;

				const primitive = {
					meshPart
				} as Primitive;

				this.primitives.push(primitive);
			}
		}
	}

	public setRendering(rendering: boolean) {
		for (const primitive of this.primitives) {
			if (rendering) primitive.meshPart.Parent = Workspace;

			primitive.meshPart.Transparency = rendering ? 1 : 0;

			const tween = TweenService.Create(primitive.meshPart, new TweenInfo(0.5), {
				Transparency: rendering ? 0 : 1
			});

			tween.Completed.Connect(() => {
				if (!rendering) primitive.meshPart.Parent = script;
			});

			tween.Play();
		}
	}

	public destroy() {
		this.primitives.forEach(prim => {
			prim.mesh.Destroy();
			prim.meshPart.Destroy();
			prim.texture.Destroy();
		});

		this.primitives.clear();
	}

	public bindToExpand(func: Callback) {
		if (this.primitives.size() > 0) {
			const val = new Instance("BoolValue");

			val.Parent = this.primitives[0].meshPart;

			val.Changed.Connect(() => func());
		} else {
			const val = new Instance("BoolValue");

			val.Parent = Workspace;
			val.Name = this.path;

			val.Changed.Connect(() => func());
		}
	}
}