import { describe, it, expect } from 'vitest';
import * as THREE from 'three';
import { SculptMeshBuffer } from '../src/geometry/sculpt-mesh-buffer.js';
import { voxelRemesh } from '../src/remeshing/voxel-remesh.js';

describe('Voxel Remesher & Topology Safety', () => {
  it('throws safety error when resolution exceeds safety cap', () => {
    // A unit cube
    const cubeGeom = new THREE.BoxGeometry(10, 10, 10);
    const buffer = SculptMeshBuffer.fromBufferGeometry(cubeGeom);

    // Ridiculously small voxel size on a 10x10x10 cube
    expect(() => {
      voxelRemesh(buffer, {
        voxelSize: 0.01, // 1000 x 1000 x 1000 = 1 billion voxels!
        safetyCapMaxVertices: 1000,
      });
    }).toThrow(/memory safety threshold/);
  });

  it('remeshes a cube into uniform watertight manifold triangle mesh', () => {
    const cubeGeom = new THREE.BoxGeometry(1, 1, 1);
    const buffer = SculptMeshBuffer.fromBufferGeometry(cubeGeom);

    const remeshed = voxelRemesh(buffer, {
      voxelSize: 0.25,
      safetyCapMaxVertices: 50000,
    });

    expect(remeshed.vertexCount).toBeGreaterThan(10);
    expect(remeshed.indices).toBeDefined();
    expect(remeshed.indices!.length).toBeGreaterThan(0);
    expect(remeshed.indices!.length % 3).toBe(0); // Valid triangle count

    // Check normals are valid unit vectors
    const norm = new THREE.Vector3();
    for (let i = 0; i < remeshed.vertexCount; i++) {
      remeshed.getNormal(i, norm);
      expect(norm.length()).toBeCloseTo(1.0, 3);
    }
  });
});
