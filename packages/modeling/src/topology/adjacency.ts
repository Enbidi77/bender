import type { VertexData, EdgeData, FaceData, EditElementMode } from '@blender-elt/contracts';

/**
 * Adjacency structures for fast topological graph traversal
 */
export interface TopologyAdjacency {
  vertexToEdges: Map<number, number[]>;
  vertexToFaces: Map<number, number[]>;
  edgeToFaces: Map<number, number[]>;
  faceToEdges: Map<number, number[]>;
}

/**
 * Builds complete bidirectional adjacency maps from vertex, edge, and face arrays
 */
export function buildAdjacency(
  vertices: VertexData[],
  edges: EdgeData[],
  faces: FaceData[],
): TopologyAdjacency {
  const vertexToEdges = new Map<number, number[]>();
  const vertexToFaces = new Map<number, number[]>();
  const edgeToFaces = new Map<number, number[]>();
  const faceToEdges = new Map<number, number[]>();

  const getOrCreateVEdges = (v: number): number[] => {
    let list = vertexToEdges.get(v);
    if (!list) {
      list = [];
      vertexToEdges.set(v, list);
    }
    return list;
  };

  const getOrCreateVFaces = (v: number): number[] => {
    let list = vertexToFaces.get(v);
    if (!list) {
      list = [];
      vertexToFaces.set(v, list);
    }
    return list;
  };

  for (const v of vertices) {
    vertexToEdges.set(v.index, []);
    vertexToFaces.set(v.index, []);
  }

  const edgeLookup = new Map<string, number>();
  for (const e of edges) {
    edgeToFaces.set(e.index, []);
    getOrCreateVEdges(e.v1).push(e.index);
    getOrCreateVEdges(e.v2).push(e.index);
    const minV = Math.min(e.v1, e.v2);
    const maxV = Math.max(e.v1, e.v2);
    edgeLookup.set(`${minV}_${maxV}`, e.index);
  }

  for (const f of faces) {
    const fEdgeList: number[] = [];
    const vi = f.vertexIndices;
    const count = vi.length;

    for (let i = 0; i < count; i++) {
      const vIdx = vi[i];
      getOrCreateVFaces(vIdx).push(f.index);

      const nextIdx = vi[(i + 1) % count];
      const minV = Math.min(vIdx, nextIdx);
      const maxV = Math.max(vIdx, nextIdx);
      const key = `${minV}_${maxV}`;

      const eIdx = edgeLookup.get(key);
      if (eIdx !== undefined) {
        fEdgeList.push(eIdx);
        let efList = edgeToFaces.get(eIdx);
        if (!efList) {
          efList = [];
          edgeToFaces.set(eIdx, efList);
        }
        if (!efList.includes(f.index)) {
          efList.push(f.index);
        }
      }
    }

    faceToEdges.set(f.index, fEdgeList);
  }

  return {
    vertexToEdges,
    vertexToFaces,
    edgeToFaces,
    faceToEdges,
  };
}

/**
 * Returns all boundary edges (edges referenced by exactly 1 face)
 */
export function getBoundaryEdges(
  edges: EdgeData[],
  edgeToFaces: Map<number, number[]>,
): EdgeData[] {
  const result: EdgeData[] = [];
  for (const edge of edges) {
    const incidentFaces = edgeToFaces.get(edge.index);
    if (incidentFaces && incidentFaces.length === 1) {
      result.push(edge);
    }
  }
  return result;
}

/**
 * Returns all non-manifold edges (edges referenced by > 2 faces)
 */
export function getNonManifoldEdges(
  edges: EdgeData[],
  edgeToFaces: Map<number, number[]>,
): EdgeData[] {
  const result: EdgeData[] = [];
  for (const edge of edges) {
    const incidentFaces = edgeToFaces.get(edge.index);
    if (incidentFaces && incidentFaces.length > 2) {
      result.push(edge);
    }
  }
  return result;
}

/**
 * Finds ordered boundary loops (closed sequences of vertex indices) from boundary edges
 */
export function getBoundaryLoops(
  edges: EdgeData[],
  edgeToFaces: Map<number, number[]>,
  _vertices: VertexData[],
): number[][] {
  const boundaryEdges = getBoundaryEdges(edges, edgeToFaces);
  if (boundaryEdges.length === 0) return [];

  // Map each vertex to its incident boundary edges
  const vertToBndEdges = new Map<number, EdgeData[]>();
  for (const edge of boundaryEdges) {
    if (!vertToBndEdges.has(edge.v1)) vertToBndEdges.set(edge.v1, []);
    if (!vertToBndEdges.has(edge.v2)) vertToBndEdges.set(edge.v2, []);
    vertToBndEdges.get(edge.v1)!.push(edge);
    vertToBndEdges.get(edge.v2)!.push(edge);
  }

  const visitedEdges = new Set<number>();
  const loops: number[][] = [];

  for (const edge of boundaryEdges) {
    if (visitedEdges.has(edge.index)) continue;

    const loop: number[] = [edge.v1, edge.v2];
    visitedEdges.add(edge.index);

    let currentVert = edge.v2;
    const startVert = edge.v1;
    let closed = false;

    while (!closed) {
      const candidates = vertToBndEdges.get(currentVert) || [];
      const nextEdge = candidates.find((e) => !visitedEdges.has(e.index));

      if (!nextEdge) {
        break; // Open chain or terminal vertex
      }

      visitedEdges.add(nextEdge.index);
      const nextVert = nextEdge.v1 === currentVert ? nextEdge.v2 : nextEdge.v1;

      if (nextVert === startVert) {
        closed = true;
      } else {
        loop.push(nextVert);
        currentVert = nextVert;
      }
    }

    loops.push(loop);
  }

  return loops;
}

/**
 * Traverses connected vertices starting from startVertexIndex (flood fill)
 */
export function getConnectedVertices(
  startVertexIndex: number,
  vertexToEdges: Map<number, number[]>,
  edges: EdgeData[],
): number[] {
  const visited = new Set<number>();
  const queue: number[] = [startVertexIndex];
  visited.add(startVertexIndex);

  while (queue.length > 0) {
    const curr = queue.shift()!;
    const edgeIndices = vertexToEdges.get(curr) || [];
    for (const eIdx of edgeIndices) {
      const edge = edges[eIdx];
      if (!edge) continue;
      const neighbor = edge.v1 === curr ? edge.v2 : edge.v1;
      if (!visited.has(neighbor)) {
        visited.add(neighbor);
        queue.push(neighbor);
      }
    }
  }

  return Array.from(visited);
}

/**
 * Traverses connected faces sharing an edge starting from startFaceIndex (flood fill)
 */
export function getConnectedFaces(
  startFaceIndex: number,
  faceToEdges: Map<number, number[]>,
  edgeToFaces: Map<number, number[]>,
): number[] {
  const visited = new Set<number>();
  const queue: number[] = [startFaceIndex];
  visited.add(startFaceIndex);

  while (queue.length > 0) {
    const curr = queue.shift()!;
    const edgeIndices = faceToEdges.get(curr) || [];
    for (const eIdx of edgeIndices) {
      const adjacentFaces = edgeToFaces.get(eIdx) || [];
      for (const fIdx of adjacentFaces) {
        if (!visited.has(fIdx)) {
          visited.add(fIdx);
          queue.push(fIdx);
        }
      }
    }
  }

  return Array.from(visited);
}

/**
 * Selection conversion: Vertices -> Edges (edges where both endpoints are selected)
 */
export function verticesToEdges(vertexIndices: number[], edges: EdgeData[]): number[] {
  const vSet = new Set(vertexIndices);
  const result: number[] = [];
  for (const edge of edges) {
    if (vSet.has(edge.v1) && vSet.has(edge.v2)) {
      result.push(edge.index);
    }
  }
  return result;
}

/**
 * Selection conversion: Edges -> Faces (faces where all boundary edges are selected)
 */
export function edgesToFaces(edgeIndices: number[], faces: FaceData[]): number[] {
  const eSet = new Set(edgeIndices);
  const result: number[] = [];
  for (const face of faces) {
    if (face.edgeIndices && face.edgeIndices.length > 0) {
      if (face.edgeIndices.every((eIdx) => eSet.has(eIdx))) {
        result.push(face.index);
      }
    }
  }
  return result;
}

/**
 * Selection conversion: Faces -> Vertices (all vertices in selected faces)
 */
export function facesToVertices(faceIndices: number[], faces: FaceData[]): number[] {
  const vSet = new Set<number>();
  for (const fIdx of faceIndices) {
    const face = faces[fIdx];
    if (face) {
      for (const vi of face.vertexIndices) {
        vSet.add(vi);
      }
    }
  }
  return Array.from(vSet);
}

/**
 * Selection conversion: Faces -> Edges (all edges belonging to selected faces)
 */
export function facesToEdges(faceIndices: number[], faces: FaceData[]): number[] {
  const eSet = new Set<number>();
  for (const fIdx of faceIndices) {
    const face = faces[fIdx];
    if (face && face.edgeIndices) {
      for (const ei of face.edgeIndices) {
        eSet.add(ei);
      }
    }
  }
  return Array.from(eSet);
}

/**
 * Grows selection to 1-ring neighbors
 */
export function growSelection(
  mode: EditElementMode,
  indices: number[],
  adj: TopologyAdjacency,
  edges: EdgeData[],
  _faces: FaceData[],
): number[] {
  const result = new Set<number>(indices);

  if (mode === 'vertex') {
    for (const vIdx of indices) {
      const eIndices = adj.vertexToEdges.get(vIdx) || [];
      for (const eIdx of eIndices) {
        const edge = edges[eIdx];
        if (edge) {
          result.add(edge.v1);
          result.add(edge.v2);
        }
      }
    }
  } else if (mode === 'edge') {
    for (const eIdx of indices) {
      const edge = edges[eIdx];
      if (!edge) continue;
      const v1Edges = adj.vertexToEdges.get(edge.v1) || [];
      const v2Edges = adj.vertexToEdges.get(edge.v2) || [];
      for (const e of v1Edges) result.add(e);
      for (const e of v2Edges) result.add(e);
    }
  } else if (mode === 'face') {
    for (const fIdx of indices) {
      const eIndices = adj.faceToEdges.get(fIdx) || [];
      for (const eIdx of eIndices) {
        const adjFaces = adj.edgeToFaces.get(eIdx) || [];
        for (const af of adjFaces) result.add(af);
      }
    }
  }

  return Array.from(result);
}

/**
 * Shrinks selection by removing boundary elements of the selection
 */
export function shrinkSelection(
  mode: EditElementMode,
  indices: number[],
  adj: TopologyAdjacency,
  edges: EdgeData[],
  _faces: FaceData[],
): number[] {
  const currentSet = new Set(indices);
  const result: number[] = [];

  if (mode === 'vertex') {
    for (const vIdx of indices) {
      const eIndices = adj.vertexToEdges.get(vIdx) || [];
      let isFullySurrounded = true;
      for (const eIdx of eIndices) {
        const edge = edges[eIdx];
        if (edge) {
          const neighbor = edge.v1 === vIdx ? edge.v2 : edge.v1;
          if (!currentSet.has(neighbor)) {
            isFullySurrounded = false;
            break;
          }
        }
      }
      if (isFullySurrounded) {
        result.push(vIdx);
      }
    }
  } else if (mode === 'edge') {
    for (const eIdx of indices) {
      const edge = edges[eIdx];
      if (!edge) continue;
      const v1Edges = adj.vertexToEdges.get(edge.v1) || [];
      const v2Edges = adj.vertexToEdges.get(edge.v2) || [];
      const allNeighborsInSet =
        v1Edges.every((e) => currentSet.has(e)) && v2Edges.every((e) => currentSet.has(e));
      if (allNeighborsInSet) {
        result.push(eIdx);
      }
    }
  } else if (mode === 'face') {
    for (const fIdx of indices) {
      const eIndices = adj.faceToEdges.get(fIdx) || [];
      let allNeighborsInSet = true;
      for (const eIdx of eIndices) {
        const adjFaces = adj.edgeToFaces.get(eIdx) || [];
        if (!adjFaces.every((af) => currentSet.has(af))) {
          allNeighborsInSet = false;
          break;
        }
      }
      if (allNeighborsInSet) {
        result.push(fIdx);
      }
    }
  }

  return result;
}
