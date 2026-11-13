import { describe, it, expect, beforeEach } from 'vitest';
import * as THREE from 'three';
import { MeshTopology } from '@blender-elt/modeling';
import { EditRaycaster } from '../../src/edit/EditRaycaster.js';
import { bufferGeometryToMeshData } from '../../src/edit/EditViewportBridge.js';

describe('EditRaycaster', () => {
  let raycaster: EditRaycaster;
  let mesh: THREE.Mesh;
  let topology: MeshTopology;
  let camera: THREE.PerspectiveCamera;
  const rect = { left: 0, top: 0, width: 800, height: 600 };

  beforeEach(() => {
    raycaster = new EditRaycaster();

    const geometry = new THREE.BoxGeometry(2, 2, 2);
    const material = new THREE.MeshBasicMaterial();
    mesh = new THREE.Mesh(geometry, material);
    mesh.position.set(0, 0, 0);
    mesh.updateMatrixWorld(true);

    const meshData = bufferGeometryToMeshData(geometry);
    topology = MeshTopology.fromMeshData(meshData);

    camera = new THREE.PerspectiveCamera(60, 800 / 600, 0.1, 100);
    camera.position.set(0, 0, 5);
    camera.lookAt(0, 0, 0);
    camera.updateMatrixWorld(true);
  });

  it('converts DOM client coordinates to NDC [-1, 1]', () => {
    const center = raycaster.clientToNDC(400, 300, rect);
    expect(center.x).toBeCloseTo(0, 4);
    expect(center.y).toBeCloseTo(0, 4);

    const topLeft = raycaster.clientToNDC(0, 0, rect);
    expect(topLeft.x).toBeCloseTo(-1, 4);
    expect(topLeft.y).toBeCloseTo(1, 4);

    const bottomRight = raycaster.clientToNDC(800, 600, rect);
    expect(bottomRight.x).toBeCloseTo(1, 4);
    expect(bottomRight.y).toBeCloseTo(-1, 4);
  });

  it('accurately projects 3D local points into screen coordinates', () => {
    const originProj = raycaster.projectLocalPoint({ x: 0, y: 0, z: 0 }, mesh, camera, rect);
    expect(originProj.isBehind).toBe(false);
    expect(originProj.screenX).toBeCloseTo(400, 1);
    expect(originProj.screenY).toBeCloseTo(300, 1);
  });

  it('picks vertices within screen-space radius tolerance and rejects outside radius', () => {
    // Project the first vertex to screen coordinates
    const v0 = topology.vertices[0];
    const proj = raycaster.projectLocalPoint(v0.position, mesh, camera, rect);

    // Pick exactly at vertex screen location
    const hitNear = raycaster.pickVertex(
      mesh,
      topology,
      proj.screenX,
      proj.screenY,
      rect,
      camera,
      12,
    );
    expect(hitNear).not.toBeNull();
    expect(hitNear?.type).toBe('vertex');
    expect(hitNear?.elementIndex).toBe(v0.index);

    // Pick 5 pixels away (within 12px tolerance)
    const hitOffset = raycaster.pickVertex(
      mesh,
      topology,
      proj.screenX + 5,
      proj.screenY + 5,
      rect,
      camera,
      12,
    );
    expect(hitOffset).not.toBeNull();
    expect(hitOffset?.elementIndex).toBe(v0.index);

    // Pick 50 pixels away (far outside tolerance)
    const hitFar = raycaster.pickVertex(
      mesh,
      topology,
      proj.screenX + 50,
      proj.screenY + 50,
      rect,
      camera,
      12,
    );
    // Should not hit v0
    if (hitFar) {
      expect(hitFar.elementIndex).not.toBe(v0.index);
    }
  });

  it('picks edges within screen-space distance threshold', () => {
    const edge0 = topology.edges[0];
    const v1 = topology.vertices[edge0.v1];
    const v2 = topology.vertices[edge0.v2];

    const p1 = raycaster.projectLocalPoint(v1.position, mesh, camera, rect);
    const p2 = raycaster.projectLocalPoint(v2.position, mesh, camera, rect);

    // Pick at midpoint of edge on screen
    const midX = (p1.screenX + p2.screenX) * 0.5;
    const midY = (p1.screenY + p2.screenY) * 0.5;

    const hit = raycaster.pickEdge(mesh, topology, midX, midY, rect, camera, 10);
    expect(hit).not.toBeNull();
    expect(hit?.type).toBe('edge');
  });

  it('picks faces via 3D raycasting through the front face', () => {
    // Center of screen (400, 300) shoots ray right through the front center of cube
    const hit = raycaster.pickFace(mesh, topology, 400, 300, rect, camera);
    expect(hit).not.toBeNull();
    expect(hit?.type).toBe('face');
    expect(hit?.elementIndex).toBeGreaterThanOrEqual(0);
    expect(hit?.worldPoint.z).toBeCloseTo(1.0, 1);
  });

  it('respects active element modes in unified pickElement', () => {
    // In face mode only: picking near center hits face
    const hitFace = raycaster.pickElement(mesh, topology, 400, 300, rect, camera, ['face']);
    expect(hitFace?.type).toBe('face');

    // In vertex mode: picking at center should not hit any vertex (vertices are at corners)
    const hitVert = raycaster.pickElement(mesh, topology, 400, 300, rect, camera, ['vertex'], {
      vertexRadiusPixels: 8,
    });
    expect(hitVert).toBeNull();
  });

  it('performs box marquee selection selecting vertices, edges, and faces inside marquee rectangle', () => {
    // Marquee enclosing the entire viewport
    const fullBox = { x1: 0, y1: 0, x2: 800, y2: 600 };
    const result = raycaster.boxSelectElements(mesh, topology, fullBox, rect, camera, [
      'vertex',
      'edge',
      'face',
    ]);

    // Front-facing elements should be selected
    expect(result.vertexIndices.length).toBeGreaterThan(0);
    expect(result.edgeIndices.length).toBeGreaterThan(0);
    expect(result.faceIndices.length).toBeGreaterThan(0);

    // Small empty marquee in corner (top-left empty space)
    const emptyBox = { x1: 0, y1: 0, x2: 50, y2: 50 };
    const emptyResult = raycaster.boxSelectElements(mesh, topology, emptyBox, rect, camera, [
      'vertex',
      'edge',
      'face',
    ]);
    expect(emptyResult.vertexIndices.length).toBe(0);
    expect(emptyResult.edgeIndices.length).toBe(0);
    expect(emptyResult.faceIndices.length).toBe(0);
  });
});
