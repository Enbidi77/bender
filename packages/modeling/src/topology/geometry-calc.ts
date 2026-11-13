import type { VertexData, EdgeData, FaceData, Vector3 } from '@blender-elt/contracts';

/**
 * Computes the normal vector for a face using Newell's method (robust for triangles, quads, and n-gons)
 */
export function computeFaceNormal(vertexIndices: number[], vertices: VertexData[]): Vector3 {
  const count = vertexIndices.length;
  if (count < 3) {
    return { x: 0, y: 1, z: 0 };
  }

  let nx = 0;
  let ny = 0;
  let nz = 0;

  for (let i = 0; i < count; i++) {
    const curIdx = vertexIndices[i];
    const nextIdx = vertexIndices[(i + 1) % count];
    const vCur = vertices[curIdx]?.position;
    const vNext = vertices[nextIdx]?.position;

    if (!vCur || !vNext) continue;

    nx += (vCur.y - vNext.y) * (vCur.z + vNext.z);
    ny += (vCur.z - vNext.z) * (vCur.x + vNext.x);
    nz += (vCur.x - vNext.x) * (vCur.y + vNext.y);
  }

  const length = Math.sqrt(nx * nx + ny * ny + nz * nz);
  if (length > 1e-12) {
    return {
      x: nx / length,
      y: ny / length,
      z: nz / length,
    };
  }

  return { x: 0, y: 1, z: 0 };
}

/**
 * Computes the centroid (arithmetic mean of vertices) of a face
 */
export function computeFaceCentroid(vertexIndices: number[], vertices: VertexData[]): Vector3 {
  if (vertexIndices.length === 0) {
    return { x: 0, y: 0, z: 0 };
  }

  let sx = 0;
  let sy = 0;
  let sz = 0;
  let count = 0;

  for (const idx of vertexIndices) {
    const v = vertices[idx];
    if (v) {
      sx += v.position.x;
      sy += v.position.y;
      sz += v.position.z;
      count++;
    }
  }

  if (count === 0) return { x: 0, y: 0, z: 0 };
  return { x: sx / count, y: sy / count, z: sz / count };
}

/**
 * Computes the 3D surface area of a polygon face using Newell's area formula
 */
export function computeFaceArea(vertexIndices: number[], vertices: VertexData[]): number {
  const count = vertexIndices.length;
  if (count < 3) return 0;

  let nx = 0;
  let ny = 0;
  let nz = 0;

  for (let i = 0; i < count; i++) {
    const curIdx = vertexIndices[i];
    const nextIdx = vertexIndices[(i + 1) % count];
    const vCur = vertices[curIdx]?.position;
    const vNext = vertices[nextIdx]?.position;

    if (!vCur || !vNext) continue;

    nx += (vCur.y - vNext.y) * (vCur.z + vNext.z);
    ny += (vCur.z - vNext.z) * (vCur.x + vNext.x);
    nz += (vCur.x - vNext.x) * (vCur.y + vNext.y);
  }

  return 0.5 * Math.sqrt(nx * nx + ny * ny + nz * nz);
}

/**
 * Computes the total surface area across all faces
 */
export function computeMeshSurfaceArea(faces: FaceData[], vertices: VertexData[]): number {
  let totalArea = 0;
  for (const face of faces) {
    totalArea += computeFaceArea(face.vertexIndices, vertices);
  }
  return totalArea;
}

/**
 * Computes axis-aligned bounding box of vertices
 */
export function computeBoundingBox(vertices: VertexData[]): {
  min: Vector3;
  max: Vector3;
  size: Vector3;
  center: Vector3;
} {
  if (vertices.length === 0) {
    const zero = { x: 0, y: 0, z: 0 };
    return { min: zero, max: zero, size: zero, center: zero };
  }

  let minX = Infinity;
  let minY = Infinity;
  let minZ = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;
  let maxZ = -Infinity;

  for (const v of vertices) {
    const p = v.position;
    if (p.x < minX) minX = p.x;
    if (p.y < minY) minY = p.y;
    if (p.z < minZ) minZ = p.z;
    if (p.x > maxX) maxX = p.x;
    if (p.y > maxY) maxY = p.y;
    if (p.z > maxZ) maxZ = p.z;
  }

  const min = { x: minX, y: minY, z: minZ };
  const max = { x: maxX, y: maxY, z: maxZ };
  const size = { x: maxX - minX, y: maxY - minY, z: maxZ - minZ };
  const center = {
    x: (minX + maxX) * 0.5,
    y: (minY + maxY) * 0.5,
    z: (minZ + maxZ) * 0.5,
  };

  return { min, max, size, center };
}

/**
 * Computes Euclidean length of an edge
 */
export function computeEdgeLength(edge: EdgeData, vertices: VertexData[]): number {
  const p1 = vertices[edge.v1]?.position;
  const p2 = vertices[edge.v2]?.position;
  if (!p1 || !p2) return 0;
  const dx = p2.x - p1.x;
  const dy = p2.y - p1.y;
  const dz = p2.z - p1.z;
  return Math.sqrt(dx * dx + dy * dy + dz * dz);
}

/**
 * Computes midpoint of an edge
 */
export function computeEdgeMidpoint(edge: EdgeData, vertices: VertexData[]): Vector3 {
  const p1 = vertices[edge.v1]?.position ?? { x: 0, y: 0, z: 0 };
  const p2 = vertices[edge.v2]?.position ?? { x: 0, y: 0, z: 0 };
  return {
    x: (p1.x + p2.x) * 0.5,
    y: (p1.y + p2.y) * 0.5,
    z: (p1.z + p2.z) * 0.5,
  };
}
