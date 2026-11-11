import { describe, it, expect } from 'vitest';
import * as THREE from 'three';
import type {
  IMeshData,
  MeshNode,
  LightNode,
  CameraNode,
  PBRMaterialConfig,
} from '@blender-elt/contracts';
import {
  meshDataToBufferGeometry,
  bufferGeometryToMeshData,
  pbrConfigToThreeMaterial,
  threeMaterialToPBR,
  beltToThree,
  threeToBelt,
  exportScene,
  importScene,
} from '../src/index.js';

describe('Bridge & Unified Converters', () => {
  it('converts IMeshData to THREE.BufferGeometry and back', () => {
    const original: IMeshData = {
      vertices: new Float32Array([0, 0, 0, 1, 0, 0, 0, 1, 0]),
      normals: new Float32Array([0, 0, 1, 0, 0, 1, 0, 0, 1]),
      uvs: new Float32Array([0, 0, 1, 0, 0, 1]),
      indices: new Uint32Array([0, 1, 2]),
    };

    const geometry = meshDataToBufferGeometry(original);
    expect(geometry.getAttribute('position').count).toBe(3);
    expect(geometry.getAttribute('normal').count).toBe(3);
    expect(geometry.getAttribute('uv').count).toBe(3);
    expect(geometry.getIndex()?.count).toBe(3);

    const convertedBack = bufferGeometryToMeshData(geometry);
    expect(convertedBack.vertices.length).toBe(9);
    expect(convertedBack.normals?.length).toBe(9);
    expect(convertedBack.uvs?.length).toBe(6);
    expect(convertedBack.indices?.length).toBe(3);
  });

  it('converts PBRMaterialConfig to THREE.MeshStandardMaterial and back', () => {
    const config: PBRMaterialConfig = {
      color: '#3388ff',
      roughness: 0.35,
      metalness: 0.9,
      emission: '#112233',
      emissionIntensity: 1.0,
      opacity: 0.95,
      transparent: true,
      wireframe: false,
    };

    const threeMat = pbrConfigToThreeMaterial(config, 'BlueMetal');
    expect(threeMat.name).toBe('BlueMetal');
    expect(threeMat.roughness).toBeCloseTo(0.35);
    expect(threeMat.metalness).toBeCloseTo(0.9);
    expect(threeMat.transparent).toBe(true);

    const { config: backConfig, name } = threeMaterialToPBR(threeMat);
    expect(name).toBe('BlueMetal');
    expect(backConfig.roughness).toBeCloseTo(0.35);
    expect(backConfig.metalness).toBeCloseTo(0.9);
    expect(backConfig.transparent).toBe(true);
  });

  it('converts domain scene nodes to THREE.Group and reconstructs back with threeToBelt', () => {
    const nodes = {
      'mesh-node': {
        id: 'mesh-node',
        name: 'TestMesh',
        type: 'mesh',
        geometryId: 'geo-1',
        materialId: 'mat-1',
        transform: {
          position: { x: 1, y: 2, z: 3 },
          rotation: { x: 0, y: 0, z: 0, order: 'XYZ' },
          scale: { x: 2, y: 2, z: 2 },
        },
        visible: true,
        locked: false,
        parentId: null,
        childrenIds: [],
      } as MeshNode,
      'cam-node': {
        id: 'cam-node',
        name: 'MainCam',
        type: 'camera',
        projection: 'perspective',
        fov: 50,
        near: 0.1,
        far: 500,
        zoom: 1,
        transform: {
          position: { x: 0, y: 0, z: 5 },
          rotation: { x: 0, y: 0, z: 0, order: 'XYZ' },
          scale: { x: 1, y: 1, z: 1 },
        },
        visible: true,
        locked: false,
        parentId: null,
        childrenIds: [],
      } as CameraNode,
      'light-node': {
        id: 'light-node',
        name: 'Sun',
        type: 'light',
        lightType: 'directional',
        color: '#ffffaa',
        intensity: 2.0,
        transform: {
          position: { x: 0, y: 10, z: 0 },
          rotation: { x: 0, y: 0, z: 0, order: 'XYZ' },
          scale: { x: 1, y: 1, z: 1 },
        },
        visible: true,
        locked: false,
        parentId: null,
        childrenIds: [],
      } as LightNode,
    };

    const geometries: Record<string, IMeshData> = {
      'geo-1': {
        vertices: new Float32Array([0, 0, 0, 1, 0, 0, 0, 1, 0]),
        normals: new Float32Array([0, 0, 1, 0, 0, 1, 0, 0, 1]),
        indices: new Uint32Array([0, 1, 2]),
      },
    };

    const materials = {
      'mat-1': {
        id: 'mat-1',
        name: 'TestMat',
        type: 'pbr' as const,
        config: {
          color: '#ffffff',
          roughness: 0.5,
          metalness: 0,
          emission: '#000000',
          opacity: 1,
          transparent: false,
          wireframe: false,
        },
      },
    };

    const group = beltToThree({ nodes, geometries, materials });
    expect(group.children.length).toBe(3);

    const imported = threeToBelt(group);
    expect(Object.keys(imported.nodes).length).toBe(3);
    expect(Object.keys(imported.geometries).length).toBe(1);
    expect(Object.keys(imported.materials).length).toBe(1);
  });

  it('runs unified exportScene and importScene for supported formats', async () => {
    const scene = new THREE.Scene();
    const mesh = new THREE.Mesh(
      new THREE.BoxGeometry(2, 2, 2),
      new THREE.MeshStandardMaterial({ color: 0x00ff00 }),
    );
    mesh.name = 'GreenBox';
    scene.add(mesh);

    // GLTF export & import
    const gltfExport = await exportScene('gltf', scene);
    expect(gltfExport.format).toBe('gltf');
    expect(typeof gltfExport.data === 'string').toBe(true);

    const gltfImport = await importScene('gltf', gltfExport.data);
    expect(Object.keys(gltfImport.nodes).length).toBeGreaterThan(0);

    // OBJ export & import
    const objExport = await exportScene('obj', scene);
    expect(objExport.format).toBe('obj');
    expect(typeof objExport.data === 'string').toBe(true);
    expect(objExport.data).toContain('GreenBox');

    const objImport = await importScene('obj', objExport.data as string);
    expect(Object.keys(objImport.nodes).length).toBeGreaterThan(0);

    // STL export & import
    const stlExport = await exportScene('stl', scene, { binary: false });
    expect(stlExport.format).toBe('stl');
    expect(typeof stlExport.data === 'string').toBe(true);
    expect(stlExport.data).toContain('solid BlenderELT');

    const stlImport = await importScene('stl', stlExport.data as string);
    expect(Object.keys(stlImport.nodes).length).toBe(1);
  });
});
