function readUint8(data: number[], offset: number): [number, number] {
	return [data[offset], offset + 1];
}

function readUint16LE(data: number[], offset: number): [number, number] {
	return [data[offset] | (data[offset + 1] << 8), offset + 2];
}

function readUint32LE(data: number[], offset: number): [number, number] {
	return [
		data[offset] |
		(data[offset + 1] << 8) |
		(data[offset + 2] << 16) |
		(data[offset + 3] << 24),
		offset + 4
	];
}

function readFloat32LE(data: number[], offset: number): [number, number] {
	const b0 = data[offset];
	const b1 = data[offset + 1];
	const b2 = data[offset + 2];
	const b3 = data[offset + 3];
	offset += 4;

	const int = b0 | (b1 << 8) | (b2 << 16) | (b3 << 24);
	const sign = (int >> 31) === 0 ? 1 : -1;
	const exponent = (int >> 23) & 0xff;
	const fraction = int & 0x7fffff;

	let value: number;
	if (exponent === 255) {
		value = fraction === 0 ? sign * math.huge : 0 / 0;
	} else if (exponent === 0) {
		value = sign * math.pow(2, -126) * (fraction / math.pow(2, 23));
	} else {
		value = sign * math.pow(2, exponent - 127) * (1 + fraction / math.pow(2, 23));
	}

	return [value, offset];
}

function readString(data: number[], offset: number): [string, number] {
	const [len, o] = readUint8(data, offset);
	let str = "";
	for (let i = 0; i < len; i++) {
		str += string.char(data[o + i]);
	}
	return [str, o + len];
}

export function decodeMesh(data: number[]): any {
	let offset = 0;
	const [meshCount, mo] = readUint16LE(data, offset); offset = mo;

	const meshes = [];

	for (let m = 0; m < meshCount; m++) {
		const [name, nameOffset] = readString(data, offset); offset = nameOffset;
		const [primitiveCount, pc] = readUint8(data, offset); offset = pc;

		const primitives = [];

		for (let p = 0; p < primitiveCount; p++) {
			const readFloatArray = (): number[] => {
				const [count, co] = readUint32LE(data, offset); offset = co;
				const arr = new Array<number>(count);
				for (let i = 0; i < count; i++) {
					const [f, no] = readFloat32LE(data, offset); arr[i] = f; offset = no;
				}
				return arr;
			};

			const readUint32Array = (): number[] => {
				const [count, co] = readUint32LE(data, offset); offset = co;
				const arr = new Array<number>(count);
				for (let i = 0; i < count; i++) {
					const [n, no] = readUint32LE(data, offset); arr[i] = n; offset = no;
				}
				return arr;
			};

			const positions = readFloatArray();
			const normals = readFloatArray();
			const uvs = readFloatArray();
			const indices = readUint32Array();

			const [texture, tOff] = readString(data, offset); offset = tOff;

			const origin: number[] = [];
			for (let i = 0; i < 3; i++) {
				const [f, no] = readFloat32LE(data, offset); origin.push(f); offset = no;
			}

			primitives.push({ positions, normals, uvs, indices, texture, origin });
		}

		meshes.push({ name, primitives });
	}

	const [textureCount, tc] = readUint16LE(data, offset); offset = tc;
	const textures: Record<string, number[][][]> = {};

	for (let i = 0; i < textureCount; i++) {
		const [texId, tidOff] = readString(data, offset); offset = tidOff;
		const [w, wo] = readUint16LE(data, offset); offset = wo;
		const [h, ho] = readUint16LE(data, offset); offset = ho;

		const pixels: number[][][] = [];
		for (let y = 0; y < h; y++) {
			const row: number[][] = [];
			for (let x = 0; x < w; x++) {
				const r = data[offset++];
				const g = data[offset++];
				const b = data[offset++];
				row.push([r, g, b]);
			}
			pixels.push(row);
		}

		textures[texId] = pixels;
	}

	return { meshes, textures };
}
