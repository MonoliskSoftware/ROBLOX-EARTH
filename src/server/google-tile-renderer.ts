import { AssetService, TweenService, Workspace } from "@rbxts/services";
import { applyTextureToMesh, createEditableMeshFromData } from "shared/libraries/rbmesh";

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

	constructor(path: string, private readonly tileData: GoogleTileData) {
		try {
			for (let i = 0; i < tileData.meshes[0].primitives.size(); i++) {
				const meshData = tileData.meshes[0].primitives[i];
				const textureData = tileData.textures[meshData.texture];

				const mesh = createEditableMeshFromData(meshData, new Vector2(textureData[0].size() / 512, textureData.size() / 512));
				const texture = applyTextureToMesh(tileData.textures[meshData.texture]);
				const meshPart = AssetService.CreateMeshPartAsync(Content.fromObject(mesh));

				meshPart.Parent = Workspace;
				meshPart.Anchored = true;
				meshPart.TextureContent = Content.fromObject(texture);
				meshPart.Name = `${path}.${i}`;

				const primitive = {
					mesh,
					texture,
					meshPart
				} satisfies Primitive;

				this.primitives[i] = primitive;
			}
		} catch (e) {
			warn(`Failed to load tile: ${e}`);
		}

		this.setRendering(true);
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
		}
	}
}