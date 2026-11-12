import { describe, it, expect } from 'vitest';
import * as THREE from 'three';
import { SurfaceRaycaster } from '../../src/sculpt/SurfaceRaycaster.js';

describe('SurfaceRaycaster', () => {
  it('converts client DOM coordinates to NDC [-1, 1]', () => {
    const raycaster = new SurfaceRaycaster();
    const rect = { left: 100, top: 100, width: 800, height: 600 };

    // Center of element
    const center = raycaster.clientToNDC(500, 400, rect);
    expect(center.x).toBeCloseTo(0, 5);
    expect(center.y).toBeCloseTo(0, 5);

    // Top-left
    const topLeft = raycaster.clientToNDC(100, 100, rect);
    expect(topLeft.x).toBeCloseTo(-1, 5);
    expect(topLeft.y).toBeCloseTo(1, 5);

    // Bottom-right
    const bottomRight = raycaster.clientToNDC(900, 700, rect);
    expect(bottomRight.x).toBeCloseTo(1, 5);
    expect(bottomRight.y).toBeCloseTo(-1, 5);
  });

  it('performs accurate raycasting and returns local and world coordinates', () => {
    const raycaster = new SurfaceRaycaster();

    const geometry = new THREE.BoxGeometry(2, 2, 2);
    const material = new THREE.MeshBasicMaterial();
    const mesh = new THREE.Mesh(geometry, material);
    mesh.position.set(0, 0, 0);
    mesh.updateMatrixWorld(true);

    const camera = new THREE.PerspectiveCamera(60, 1, 0.1, 100);
    camera.position.set(0, 0, 5);
    camera.lookAt(0, 0, 0);
    camera.updateMatrixWorld(true);

    // Raycast center
    const hit = raycaster.raycastFromNDC(mesh, 0, 0, camera);
    expect(hit).not.toBeNull();
    expect(hit?.hit).toBe(true);

    // Should hit the front face at z = 1.0
    expect(hit?.point.z).toBeCloseTo(1.0, 2);
    expect(hit?.normal.z).toBeCloseTo(1.0, 2);
    expect(hit?.localPoint.z).toBeCloseTo(1.0, 2);
    expect(hit?.localNormal.z).toBeCloseTo(1.0, 2);
  });

  it('transforms hit points accurately when mesh is translated and rotated', () => {
    const raycaster = new SurfaceRaycaster();

    const geometry = new THREE.BoxGeometry(2, 2, 2);
    const mesh = new THREE.Mesh(geometry, new THREE.MeshBasicMaterial());
    mesh.position.set(3, 4, 5);
    mesh.updateMatrixWorld(true);

    const camera = new THREE.PerspectiveCamera(60, 1, 0.1, 100);
    camera.position.set(3, 4, 10);
    camera.lookAt(3, 4, 5);
    camera.updateMatrixWorld(true);

    const hit = raycaster.raycastFromNDC(mesh, 0, 0, camera);
    expect(hit).not.toBeNull();
    expect(hit?.hit).toBe(true);

    // World point should be at z = 6.0
    expect(hit?.point.x).toBeCloseTo(3.0, 2);
    expect(hit?.point.y).toBeCloseTo(4.0, 2);
    expect(hit?.point.z).toBeCloseTo(6.0, 2);

    // Local point should still be at local z = 1.0
    expect(hit?.localPoint.x).toBeCloseTo(0.0, 2);
    expect(hit?.localPoint.y).toBeCloseTo(0.0, 2);
    expect(hit?.localPoint.z).toBeCloseTo(1.0, 2);
  });

  it('returns null when ray misses the mesh', () => {
    const raycaster = new SurfaceRaycaster();

    const geometry = new THREE.SphereGeometry(1, 16, 16);
    const mesh = new THREE.Mesh(geometry, new THREE.MeshBasicMaterial());
    mesh.updateMatrixWorld(true);

    const camera = new THREE.PerspectiveCamera(60, 1, 0.1, 100);
    camera.position.set(0, 0, 5);
    camera.lookAt(0, 0, 0);
    camera.updateMatrixWorld(true);

    // Corner raycast misses the sphere
    const hit = raycaster.raycastFromNDC(mesh, 0.95, 0.95, camera);
    expect(hit).toBeNull();
  });

  it('finds best foremost hit among multiple meshes', () => {
    const raycaster = new SurfaceRaycaster();

    const geo = new THREE.BoxGeometry(1, 1, 1);
    const meshFront = new THREE.Mesh(geo, new THREE.MeshBasicMaterial());
    meshFront.position.set(0, 0, 2);
    meshFront.updateMatrixWorld(true);

    const meshBack = new THREE.Mesh(geo, new THREE.MeshBasicMaterial());
    meshBack.position.set(0, 0, 0);
    meshBack.updateMatrixWorld(true);

    const camera = new THREE.PerspectiveCamera(60, 1, 0.1, 100);
    camera.position.set(0, 0, 10);
    camera.lookAt(0, 0, 0);
    camera.updateMatrixWorld(true);

    const hit = raycaster.findBestHit([meshBack, meshFront], 0, 0, camera);
    expect(hit).not.toBeNull();
    expect(hit?.object).toBe(meshFront);
    expect(hit?.point.z).toBeCloseTo(2.5, 2);
  });
});
