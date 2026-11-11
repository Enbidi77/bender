import { describe, it, expect } from 'vitest';
import type { ProjectDocument, MeshNode, CameraNode, LightNode } from '@blender-elt/contracts';
import {
  serializeProject,
  deserializeProject,
  validateProjectDocument,
  createProjectMetadata,
  CURRENT_PROJECT_VERSION,
} from '../src/project.js';

describe('ProjectDocument (.belt / JSON) Serializer & Deserializer', () => {
  const sampleDocument: ProjectDocument = {
    version: CURRENT_PROJECT_VERSION,
    metadata: createProjectMetadata('Test Project', 'Tester'),
    root: {
      id: 'root',
      name: 'Scene Collection',
      type: 'root',
      childrenIds: ['mesh-1', 'cam-1', 'light-1'],
    },
    nodes: {
      'mesh-1': {
        id: 'mesh-1',
        name: 'Cube',
        type: 'mesh',
        geometryId: 'geo-1',
        materialId: 'mat-1',
        transform: {
          position: { x: 0, y: 1, z: 0 },
          rotation: { x: 0, y: 0, z: 0, order: 'XYZ' },
          scale: { x: 1, y: 1, z: 1 },
        },
        visible: true,
        locked: false,
        parentId: null,
        childrenIds: [],
        castShadow: true,
        receiveShadow: true,
      } as MeshNode,
      'cam-1': {
        id: 'cam-1',
        name: 'Camera',
        type: 'camera',
        projection: 'perspective',
        fov: 60,
        near: 0.1,
        far: 1000,
        zoom: 1,
        transform: {
          position: { x: 0, y: 5, z: 10 },
          rotation: { x: -0.4, y: 0, z: 0, order: 'XYZ' },
          scale: { x: 1, y: 1, z: 1 },
        },
        visible: true,
        locked: false,
        parentId: null,
        childrenIds: [],
      } as CameraNode,
      'light-1': {
        id: 'light-1',
        name: 'Key Light',
        type: 'light',
        lightType: 'directional',
        color: '#ffffff',
        intensity: 1.5,
        castShadow: true,
        transform: {
          position: { x: 5, y: 10, z: 5 },
          rotation: { x: 0, y: 0, z: 0, order: 'XYZ' },
          scale: { x: 1, y: 1, z: 1 },
        },
        visible: true,
        locked: false,
        parentId: null,
        childrenIds: [],
      } as LightNode,
    },
    geometries: {
      'geo-1': {
        vertices: new Float32Array([-0.5, -0.5, 0.5, 0.5, -0.5, 0.5, 0.5, 0.5, 0.5]),
        normals: new Float32Array([0, 0, 1, 0, 0, 1, 0, 0, 1]),
        uvs: new Float32Array([0, 0, 1, 0, 1, 1]),
        indices: new Uint32Array([0, 1, 2]),
      },
    },
    materials: {
      'mat-1': {
        id: 'mat-1',
        name: 'Glossy Red',
        type: 'pbr',
        config: {
          color: '#ff2222',
          roughness: 0.2,
          metalness: 0.8,
          emission: '#000000',
          opacity: 1,
          transparent: false,
          wireframe: false,
        },
      },
    },
  };

  it('validates a correct ProjectDocument', () => {
    const result = validateProjectDocument(sampleDocument);
    expect(result.success).toBe(true);
  });

  it('rejects an invalid ProjectDocument missing required fields', () => {
    const invalidDoc = {
      version: '1.0.0',
      metadata: { name: 'Invalid' },
      // missing root, nodes, geometries, materials
    };
    const result = validateProjectDocument(invalidDoc);
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.errors.length).toBeGreaterThan(0);
    }
  });

  it('serializes ProjectDocument to JSON with updated timestamp and normalized arrays', () => {
    const serialized = serializeProject(sampleDocument);
    expect(typeof serialized).toBe('string');
    const parsed = JSON.parse(serialized);
    expect(parsed.version).toBe(CURRENT_PROJECT_VERSION);
    expect(Array.isArray(parsed.geometries['geo-1'].vertices)).toBe(true);
    expect(parsed.metadata.updatedAt).toBeDefined();
  });

  it('deserializes JSON string back to full ProjectDocument and restores Float32Array', () => {
    const serialized = serializeProject(sampleDocument);
    const restored = deserializeProject(serialized);

    expect(restored.version).toBe(CURRENT_PROJECT_VERSION);
    expect(restored.root.childrenIds).toEqual(['mesh-1', 'cam-1', 'light-1']);
    expect(restored.nodes['mesh-1'].name).toBe('Cube');
    expect(restored.nodes['cam-1'].type).toBe('camera');
    expect(restored.nodes['light-1'].type).toBe('light');

    const geo = restored.geometries['geo-1'];
    expect(geo.vertices).toBeInstanceOf(Float32Array);
    expect(geo.vertices.length).toBe(9);
    expect(geo.indices).toBeInstanceOf(Uint32Array);
    expect(geo.indices?.length).toBe(3);

    const mat = restored.materials['mat-1'];
    expect(mat.config.color).toBe('#ff2222');
    expect(mat.config.roughness).toBe(0.2);
  });

  it('throws descriptive error on malformed JSON string', () => {
    expect(() => deserializeProject('{ invalid json ...')).toThrowError(
      /Failed to parse .belt project JSON/,
    );
  });

  it('throws descriptive error when version is missing', () => {
    const jsonWithoutVersion = JSON.stringify({
      metadata: { name: 'No version' },
      root: { id: 'root', name: 'Root', type: 'root', childrenIds: [] },
      nodes: {},
      geometries: {},
      materials: {},
    });
    expect(() => deserializeProject(jsonWithoutVersion)).toThrowError(/missing version identifier/);
  });
});
