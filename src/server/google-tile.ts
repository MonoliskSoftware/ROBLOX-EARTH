import { fetch, RobloxResponse } from "shared/libraries/fetch";
import { GoogleTileData, TileRenderer } from "./google-tile-renderer";
import { Chunk } from "./tree";

function startsWith(str1: string, str2: string) {
	return str1.match(`^${str2}`)[0] !== undefined;
}

function all<T>(promises: Promise<T>[]): Promise<T[]> {
	return new Promise<T[]>((resolve, reject) => {
		const results: T[] = [];
		let completed = 0;

		if (promises.size() === 0) {
			resolve([]);
			return;
		}

		promises.forEach((promise, index) => {
			promise.then((value) => {
				results[index] = value;
				completed++;
				if (completed === promises.size()) {
					resolve(results);
				}
			}).catch(reject); // reject immediately if any promise rejects
		});
	});
}

export class GoogleTile {
	public state: "leaf" | "rendered" | "link" = "link";
	public children?: GoogleTile[];
	public renderer?: TileRenderer;

	constructor(private readonly chunk: Chunk) {
		if (chunk.type === "mesh") {
			const data = (fetch(`http://127.0.0.1:8787/get?path=${chunk.path}`).await()[1] as RobloxResponse).json().await()[1] as GoogleTileData;

			this.renderer = new TileRenderer(chunk.path, data);
			this.renderer.bindToExpand(() => this.expand());
		}

		if ("children" in chunk) this.children = chunk.children.map(child => new GoogleTile(child));
	}

	public static async createRoot(): Promise<GoogleTile> {
		const roots = await fetch(`http://127.0.0.1:8787/roots`).then(data => data.json());

		return new GoogleTile(roots as Chunk);
	}

	public async expand() {
		const body = await fetch(`http://127.0.0.1:8787/expand?path=${this.chunk.path}`).then(data => data.json()) as { paths: string[] };

		const promises = body.paths.map((path) =>
			Promise.resolve().then(() => new GoogleTile({
				type: "mesh",
				path: path,
				mesh: undefined as unknown as string,
				children: undefined as unknown as Array<Chunk>
			}))
		);

		this.children = await all(promises);

		this.renderer?.setRendering(false);
	}

	public async search(finalPath: string) {
		if (startsWith(finalPath, this.chunk.path)) {
			if (this.chunk.path === finalPath) return;
			if (this.children === undefined) await this.expand();

			this.children?.forEach(child => child.search(finalPath));
		} else return;
	}
}