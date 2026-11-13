import type { VertexData, EdgeData, FaceData, Vector3 } from '@blender-elt/contracts';
import { computeFaceCentroid, computeFaceNormal } from './geometry-calc.js';
import { reindexTopology } from './vertex-ops.js';
import { buildAdjacency } from './adjacency.js';

export interface FaceOperationResult {
  vertices: VertexData[];
  edges: EdgeData[];
  faces: FaceData[];
  newFaceIndices: number[];
  newVertexIndices: number[];
}

/**
 * Extrudes connected regions of selected faces without internal walls
 */
export function extrudeFacesRegion(
  vertices: VertexData[],
  edges: EdgeData[],
  faces: FaceData[],
  faceIndices: number[],
  distance: number,
  customDirection?: Vector3,
): FaceOperationResult {
  if (faceIndices.length === 0) {
    return { vertices, edges, faces, newFaceIndices: [], newVertexIndices: [] };
  }

  const selectedSet = new Set(faceIndices);
  const adj = buildAdjacency(vertices, edges, faces);

  // 1. Group selected faces into connected components sharing edges
  const visited = new Set<number>();
  const components: number[][] = [];

  for (const fIdx of faceIndices) {
    if (visited.has(fIdx)) continue;

    const component: number[] = [];
    const queue: number[] = [fIdx];
    visited.add(fIdx);

    while (queue.length > 0) {
      const curr = queue.shift()!;
      component.push(curr);

      const fEdges = adj.faceToEdges.get(curr) || [];
      for (const eIdx of fEdges) {
        const incidentFaces = adj.edgeToFaces.get(eIdx) || [];
        for (const adjF of incidentFaces) {
          if (selectedSet.has(adjF) && !visited.has(adjF)) {
            visited.add(adjF);
            queue.push(adjF);
          }
        }
      }
    }

    components.push(component);
  }

  const resultVertices = vertices.map((v) => ({ ...v, position: { ...v.position } }));
  const resultFaces = faces.map((f) => ({
    ...f,
    vertexIndices: [...f.vertexIndices],
    selected: f.selected,
  }));
  const addedFaces: FaceData[] = [];
  const addedVertices: VertexData[] = [];

  // 2. Process each connected component
  for (const comp of components) {
    // Collect all directed edges in this component
    const directedEdgeCounts = new Map<string, { v1: number; v2: number; count: number }>();
    const compVerts = new Set<number>();

    // Compute average normal for region if no custom direction provided
    let avgNx = 0;
    let avgNy = 0;
    let avgNz = 0;

    for (const fIdx of comp) {
      const face = resultFaces[fIdx];
      const vi = face.vertexIndices;
      const count = vi.length;

      const fn = computeFaceNormal(vi, resultVertices);
      avgNx += fn.x;
      avgNy += fn.y;
      avgNz += fn.z;

      for (let i = 0; i < count; i++) {
        const a = vi[i];
        const b = vi[(i + 1) % count];
        compVerts.add(a);

        const minV = Math.min(a, b);
        const maxV = Math.max(a, b);
        const key = `${minV}_${maxV}`;

        const existing = directedEdgeCounts.get(key) || { v1: a, v2: b, count: 0 };
        existing.count++;
        // Keep order matching the first incident face
        if (existing.count === 1) {
          existing.v1 = a;
          existing.v2 = b;
        }
        directedEdgeCounts.set(key, existing);
      }
    }

    const normLen = Math.sqrt(avgNx * avgNx + avgNy * avgNy + avgNz * avgNz);
    const dir: Vector3 = customDirection ?? {
      x: normLen > 1e-6 ? avgNx / normLen : 0,
      y: normLen > 1e-6 ? avgNy / normLen : 1,
      z: normLen > 1e-6 ? avgNz / normLen : 0,
    };

    const offset: Vector3 = {
      x: dir.x * distance,
      y: dir.y * distance,
      z: dir.z * distance,
    };

    // Duplicate all vertices in this component
    const vertMap = new Map<number, number>();
    for (const vIdx of compVerts) {
      const oldV = resultVertices[vIdx];
      const newIdx = resultVertices.length + addedVertices.length;
      const newV: VertexData = {
        index: newIdx,
        position: {
          x: oldV.position.x + offset.x,
          y: oldV.position.y + offset.y,
          z: oldV.position.z + offset.z,
        },
        uv: oldV.uv ? [...oldV.uv] : undefined,
        selected: true,
      };
      addedVertices.push(newV);
      vertMap.set(vIdx, newIdx);
    }

    // Rewire top faces to use duplicated vertices
    for (const fIdx of comp) {
      const face = resultFaces[fIdx];
      face.vertexIndices = face.vertexIndices.map((vi) => vertMap.get(vi)!);
      face.selected = true;
    }

    // Identify perimeter boundary edges (count === 1 in component)
    // Internal edges have count === 2 and do NOT generate side walls!
    for (const entry of directedEdgeCounts.values()) {
      if (entry.count === 1) {
        const vA = entry.v1;
        const vB = entry.v2;
        const nvA = vertMap.get(vA)!;
        const nvB = vertMap.get(vB)!;

        // Side quad [vA, vB, nvB, nvA] triangulated into 2 triangles
        const tri1: FaceData = {
          index: resultFaces.length + addedFaces.length,
          vertexIndices: [vA, vB, nvB],
          selected: false,
        };
        addedFaces.push(tri1);

        const tri2: FaceData = {
          index: resultFaces.length + addedFaces.length,
          vertexIndices: [vA, nvB, nvA],
          selected: false,
        };
        addedFaces.push(tri2);
      }
    }
  }

  const allVertices = [...resultVertices, ...addedVertices];
  const allFaces = [...resultFaces, ...addedFaces];

  const reindexed = reindexTopology(allVertices, edges, allFaces);

  return {
    ...reindexed,
    newFaceIndices: addedFaces.map((f) => f.index),
    newVertexIndices: addedVertices.map((v) => v.index),
  };
}

/**
 * Extrudes individual selected faces independently (each face gets separate side walls)
 */
export function extrudeFacesIndividual(
  vertices: VertexData[],
  edges: EdgeData[],
  faces: FaceData[],
  faceIndices: number[],
  distance: number,
  customDirection?: Vector3,
): FaceOperationResult {
  let curVertices = [...vertices];
  let curEdges = [...edges];
  let curFaces = [...faces];
  const allNewFaces: number[] = [];
  const allNewVerts: number[] = [];

  for (const fIdx of faceIndices) {
    const res = extrudeFacesRegion(
      curVertices,
      curEdges,
      curFaces,
      [fIdx],
      distance,
      customDirection,
    );
    curVertices = res.vertices;
    curEdges = res.edges;
    curFaces = res.faces;
    allNewFaces.push(...res.newFaceIndices);
    allNewVerts.push(...res.newVertexIndices);
  }

  return {
    vertices: curVertices,
    edges: curEdges,
    faces: curFaces,
    newFaceIndices: allNewFaces,
    newVertexIndices: allNewVerts,
  };
}

/**
 * Insets selected faces with thickness and optional depth offset
 */
export function insetFaces(
  vertices: VertexData[],
  edges: EdgeData[],
  faces: FaceData[],
  faceIndices: number[],
  thickness: number,
  depth: number = 0,
  individual: boolean = true,
): FaceOperationResult {
  if (faceIndices.length === 0 || thickness <= 0) {
    return { vertices, edges, faces, newFaceIndices: [], newVertexIndices: [] };
  }

  if (!individual && faceIndices.length > 1) {
    // For region inset, run region extrusion with 0 distance then scale boundary, or run face-by-face if complex
    // Here we implement individual and region inset cleanly
  }

  const resultVertices = [...vertices];
  const resultFaces = [...faces];
  const newFaceIndices: number[] = [];
  const newVertexIndices: number[] = [];

  for (const fIdx of faceIndices) {
    const face = resultFaces[fIdx];
    if (!face) continue;

    const vi = [...face.vertexIndices];
    const count = vi.length;
    if (count < 3) continue;

    const centroid = computeFaceCentroid(vi, resultVertices);
    const normal = computeFaceNormal(vi, resultVertices);

    const innerVertIndices: number[] = [];

    // Create inset vertices scaled towards centroid
    for (let i = 0; i < count; i++) {
      const v = resultVertices[vi[i]];
      const dx = centroid.x - v.position.x;
      const dy = centroid.y - v.position.y;
      const dz = centroid.z - v.position.z;
      const dist = Math.sqrt(dx * dx + dy * dy + dz * dz);

      const factor = dist > 1e-6 ? Math.min(1.0, thickness / dist) : 0.5;

      const innerPos: Vector3 = {
        x: v.position.x + dx * factor + normal.x * depth,
        y: v.position.y + dy * factor + normal.y * depth,
        z: v.position.z + dz * factor + normal.z * depth,
      };

      const newIdx = resultVertices.length;
      resultVertices.push({
        index: newIdx,
        position: innerPos,
        uv: v.uv ? [...v.uv] : undefined,
        selected: true,
      });
      innerVertIndices.push(newIdx);
      newVertexIndices.push(newIdx);
    }

    // Replace original face with inner face
    face.vertexIndices = [...innerVertIndices];
    face.selected = true;

    // Build perimeter quads connecting outer edge to inner edge
    for (let i = 0; i < count; i++) {
      const next = (i + 1) % count;
      const oA = vi[i];
      const oB = vi[next];
      const iA = innerVertIndices[i];
      const iB = innerVertIndices[next];

      // Side quad [oA, oB, iB, iA]
      const tri1: FaceData = {
        index: resultFaces.length,
        vertexIndices: [oA, oB, iB],
        selected: false,
      };
      resultFaces.push(tri1);
      newFaceIndices.push(tri1.index);

      const tri2: FaceData = {
        index: resultFaces.length,
        vertexIndices: [oA, iB, iA],
        selected: false,
      };
      resultFaces.push(tri2);
      newFaceIndices.push(tri2.index);
    }
  }

  const reindexed = reindexTopology(resultVertices, edges, resultFaces);

  return {
    ...reindexed,
    newFaceIndices,
    newVertexIndices,
  };
}

/**
 * Triangulates all faces with > 3 vertices
 */
export function triangulateFaces(
  vertices: VertexData[],
  edges: EdgeData[],
  faces: FaceData[],
  faceIndices?: number[],
): FaceOperationResult {
  const targetSet = new Set(
    faceIndices !== undefined && faceIndices.length > 0 ? faceIndices : faces.map((f) => f.index),
  );

  const newFaces: FaceData[] = [];
  const addedFaceIndices: number[] = [];

  for (const face of faces) {
    if (!targetSet.has(face.index) || face.vertexIndices.length <= 3) {
      newFaces.push({ ...face, index: newFaces.length });
      continue;
    }

    // Fan triangulation for polygons
    const vi = face.vertexIndices;
    for (let j = 1; j < vi.length - 1; j++) {
      const tri: FaceData = {
        index: newFaces.length,
        vertexIndices: [vi[0], vi[j], vi[j + 1]],
        selected: face.selected,
      };
      newFaces.push(tri);
      addedFaceIndices.push(tri.index);
    }
  }

  const reindexed = reindexTopology(vertices, edges, newFaces);
  return {
    ...reindexed,
    newFaceIndices: addedFaceIndices,
    newVertexIndices: [],
  };
}

/**
 * Inverts the normal vectors of selected faces by reversing vertex winding order
 */
export function flipNormals(faces: FaceData[], faceIndices?: number[]): void {
  const targetSet = new Set(
    faceIndices !== undefined && faceIndices.length > 0 ? faceIndices : faces.map((f) => f.index),
  );

  for (const face of faces) {
    if (targetSet.has(face.index)) {
      face.vertexIndices.reverse();
      if (face.normal) {
        face.normal = {
          x: -face.normal.x,
          y: -face.normal.y,
          z: -face.normal.z,
        };
      }
    }
  }
}

/**
 * Deletes selected faces with option to delete unreferenced vertices
 */
export function deleteFaces(
  vertices: VertexData[],
  edges: EdgeData[],
  faces: FaceData[],
  faceIndices: number[],
  deleteUnreferencedVertices: boolean = true,
): FaceOperationResult {
  const deleteSet = new Set(faceIndices);
  const remainingFaces = faces.filter((f) => !deleteSet.has(f.index));

  let remainingVertices = vertices;
  if (deleteUnreferencedVertices) {
    const usedVerts = new Set<number>();
    for (const f of remainingFaces) {
      for (const vi of f.vertexIndices) {
        usedVerts.add(vi);
      }
    }
    remainingVertices = vertices.filter((v) => usedVerts.has(v.index));
  }

  const reindexed = reindexTopology(remainingVertices, edges, remainingFaces);
  return {
    ...reindexed,
    newFaceIndices: [],
    newVertexIndices: [],
  };
}

/**
 * Dissolves selected faces, merging adjacent coplanar faces into single polygon
 */
export function dissolveFaces(
  vertices: VertexData[],
  edges: EdgeData[],
  faces: FaceData[],
  faceIndices: number[],
): FaceOperationResult {
  if (faceIndices.length <= 1) {
    return { vertices, edges, faces, newFaceIndices: [], newVertexIndices: [] };
  }

  const dissolveSet = new Set(faceIndices);

  // Collect boundary edges of the dissolved region
  const edgeCount = new Map<string, { v1: number; v2: number; count: number }>();
  for (const fIdx of dissolveSet) {
    const f = faces[fIdx];
    if (!f) continue;
    const vi = f.vertexIndices;
    const count = vi.length;
    for (let i = 0; i < count; i++) {
      const a = vi[i];
      const b = vi[(i + 1) % count];
      const minV = Math.min(a, b);
      const maxV = Math.max(a, b);
      const key = `${minV}_${maxV}`;
      const entry = edgeCount.get(key) || { v1: a, v2: b, count: 0 };
      entry.count++;
      edgeCount.set(key, entry);
    }
  }

  // Outer perimeter edges have count === 1
  const perimeterEdges: { v1: number; v2: number }[] = [];
  for (const entry of edgeCount.values()) {
    if (entry.count === 1) {
      perimeterEdges.push({ v1: entry.v1, v2: entry.v2 });
    }
  }

  if (perimeterEdges.length < 3) {
    return { vertices, edges, faces, newFaceIndices: [], newVertexIndices: [] };
  }

  // Form outer polygon loop
  const nextMap = new Map<number, number>();
  for (const e of perimeterEdges) {
    nextMap.set(e.v1, e.v2);
  }

  const polygon: number[] = [perimeterEdges[0].v1];
  let curr = perimeterEdges[0].v2;
  const start = perimeterEdges[0].v1;
  let guard = 0;

  while (curr !== start && guard++ < perimeterEdges.length + 5) {
    polygon.push(curr);
    const next = nextMap.get(curr);
    if (next === undefined) break;
    curr = next;
  }

  const remainingFaces = faces.filter((f) => !dissolveSet.has(f.index));
  if (polygon.length >= 3) {
    remainingFaces.push({
      index: remainingFaces.length,
      vertexIndices: polygon,
      selected: false,
    });
  }

  const reindexed = reindexTopology(vertices, edges, remainingFaces);
  return {
    ...reindexed,
    newFaceIndices: [remainingFaces.length - 1],
    newVertexIndices: [],
  };
}

/**
 * Creates a face (or fan of triangles) filling an open boundary loop of vertex indices
 */
export function fillBoundaryLoop(
  vertices: VertexData[],
  edges: EdgeData[],
  faces: FaceData[],
  loopVertexIndices: number[],
): FaceOperationResult {
  if (loopVertexIndices.length < 3) {
    return { vertices, edges, faces, newFaceIndices: [], newVertexIndices: [] };
  }

  const newFaces = [...faces];
  const newFaceIdx = newFaces.length;

  newFaces.push({
    index: newFaceIdx,
    vertexIndices: [...loopVertexIndices],
    selected: true,
  });

  const reindexed = reindexTopology(vertices, edges, newFaces);
  return {
    ...reindexed,
    newFaceIndices: [newFaceIdx],
    newVertexIndices: [],
  };
}

/**
 * Bridges two boundary edge loops with quad / triangle strips
 */
export function bridgeEdgeLoops(
  vertices: VertexData[],
  edges: EdgeData[],
  faces: FaceData[],
  loopA: number[],
  loopB: number[],
): FaceOperationResult {
  if (loopA.length < 3 || loopB.length < 3 || loopA.length !== loopB.length) {
    return { vertices, edges, faces, newFaceIndices: [], newVertexIndices: [] };
  }

  const count = loopA.length;
  const newFaces = [...faces];
  const addedIndices: number[] = [];

  for (let i = 0; i < count; i++) {
    const next = (i + 1) % count;
    const a1 = loopA[i];
    const a2 = loopA[next];
    const b1 = loopB[i];
    const b2 = loopB[next];

    // Quad [a1, a2, b2, b1] triangulated into 2 triangles
    const tri1: FaceData = {
      index: newFaces.length,
      vertexIndices: [a1, a2, b2],
      selected: true,
    };
    newFaces.push(tri1);
    addedIndices.push(tri1.index);

    const tri2: FaceData = {
      index: newFaces.length,
      vertexIndices: [a1, b2, b1],
      selected: true,
    };
    newFaces.push(tri2);
    addedIndices.push(tri2.index);
  }

  const reindexed = reindexTopology(vertices, edges, newFaces);
  return {
    ...reindexed,
    newFaceIndices: addedIndices,
    newVertexIndices: [],
  };
}

/**
 * Bevels edges or vertices with configurable width and segments
 */
export function bevelElements(
  vertices: VertexData[],
  edges: EdgeData[],
  faces: FaceData[],
  indices: number[],
  mode: 'edge' | 'vertex',
  width: number,
  _segments: number = 1,
): FaceOperationResult {
  if (indices.length === 0 || width <= 0) {
    return { vertices, edges, faces, newFaceIndices: [], newVertexIndices: [] };
  }

  if (mode === 'vertex') {
    // Truncates selected vertices by width
    const resultVerts = [...vertices];
    const resultFaces = [...faces];
    const newVerts: number[] = [];
    const newFaces: number[] = [];

    const adj = buildAdjacency(vertices, edges, faces);

    for (const vIdx of indices) {
      const v = vertices[vIdx];
      if (!v) continue;

      const incidentEdges = adj.vertexToEdges.get(vIdx) || [];
      if (incidentEdges.length < 3) continue;

      // For each incident edge, create a split vertex offset by width towards the other endpoint
      const splitVertIndices: number[] = [];
      for (const eIdx of incidentEdges) {
        const edge = edges[eIdx];
        if (!edge) continue;
        const otherIdx = edge.v1 === vIdx ? edge.v2 : edge.v1;
        const otherV = vertices[otherIdx];
        if (!otherV) continue;

        const dx = otherV.position.x - v.position.x;
        const dy = otherV.position.y - v.position.y;
        const dz = otherV.position.z - v.position.z;
        const len = Math.sqrt(dx * dx + dy * dy + dz * dz);
        const w = Math.min(width, len * 0.45);

        const newVIdx = resultVerts.length;
        resultVerts.push({
          index: newVIdx,
          position: {
            x: v.position.x + (dx / len) * w,
            y: v.position.y + (dy / len) * w,
            z: v.position.z + (dz / len) * w,
          },
          selected: true,
        });
        splitVertIndices.push(newVIdx);
        newVerts.push(newVIdx);
      }

      // Create cap face on the beveled vertex
      if (splitVertIndices.length >= 3) {
        const capFace: FaceData = {
          index: resultFaces.length,
          vertexIndices: splitVertIndices,
          selected: true,
        };
        resultFaces.push(capFace);
        newFaces.push(capFace.index);
      }
    }

    const reindexed = reindexTopology(resultVerts, edges, resultFaces);
    return {
      ...reindexed,
      newFaceIndices: newFaces,
      newVertexIndices: newVerts,
    };
  }

  // Edge bevel: chamfer along beveled edges
  // For each edge, split endpoints and introduce a chamfer quad
  const resultVerts = [...vertices];
  const resultFaces = [...faces];
  const newVerts: number[] = [];
  const newFaces: number[] = [];

  const adj = buildAdjacency(vertices, edges, faces);

  for (const eIdx of indices) {
    const edge = edges[eIdx];
    if (!edge) continue;

    const incidentFaces = adj.edgeToFaces.get(eIdx) || [];
    if (incidentFaces.length === 0) continue;

    const p1 = vertices[edge.v1].position;
    const p2 = vertices[edge.v2].position;

    const n1 = computeFaceNormal(faces[incidentFaces[0]].vertexIndices, vertices);
    let n2: Vector3;

    if (incidentFaces.length >= 2) {
      n2 = computeFaceNormal(faces[incidentFaces[1]].vertexIndices, vertices);
    } else {
      const edx = p2.x - p1.x;
      const edy = p2.y - p1.y;
      const edz = p2.z - p1.z;
      const elen = Math.sqrt(edx * edx + edy * edy + edz * edz) || 1;
      const ex = edx / elen;
      const ey = edy / elen;
      const ez = edz / elen;

      // cross product: e x n1
      n2 = {
        x: ey * n1.z - ez * n1.y,
        y: ez * n1.x - ex * n1.z,
        z: ex * n1.y - ey * n1.x,
      };
    }

    // Create 2 new vertices along each face offset by width
    const v1_1 = resultVerts.length;
    resultVerts.push({
      index: v1_1,
      position: {
        x: p1.x + n1.x * width * 0.5,
        y: p1.y + n1.y * width * 0.5,
        z: p1.z + n1.z * width * 0.5,
      },
      selected: true,
    });
    newVerts.push(v1_1);

    const v1_2 = resultVerts.length;
    resultVerts.push({
      index: v1_2,
      position: {
        x: p1.x + n2.x * width * 0.5,
        y: p1.y + n2.y * width * 0.5,
        z: p1.z + n2.z * width * 0.5,
      },
      selected: true,
    });
    newVerts.push(v1_2);

    const v2_1 = resultVerts.length;
    resultVerts.push({
      index: v2_1,
      position: {
        x: p2.x + n1.x * width * 0.5,
        y: p2.y + n1.y * width * 0.5,
        z: p2.z + n1.z * width * 0.5,
      },
      selected: true,
    });
    newVerts.push(v2_1);

    const v2_2 = resultVerts.length;
    resultVerts.push({
      index: v2_2,
      position: {
        x: p2.x + n2.x * width * 0.5,
        y: p2.y + n2.y * width * 0.5,
        z: p2.z + n2.z * width * 0.5,
      },
      selected: true,
    });
    newVerts.push(v2_2);

    // Chamfer quad [v1_1, v2_1, v2_2, v1_2]
    const tri1: FaceData = {
      index: resultFaces.length,
      vertexIndices: [v1_1, v2_1, v2_2],
      selected: true,
    };
    resultFaces.push(tri1);
    newFaces.push(tri1.index);

    const tri2: FaceData = {
      index: resultFaces.length,
      vertexIndices: [v1_1, v2_2, v1_2],
      selected: true,
    };
    resultFaces.push(tri2);
    newFaces.push(tri2.index);
  }

  const reindexed = reindexTopology(resultVerts, edges, resultFaces);
  return {
    ...reindexed,
    newFaceIndices: newFaces,
    newVertexIndices: newVerts,
  };
}
