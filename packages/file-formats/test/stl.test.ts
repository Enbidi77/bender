import { describe, it, expect } from 'vitest';
import * as THREE from 'three';
import {
  exportSTL,
  exportBinarySTL,
  exportAsciiSTL,
  parseSTLToMeshData,
  importSTL,
} from '../src/index.js';

describe('STL Support (Binary & ASCII)', () => {
  const createTestMesh = (): THREE.Mesh => {
    const geo = new THREE.BufferGeometry();
    const vertices = new Float32Array([0, 0, 0, 1, 0, 0, 0, 1, 0, 1, 0, 0, 1, 1, 0, 0, 1, 0]);
    geo.setAttribute('position', new THREE.BufferAttribute(vertices, 3));
    geo.computeVertexNormals();
    return new THREE.Mesh(geo, new THREE.MeshBasicMaterial());
  };

  it('exports scene meshes into ASCII STL format', () => {
    const mesh = createTestMesh();
    mesh.name = 'TestPlane';

    const asciiOutput = exportAsciiSTL(mesh);
    expect(typeof asciiOutput).toBe('string');
    expect(asciiOutput).toContain('solid BlenderELT');
    expect(asciiOutput).toContain('facet normal');
    expect(asciiOutput).toContain('outer loop');
    expect(asciiOutput).toContain('vertex ');
    expect(asciiOutput).toContain('endloop');
    expect(asciiOutput).toContain('endfacet');
    expect(asciiOutput).toContain('endsolid BlenderELT');
  });

  it('exports scene meshes into binary STL format with correct header and triangle count', () => {
    const mesh = createTestMesh();
    const binaryOutput = exportBinarySTL(mesh);

    expect(binaryOutput).toBeInstanceOf(Uint8Array);
    // Two triangles = 84 + 2 * 50 = 184 bytes
    expect(binaryOutput.byteLength).toBe(184);

    const view = new DataView(
      binaryOutput.buffer,
      binaryOutput.byteOffset,
      binaryOutput.byteLength,
    );
    const triangleCount = view.getUint32(80, true);
    expect(triangleCount).toBe(2);
  });

  it('parses ASCII STL into IMeshData with vertices, normals, and indices', () => {
    const asciiSTL = `
solid SimpleFacet
  facet normal 0 0 1
    outer loop
      vertex 0 0 0
      vertex 1 0 0
      vertex 0 1 0
    endloop
  endfacet
endsolid SimpleFacet
`;

    const meshData = parseSTLToMeshData(asciiSTL);
    expect(meshData.vertices.length).toBe(9);
    expect(meshData.normals?.length).toBe(9);
    expect(meshData.indices?.length).toBe(3);

    expect(meshData.vertices[0]).toBeCloseTo(0);
    expect(meshData.vertices[3]).toBeCloseTo(1);
    expect(meshData.normals?.[2]).toBeCloseTo(1);
  });

  it('parses binary STL into IMeshData correctly', () => {
    const mesh = createTestMesh();
    const binaryBytes = exportBinarySTL(mesh);

    const meshData = parseSTLToMeshData(binaryBytes);
    expect(meshData.vertices.length).toBe(18); // 2 triangles * 3 vertices * 3 coords
    expect(meshData.normals?.length).toBe(18);
    expect(meshData.indices?.length).toBe(6);
  });

  it('roundtrips binary and ASCII STL through exportSTL and importSTL', () => {
    const mesh = createTestMesh();

    // Binary roundtrip
    const binData = exportSTL(mesh, { binary: true });
    const binImported = importSTL(binData);
    expect(Object.keys(binImported.nodes).length).toBe(1);
    expect(Object.keys(binImported.geometries).length).toBe(1);
    const binGeo = Object.values(binImported.geometries)[0];
    expect(binGeo.vertices.length).toBe(18);

    // ASCII roundtrip
    const asciiData = exportSTL(mesh, { binary: false });
    const asciiImported = importSTL(asciiData, { centerGeometry: true });
    expect(Object.keys(asciiImported.nodes).length).toBe(1);
    const asciiGeo = Object.values(asciiImported.geometries)[0];
    expect(asciiGeo.vertices.length).toBe(18);
  });
});
