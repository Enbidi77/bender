import { describe, it, expect } from 'vitest';
import * as THREE from 'three';
import {
  exportOBJ,
  parseOBJToMeshData,
  parseMTL,
  importOBJ,
} from '../src/index.js';

describe('OBJ & MTL Support', () => {
  it('exports mesh into Wavefront .obj format with v, vn, vt, and f', () => {
    const scene = new THREE.Scene();
    const geo = new THREE.BoxGeometry(1, 2, 3);
    const mat = new THREE.MeshStandardMaterial({
      color: 0x2288cc,
      roughness: 0.4,
      metalness: 0.6,
    });
    mat.name = 'BoxMaterial';
    const mesh = new THREE.Mesh(geo, mat);
    mesh.name = 'TestBox';
    scene.add(mesh);

    const { obj, mtl, mtlFileName } = exportOBJ(scene, {
      includeMaterials: true,
      mtlFileName: 'testbox.mtl',
    });

    expect(obj).toContain('# Wavefront OBJ exported by Blender-ELT');
    expect(obj).toContain('mtllib testbox.mtl');
    expect(obj).toContain('o TestBox');
    expect(obj).toContain('usemtl BoxMaterial');
    expect(obj).toContain('v ');
    expect(obj).toContain('vn ');
    expect(obj).toContain('vt ');
    expect(obj).toContain('f ');

    expect(mtl).toBeDefined();
    expect(mtl).toContain('newmtl BoxMaterial');
    expect(mtl).toContain('Kd ');
    expect(mtl).toContain('Ks ');
    expect(mtl).toContain('Ns ');
    expect(mtlFileName).toBe('testbox.mtl');
  });

  it('supports upAxis Z transformation in OBJ export', () => {
    const scene = new THREE.Scene();
    const geo = new THREE.BufferGeometry();
    geo.setAttribute(
      'position',
      new THREE.BufferAttribute(new Float32Array([0, 10, 5, 0, 10, 0, 10, 10, 0]), 3)
    );
    const mesh = new THREE.Mesh(geo, new THREE.MeshBasicMaterial());
    scene.add(mesh);

    const { obj } = exportOBJ(scene, { upAxis: 'Z', includeMaterials: false });
    // When upAxis is Z, Y (10) and Z (5) are mapped to -Z and Y
    expect(obj).toContain('v 0.000000 -5.000000 10.000000');
  });

  it('parses OBJ text into IMeshData with vertex positions, normals, texture coords, and faces', () => {
    const rawObj = `
# Sample OBJ
v 0.0 0.0 0.0
v 1.0 0.0 0.0
v 1.0 1.0 0.0
v 0.0 1.0 0.0
vt 0.0 0.0
vt 1.0 0.0
vt 1.0 1.0
vt 0.0 1.0
vn 0.0 0.0 1.0
# Quad face with v/vt/vn format
f 1/1/1 2/2/1 3/3/1 4/4/1
`;

    const meshData = parseOBJToMeshData(rawObj);
    expect(meshData.vertices.length).toBeGreaterThan(0);
    expect(meshData.normals?.length).toBeGreaterThan(0);
    expect(meshData.uvs?.length).toBeGreaterThan(0);
    // A quad must be triangulated into 2 triangles (6 indices)
    expect(meshData.indices?.length).toBe(6);
  });

  it('parses OBJ with relative negative indices and generates missing normals', () => {
    const rawObj = `
v 0 0 0
v 2 0 0
v 2 2 0
# Triangle using relative indices
f -3 -2 -1
`;

    const meshData = parseOBJToMeshData(rawObj);
    expect(meshData.indices?.length).toBe(3);
    // Face normals should be computed automatically
    expect(meshData.normals).toBeDefined();
    expect(meshData.normals?.length).toBe(meshData.vertices.length);
  });

  it('parses companion .mtl text into MaterialDefinitions', () => {
    const rawMtl = `
# MTL file
newmtl CustomMetal
Kd 0.8 0.2 0.2
Ks 0.9 0.9 0.9
Ns 500
d 0.8
Ke 0.1 0.1 0.1
`;

    const materials = parseMTL(rawMtl);
    expect(materials['CustomMetal']).toBeDefined();
    const mat = materials['CustomMetal'];
    expect(mat.name).toBe('CustomMetal');
    expect(mat.config.metalness).toBeCloseTo(0.9);
    expect(mat.config.opacity).toBeCloseTo(0.8);
    expect(mat.config.transparent).toBe(true);
  });

  it('imports OBJ and MTL together into complete domain SceneNodes and Geometries', () => {
    const objText = `
o CustomMesh
v 0 0 0
v 1 0 0
v 0 1 0
f 1 2 3
`;
    const mtlText = `
newmtl BaseMat
Kd 0.5 0.5 0.5
`;

    const scene = importOBJ(objText, mtlText, { centerGeometry: true });
    expect(scene.root).toBeDefined();
    expect(Object.keys(scene.nodes).length).toBe(1);
    expect(Object.keys(scene.geometries).length).toBe(1);
    expect(Object.keys(scene.materials).length).toBeGreaterThan(0);

    const node = Object.values(scene.nodes)[0];
    expect(node.type).toBe('mesh');
  });
});
