import { describe, it, expect } from 'vitest';
import * as THREE from 'three';
import type { ProjectDocument, MeshNode } from '@blender-elt/contracts';
import {
  exportGLTF,
  exportGLB,
  importGLTF,
  importGLB,
  createProjectMetadata,
  CURRENT_PROJECT_VERSION,
} from '../src/index.js';

describe('GLTF & GLB Support', () => {
  const sampleProject: ProjectDocument = {
    version: CURRENT_PROJECT_VERSION,
    metadata: createProjectMetadata('GLTF Export Test', 'Tester'),
    root: {
      id: 'root',
      name: 'Scene Collection',
      type: 'root',
      childrenIds: ['mesh-cube'],
    },
    nodes: {
      'mesh-cube': {
        id: 'mesh-cube',
        name: 'TargetCube',
        type: 'mesh',
        geometryId: 'geo-cube',
        materialId: 'mat-gold',
        transform: {
          position: { x: 2, y: 3, z: -1 },
          rotation: { x: 0, y: 0.5, z: 0, order: 'XYZ' },
          scale: { x: 1.5, y: 1.5, z: 1.5 },
        },
        visible: true,
        locked: false,
        parentId: null,
        childrenIds: [],
        castShadow: true,
      } as MeshNode,
    },
    geometries: {
      'geo-cube': {
        vertices: new Float32Array([
          -1, -1, 1, 1, -1, 1, 1, 1, 1,
          -1, -1, 1, 1, 1, 1, -1, 1, 1,
        ]),
        normals: new Float32Array([
          0, 0, 1, 0, 0, 1, 0, 0, 1,
          0, 0, 1, 0, 0, 1, 0, 0, 1,
        ]),
        indices: new Uint32Array([0, 1, 2, 3, 4, 5]),
      },
    },
    materials: {
      'mat-gold': {
        id: 'mat-gold',
        name: 'Gold',
        type: 'pbr',
        config: {
          color: '#ffd700',
          roughness: 0.1,
          metalness: 0.95,
          emission: '#000000',
          opacity: 1,
          transparent: false,
          wireframe: false,
        },
      },
    },
  };

  it('exports glTF 2.0 JSON from ProjectDocument', async () => {
    const result = await exportGLTF(sampleProject, { prettyPrint: true });
    expect(typeof result).toBe('string');
    const parsed = JSON.parse(result as string);

    expect(parsed.asset).toBeDefined();
    expect(parsed.asset.version).toBe('2.0');
    expect(parsed.scenes).toBeDefined();
    expect(parsed.nodes.length).toBeGreaterThan(0);
    expect(parsed.materials.length).toBeGreaterThan(0);
  });

  it('exports binary GLB from ProjectDocument and THREE.Scene', async () => {
    const glbData = await exportGLB(sampleProject);
    expect(glbData).toBeInstanceOf(Uint8Array);
    expect(glbData.byteLength).toBeGreaterThan(100);

    // Verify GLB magic header (0x46546C67 = "glTF")
    const dataView = new DataView(glbData.buffer, glbData.byteOffset, glbData.byteLength);
    const magic = dataView.getUint32(0, true);
    expect(magic).toBe(0x46546c67);
  });

  it('imports glTF JSON and reconstructs SceneNodes, MeshData, and PBRMaterials', async () => {
    const gltfJson = (await exportGLTF(sampleProject, { prettyPrint: true })) as string;
    const imported = await importGLTF(gltfJson);

    expect(imported.root).toBeDefined();
    expect(Object.keys(imported.nodes).length).toBeGreaterThan(0);
    expect(Object.keys(imported.geometries).length).toBeGreaterThan(0);
    expect(Object.keys(imported.materials).length).toBeGreaterThan(0);

    const firstMeshNode = Object.values(imported.nodes).find((n) => n.type === 'mesh') as MeshNode;
    expect(firstMeshNode).toBeDefined();
    expect(firstMeshNode.name).toBe('TargetCube');

    // Check transform preservation
    expect(firstMeshNode.transform.position.x).toBeCloseTo(2);
    expect(firstMeshNode.transform.position.y).toBeCloseTo(3);
    expect(firstMeshNode.transform.position.z).toBeCloseTo(-1);
    expect(firstMeshNode.transform.scale.x).toBeCloseTo(1.5);

    // Check material reconstruction
    const mat = imported.materials[firstMeshNode.materialId!];
    expect(mat).toBeDefined();
    expect(mat.config.roughness).toBeCloseTo(0.1, 1);
    expect(mat.config.metalness).toBeCloseTo(0.95, 1);
  });

  it('imports binary GLB and roundtrips geometry successfully', async () => {
    const glbBuffer = await exportGLB(sampleProject);
    const imported = await importGLB(glbBuffer);

    expect(Object.keys(imported.nodes).length).toBeGreaterThan(0);
    const meshNode = Object.values(imported.nodes).find((n) => n.type === 'mesh') as MeshNode;
    expect(meshNode).toBeDefined();

    const geo = imported.geometries[meshNode.geometryId];
    expect(geo).toBeDefined();
    expect(geo.vertices.length).toBeGreaterThan(0);
  });

  it('supports centerGeometry and normalizeScale options during import', async () => {
    const scene = new THREE.Scene();
    const mesh = new THREE.Mesh(
      new THREE.BoxGeometry(10, 20, 30),
      new THREE.MeshStandardMaterial()
    );
    mesh.position.set(100, 200, 300);
    scene.add(mesh);

    const glb = await exportGLB(scene);
    const imported = await importGLTF(glb, {
      centerGeometry: true,
      normalizeScale: true,
    });

    const meshNode = Object.values(imported.nodes).find((n) => n.type === 'mesh') as MeshNode;
    expect(meshNode).toBeDefined();
    // Normalized scale should scale max dimension 30 to around 2.0
    expect(meshNode.transform.scale.x).toBeCloseTo(2 / 30);
  });
});
