type BaseChunk = {
	path: string
}

export type ChildfulChunk = BaseChunk & {
	children: Chunk[]
}

export type MeshfulChunk = {
	mesh: string
}

export type MeshChunk = ChildfulChunk & MeshfulChunk & {
	type: "mesh"
};

export type LinkedChunk = BaseChunk & MeshfulChunk & {
	chunk: string,
	type: "link"
}

export type LeafChunk = BaseChunk & MeshfulChunk & {
	type: "leaf"
};

export type RootChunk = ChildfulChunk & {
	type: "root"
};

export type Chunk = RootChunk | MeshChunk | LinkedChunk | LeafChunk;
export type Tree = {
	root: Chunk
}