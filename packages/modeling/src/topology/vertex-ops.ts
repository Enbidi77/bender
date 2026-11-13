import type { VertexData, EdgeData, FaceData, Vector3 } from '@blender-elt/contracts';
import { computeFaceCentroid } from './geometry-calc.js';

/**
 * Result of a vertex topology mutation
 */
export interface VertexOperationResult {
  vertices: VertexData[];
  edges: EdgeData[];
  faces: FaceData[];
  affectedIndices: number[];
}

/**
 * Re-indexes vertices, edges, and faces to guarantee contiguous indices [0..N-1]
 */
export function reindexTopology(
  vertices: VertexData[],
  edges: EdgeData[],
  faces: FaceData[],
): { vertices: VertexData[]; edges: EdgeData[]; faces: FaceData[] } {
  // Map old vertex index -> new vertex index
  const vertIndexMap = new Map<number, number>();
  const newVertices: VertexData[] = [];

  for (let i = 0; i < vertices.length; i++) {
    const oldV = vertices[i];
    vertIndexMap.set(oldV.index, i);
    newVertices.push({
      ...oldV,
      index: i,
    });
  }

  // Update edges
  const newEdges: EdgeData[] = [];
  const edgeKeyMap = new Map<string, number>();

  for (const edge of edges) {
    const newV1 = vertIndexMap.get(edge.v1);
    const newV2 = vertIndexMap.get(edge.v2);
    if (newV1 !== undefined && newV2 !== undefined && newV1 !== newV2) {
      const minV = Math.min(newV1, newV2);
      const maxV = Math.max(newV1, newV2);
      const key = `${minV}_${maxV}`;
      if (!edgeKeyMap.has(key)) {
        const edgeIdx = newEdges.length;
        edgeKeyMap.set(key, edgeIdx);
        newEdges.push({
          index: edgeIdx,
          v1: minV,
          v2: maxV,
          selected: edge.selected,
        });
      }
    }
  }

  // Update faces
  const newFaces: FaceData[] = [];
  for (const face of faces) {
    const newVi: number[] = [];
    for (const oldVi of face.vertexIndices) {
      const remapped = vertIndexMap.get(oldVi);
      if (remapped !== undefined) {
        // avoid consecutive duplicates
        if (newVi.length === 0 || newVi[newVi.length - 1] !== remapped) {
          newVi.push(remapped);
        }
      }
    }
    // wrap-around duplicate check
    if (newVi.length > 1 && newVi[0] === newVi[newVi.length - 1]) {
      newVi.pop();
    }

    if (newVi.length >= 3) {
      const faceIdx = newFaces.length;
      // Rebuild face edge indices
      const faceEdges: number[] = [];
      const count = newVi.length;
      for (let j = 0; j < count; j++) {
        const a = newVi[j];
        const b = newVi[(j + 1) % count];
        const minV = Math.min(a, b);
        const maxV = Math.max(a, b);
        const key = `${minV}_${maxV}`;
        let edgeIdx = edgeKeyMap.get(key);
        if (edgeIdx === undefined) {
          edgeIdx = newEdges.length;
          edgeKeyMap.set(key, edgeIdx);
          newEdges.push({
            index: edgeIdx,
            v1: minV,
            v2: maxV,
            selected: false,
          });
        }
        faceEdges.push(edgeIdx);
      }

      newFaces.push({
        index: faceIdx,
        vertexIndices: newVi,
        edgeIndices: faceEdges,
        normal: face.normal ? { ...face.normal } : undefined,
        selected: face.selected,
      });
    }
  }

  return {
    vertices: newVertices,
    edges: newEdges,
    faces: newFaces,
  };
}

/**
 * Merges selected vertices at their geometric centroid
 */
export function mergeVerticesAtCenter(
  vertices: VertexData[],
  edges: EdgeData[],
  faces: FaceData[],
  vertexIndices: number[],
): VertexOperationResult {
  if (vertexIndices.length <= 1) {
    return { vertices, edges, faces, affectedIndices: vertexIndices };
  }

  const selectedSet = new Set(vertexIndices);
  const targetIndex = Math.min(...vertexIndices);
  const centroid = computeFaceCentroid(vertexIndices, vertices);

  // Remap all merged vertices to targetIndex
  const vertRemap = new Map<number, number>();
  for (const idx of vertexIndices) {
    vertRemap.set(idx, targetIndex);
  }

  // Update target vertex position
  const updatedVertices = vertices
    .filter((v) => !selectedSet.has(v.index) || v.index === targetIndex)
    .map((v) => {
      if (v.index === targetIndex) {
        return {
          ...v,
          position: centroid,
          selected: true,
        };
      }
      return { ...v };
    });

  // Remap vertices in faces
  const updatedFaces: FaceData[] = [];
  for (const face of faces) {
    const remappedVi = face.vertexIndices.map((vi) => vertRemap.get(vi) ?? vi);
    // Deduplicate consecutive identical vertices
    const cleanVi: number[] = [];
    for (const v of remappedVi) {
      if (cleanVi.length === 0 || cleanVi[cleanVi.length - 1] !== v) {
        cleanVi.push(v);
      }
    }
    if (cleanVi.length > 1 && cleanVi[0] === cleanVi[cleanVi.length - 1]) {
      cleanVi.pop();
    }

    if (cleanVi.length >= 3) {
      updatedFaces.push({
        ...face,
        vertexIndices: cleanVi,
      });
    }
  }

  // Remap edges
  const updatedEdges: EdgeData[] = [];
  for (const edge of edges) {
    const v1 = vertRemap.get(edge.v1) ?? edge.v1;
    const v2 = vertRemap.get(edge.v2) ?? edge.v2;
    if (v1 !== v2) {
      updatedEdges.push({
        ...edge,
        v1,
        v2,
      });
    }
  }

  const reindexed = reindexTopology(updatedVertices, updatedEdges, updatedFaces);
  return {
    ...reindexed,
    affectedIndices: [targetIndex],
  };
}

/**
 * Merges vertices that are within a distance threshold using a 3D spatial hash grid
 */
export function mergeVerticesByDistance(
  vertices: VertexData[],
  edges: EdgeData[],
  faces: FaceData[],
  distanceThreshold: number,
  candidateIndices?: number[],
): VertexOperationResult {
  if (distanceThreshold <= 0 || vertices.length <= 1) {
    return { vertices, edges, faces, affectedIndices: [] };
  }

  const cellSize = distanceThreshold;
  const targetIndices = new Set(
    candidateIndices !== undefined && candidateIndices.length > 0
      ? candidateIndices
      : vertices.map((v) => v.index),
  );

  const getCellKey = (pos: Vector3): string => {
    const cx = Math.floor(pos.x / cellSize);
    const cy = Math.floor(pos.y / cellSize);
    const cz = Math.floor(pos.z / cellSize);
    return `${cx}_${cy}_${cz}`;
  };

  const grid = new Map<string, number[]>();
  for (const v of vertices) {
    if (!targetIndices.has(v.index)) continue;
    const key = getCellKey(v.position);
    let cell = grid.get(key);
    if (!cell) {
      cell = [];
      grid.set(key, cell);
    }
    cell.push(v.index);
  }

  // Union-Find / Disjoint Set to group nearby vertices
  const parent = new Map<number, number>();
  for (const v of vertices) {
    parent.set(v.index, v.index);
  }

  const find = (i: number): number => {
    let root = i;
    while (root !== parent.get(root)!) {
      root = parent.get(root)!;
    }
    let curr = i;
    while (curr !== root) {
      const next = parent.get(curr)!;
      parent.set(curr, root);
      curr = next;
    }
    return root;
  };

  const union = (i: number, j: number) => {
    const rootI = find(i);
    const rootJ = find(j);
    if (rootI !== rootJ) {
      if (rootI < rootJ) {
        parent.set(rootJ, rootI);
      } else {
        parent.set(rootI, rootJ);
      }
    }
  };

  // Check each candidate against neighboring 27 grid cells
  const distSqThreshold = distanceThreshold * distanceThreshold;
  for (const v of vertices) {
    if (!targetIndices.has(v.index)) continue;
    const cx = Math.floor(v.position.x / cellSize);
    const cy = Math.floor(v.position.y / cellSize);
    const cz = Math.floor(v.position.z / cellSize);

    for (let dx = -1; dx <= 1; dx++) {
      for (let dy = -1; dy <= 1; dy++) {
        for (let dz = -1; dz <= 1; dz++) {
          const neighborKey = `${cx + dx}_${cy + dy}_${cz + dz}`;
          const neighbors = grid.get(neighborKey);
          if (!neighbors) continue;
          for (const nIdx of neighbors) {
            if (nIdx > v.index) {
              const nV = vertices[nIdx];
              const distSq =
                (v.position.x - nV.position.x) ** 2 +
                (v.position.y - nV.position.y) ** 2 +
                (v.position.z - nV.position.z) ** 2;
              if (distSq <= distSqThreshold) {
                union(v.index, nIdx);
              }
            }
          }
        }
      }
    }
  }

  // Group vertices into clusters
  const clusters = new Map<number, number[]>();
  for (const v of vertices) {
    const root = find(v.index);
    let cl = clusters.get(root);
    if (!cl) {
      cl = [];
      clusters.set(root, cl);
    }
    cl.push(v.index);
  }

  const vertRemap = new Map<number, number>();
  const updatedVerticesMap = new Map<number, VertexData>();

  for (const [root, members] of clusters.entries()) {
    if (members.length > 1) {
      const centroid = computeFaceCentroid(members, vertices);
      const rootVert = vertices[root];
      updatedVerticesMap.set(root, {
        ...rootVert,
        position: centroid,
      });
      for (const m of members) {
        vertRemap.set(m, root);
      }
    } else {
      updatedVerticesMap.set(root, { ...vertices[root] });
    }
  }

  const updatedVertices = Array.from(updatedVerticesMap.values());

  // Remap faces
  const updatedFaces: FaceData[] = [];
  for (const face of faces) {
    const remappedVi = face.vertexIndices.map((vi) => vertRemap.get(vi) ?? vi);
    const cleanVi: number[] = [];
    for (const v of remappedVi) {
      if (cleanVi.length === 0 || cleanVi[cleanVi.length - 1] !== v) {
        cleanVi.push(v);
      }
    }
    if (cleanVi.length > 1 && cleanVi[0] === cleanVi[cleanVi.length - 1]) {
      cleanVi.pop();
    }
    if (cleanVi.length >= 3) {
      updatedFaces.push({ ...face, vertexIndices: cleanVi });
    }
  }

  // Remap edges
  const updatedEdges: EdgeData[] = [];
  for (const edge of edges) {
    const v1 = vertRemap.get(edge.v1) ?? edge.v1;
    const v2 = vertRemap.get(edge.v2) ?? edge.v2;
    if (v1 !== v2) {
      updatedEdges.push({ ...edge, v1, v2 });
    }
  }

  const reindexed = reindexTopology(updatedVertices, updatedEdges, updatedFaces);
  return {
    ...reindexed,
    affectedIndices: Array.from(clusters.keys()),
  };
}

/**
 * Laplacian smoothing on selected vertices
 */
export function smoothVertices(
  vertices: VertexData[],
  edges: EdgeData[],
  vertexIndices: number[],
  factor: number = 0.5,
  iterations: number = 1,
): VertexData[] {
  const targetSet = new Set(
    vertexIndices.length > 0 ? vertexIndices : vertices.map((v) => v.index),
  );

  // Build neighbor graph
  const neighbors = new Map<number, Set<number>>();
  for (const e of edges) {
    if (!neighbors.has(e.v1)) neighbors.set(e.v1, new Set());
    if (!neighbors.has(e.v2)) neighbors.set(e.v2, new Set());
    neighbors.get(e.v1)!.add(e.v2);
    neighbors.get(e.v2)!.add(e.v1);
  }

  const resultVertices = vertices.map((v) => ({
    ...v,
    position: { ...v.position },
    normal: v.normal ? { ...v.normal } : undefined,
  }));

  for (let iter = 0; iter < iterations; iter++) {
    const nextPositions = new Map<number, Vector3>();

    for (const vIdx of targetSet) {
      const nSet = neighbors.get(vIdx);
      if (!nSet || nSet.size === 0) continue;

      let avgX = 0;
      let avgY = 0;
      let avgZ = 0;
      for (const n of nSet) {
        avgX += resultVertices[n].position.x;
        avgY += resultVertices[n].position.y;
        avgZ += resultVertices[n].position.z;
      }
      avgX /= nSet.size;
      avgY /= nSet.size;
      avgZ /= nSet.size;

      const curPos = resultVertices[vIdx].position;
      nextPositions.set(vIdx, {
        x: curPos.x + (avgX - curPos.x) * factor,
        y: curPos.y + (avgY - curPos.y) * factor,
        z: curPos.z + (avgZ - curPos.z) * factor,
      });
    }

    for (const [vIdx, pos] of nextPositions.entries()) {
      resultVertices[vIdx].position = pos;
      if (vertices[vIdx]) {
        vertices[vIdx].position.x = pos.x;
        vertices[vIdx].position.y = pos.y;
        vertices[vIdx].position.z = pos.z;
      }
    }
  }

  return resultVertices;
}

/**
 * Deletes vertices along with all connected edges and incident faces
 */
export function deleteVertices(
  vertices: VertexData[],
  edges: EdgeData[],
  faces: FaceData[],
  vertexIndices: number[],
): VertexOperationResult {
  const deleteSet = new Set(vertexIndices);

  const remainingVertices = vertices.filter((v) => !deleteSet.has(v.index));
  const remainingEdges = edges.filter((e) => !deleteSet.has(e.v1) && !deleteSet.has(e.v2));
  const remainingFaces = faces.filter((f) => f.vertexIndices.every((vi) => !deleteSet.has(vi)));

  return {
    ...reindexTopology(remainingVertices, remainingEdges, remainingFaces),
    affectedIndices: [],
  };
}

/**
 * Dissolves selected vertices by merging surrounding faces into a single n-gon or triangulating the cavity
 */
export function dissolveVertices(
  vertices: VertexData[],
  edges: EdgeData[],
  faces: FaceData[],
  vertexIndices: number[],
): VertexOperationResult {
  const dissolveSet = new Set(vertexIndices);

  // Find all faces incident to dissolved vertices
  const incidentFaceIndices = new Set<number>();
  for (const f of faces) {
    if (f.vertexIndices.some((vi) => dissolveSet.has(vi))) {
      incidentFaceIndices.add(f.index);
    }
  }

  if (incidentFaceIndices.size === 0) {
    return deleteVertices(vertices, edges, faces, vertexIndices);
  }

  // Collect perimeter boundary of the cavity created by removed faces
  const edgeCountMap = new Map<string, { v1: number; v2: number; count: number }>();
  for (const fIdx of incidentFaceIndices) {
    const f = faces[fIdx];
    const vi = f.vertexIndices;
    const count = vi.length;
    for (let i = 0; i < count; i++) {
      const a = vi[i];
      const b = vi[(i + 1) % count];
      const minV = Math.min(a, b);
      const maxV = Math.max(a, b);
      const key = `${minV}_${maxV}`;
      const entry = edgeCountMap.get(key) || { v1: a, v2: b, count: 0 };
      entry.count++;
      edgeCountMap.set(key, entry);
    }
  }

  // Outer boundary edges are those with count === 1 and neither endpoint is dissolved
  const outerEdges: { v1: number; v2: number }[] = [];
  for (const entry of edgeCountMap.values()) {
    if (entry.count === 1 && !dissolveSet.has(entry.v1) && !dissolveSet.has(entry.v2)) {
      outerEdges.push({ v1: entry.v1, v2: entry.v2 });
    }
  }

  // Form a closed polygon from outer edges
  const remainingFaces = faces.filter((f) => !incidentFaceIndices.has(f.index));

  if (outerEdges.length >= 3) {
    const nextMap = new Map<number, number>();
    for (const e of outerEdges) {
      nextMap.set(e.v1, e.v2);
    }

    const polygon: number[] = [outerEdges[0].v1];
    let curr = outerEdges[0].v2;
    const start = outerEdges[0].v1;
    let guard = 0;

    while (curr !== start && guard++ < outerEdges.length + 10) {
      polygon.push(curr);
      const next = nextMap.get(curr);
      if (next === undefined) break;
      curr = next;
    }

    if (polygon.length >= 3) {
      // Add the merged polygon face (triangulated if needed)
      remainingFaces.push({
        index: remainingFaces.length,
        vertexIndices: polygon,
        selected: false,
      });
    }
  }

  const remainingVertices = vertices.filter((v) => !dissolveSet.has(v.index));
  const remainingEdges = edges.filter((e) => !dissolveSet.has(e.v1) && !dissolveSet.has(e.v2));

  return {
    ...reindexTopology(remainingVertices, remainingEdges, remainingFaces),
    affectedIndices: [],
  };
}

/**
 * Slides a vertex along an incident edge by a given relative factor [0..1]
 */
export function slideVertex(
  vertices: VertexData[],
  vertexIndex: number,
  targetEdge: EdgeData,
  factor: number,
): void {
  const v = vertices[vertexIndex];
  if (!v) return;

  const otherIndex = targetEdge.v1 === vertexIndex ? targetEdge.v2 : targetEdge.v1;
  const otherV = vertices[otherIndex];
  if (!otherV) return;

  const clampedFactor = Math.max(0, Math.min(1, factor));
  v.position.x += (otherV.position.x - v.position.x) * clampedFactor;
  v.position.y += (otherV.position.y - v.position.y) * clampedFactor;
  v.position.z += (otherV.position.z - v.position.z) * clampedFactor;
}
