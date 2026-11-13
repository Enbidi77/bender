import { describe, it, expect } from 'vitest';
import { generateCube, generatePlane, MeshTopology, applyMeshOperation } from '../src/index.js';

describe('Mesh Topology & Data Structure Invariants', () => {
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

  it('builds comprehensive bidirectional adjacency structures', () => {
    const cubeData = generateCube();
    const topology = MeshTopology.fromMeshData(cubeData);
    const adj = topology.getAdjacency();

    // Verify vertexToEdges and vertexToFaces
    expect(adj.vertexToEdges.size).toBe(topology.vertices.length);
    expect(adj.vertexToFaces.size).toBe(topology.vertices.length);
    for (let i = 0; i < topology.vertices.length; i++) {
      expect(adj.vertexToEdges.get(i)!.length).toBeGreaterThan(0);
      expect(adj.vertexToFaces.get(i)!.length).toBeGreaterThan(0);
    }

    // Verify edgeToFaces
    expect(adj.edgeToFaces.size).toBe(topology.edges.length);
    for (let i = 0; i < topology.edges.length; i++) {
      const fList = adj.edgeToFaces.get(i)!;
      // Closed cube is a 2-manifold where each internal edge is shared by 2 triangles
      expect(fList.length).toBeGreaterThanOrEqual(1);
    }

    // Verify faceToEdges
    expect(adj.faceToEdges.size).toBe(topology.faces.length);
    for (let i = 0; i < topology.faces.length; i++) {
      expect(adj.faceToEdges.get(i)!.length).toBe(3); // Triangles have 3 edges
    }
  });

  it('detects boundary edges and closed boundary loops on an open mesh', () => {
    const planeData = generatePlane({ width: 2, height: 2, widthSegments: 1, heightSegments: 1 });
    const topology = MeshTopology.fromMeshData(planeData);

    const boundaryEdges = topology.getBoundaryEdges();
    expect(boundaryEdges.length).toBe(4); // 4 perimeter edges of square plane

    const boundaryLoops = topology.getBoundaryLoops();
    expect(boundaryLoops.length).toBe(1);
    expect(boundaryLoops[0].length).toBeGreaterThanOrEqual(4);

    const nonManifoldEdges = topology.getNonManifoldEdges();
    expect(nonManifoldEdges.length).toBe(0); // Clean 2-manifold with boundary
  });

  it('calculates face normals, centroids, face areas, and mesh surface area', () => {
    const planeData = generatePlane({ width: 2, height: 2, widthSegments: 1, heightSegments: 1 });
    const topology = MeshTopology.fromMeshData(planeData);

    const area = topology.getSurfaceArea();
    expect(area).toBeCloseTo(4.0, 3); // 2x2 plane area = 4

    const face0Area = topology.getFaceArea(0);
    expect(face0Area).toBeCloseTo(2.0, 3); // half of 4

    const normal0 = topology.getFaceNormal(0);
    expect(normal0.z).toBeCloseTo(1.0, 3);

    const centroid0 = topology.getFaceCentroid(0);
    expect(typeof centroid0.x).toBe('number');
    expect(typeof centroid0.y).toBe('number');
  });

  it('validates mesh invariants and computes topology statistics', () => {
    const cubeData = generateCube();
    const topology = MeshTopology.fromMeshData(cubeData);

    const validation = topology.validate();
    expect(validation.isValid).toBe(true);

    const stats = topology.getStats();
    expect(stats.vertexCount).toBe(topology.vertices.length);
    expect(stats.edgeCount).toBe(topology.edges.length);
    expect(stats.faceCount).toBe(12);
    expect(stats.triangleCount).toBe(12);
    expect(stats.quadCount).toBe(0);
    expect(stats.surfaceArea).toBeCloseTo(24.0, 1); // 6 faces * (2x2) = 24
  });

  it('reports dangling vertices and degenerate faces during validation', () => {
    const topology = new MeshTopology(
      [
        { index: 0, position: { x: 0, y: 0, z: 0 }, selected: false },
        { index: 1, position: { x: 1, y: 0, z: 0 }, selected: false },
        { index: 2, position: { x: 0, y: 1, z: 0 }, selected: false },
        { index: 3, position: { x: 5, y: 5, z: 5 }, selected: false }, // Dangling
      ],
      [
        { index: 0, v1: 0, v2: 1, selected: false },
        { index: 1, v1: 1, v2: 2, selected: false },
        { index: 2, v1: 2, v2: 0, selected: false },
      ],
      [
        { index: 0, vertexIndices: [0, 1, 2], selected: false },
        { index: 1, vertexIndices: [0, 0, 1], selected: false }, // Degenerate duplicate
      ],
    );

    const res = topology.validate();
    expect(res.isValid).toBe(false);
    expect(res.issues.some((i) => i.code === 'dangling-vertex')).toBe(true);
    expect(res.issues.some((i) => i.code === 'degenerate-face')).toBe(true);
  });

  it('traverses connected vertices and connected faces (flood-fill)', () => {
    const planeData = generatePlane({ width: 2, height: 2, widthSegments: 2, heightSegments: 2 });
    const topology = MeshTopology.fromMeshData(planeData);

    const connectedVerts = topology.getConnectedVertices(0);
    expect(connectedVerts.length).toBe(topology.vertices.length);

    const connectedFaces = topology.getConnectedFaces(0);
    expect(connectedFaces.length).toBe(topology.faces.length);
  });

  it('converts selections between vertex, edge, and face modes', () => {
    const planeData = generatePlane({ width: 2, height: 2, widthSegments: 1, heightSegments: 1 });
    const topology = MeshTopology.fromMeshData(planeData);

    // Select vertices 0, 1
    const edgeIndices = topology.verticesToEdges([topology.edges[0].v1, topology.edges[0].v2]);
    expect(edgeIndices).toContain(topology.edges[0].index);

    // Faces to vertices
    const faceVerts = topology.facesToVertices([0]);
    expect(faceVerts.length).toBe(3);

    // Grow and shrink selection
    topology.selectVertex(0, true);
    const grown = topology.growSelection('vertex');
    expect(grown.length).toBeGreaterThan(1);
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

  it('applies declarative operations via applyMeshOperation', () => {
    const planeData = generatePlane();
    const topology = MeshTopology.fromMeshData(planeData);

    // Flip normals
    const origNormZ = topology.faceNormals[0].z;
    applyMeshOperation(topology, {
      type: 'flip-normals',
      targetIndices: [],
      parameters: {},
    });
    expect(topology.faceNormals[0].z).toBeCloseTo(-origNormZ, 3);

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
      parameters: { target: 'only-faces' },
    });
    expect(topology.faces.length).toBe(7);
  });
});
