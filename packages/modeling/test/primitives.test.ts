import { describe, it, expect } from 'vitest';
import {
  generateCube,
  generateSphere,
  generateCylinder,
  generateCone,
  generatePlane,
  generateTorus,
  generatePrimitive,
  meshDataToBufferGeometry,
  bufferGeometryToMeshData,
} from '../src/index.js';

describe('Procedural Primitive Generators', () => {
  it('generates cube with default and custom parameters', () => {
    const defaultCube = generateCube();
    expect(defaultCube.vertices).toBeInstanceOf(Float32Array);
    expect(defaultCube.normals).toBeInstanceOf(Float32Array);
    expect(defaultCube.uvs).toBeInstanceOf(Float32Array);
    expect(
      defaultCube.indices instanceof Uint16Array || defaultCube.indices instanceof Uint32Array,
    ).toBe(true);
    expect(defaultCube.vertices.length).toBeGreaterThan(0);
    expect(defaultCube.indices!.length).toBe(36); // 12 triangles * 3

    const customCube = generateCube({
      size: 4,
      widthSegments: 2,
      heightSegments: 2,
      depthSegments: 2,
    });
    expect(customCube.vertices.length).toBeGreaterThan(defaultCube.vertices.length);
  });

  it('generates sphere with customizable radius and segments', () => {
    const sphere = generateSphere({ radius: 2.5, widthSegments: 16, heightSegments: 8 });
    expect(sphere.vertices).toBeInstanceOf(Float32Array);
    expect(sphere.normals).toBeInstanceOf(Float32Array);
    expect(sphere.uvs).toBeInstanceOf(Float32Array);
    expect(sphere.indices).toBeDefined();

    // Verify radius of first vertex
    const x0 = sphere.vertices[0];
    const y0 = sphere.vertices[1];
    const z0 = sphere.vertices[2];
    const dist = Math.sqrt(x0 * x0 + y0 * y0 + z0 * z0);
    expect(dist).toBeCloseTo(2.5, 3);
  });

  it('generates cylinder with radius and height parameters', () => {
    const cylinder = generateCylinder({
      radiusTop: 1.5,
      radiusBottom: 1.5,
      height: 4,
      radialSegments: 24,
    });
    expect(cylinder.vertices).toBeInstanceOf(Float32Array);
    expect(cylinder.normals).toBeInstanceOf(Float32Array);
    expect(cylinder.uvs).toBeInstanceOf(Float32Array);
    expect(cylinder.indices!.length).toBeGreaterThan(0);
  });

  it('generates cone with radius, height and radialSegments', () => {
    const cone = generateCone({ radius: 2, height: 3, radialSegments: 16 });
    expect(cone.vertices).toBeInstanceOf(Float32Array);
    expect(cone.normals).toBeInstanceOf(Float32Array);
    expect(cone.indices!.length).toBeGreaterThan(0);
  });

  it('generates plane with width, height and segments', () => {
    const plane = generatePlane({ width: 5, height: 5, widthSegments: 2, heightSegments: 2 });
    expect(plane.vertices).toBeInstanceOf(Float32Array);
    expect(plane.normals).toBeInstanceOf(Float32Array);
    expect(plane.indices!.length).toBe(24); // 4 quads * 2 triangles * 3 = 24
  });

  it('generates torus with radius, tube, radial and tubular segments', () => {
    const torus = generateTorus({
      radius: 3,
      tube: 0.8,
      radialSegments: 12,
      tubularSegments: 24,
    });
    expect(torus.vertices).toBeInstanceOf(Float32Array);
    expect(torus.normals).toBeInstanceOf(Float32Array);
    expect(torus.uvs).toBeInstanceOf(Float32Array);
    expect(torus.indices!.length).toBe(12 * 24 * 6);
  });

  it('generates all primitive types via unified generatePrimitive', () => {
    const types = ['cube', 'sphere', 'cylinder', 'cone', 'plane', 'torus'] as const;
    for (const t of types) {
      const mesh = generatePrimitive(t);
      expect(mesh.vertices).toBeInstanceOf(Float32Array);
      expect(mesh.normals).toBeInstanceOf(Float32Array);
      expect(mesh.uvs).toBeInstanceOf(Float32Array);
      expect(mesh.indices).toBeDefined();
    }
  });

  it('converts between Three.js BufferGeometry and IMeshData cleanly', () => {
    const cubeData = generateCube({ size: 2 });
    const geom = meshDataToBufferGeometry(cubeData);
    expect(geom.getAttribute('position')).toBeDefined();
    expect(geom.getAttribute('normal')).toBeDefined();
    expect(geom.getAttribute('uv')).toBeDefined();
    expect(geom.getIndex()).toBeDefined();

    const roundTrip = bufferGeometryToMeshData(geom);
    expect(roundTrip.vertices.length).toBe(cubeData.vertices.length);
    expect(roundTrip.indices!.length).toBe(cubeData.indices!.length);
    geom.dispose();
  });
});
