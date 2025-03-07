import { AssetService, Workspace } from "@rbxts/services";

export abstract class MeshTile<T> {
	protected meshPart: MeshPart | undefined;
	protected mesh = AssetService.CreateEditableMesh();
	protected readonly data: T;
	protected readonly tile: [number, number, number];
	protected readonly originOffset: CFrame;

	constructor(tile: [number, number, number], data: T, originOffset: CFrame) {
		this.tile = tile;
		this.data = data;
		this.originOffset = originOffset;
	}

	protected applyMesh() {
		if (!this.meshPart) {
			this.meshPart = AssetService.CreateMeshPartAsync(Content.fromObject(this.mesh));
			this.meshPart.Anchored = true;
		} else {
			this.meshPart.ApplyMesh(this.meshPart);
		}
	}

	protected abstract dispose(): void;

	public destroy() {
		(this as any).data = undefined;
		this.mesh.Destroy();
		this.meshPart?.Destroy();
	}

	public parent() {
		this.meshPart!.Parent = Workspace;
	}

	public unparent() {
		this.meshPart!.Parent = game;
	}
}