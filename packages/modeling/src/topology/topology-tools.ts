import type { VertexData, EdgeData, FaceData } from '@blender-elt/contracts';
import { buildAdjacency } from './adjacency.js';
import { reindexTopology } from './vertex-ops.js';

export interface TopologyToolResult {
  vertices: VertexData[];
  edges: EdgeData[];
  faces: FaceData[];
  newVertexIndices: number[];
  newEdgeIndices: number[];
  newFaceIndices: number[];
}

/**
 * Performs a loop cut across a sequence of quad faces
 */
export function loopCut(
  vertices: VertexData[],
  edges: EdgeData[],
  faces: FaceData[],
  startEdgeIndex: number,
  factor: number = 0.5,
  cuts: number = 1,
): TopologyToolResult {
  const startEdge = edges[startEdgeIndex];
  if (!startEdge) {
    return {
      vertices,
      edges,
      faces,
      newVertexIndices: [],
      newEdgeIndices: [],
      newFaceIndices: [],
    };
  }

  const clampedFactor = Math.max(0.01, Math.min(0.99, factor));
  const adj = buildAdjacency(vertices, edges, faces);

  // Traverse quad loop across opposite edges
  interface RingStep {
    faceIndex: number;
    edgeIn: number;
    edgeOut: number;
    v0: number; // endpoint on edgeIn
    v1: number; // other endpoint on edgeIn
    v2: number; // endpoint on edgeOut
    v3: number; // other endpoint on edgeOut
  }

  const ringSteps: RingStep[] = [];
  const visitedFaces = new Set<number>();
  const visitedEdges = new Set<number>([startEdgeIndex]);

  const traverse = (initialEdge: number, startFaceIdx: number) => {
    let curEdge = initialEdge;
    let curFace = startFaceIdx;

    while (true) {
      if (visitedFaces.has(curFace)) break;
      const face = faces[curFace];
      if (!face || face.vertexIndices.length !== 4) break;

      visitedFaces.add(curFace);

      const vi = face.vertexIndices;
      const e = edges[curEdge];
      const i0 = vi.indexOf(e.v1);
      const i1 = vi.indexOf(e.v2);

      // In quad [0, 1, 2, 3], if edge is (0,1), opposite edge is (2,3)
      const otherIndices = [0, 1, 2, 3].filter((i) => i !== i0 && i !== i1);
      if (otherIndices.length !== 2) break;

      const oA = vi[otherIndices[0]];
      const oB = vi[otherIndices[1]];
      const minO = Math.min(oA, oB);
      const maxO = Math.max(oA, oB);

      const oppEdge = edges.find((ed) => ed.v1 === minO && ed.v2 === maxO);
      if (!oppEdge) break;

      ringSteps.push({
        faceIndex: curFace,
        edgeIn: curEdge,
        edgeOut: oppEdge.index,
        v0: e.v1,
        v1: e.v2,
        v2: oppEdge.v1,
        v3: oppEdge.v2,
      });

      visitedEdges.add(oppEdge.index);

      // Next face across oppEdge
      const incident = adj.edgeToFaces.get(oppEdge.index) || [];
      const nextFace = incident.find((f) => f !== curFace);
      if (nextFace === undefined) break;

      curEdge = oppEdge.index;
      curFace = nextFace;
    }
  };

  const initialFaces = adj.edgeToFaces.get(startEdgeIndex) || [];
  if (initialFaces.length > 0) {
    traverse(startEdgeIndex, initialFaces[0]);
  }
  if (initialFaces.length > 1 && !visitedFaces.has(initialFaces[1])) {
    traverse(startEdgeIndex, initialFaces[1]);
  }

  if (ringSteps.length === 0) {
    return {
      vertices,
      edges,
      faces,
      newVertexIndices: [],
      newEdgeIndices: [],
      newFaceIndices: [],
    };
  }

  // Insert cut vertices along traversed edges
  const edgeToCutVerts = new Map<number, number[]>();
  const newVertsList: VertexData[] = [];

  const getOrAddEdgeCuts = (edgeIdx: number): number[] => {
    let existing = edgeToCutVerts.get(edgeIdx);
    if (existing) return existing;

    const edge = edges[edgeIdx];
    const pA = vertices[edge.v1].position;
    const pB = vertices[edge.v2].position;
    const cutsList: number[] = [];

    for (let c = 1; c <= cuts; c++) {
      const t = cuts === 1 ? clampedFactor : c / (cuts + 1);
      const newIdx = vertices.length + newVertsList.length;

      newVertsList.push({
        index: newIdx,
        position: {
          x: pA.x + (pB.x - pA.x) * t,
          y: pA.y + (pB.y - pA.y) * t,
          z: pA.z + (pB.z - pA.z) * t,
        },
        selected: true,
      });
      cutsList.push(newIdx);
    }

    edgeToCutVerts.set(edgeIdx, cutsList);
    return cutsList;
  };

  const facesToReplace = new Set<number>(ringSteps.map((s) => s.faceIndex));
  const newFacesList: FaceData[] = [];

  for (const step of ringSteps) {
    const face = faces[step.faceIndex];
    const vi = face.vertexIndices;

    const cutsIn = getOrAddEdgeCuts(step.edgeIn);
    const cutsOut = getOrAddEdgeCuts(step.edgeOut);

    // Split quad [v0, v1, v2, v3] into two quads across the cuts
    const midIn = cutsIn[0];
    const midOut = cutsOut[0];

    // Find cyclic order in face
    const idx0 = vi.indexOf(step.v0);
    const idx1 = vi.indexOf(step.v1);
    const vInFirst = (idx0 + 1) % 4 === idx1 ? step.v0 : step.v1;
    const vInSecond = vInFirst === step.v0 ? step.v1 : step.v0;

    // Remaining two vertices
    const rem = vi.filter((v) => v !== vInFirst && v !== vInSecond);
    const vOutFirst = rem[0];
    const vOutSecond = rem[1];

    // Two quads (triangulated if desired or kept as quads)
    newFacesList.push(
      {
        index: faces.length + newFacesList.length,
        vertexIndices: [vInFirst, midIn, midOut, vOutSecond],
        selected: true,
      },
      {
        index: faces.length + newFacesList.length + 1,
        vertexIndices: [midIn, vInSecond, vOutFirst, midOut],
        selected: true,
      },
    );
  }

  const remainingFaces = faces.filter((f) => !facesToReplace.has(f.index)).concat(newFacesList);

  const combinedVertices = [...vertices, ...newVertsList];
  const reindexed = reindexTopology(combinedVertices, edges, remainingFaces);

  return {
    ...reindexed,
    newVertexIndices: newVertsList.map((v) => v.index),
    newEdgeIndices: [],
    newFaceIndices: newFacesList.map((f) => f.index),
  };
}

/**
 * Splits an edge by inserting a vertex at factor t [0..1]
 */
export function knifeSplitEdge(
  vertices: VertexData[],
  edges: EdgeData[],
  faces: FaceData[],
  edgeIndex: number,
  factor: number = 0.5,
): TopologyToolResult {
  const edge = edges[edgeIndex];
  if (!edge) {
    return {
      vertices,
      edges,
      faces,
      newVertexIndices: [],
      newEdgeIndices: [],
      newFaceIndices: [],
    };
  }

  const clampedFactor = Math.max(0.01, Math.min(0.99, factor));
  const pA = vertices[edge.v1].position;
  const pB = vertices[edge.v2].position;

  const newVertIdx = vertices.length;
  const newVert: VertexData = {
    index: newVertIdx,
    position: {
      x: pA.x + (pB.x - pA.x) * clampedFactor,
      y: pA.y + (pB.y - pA.y) * clampedFactor,
      z: pA.z + (pB.z - pA.z) * clampedFactor,
    },
    selected: true,
  };

  const updatedVertices = [...vertices, newVert];

  // Insert new vertex into all incident faces
  const updatedFaces: FaceData[] = [];
  for (const face of faces) {
    const vi = face.vertexIndices;
    const count = vi.length;
    let inserted = false;
    const newVi: number[] = [];

    for (let i = 0; i < count; i++) {
      const a = vi[i];
      const b = vi[(i + 1) % count];
      newVi.push(a);

      if ((a === edge.v1 && b === edge.v2) || (a === edge.v2 && b === edge.v1)) {
        newVi.push(newVertIdx);
        inserted = true;
      }
    }

    if (inserted) {
      updatedFaces.push({ ...face, vertexIndices: newVi });
    } else {
      updatedFaces.push({ ...face });
    }
  }

  const reindexed = reindexTopology(updatedVertices, edges, updatedFaces);
  return {
    ...reindexed,
    newVertexIndices: [newVertIdx],
    newEdgeIndices: [],
    newFaceIndices: [],
  };
}

/**
 * Splits a face along two non-adjacent vertices
 */
export function knifeSplitFace(
  vertices: VertexData[],
  edges: EdgeData[],
  faces: FaceData[],
  faceIndex: number,
  v1: number,
  v2: number,
): TopologyToolResult {
  const face = faces[faceIndex];
  if (!face) {
    return {
      vertices,
      edges,
      faces,
      newVertexIndices: [],
      newEdgeIndices: [],
      newFaceIndices: [],
    };
  }

  const vi = face.vertexIndices;
  const idx1 = vi.indexOf(v1);
  const idx2 = vi.indexOf(v2);

  if (idx1 === -1 || idx2 === -1 || idx1 === idx2) {
    return {
      vertices,
      edges,
      faces,
      newVertexIndices: [],
      newEdgeIndices: [],
      newFaceIndices: [],
    };
  }

  // Check if vertices are non-adjacent
  const count = vi.length;
  if ((idx1 + 1) % count === idx2 || (idx2 + 1) % count === idx1) {
    return {
      vertices,
      edges,
      faces,
      newVertexIndices: [],
      newEdgeIndices: [],
      newFaceIndices: [],
    };
  }

  // Split polygon into two cycles
  const first = Math.min(idx1, idx2);
  const second = Math.max(idx1, idx2);

  const poly1: number[] = [];
  for (let i = first; i <= second; i++) {
    poly1.push(vi[i]);
  }

  const poly2: number[] = [];
  for (let i = second; i < count; i++) {
    poly2.push(vi[i]);
  }
  for (let i = 0; i <= first; i++) {
    poly2.push(vi[i]);
  }

  const newFaces: FaceData[] = faces
    .filter((f) => f.index !== faceIndex)
    .concat([
      { index: faces.length, vertexIndices: poly1, selected: true },
      { index: faces.length + 1, vertexIndices: poly2, selected: true },
    ]);

  const reindexed = reindexTopology(vertices, edges, newFaces);
  return {
    ...reindexed,
    newVertexIndices: [],
    newEdgeIndices: [],
    newFaceIndices: [newFaces.length - 2, newFaces.length - 1],
  };
}
