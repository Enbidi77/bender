import { describe, it, expect } from 'vitest';
import { generateCube, generatePlane, MeshTopology, applyMeshOperation } from '../src/index.js';

describe('Mesh Topology & Edit Mode Operations', () => {
  it('constructs topology from IMeshData with vertices, edges, faces, and normals', () => {
    const cubeData = generateCube();
    const topology = MeshTopology.fromMeshData(cubeData);

    expect(topology.vertices.length).toBeGreaterThan(0);
    expect(topology.faces.length).toBe(12); // Box has 6 sides * 2 triangles = 12 faces
    expect(topology.edges.length).toBeGreaterThan(0);
    expect(topology.faceNormals.length).toBe(topology.faces.length);

    // Verify normals are normalized
    for (const fn of topology.faceNormals) {
      const len = Math.sqrt(fn.x * fn.x + fn.y * fn.y + fn.z * fn.z);
      expect(len).toBeCloseTo(1.0, 3);
    }
  });

  it('supports vertex, edge, and face selection queries', () => {
    const planeData = generatePlane({ width: 2, height: 2, widthSegments: 1, heightSegments: 1 });
    const topology = MeshTopology.fromMeshData(planeData);

    expect(topology.getSelectedVertices().length).toBe(0);
    expect(topology.getSelectedFaces().length).toBe(0);

    topology.selectVertex(0, true);
    expect(topology.getSelectedVertexIndices()).toEqual([0]);

    topology.selectFace(1, true);
    expect(topology.getSelectedFaceIndices()).toEqual([1]);

    topology.selectAll('vertex');
    expect(topology.getSelectedVertices().length).toBe(topology.vertices.length);

    topology.deselectAll('vertex');
    expect(topology.getSelectedVertices().length).toBe(0);

    topology.setSelection('face', [0]);
    expect(topology.getSelection('face')).toEqual([0]);

    topology.invertSelection('face');
    expect(topology.getSelection('face')).toEqual([1]);
  });

  it('transforms vertices with translation, rotation, and scaling', () => {
    const planeData = generatePlane({ width: 2, height: 2, widthSegments: 1, heightSegments: 1 });
    const topology = MeshTopology.fromMeshData(planeData);

    const origY = topology.vertices[0].position.y;
    topology.translateVertices([0], { x: 0, y: 5, z: 0 });
    expect(topology.vertices[0].position.y).toBeCloseTo(origY + 5, 4);

    // Scale
    const origX = topology.vertices[1].position.x;
    topology.scaleVertices([1], { x: 2, y: 1, z: 1 }, { x: 0, y: 0, z: 0 });
    expect(topology.vertices[1].position.x).toBeCloseTo(origX * 2, 4);

    // Rotate 90 degrees around Z axis (x becomes -y, y becomes x)
    const testVertIndex = 2;
    topology.vertices[testVertIndex].position = { x: 1, y: 0, z: 0 };
    topology.rotateVertices([testVertIndex], { x: 0, y: 0, z: Math.PI / 2 }, { x: 0, y: 0, z: 0 });
    expect(topology.vertices[testVertIndex].position.x).toBeCloseTo(0, 3);
    expect(topology.vertices[testVertIndex].position.y).toBeCloseTo(1, 3);
  });

  it('performs basic face extrusion and updates topology', () => {
    const planeData = generatePlane({ width: 2, height: 2, widthSegments: 1, heightSegments: 1 });
    const topology = MeshTopology.fromMeshData(planeData);

    const initialFaceCount = topology.faces.length;
    const initialVertCount = topology.vertices.length;

    // Extrude face 0 by 1.0 along normal
    const result = topology.extrudeFace(0, 1.0);

    expect(result.newVertexIndices.length).toBe(3); // 3 extruded vertices for triangle
    expect(topology.vertices.length).toBe(initialVertCount + 3);
    // Original face replaced with top face + 3 side quads (6 side triangles) -> +6 faces
    expect(topology.faces.length).toBe(initialFaceCount + 6);

    // Convert to IMeshData and ensure valid
    const meshData = topology.toMeshData();
    expect(meshData.vertices.length).toBe(topology.vertices.length * 3);
    expect(meshData.indices!.length).toBe(topology.faces.length * 3);
  });

  it('subdivides mesh faces into 4 smaller triangles', () => {
    const planeData = generatePlane({ width: 2, height: 2, widthSegments: 1, heightSegments: 1 });
    const topology = MeshTopology.fromMeshData(planeData);

    expect(topology.faces.length).toBe(2);

    topology.subdivide(1);
    expect(topology.faces.length).toBe(8); // 2 * 4 = 8 faces

    // Midpoints should share vertices
    expect(topology.vertices.length).toBeGreaterThan(4);

    const meshData = topology.toMeshData();
    expect(meshData.indices!.length).toBe(24);
  });

  it('applies declarative operations via applyMeshOperation', () => {
    const planeData = generatePlane();
    const topology = MeshTopology.fromMeshData(planeData);

    // Flip normals
    const origNormY = topology.faceNormals[0].z;
    applyMeshOperation(topology, {
      type: 'flip-normals',
      targetIndices: [],
      parameters: {},
    });
    expect(topology.faceNormals[0].z).toBeCloseTo(-origNormY, 3);

    // Subdivide
    applyMeshOperation(topology, {
      type: 'subdivide',
      targetIndices: [],
      parameters: { iterations: 1 },
    });
    expect(topology.faces.length).toBe(8);

    // Delete face
    applyMeshOperation(topology, {
      type: 'delete',
      targetIndices: [0],
      parameters: {},
    });
    expect(topology.faces.length).toBe(7);
  });
});
