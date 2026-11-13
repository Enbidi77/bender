import { describe, it, expect } from 'vitest';
import { generateCube, generatePlane, MeshTopology, applyMeshOperation } from '../src/index.js';

describe('Edit Mode Modeling Operations', () => {
  describe('Face Operations', () => {
    it('performs connected-region extrusion without generating duplicate internal walls', () => {
      // 2x2 quad plane (8 triangles)
      const planeData = generatePlane({ width: 4, height: 4, widthSegments: 2, heightSegments: 2 });
      const topology = MeshTopology.fromMeshData(planeData);

      const initialVertCount = topology.vertices.length;
      const initialFaceCount = topology.faces.length;

      // Select two adjacent faces sharing an internal edge: face 0 and face 1
      const selectedFaces = [0, 1];
      const result = topology.extrudeFacesRegion(selectedFaces, 2.0);

      expect(result.newVertexIndices.length).toBeGreaterThan(0);
      expect(result.newFaceIndices.length).toBeGreaterThan(0);
      expect(topology.vertices.length).toBeGreaterThan(initialVertCount);
      expect(topology.faces.length).toBeGreaterThan(initialFaceCount);

      // Verify validation passes (no degenerate or dangling elements)
      const val = topology.validate();
      expect(val.isValid).toBe(true);

      // Conversion to IMeshData succeeds
      const meshData = topology.toMeshData();
      expect(meshData.vertices.length).toBe(topology.vertices.length * 3);
      expect(meshData.indices!.length).toBe(topology.faces.length * 3);
    });

    it('performs individual face extrusion generating independent side walls', () => {
      const planeData = generatePlane({ width: 2, height: 2, widthSegments: 1, heightSegments: 1 });
      const topology = MeshTopology.fromMeshData(planeData);

      const initialFaces = topology.faces.length;
      const initialVerts = topology.vertices.length;

      // Extrude both triangles individually
      const result = topology.extrudeFacesIndividual([0, 1], 1.5);

      expect(result.newVertexIndices.length).toBe(6); // 3 verts per triangle * 2 = 6
      expect(topology.vertices.length).toBe(initialVerts + 6);
      expect(topology.faces.length).toBe(initialFaces + 12); // 3 side quads (6 triangles) per triangle * 2 = 12
    });

    it('insets selected faces with configurable thickness and depth', () => {
      const planeData = generatePlane({ width: 2, height: 2, widthSegments: 1, heightSegments: 1 });
      const topology = MeshTopology.fromMeshData(planeData);

      const initialFaces = topology.faces.length;
      const initialVerts = topology.vertices.length;

      const result = topology.insetFaces([0], 0.2, 0.5);

      expect(result.newVertexIndices.length).toBe(3);
      expect(topology.vertices.length).toBe(initialVerts + 3);
      expect(topology.faces.length).toBe(initialFaces + 6); // 3 perimeter quads = 6 triangles

      const val = topology.validate();
      expect(val.isValid).toBe(true);
    });

    it('triangulates polygon faces and flips normals', () => {
      // Create quad face topology
      const topology = new MeshTopology(
        [
          { index: 0, position: { x: 0, y: 0, z: 0 }, selected: false },
          { index: 1, position: { x: 2, y: 0, z: 0 }, selected: false },
          { index: 2, position: { x: 2, y: 2, z: 0 }, selected: false },
          { index: 3, position: { x: 0, y: 2, z: 0 }, selected: false },
        ],
        [],
        [{ index: 0, vertexIndices: [0, 1, 2, 3], selected: false }],
      );

      expect(topology.faces.length).toBe(1);
      const triRes = topology.triangulateFaces();
      expect(topology.faces.length).toBe(2); // Quad split into 2 triangles
      expect(triRes.newFaceIndices.length).toBe(2);

      // Flip normals
      const origZ = topology.faces[0].normal?.z ?? 1;
      topology.flipNormals([0]);
      expect(topology.faces[0].normal?.z).toBeCloseTo(-origZ, 2);
    });

    it('deletes faces with option to retain or delete unreferenced vertices', () => {
      const planeData = generatePlane({ width: 2, height: 2, widthSegments: 1, heightSegments: 1 });
      const topology = MeshTopology.fromMeshData(planeData);

      const origVertCount = topology.vertices.length;
      // Delete face 0 retaining unreferenced vertices
      topology.deleteFaces([0], false);
      expect(topology.faces.length).toBe(1);
      expect(topology.vertices.length).toBe(origVertCount);

      // Delete remaining face deleting unreferenced vertices
      topology.deleteFaces([0], true);
      expect(topology.faces.length).toBe(0);
      expect(topology.vertices.length).toBe(0);
    });

    it('dissolves adjacent coplanar faces into a single polygon', () => {
      const planeData = generatePlane({ width: 2, height: 2, widthSegments: 1, heightSegments: 1 });
      const topology = MeshTopology.fromMeshData(planeData);

      expect(topology.faces.length).toBe(2);
      topology.dissolveFaces([0, 1]);
      expect(topology.faces.length).toBe(1);
      expect(topology.faces[0].vertexIndices.length).toBe(4); // 4 outer vertices of the plane
    });

    it('fills open boundary loop and bridges edge loops', () => {
      // 1. Fill boundary loop
      const planeData = generatePlane({ width: 2, height: 2, widthSegments: 1, heightSegments: 1 });
      const topology = MeshTopology.fromMeshData(planeData);
      topology.deleteFaces([0, 1], false); // Leave 4 boundary vertices
      expect(topology.faces.length).toBe(0);

      const newFaceIdx = topology.fillBoundaryLoop([0, 1, 2, 3]);
      expect(newFaceIdx).toBeGreaterThanOrEqual(0);
      expect(topology.faces.length).toBe(1);

      // 2. Bridge edge loops
      const bridgeTopo = new MeshTopology(
        [
          // Loop A at z=0
          { index: 0, position: { x: 0, y: 0, z: 0 }, selected: false },
          { index: 1, position: { x: 1, y: 0, z: 0 }, selected: false },
          { index: 2, position: { x: 1, y: 1, z: 0 }, selected: false },
          { index: 3, position: { x: 0, y: 1, z: 0 }, selected: false },
          // Loop B at z=2
          { index: 4, position: { x: 0, y: 0, z: 2 }, selected: false },
          { index: 5, position: { x: 1, y: 0, z: 2 }, selected: false },
          { index: 6, position: { x: 1, y: 1, z: 2 }, selected: false },
          { index: 7, position: { x: 0, y: 1, z: 2 }, selected: false },
        ],
        [],
        [],
      );

      const bridgedFaces = bridgeTopo.bridgeEdgeLoops([0, 1, 2, 3], [4, 5, 6, 7]);
      expect(bridgedFaces.length).toBe(8); // 4 quads * 2 triangles = 8
      expect(bridgeTopo.faces.length).toBe(8);
    });
  });

  describe('Vertex Operations', () => {
    it('merges vertices at center and collapses degenerate faces', () => {
      const planeData = generatePlane({ width: 2, height: 2, widthSegments: 1, heightSegments: 1 });
      const topology = MeshTopology.fromMeshData(planeData);

      const initialVerts = topology.vertices.length;
      // Merge vertices 0 and 1
      topology.mergeVerticesAtCenter([0, 1]);

      expect(topology.vertices.length).toBe(initialVerts - 1);
      const val = topology.validate();
      expect(val.isValid).toBe(true);
    });

    it('merges vertices by distance using 3D spatial hash grid', () => {
      // Mesh with two nearly coincident vertices
      const topology = new MeshTopology(
        [
          { index: 0, position: { x: 0, y: 0, z: 0 }, selected: false },
          { index: 1, position: { x: 0.0001, y: 0, z: 0 }, selected: false }, // very close to 0
          { index: 2, position: { x: 0, y: 1, z: 0 }, selected: false },
          { index: 3, position: { x: 1, y: 1, z: 0 }, selected: false },
        ],
        [],
        [
          { index: 0, vertexIndices: [0, 2, 3], selected: false },
          { index: 1, vertexIndices: [1, 3, 2], selected: false },
        ],
      );

      expect(topology.vertices.length).toBe(4);
      topology.mergeVerticesByDistance(0.01);
      // Vertices 0 and 1 should merge
      expect(topology.vertices.length).toBeLessThan(4);
    });

    it('applies Laplacian vertex smoothing', () => {
      const planeData = generatePlane({ width: 2, height: 2, widthSegments: 2, heightSegments: 2 });
      const topology = MeshTopology.fromMeshData(planeData);

      // Displace center vertex
      const centerVert = topology.vertices[4];
      centerVert.position.z = 5.0;

      topology.smoothVertices([4], 0.5, 3);
      expect(centerVert.position.z).toBeLessThan(5.0);
      expect(centerVert.position.z).toBeGreaterThan(0.0);
    });

    it('deletes vertices with connected edges and faces', () => {
      const planeData = generatePlane({ width: 2, height: 2, widthSegments: 1, heightSegments: 1 });
      const topology = MeshTopology.fromMeshData(planeData);

      topology.deleteVertices([0]);
      expect(topology.vertices.length).toBe(3);
      expect(topology.faces.length).toBe(1); // One triangle removed that contained vertex 0
      const val = topology.validate();
      expect(val.isValid).toBe(true);
    });

    it('slides a vertex along an edge', () => {
      const planeData = generatePlane({ width: 2, height: 2, widthSegments: 1, heightSegments: 1 });
      const topology = MeshTopology.fromMeshData(planeData);

      const edge = topology.edges[0];
      const origP = { ...topology.vertices[edge.v1].position };
      topology.slideVertex(edge.v1, edge.index, 0.5);
      const newP = topology.vertices[edge.v1].position;
      const dist = Math.hypot(newP.x - origP.x, newP.y - origP.y, newP.z - origP.z);
      expect(dist).toBeGreaterThan(0);
    });
  });

  describe('Edge Operations', () => {
    it('creates an edge between two vertices', () => {
      const topology = new MeshTopology(
        [
          { index: 0, position: { x: 0, y: 0, z: 0 }, selected: false },
          { index: 1, position: { x: 1, y: 0, z: 0 }, selected: false },
        ],
        [],
        [],
      );

      const newEdge = topology.createEdge(0, 1);
      expect(newEdge.v1).toBe(0);
      expect(newEdge.v2).toBe(1);
      expect(topology.edges.length).toBe(1);
    });

    it('subdivides edges with custom cuts', () => {
      const planeData = generatePlane({ width: 2, height: 2, widthSegments: 1, heightSegments: 1 });
      const topology = MeshTopology.fromMeshData(planeData);

      const origVertCount = topology.vertices.length;
      topology.subdivideEdges([0], 2); // 2 cuts on edge 0
      expect(topology.vertices.length).toBe(origVertCount + 2);
    });

    it('detects edge loops and rings on quad topologies', () => {
      const quadTopo = new MeshTopology(
        [
          { index: 0, position: { x: 0, y: 0, z: 0 }, selected: false },
          { index: 1, position: { x: 1, y: 0, z: 0 }, selected: false },
          { index: 2, position: { x: 1, y: 1, z: 0 }, selected: false },
          { index: 3, position: { x: 0, y: 1, z: 0 }, selected: false },
          { index: 4, position: { x: 2, y: 0, z: 0 }, selected: false },
          { index: 5, position: { x: 2, y: 1, z: 0 }, selected: false },
        ],
        [],
        [
          { index: 0, vertexIndices: [0, 1, 2, 3], selected: false },
          { index: 1, vertexIndices: [1, 4, 5, 2], selected: false },
        ],
      );

      const loop = quadTopo.getEdgeLoop(0);
      expect(loop.length).toBeGreaterThanOrEqual(1);

      const ring = quadTopo.getEdgeRing(0);
      expect(ring.length).toBeGreaterThanOrEqual(1);
    });

    it('bevels edges with width and segments', () => {
      const cubeData = generateCube();
      const topology = MeshTopology.fromMeshData(cubeData);

      const initialVerts = topology.vertices.length;
      const res = topology.bevelEdges([0], 0.1, 1);

      expect(res.newFaceIndices.length).toBeGreaterThan(0);
      expect(topology.vertices.length).toBeGreaterThan(initialVerts);
    });

    it('dissolves and deletes edges', () => {
      const planeData = generatePlane({ width: 2, height: 2, widthSegments: 1, heightSegments: 1 });
      const topology = MeshTopology.fromMeshData(planeData);
      const adj = topology.getAdjacency();

      const sharedEdge = topology.edges.find(
        (e) => (adj.edgeToFaces.get(e.index)?.length ?? 0) === 2,
      )!;
      topology.deleteEdges([sharedEdge.index], true); // delete faces only
      expect(topology.faces.length).toBe(0);
    });
  });

  describe('Topology Tools: Loop Cut and Knife Cut', () => {
    it('performs loop cut across quad faces', () => {
      const quadTopo = new MeshTopology(
        [
          { index: 0, position: { x: 0, y: 0, z: 0 }, selected: false },
          { index: 1, position: { x: 2, y: 0, z: 0 }, selected: false },
          { index: 2, position: { x: 2, y: 2, z: 0 }, selected: false },
          { index: 3, position: { x: 0, y: 2, z: 0 }, selected: false },
        ],
        [],
        [{ index: 0, vertexIndices: [0, 1, 2, 3], selected: false }],
      );

      const res = quadTopo.loopCut(0, 0.5, 1);
      expect(res.newVertexIndices.length).toBe(2);
      expect(res.newFaceIndices.length).toBe(2);
      expect(quadTopo.faces.length).toBe(2);
    });

    it('splits edge and splits face via knife tool primitives', () => {
      const quadTopo = new MeshTopology(
        [
          { index: 0, position: { x: 0, y: 0, z: 0 }, selected: false },
          { index: 1, position: { x: 2, y: 0, z: 0 }, selected: false },
          { index: 2, position: { x: 2, y: 2, z: 0 }, selected: false },
          { index: 3, position: { x: 0, y: 2, z: 0 }, selected: false },
        ],
        [],
        [{ index: 0, vertexIndices: [0, 1, 2, 3], selected: false }],
      );

      // Knife split edge
      const newV = quadTopo.knifeSplitEdge(0, 0.5);
      expect(newV).toBeGreaterThanOrEqual(0);
      expect(quadTopo.vertices.length).toBe(5);

      // Knife split face between vertex 0 and 2
      const splitFaces = quadTopo.knifeSplitFace(0, 0, 2);
      expect(splitFaces.length).toBe(2);
      expect(quadTopo.faces.length).toBe(2);
    });
  });

  describe('Declarative applyMeshOperation Integration', () => {
    it('dispatches extrude, inset, bevel, and merge operations', () => {
      const planeData = generatePlane({ width: 2, height: 2, widthSegments: 1, heightSegments: 1 });
      const topology = MeshTopology.fromMeshData(planeData);

      // 1. Extrude
      applyMeshOperation(topology, {
        type: 'extrude',
        targetIndices: [0],
        parameters: { distance: 1.0, individual: true },
      });
      expect(topology.vertices.length).toBeGreaterThan(4);

      // 2. Inset
      applyMeshOperation(topology, {
        type: 'inset',
        targetIndices: [0],
        parameters: { thickness: 0.1 },
      });

      // 3. Bevel
      applyMeshOperation(topology, {
        type: 'bevel',
        targetIndices: [0],
        parameters: { width: 0.05, mode: 'edge' },
      });

      // 4. Merge
      applyMeshOperation(topology, {
        type: 'merge',
        targetIndices: [0, 1],
        parameters: { type: 'center' },
      });
    });
  });
});
