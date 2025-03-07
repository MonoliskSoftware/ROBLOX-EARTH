import { Workspace } from "@rbxts/services";

/**
 * Breaks a large number into an array of chunks, each less than or equal to 2048
 * @param num The input number to be chunked
 * @returns An array of number chunks
 */
function chunkNumber(num: number): number[] {
	// Handle non-positive numbers
	if (num <= 0) return [0];

	const chunks: number[] = [];
	const maxChunkSize = 2048;

	// Continue chunking until the entire number is processed
	while (num > 0) {
		// Take the minimum of num and maxChunkSize
		const chunk = math.min(num, maxChunkSize);

		// Prepend the chunk to maintain original number's order when reconstructed
		chunks.unshift(chunk);

		// Reduce the remaining number
		num -= chunk;
	}

	return chunks;
}

const empty: number[][] = [];
const emptyRow = [];

for (let i = 0; i < 256; i++) {
	emptyRow[i] = 0;
}

for (let i = 0; i < 256; i++) {
	empty[i] = emptyRow;
}

export namespace TerrainRGB {
	/**
	 * height = -10000 + ((R * 256 * 256 + G * 256 + B) * 0.1)
	 * 
	 * @param r 
	 * @param g 
	 * @param b 
	 */
	export function terrainRGBToMeters(r: number, g: number, b: number): number {
		return -10000 + ((r * 256 ** 2 + g * 256 + b) * 0.1);
	}

	export function createTileMatrix(matrix: number[][][] | undefined): number[][] {
		return matrix ? matrix.map(r => r.map(([r, g, b]) => terrainRGBToMeters(r, g, b))) : empty;
	}

	export function reduceToNecessaryHeight(matrix: number[][]): number[][] {
		const min = matrix.reduce((a, c) => { c.forEach(v => a.push(v)); return a; }, [] as number[]).reduce((a, c) => c < a ? c : a, math.huge);
		const offset = math.floor(min / 2048);

		return matrix.map(r => r.map(c => c - offset * 2048));
	}

	export function createBlockTile(tile: number[][], min = 0) {
		tile.forEach((r, i) => r.forEach((h, j) => {
			const height = math.max(h, min);

			let offset = 0;
			const chunks = chunkNumber(height);

			for (let k = 0; k < chunks.size(); k++) {
				const c = chunks[k];

				const part = new Instance("Part");

				offset += c / 2;

				part.Position = new Vector3(4 * i, offset, 4 * j);
				part.Anchored = true;
				part.Size = new Vector3(4, c, 4);
				part.Parent = Workspace;

				offset += c / 2;
			}
		}));
	}
}