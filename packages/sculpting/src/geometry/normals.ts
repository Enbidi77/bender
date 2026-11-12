import * as THREE from 'three';
import type { SculptMeshBuffer } from './sculpt-mesh-buffer.js';
import type { MeshAdjacency } from './adjacency.js';

const _vA = new THREE.Vector3();
const _vB = new THREE.Vector3();
const _vC = new THREE.Vector3();
const _cb = new THREE.Vector3();
const _ab = new THREE.Vector3();
const _faceNorm = new THREE.Vector3();

/**
 * Recomputes normals for a dirty subset of vertices using adjacent triangle faces.
 */
export function recomputeDirtyNormals(
  buffer: SculptMeshBuffer,
  dirtyIndices: Iterable<number>,
  adjacency: MeshAdjacency,
): void {
  const affectedVertices = new Set<number>();
  const affectedFaces = new Set<number>();

  for (const vIdx of dirtyIndices) {
    affectedVertices.add(vIdx);
    const faces = adjacency.getConnectedFaces(vIdx);
    for (const f of faces) {
      affectedFaces.add(f);
    }
  }

  // Also include 1-ring neighbors to prevent normal discontinuity at brush border
  for (const vIdx of dirtyIndices) {
    const neighbors = adjacency.getNeighbors(vIdx);
    for (const n of neighbors) {
      affectedVertices.add(n);
    }
  }

  // Pre-calculate face normals for affected faces
  const faceNormals = new Map<number, THREE.Vector3>();
  const indices = buffer.indices;

  for (const f of affectedFaces) {
    let iA: number;
    let iB: number;
    let iC: number;

    if (indices) {
      iA = indices[f * 3];
      iB = indices[f * 3 + 1];
      iC = indices[f * 3 + 2];
    } else {
      iA = f * 3;
      iB = f * 3 + 1;
      iC = f * 3 + 2;
    }

    buffer.getVertex(iA, _vA);
    buffer.getVertex(iB, _vB);
    buffer.getVertex(iC, _vC);

    _cb.subVectors(_vC, _vB);
    _ab.subVectors(_vA, _vB);
    _faceNorm.crossVectors(_cb, _ab); // (vC - vB) x (vA - vB)

    faceNormals.set(f, _faceNorm.clone());
  }

  // Accumulate to affected vertices
  const vertNormal = new THREE.Vector3();
  for (const vIdx of affectedVertices) {
    const faces = adjacency.getConnectedFaces(vIdx);
    vertNormal.set(0, 0, 0);

    for (const f of faces) {
      const fn = faceNormals.get(f);
      if (fn) {
        vertNormal.add(fn);
      }
    }

    if (vertNormal.lengthSq() > 1e-8) {
      vertNormal.normalize();
      buffer.setNormal(vIdx, vertNormal.x, vertNormal.y, vertNormal.z);
    }
  }
}

/**
 * Recomputes all vertex normals across the entire mesh buffer.
 */
export function recomputeAllNormals(buffer: SculptMeshBuffer): void {
  buffer.computeVertexNormals();
}
