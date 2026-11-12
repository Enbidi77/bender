import type { SculptMeshBuffer } from './sculpt-mesh-buffer.js';

/**
 * Fast vertex-to-vertex and vertex-to-face adjacency map.
 * Essential for Laplacian smoothing and normal recomputation.
 */
export class MeshAdjacency {
  // Flat CSR (Compressed Sparse Row) representation for high performance and low GC overhead
  private neighborOffsets: Uint32Array = new Uint32Array(0);
  private neighborIndices: Uint32Array = new Uint32Array(0);
  private faceOffsets: Uint32Array = new Uint32Array(0);
  private faceIndices: Uint32Array = new Uint32Array(0);

  public build(buffer: SculptMeshBuffer): void {
    const vCount = buffer.vertexCount;
    const neighborSets: Set<number>[] = new Array(vCount);
    const faceLists: number[][] = new Array(vCount);

    for (let i = 0; i < vCount; i++) {
      neighborSets[i] = new Set<number>();
      faceLists[i] = [];
    }

    const indices = buffer.indices;
    const addEdge = (v1: number, v2: number) => {
      if (v1 < vCount && v2 < vCount && v1 !== v2) {
        neighborSets[v1].add(v2);
        neighborSets[v2].add(v1);
      }
    };

    if (indices) {
      const triCount = Math.floor(indices.length / 3);
      for (let t = 0; t < triCount; t++) {
        const iA = indices[t * 3];
        const iB = indices[t * 3 + 1];
        const iC = indices[t * 3 + 2];

        addEdge(iA, iB);
        addEdge(iB, iC);
        addEdge(iC, iA);

        if (iA < vCount) faceLists[iA].push(t);
        if (iB < vCount) faceLists[iB].push(t);
        if (iC < vCount) faceLists[iC].push(t);
      }
    } else {
      const triCount = Math.floor(vCount / 3);
      for (let t = 0; t < triCount; t++) {
        const iA = t * 3;
        const iB = t * 3 + 1;
        const iC = t * 3 + 2;

        addEdge(iA, iB);
        addEdge(iB, iC);
        addEdge(iC, iA);

        faceLists[iA].push(t);
        faceLists[iB].push(t);
        faceLists[iC].push(t);
      }
    }

    // Flatten neighbor lists into CSR arrays
    let totalNeighbors = 0;
    for (let i = 0; i < vCount; i++) {
      totalNeighbors += neighborSets[i].size;
    }

    this.neighborOffsets = new Uint32Array(vCount + 1);
    this.neighborIndices = new Uint32Array(totalNeighbors);

    let offset = 0;
    for (let i = 0; i < vCount; i++) {
      this.neighborOffsets[i] = offset;
      for (const n of neighborSets[i]) {
        this.neighborIndices[offset++] = n;
      }
    }
    this.neighborOffsets[vCount] = offset;

    // Flatten face lists into CSR arrays
    let totalFaces = 0;
    for (let i = 0; i < vCount; i++) {
      totalFaces += faceLists[i].length;
    }

    this.faceOffsets = new Uint32Array(vCount + 1);
    this.faceIndices = new Uint32Array(totalFaces);

    let fOffset = 0;
    for (let i = 0; i < vCount; i++) {
      this.faceOffsets[i] = fOffset;
      const list = faceLists[i];
      for (let k = 0; k < list.length; k++) {
        this.faceIndices[fOffset++] = list[k];
      }
    }
    this.faceOffsets[vCount] = fOffset;
  }

  /**
   * Returns array of 1-ring neighbor indices for a given vertex.
   */
  public getNeighbors(vertexIndex: number): number[] {
    if (vertexIndex >= this.neighborOffsets.length - 1) return [];
    const start = this.neighborOffsets[vertexIndex];
    const end = this.neighborOffsets[vertexIndex + 1];
    const result: number[] = new Array(end - start);
    for (let i = start; i < end; i++) {
      result[i - start] = this.neighborIndices[i];
    }
    return result;
  }

  /**
   * Returns the number of 1-ring neighbors for a given vertex.
   */
  public getNeighborCount(vertexIndex: number): number {
    if (vertexIndex >= this.neighborOffsets.length - 1) return 0;
    return this.neighborOffsets[vertexIndex + 1] - this.neighborOffsets[vertexIndex];
  }

  /**
   * Returns adjacent triangle face indices for a given vertex.
   */
  public getConnectedFaces(vertexIndex: number): number[] {
    if (vertexIndex >= this.faceOffsets.length - 1) return [];
    const start = this.faceOffsets[vertexIndex];
    const end = this.faceOffsets[vertexIndex + 1];
    const result: number[] = new Array(end - start);
    for (let i = start; i < end; i++) {
      result[i - start] = this.faceIndices[i];
    }
    return result;
  }
}
