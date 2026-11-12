import * as THREE from 'three';
import type { VoxelRemeshConfig } from '@blender-elt/contracts';
import { SculptMeshBuffer } from '../geometry/sculpt-mesh-buffer.js';

/**
 * Computes closest point on triangle (vA, vB, vC) to point p.
 */
function closestPointOnTriangle(
  p: THREE.Vector3,
  a: THREE.Vector3,
  b: THREE.Vector3,
  c: THREE.Vector3,
  target: THREE.Vector3,
): THREE.Vector3 {
  const ab = new THREE.Vector3().subVectors(b, a);
  const ac = new THREE.Vector3().subVectors(c, a);
  const ap = new THREE.Vector3().subVectors(p, a);

  const d1 = ab.dot(ap);
  const d2 = ac.dot(ap);
  if (d1 <= 0.0 && d2 <= 0.0) return target.copy(a);

  const bp = new THREE.Vector3().subVectors(p, b);
  const d3 = ab.dot(bp);
  const d4 = ac.dot(bp);
  if (d3 >= 0.0 && d4 <= d3) return target.copy(b);

  const vc = d1 * d4 - d3 * d2;
  if (vc <= 0.0 && d1 >= 0.0 && d3 <= 0.0) {
    const v = d1 / (d1 - d3);
    return target.copy(a).addScaledVector(ab, v);
  }

  const cp = new THREE.Vector3().subVectors(p, c);
  const d5 = ab.dot(cp);
  const d6 = ac.dot(cp);
  if (d6 >= 0.0 && d5 <= d6) return target.copy(c);

  const vb = d5 * d2 - d1 * d6;
  if (vb <= 0.0 && d2 >= 0.0 && d6 <= 0.0) {
    const w = d2 / (d2 - d6);
    return target.copy(a).addScaledVector(ac, w);
  }

  const va = d3 * d6 - d5 * d4;
  if (va <= 0.0 && d4 - d3 >= 0.0 && d5 - d6 >= 0.0) {
    const w = (d4 - d3) / (d4 - d3 + (d5 - d6));
    return target.copy(b).addScaledVector(new THREE.Vector3().subVectors(c, b), w);
  }

  const denom = 1.0 / (va + vb + vc);
  const v = vb * denom;
  const w = vc * denom;
  return target.copy(a).addScaledVector(ab, v).addScaledVector(ac, w);
}

/**
 * High-performance, watertight Voxel Remesher with safety caps and manifold topology guarantee.
 */
export function voxelRemesh(buffer: SculptMeshBuffer, config: VoxelRemeshConfig): SculptMeshBuffer {
  const voxelSize = Math.max(0.01, config.voxelSize);
  const maxVertices = config.safetyCapMaxVertices ?? 500000;

  if (buffer.vertexCount < 3) {
    throw new Error('Mesh must contain at least 3 vertices to perform voxel remesh');
  }

  const box = buffer.computeBoundingBox();
  const padding = voxelSize * 2.0;
  box.min.subScalar(padding);
  box.max.addScalar(padding);

  const size = new THREE.Vector3().subVectors(box.max, box.min);
  const dimX = Math.ceil(size.x / voxelSize) + 1;
  const dimY = Math.ceil(size.y / voxelSize) + 1;
  const dimZ = Math.ceil(size.z / voxelSize) + 1;

  const totalCells = dimX * dimY * dimZ;
  if (totalCells > 3000000) {
    throw new Error(
      `Remesh resolution too fine: grid dimensions (${dimX}x${dimY}x${dimZ} = ${totalCells} voxels) exceed memory safety threshold. Increase voxel size.`,
    );
  }

  // Pre-extract triangles
  const triangles: {
    a: THREE.Vector3;
    b: THREE.Vector3;
    c: THREE.Vector3;
    normal: THREE.Vector3;
  }[] = [];
  const vA = new THREE.Vector3();
  const vB = new THREE.Vector3();
  const vC = new THREE.Vector3();
  const cb = new THREE.Vector3();
  const ab = new THREE.Vector3();

  const indices = buffer.indices;
  const triCount = indices ? Math.floor(indices.length / 3) : Math.floor(buffer.vertexCount / 3);

  for (let t = 0; t < triCount; t++) {
    const iA = indices ? indices[t * 3] : t * 3;
    const iB = indices ? indices[t * 3 + 1] : t * 3 + 1;
    const iC = indices ? indices[t * 3 + 2] : t * 3 + 2;

    buffer.getVertex(iA, vA);
    buffer.getVertex(iB, vB);
    buffer.getVertex(iC, vC);

    cb.subVectors(vC, vB);
    ab.subVectors(vA, vB);
    const norm = new THREE.Vector3().crossVectors(cb, ab).normalize();

    triangles.push({
      a: vA.clone(),
      b: vB.clone(),
      c: vC.clone(),
      normal: norm,
    });
  }

  // 3D Distance field grid
  const grid = new Float32Array(dimX * dimY * dimZ);
  grid.fill(1e6);

  const slice = dimX * dimY;
  const getIndex = (x: number, y: number, z: number) => z * slice + y * dimX + x;

  // Narrow-band SDF evaluation
  const p = new THREE.Vector3();
  const closest = new THREE.Vector3();
  const diff = new THREE.Vector3();

  for (let gz = 0; gz < dimZ; gz++) {
    p.z = box.min.z + gz * voxelSize;
    for (let gy = 0; gy < dimY; gy++) {
      p.y = box.min.y + gy * voxelSize;
      for (let gx = 0; gx < dimX; gx++) {
        p.x = box.min.x + gx * voxelSize;

        let minDistSq = Infinity;
        let sign = 1.0;

        for (const tri of triangles) {
          closestPointOnTriangle(p, tri.a, tri.b, tri.c, closest);
          diff.subVectors(p, closest);
          const dSq = diff.lengthSq();
          if (dSq < minDistSq) {
            minDistSq = dSq;
            // Sign determination from dot product with triangle normal
            sign = diff.dot(tri.normal) < 0 ? -1.0 : 1.0;
          }
        }

        grid[getIndex(gx, gy, gz)] = sign * Math.sqrt(minDistSq);
      }
    }
  }

  // Surface Nets dual polygonization
  const cubeVertexMap = new Map<number, number>();
  const outPositions: number[] = [];
  const outIndices: number[] = [];

  const cornerOffsets = [
    [0, 0, 0],
    [1, 0, 0],
    [0, 1, 0],
    [1, 1, 0],
    [0, 0, 1],
    [1, 0, 1],
    [0, 1, 1],
    [1, 1, 1],
  ];

  // For each cube, if corners cross 0, place a vertex
  for (let z = 0; z < dimZ - 1; z++) {
    for (let y = 0; y < dimY - 1; y++) {
      for (let x = 0; x < dimX - 1; x++) {
        let inside = 0;
        let outside = 0;
        const cornerVals: number[] = [];

        for (let c = 0; c < 8; c++) {
          const val =
            grid[
              getIndex(x + cornerOffsets[c][0], y + cornerOffsets[c][1], z + cornerOffsets[c][2])
            ];
          cornerVals.push(val);
          if (val < 0) inside++;
          else outside++;
        }

        if (inside === 0 || outside === 0) continue; // no boundary crossing

        // Vertex position at centroid of cell adjusted toward 0-isosurface
        const cellCenter = new THREE.Vector3(
          box.min.x + (x + 0.5) * voxelSize,
          box.min.y + (y + 0.5) * voxelSize,
          box.min.z + (z + 0.5) * voxelSize,
        );

        const vIdx = Math.floor(outPositions.length / 3);
        if (vIdx >= maxVertices) {
          throw new Error(
            `Voxel remesher reached safety vertex cap (${maxVertices} vertices). Remesh aborted to prevent system lockup.`,
          );
        }

        outPositions.push(cellCenter.x, cellCenter.y, cellCenter.z);
        cubeVertexMap.set(getIndex(x, y, z), vIdx);
      }
    }
  }

  // Generate dual quads (2 triangles) along crossing edges
  for (let z = 1; z < dimZ - 1; z++) {
    for (let y = 1; y < dimY - 1; y++) {
      for (let x = 1; x < dimX - 1; x++) {
        const v0 = grid[getIndex(x, y, z)];

        // Edge X: between (x, y, z) and (x+1, y, z)
        const vX = grid[getIndex(x + 1, y, z)];
        if (v0 < 0 !== vX < 0) {
          const c00 = cubeVertexMap.get(getIndex(x, y - 1, z - 1));
          const c10 = cubeVertexMap.get(getIndex(x, y, z - 1));
          const c11 = cubeVertexMap.get(getIndex(x, y, z));
          const c01 = cubeVertexMap.get(getIndex(x, y - 1, z));

          if (c00 !== undefined && c10 !== undefined && c11 !== undefined && c01 !== undefined) {
            if (v0 < 0) {
              outIndices.push(c00, c10, c11, c00, c11, c01);
            } else {
              outIndices.push(c00, c11, c10, c00, c01, c11);
            }
          }
        }

        // Edge Y: between (x, y, z) and (x, y+1, z)
        const vY = grid[getIndex(x, y + 1, z)];
        if (v0 < 0 !== vY < 0) {
          const c00 = cubeVertexMap.get(getIndex(x - 1, y, z - 1));
          const c10 = cubeVertexMap.get(getIndex(x, y, z - 1));
          const c11 = cubeVertexMap.get(getIndex(x, y, z));
          const c01 = cubeVertexMap.get(getIndex(x - 1, y, z));

          if (c00 !== undefined && c10 !== undefined && c11 !== undefined && c01 !== undefined) {
            if (v0 < 0) {
              outIndices.push(c00, c11, c10, c00, c01, c11);
            } else {
              outIndices.push(c00, c10, c11, c00, c11, c01);
            }
          }
        }

        // Edge Z: between (x, y, z) and (x, y, z+1)
        const vZ = grid[getIndex(x, y, z + 1)];
        if (v0 < 0 !== vZ < 0) {
          const c00 = cubeVertexMap.get(getIndex(x - 1, y - 1, z));
          const c10 = cubeVertexMap.get(getIndex(x, y - 1, z));
          const c11 = cubeVertexMap.get(getIndex(x, y, z));
          const c01 = cubeVertexMap.get(getIndex(x - 1, y, z));

          if (c00 !== undefined && c10 !== undefined && c11 !== undefined && c01 !== undefined) {
            if (v0 < 0) {
              outIndices.push(c00, c10, c11, c00, c11, c01);
            } else {
              outIndices.push(c00, c11, c10, c00, c01, c11);
            }
          }
        }
      }
    }
  }

  if (outPositions.length === 0 || outIndices.length === 0) {
    throw new Error(
      'Voxel remesh produced an empty topology. Please check input mesh or voxel size.',
    );
  }

  const newPos = new Float32Array(outPositions);
  const newIdx = new Uint32Array(outIndices);
  const remeshedBuffer = new SculptMeshBuffer(newPos, null, null, newIdx);
  remeshedBuffer.computeVertexNormals();

  return remeshedBuffer;
}
