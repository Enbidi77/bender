import type { VertexData, EdgeData, FaceData, Vector3 } from '@blender-elt/contracts';
import { buildAdjacency } from './adjacency.js';
import { reindexTopology } from './vertex-ops.js';

export interface EdgeOperationResult {
  vertices: VertexData[];
  edges: EdgeData[];
  faces: FaceData[];
  newVertexIndices: number[];
  newEdgeIndices: number[];
}

/**
 * Creates an edge between two vertices if one does not already exist
 */
export function createEdgeBetweenVertices(
  edges: EdgeData[],
  v1: number,
  v2: number,
): { edge: EdgeData; isNew: boolean } {
  if (v1 === v2) {
    throw new Error('Cannot create edge with identical vertices');
  }

  const minV = Math.min(v1, v2);
  const maxV = Math.max(v1, v2);

  const existing = edges.find((e) => e.v1 === minV && e.v2 === maxV);
  if (existing) {
    return { edge: existing, isNew: false };
  }

  const newEdge: EdgeData = {
    index: edges.length,
    v1: minV,
    v2: maxV,
    selected: true,
  };
  edges.push(newEdge);

  return { edge: newEdge, isNew: true };
}

/**
 * Subdivides specified edges, inserting new vertices and updating adjacent faces
 */
export function subdivideEdges(
  vertices: VertexData[],
  edges: EdgeData[],
  faces: FaceData[],
  edgeIndices: number[],
  cuts: number = 1,
): EdgeOperationResult {
  if (edgeIndices.length === 0 || cuts < 1) {
    return { vertices, edges, faces, newVertexIndices: [], newEdgeIndices: [] };
  }

  const edgeSet = new Set(edgeIndices);
  const newVertsList: VertexData[] = [];
  const edgeSplitMap = new Map<number, number[]>(); // edge index -> list of new vertex indices

  for (const eIdx of edgeSet) {
    const edge = edges[eIdx];
    if (!edge) continue;

    const pA = vertices[edge.v1].position;
    const pB = vertices[edge.v2].position;
    const uvA = vertices[edge.v1].uv;
    const uvB = vertices[edge.v2].uv;

    const splitVerts: number[] = [];
    for (let c = 1; c <= cuts; c++) {
      const t = c / (cuts + 1);
      const newIndex = vertices.length + newVertsList.length;

      const pos: Vector3 = {
        x: pA.x + (pB.x - pA.x) * t,
        y: pA.y + (pB.y - pA.y) * t,
        z: pA.z + (pB.z - pA.z) * t,
      };

      const uv: [number, number] | undefined =
        uvA && uvB ? [uvA[0] + (uvB[0] - uvA[0]) * t, uvA[1] + (uvB[1] - uvA[1]) * t] : undefined;

      const newVert: VertexData = {
        index: newIndex,
        position: pos,
        uv,
        selected: true,
      };
      newVertsList.push(newVert);
      splitVerts.push(newIndex);
    }

    edgeSplitMap.set(edge.index, splitVerts);
  }

  const combinedVertices = [...vertices, ...newVertsList];

  // Rebuild faces by expanding subdivided edges
  const newFaces: FaceData[] = [];

  for (const face of faces) {
    const vi = face.vertexIndices;
    const count = vi.length;
    const expandedVi: number[] = [];

    for (let i = 0; i < count; i++) {
      const vA = vi[i];
      const vB = vi[(i + 1) % count];
      expandedVi.push(vA);

      // Find if edge vA-vB was subdivided
      const minV = Math.min(vA, vB);
      const maxV = Math.max(vA, vB);
      const edge = edges.find((e) => e.v1 === minV && e.v2 === maxV);

      if (edge && edgeSplitMap.has(edge.index)) {
        const splitVerts = edgeSplitMap.get(edge.index)!;
        if (vA === edge.v1) {
          expandedVi.push(...splitVerts);
        } else {
          expandedVi.push(...[...splitVerts].reverse());
        }
      }
    }

    // If face now has > count vertices, triangulate into simple fan or keep polygon
    if (expandedVi.length === count) {
      newFaces.push({ ...face, index: newFaces.length });
    } else if (expandedVi.length === 4) {
      newFaces.push({
        index: newFaces.length,
        vertexIndices: expandedVi,
        selected: face.selected,
      });
    } else {
      // Fan triangulate
      for (let j = 1; j < expandedVi.length - 1; j++) {
        newFaces.push({
          index: newFaces.length,
          vertexIndices: [expandedVi[0], expandedVi[j], expandedVi[j + 1]],
          selected: face.selected,
        });
      }
    }
  }

  const reindexed = reindexTopology(combinedVertices, edges, newFaces);

  return {
    ...reindexed,
    newVertexIndices: newVertsList.map((v) => v.index),
    newEdgeIndices: [],
  };
}

/**
 * Finds edge loop starting from a given edge
 */
export function getEdgeLoop(
  edges: EdgeData[],
  faces: FaceData[],
  startEdgeIndex: number,
): number[] {
  const startEdge = edges[startEdgeIndex];
  if (!startEdge) return [];

  const adj = buildAdjacency([], edges, faces);
  const loopEdges = new Set<number>([startEdgeIndex]);

  const followLoop = (curEdgeIdx: number, direction: 1 | -1) => {
    let curr = curEdgeIdx;
    const visited = new Set<number>([curr]);

    while (true) {
      const incidentFaces = adj.edgeToFaces.get(curr) || [];
      if (incidentFaces.length !== 2) break; // Terminate at boundaries or non-manifold

      const fIdx = direction === 1 ? incidentFaces[0] : incidentFaces[1];
      const face = faces[fIdx];
      if (!face || face.vertexIndices.length !== 4) break; // Quad-only loop traversal

      // Find opposite edge in the quad
      const vi = face.vertexIndices;
      const curEdge = edges[curr];
      const v1 = curEdge.v1;
      const v2 = curEdge.v2;

      const idx1 = vi.indexOf(v1);
      const idx2 = vi.indexOf(v2);

      // In quad [0, 1, 2, 3], edge between (i, i+1) is opposite (i+2, i+3)
      const otherIndices = [0, 1, 2, 3].filter((i) => i !== idx1 && i !== idx2);
      if (otherIndices.length !== 2) break;

      const oA = vi[otherIndices[0]];
      const oB = vi[otherIndices[1]];
      const minO = Math.min(oA, oB);
      const maxO = Math.max(oA, oB);

      const oppEdge = edges.find((e) => e.v1 === minO && e.v2 === maxO);
      if (!oppEdge || visited.has(oppEdge.index) || loopEdges.has(oppEdge.index)) break;

      loopEdges.add(oppEdge.index);
      visited.add(oppEdge.index);
      curr = oppEdge.index;
    }
  };

  followLoop(startEdgeIndex, 1);
  followLoop(startEdgeIndex, -1);

  return Array.from(loopEdges);
}

/**
 * Finds edge ring (parallel edges across adjacent quad faces)
 */
export function getEdgeRing(
  edges: EdgeData[],
  faces: FaceData[],
  startEdgeIndex: number,
): number[] {
  const startEdge = edges[startEdgeIndex];
  if (!startEdge) return [];

  const adj = buildAdjacency([], edges, faces);
  const ringEdges = new Set<number>([startEdgeIndex]);

  const followRing = (curEdgeIdx: number, fromFaceIdx: number | null) => {
    let curr = curEdgeIdx;
    let prevFace = fromFaceIdx;

    while (true) {
      const incidentFaces = adj.edgeToFaces.get(curr) || [];
      const nextFaceIdx = incidentFaces.find((f) => f !== prevFace);
      if (nextFaceIdx === undefined) break;

      const face = faces[nextFaceIdx];
      if (!face || face.vertexIndices.length !== 4) break;

      // In a quad, the parallel edge across the face does not share any vertex with current edge
      const cEdge = edges[curr];
      const vi = face.vertexIndices;
      const nonSharingVerts = vi.filter((v) => v !== cEdge.v1 && v !== cEdge.v2);
      if (nonSharingVerts.length !== 2) break;

      const minV = Math.min(nonSharingVerts[0], nonSharingVerts[1]);
      const maxV = Math.max(nonSharingVerts[0], nonSharingVerts[1]);
      const oppEdge = edges.find((e) => e.v1 === minV && e.v2 === maxV);

      if (!oppEdge || ringEdges.has(oppEdge.index)) break;

      ringEdges.add(oppEdge.index);
      prevFace = nextFaceIdx;
      curr = oppEdge.index;
    }
  };

  const initialFaces = adj.edgeToFaces.get(startEdgeIndex) || [];
  if (initialFaces.length > 0) followRing(startEdgeIndex, null);
  if (initialFaces.length > 1) followRing(startEdgeIndex, initialFaces[0]);

  return Array.from(ringEdges);
}

/**
 * Dissolves selected edges, merging adjacent faces that share them
 */
export function dissolveEdges(
  vertices: VertexData[],
  edges: EdgeData[],
  faces: FaceData[],
  edgeIndices: number[],
): EdgeOperationResult {
  const dissolveSet = new Set(edgeIndices);
  const adj = buildAdjacency(vertices, edges, faces);

  const facesToRemove = new Set<number>();
  const facesToAdd: FaceData[] = [];

  for (const eIdx of dissolveSet) {
    const edge = edges[eIdx];
    if (!edge) continue;

    const incidentFaces = adj.edgeToFaces.get(eIdx) || [];
    if (incidentFaces.length === 2) {
      const f1Idx = incidentFaces[0];
      const f2Idx = incidentFaces[1];

      if (facesToRemove.has(f1Idx) || facesToRemove.has(f2Idx)) continue;

      const f1 = faces[f1Idx];
      const f2 = faces[f2Idx];
      if (!f1 || !f2) continue;

      // Merge boundary vertex loop of f1 and f2 removing shared edge (v1, v2)
      const v1 = edge.v1;
      const v2 = edge.v2;

      // Construct merged polygon
      const mergedVerts: number[] = [];
      const vi1 = f1.vertexIndices;
      const vi2 = f2.vertexIndices;

      // Rotate vi1 so it starts after v2
      const idx2In1 = vi1.indexOf(v2);
      for (let i = 0; i < vi1.length; i++) {
        const v = vi1[(idx2In1 + i) % vi1.length];
        if (v !== v1) mergedVerts.push(v);
      }

      // Add vi2 vertices
      const idx1In2 = vi2.indexOf(v1);
      for (let i = 0; i < vi2.length; i++) {
        const v = vi2[(idx1In2 + i) % vi2.length];
        if (v !== v2 && !mergedVerts.includes(v)) mergedVerts.push(v);
      }

      if (mergedVerts.length >= 3) {
        facesToRemove.add(f1Idx);
        facesToRemove.add(f2Idx);
        facesToAdd.push({
          index: faces.length + facesToAdd.length,
          vertexIndices: mergedVerts,
          selected: false,
        });
      }
    }
  }

  const remainingFaces = faces.filter((f) => !facesToRemove.has(f.index)).concat(facesToAdd);
  const remainingEdges = edges.filter((e) => !dissolveSet.has(e.index));

  const reindexed = reindexTopology(vertices, remainingEdges, remainingFaces);
  return {
    ...reindexed,
    newVertexIndices: [],
    newEdgeIndices: [],
  };
}

/**
 * Deletes edges with option to delete incident faces only or full edge deletion
 */
export function deleteEdges(
  vertices: VertexData[],
  edges: EdgeData[],
  faces: FaceData[],
  edgeIndices: number[],
  deleteFacesOnly: boolean = false,
): EdgeOperationResult {
  const edgeSet = new Set(edgeIndices);
  const adj = buildAdjacency(vertices, edges, faces);

  // Identify all faces incident to these edges
  const facesToDelete = new Set<number>();
  for (const eIdx of edgeSet) {
    const fList = adj.edgeToFaces.get(eIdx) || [];
    for (const f of fList) facesToDelete.add(f);
  }

  const remainingFaces = faces.filter((f) => !facesToDelete.has(f.index));
  const remainingEdges = deleteFacesOnly ? [...edges] : edges.filter((e) => !edgeSet.has(e.index));

  const reindexed = reindexTopology(vertices, remainingEdges, remainingFaces);
  return {
    ...reindexed,
    newVertexIndices: [],
    newEdgeIndices: [],
  };
}

/**
 * Slides selected edges along adjacent perpendicular edges
 */
export function slideEdge(
  vertices: VertexData[],
  edges: EdgeData[],
  _faces: FaceData[],
  edgeIndices: number[],
  factor: number,
): void {
  const clampedFactor = Math.max(-1, Math.min(1, factor));
  const adj = buildAdjacency(vertices, edges, []);

  for (const eIdx of edgeIndices) {
    const edge = edges[eIdx];
    if (!edge) continue;

    for (const vIdx of [edge.v1, edge.v2]) {
      const v = vertices[vIdx];
      if (!v) continue;

      const incidentEdges = (adj.vertexToEdges.get(vIdx) || []).filter((e) => e !== eIdx);
      if (incidentEdges.length > 0) {
        const guideEdge = edges[incidentEdges[0]];
        const targetVIdx = guideEdge.v1 === vIdx ? guideEdge.v2 : guideEdge.v1;
        const targetV = vertices[targetVIdx];
        if (targetV) {
          v.position.x += (targetV.position.x - v.position.x) * clampedFactor * 0.5;
          v.position.y += (targetV.position.y - v.position.y) * clampedFactor * 0.5;
          v.position.z += (targetV.position.z - v.position.z) * clampedFactor * 0.5;
        }
      }
    }
  }
}
