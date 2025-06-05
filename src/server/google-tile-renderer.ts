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

export class TileRenderer {
	private mesh!: EditableMesh;
	private texture!: EditableImage;
	private meshPart!: MeshPart;

	constructor(path: string, private readonly tileData: GoogleTileData) {
		const zoom = path.size();

		try {
			const meshData = tileData.meshes[0].primitives[0];
			const texture = tileData.textures[meshData.texture];

			this.mesh = createEditableMeshFromData(meshData, new Vector2(texture[0].size() / 512, texture.size() / 512));
			this.texture = applyTextureToMesh(texture);
			this.meshPart = AssetService.CreateMeshPartAsync(Content.fromObject(this.mesh));
			this.meshPart.Parent = Workspace;
			this.meshPart.Anchored = true;
			this.meshPart.TextureContent = Content.fromObject(this.texture);
		} catch (e) {
			warn(`Failed to load tile: ${e}`);
			this.meshPart = new Instance("MeshPart");
			this.meshPart.Parent = Workspace;
			this.meshPart.Anchored = true;
		}

		this.meshPart.Name = path;
		this.setRendering(true);
	}

	public setRendering(rendering: boolean) {
		if (rendering) this.meshPart.Parent = Workspace;

		this.meshPart.Transparency = rendering ? 1 : 0;

		const tween = TweenService.Create(this.meshPart, new TweenInfo(0.5), {
			Transparency: rendering ? 0 : 1
		});

		tween.Completed.Connect(() => {
			if (!rendering) this.meshPart.Parent = script;
		});

		tween.Play();
	}

	public destroy() {
		this.mesh.Destroy();
		this.texture.Destroy();
		this.meshPart.Destroy();

		rawset(this, "mesh", undefined);
		rawset(this, "texture", undefined);
		rawset(this, "meshPart", undefined);
	}

	public bindToExpand(func: Callback) {
		if (this.meshPart) {
			const val = new Instance("BoolValue");

			val.Parent = this.meshPart;

			val.Changed.Connect(() => func());
		}
	}
}