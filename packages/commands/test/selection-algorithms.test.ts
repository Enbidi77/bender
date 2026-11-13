import { describe, it, expect } from 'vitest';
import type { IMeshData, EditMeshSelectionState } from '@blender-elt/contracts';
import {
  SelectionTopology,
  buildSelectionTopology,
  convertVertexToEdgeSelection,
  convertEdgeToFaceSelection,
  convertFaceToVertexSelection,
  convertFaceToEdgeSelection,
  convertVertexToFaceSelection,
  convertEdgeToVertexSelection,
  convertSelection,
  switchSelectionMode,
  selectAllElements,
  deselectAllElements,
  invertElementSelection,
  selectLinked,
  selectLinkedIsland,
  growSelection,
  shrinkSelection,
  getBoundaryEdges,
  getNonManifoldEdges,
  getNonManifoldVertices,
  selectBoundaryOrNonManifold,
  selectEdgeLoop,
  selectEdgeRing,
  computeMedianPoint,
  computeBoundingBox,
} from '../src/index.js';

describe('packages/commands - Selection Algorithms & Conversions', () => {
  // Helper: Create a single quad formed by 2 triangles:
  // v0 (0,0,0) - v1 (1,0,0)
  //  |          /  |
  // v3 (0,1,0) - v2 (1,1,0)
  // T0: (v0, v1, v2)
  // T1: (v0, v2, v3)
  const singleQuadMeshData: IMeshData = {
    vertices: new Float32Array([
      0,
      0,
      0, // v0
      1,
      0,
      0, // v1
      1,
      1,
      0, // v2
      0,
      1,
      0, // v3
    ]),
    indices: new Uint16Array([
      0,
      1,
      2, // Face 0
      0,
      2,
      3, // Face 1
    ]),
  };

  // Helper: Create a 2x2 quad grid (9 vertices, 4 quads / 8 triangles)
  // v6(0,2) - v7(1,2) - v8(2,2)
  //  |   Q2    |   Q3    |
  // v3(0,1) - v4(1,1) - v5(2,1)
  //  |   Q0    |   Q1    |
  // v0(0,0) - v1(1,0) - v2(2,0)
  const create2x2Grid = (): IMeshData => {
    const vertices = new Float32Array([
      0,
      0,
      0,
      1,
      0,
      0,
      2,
      0,
      0, // 0, 1, 2
      0,
      1,
      0,
      1,
      1,
      0,
      2,
      1,
      0, // 3, 4, 5
      0,
      2,
      0,
      1,
      2,
      0,
      2,
      2,
      0, // 6, 7, 8
    ]);
    const indices = new Uint16Array([
      // Q0: (0, 1, 4, 3)
      0, 1, 4, 0, 4, 3,
      // Q1: (1, 2, 5, 4)
      1, 2, 5, 1, 5, 4,
      // Q2: (3, 4, 7, 6)
      3, 4, 7, 3, 7, 6,
      // Q3: (4, 5, 8, 7)
      4, 5, 8, 4, 8, 7,
    ]);
    return { vertices, indices };
  };

  describe('Topology Construction & Adjacencies', () => {
    it('constructs correct vertex and edge count from mesh data', () => {
      const topo = buildSelectionTopology(singleQuadMeshData);
      expect(topo.vertices.length).toBe(4);
      expect(topo.faces.length).toBe(2);
      // Quad split diagonally has 5 unique edges: (0,1), (1,2), (2,0), (2,3), (3,0)
      expect(topo.edges.length).toBe(5);
    });

    it('indexes vertex-to-edge and edge-to-face adjacencies accurately', () => {
      const topo = buildSelectionTopology(singleQuadMeshData);
      // Edge (0, 2) is the shared diagonal edge
      const diagEdgeIdx = topo.findEdge(0, 2);
      expect(diagEdgeIdx).toBeDefined();

      const facesSharingDiag = topo.edgeToFaces.get(diagEdgeIdx!);
      expect(facesSharingDiag?.size).toBe(2);
      expect(facesSharingDiag?.has(0)).toBe(true);
      expect(facesSharingDiag?.has(1)).toBe(true);

      // Edge (0, 1) is a boundary edge
      const bEdgeIdx = topo.findEdge(0, 1);
      expect(bEdgeIdx).toBeDefined();
      expect(topo.edgeToFaces.get(bEdgeIdx!)?.size).toBe(1);
    });
  });

  describe('Mode Conversion Rules (Blender standard)', () => {
    it('Vertex -> Edge: selects edge only when BOTH vertices are selected', () => {
      const topo = buildSelectionTopology(singleQuadMeshData);
      // Select only v0 and v1
      const edge01 = topo.findEdge(0, 1)!;
      const converted = convertVertexToEdgeSelection([0, 1], topo);
      expect(converted).toEqual([edge01]);

      // Select v0, v1, v2 -> should select edges (0,1), (1,2), (0,2)
      const converted3 = convertVertexToEdgeSelection([0, 1, 2], topo);
      expect(converted3).toHaveLength(3);
      expect(converted3).toContain(topo.findEdge(0, 1));
      expect(converted3).toContain(topo.findEdge(1, 2));
      expect(converted3).toContain(topo.findEdge(0, 2));
    });

    it('Edge -> Face: selects face only when ALL boundary edges of face are selected', () => {
      const topo = buildSelectionTopology(singleQuadMeshData);
      const e01 = topo.findEdge(0, 1)!;
      const e12 = topo.findEdge(1, 2)!;
      const e02 = topo.findEdge(0, 2)!;

      // Select only 2 out of 3 edges of Face 0
      const partial = convertEdgeToFaceSelection([e01, e12], topo);
      expect(partial).toEqual([]);

      // Select all 3 edges of Face 0
      const full = convertEdgeToFaceSelection([e01, e12, e02], topo);
      expect(full).toEqual([0]);
    });

    it('Face -> Vertex: selects all vertices in any selected face', () => {
      const topo = buildSelectionTopology(singleQuadMeshData);
      // Face 0 has vertices [0, 1, 2]
      const verts = convertFaceToVertexSelection([0], topo);
      expect(verts).toEqual([0, 1, 2]);

      // Face 0 and Face 1 share [0, 2] and include 1, 3
      const allVerts = convertFaceToVertexSelection([0, 1], topo);
      expect(allVerts).toEqual([0, 1, 2, 3]);
    });

    it('Face -> Edge: selects all edges in any selected face', () => {
      const topo = buildSelectionTopology(singleQuadMeshData);
      const edges = convertFaceToEdgeSelection([0], topo);
      expect(edges).toHaveLength(3);
      expect(edges).toContain(topo.findEdge(0, 1));
      expect(edges).toContain(topo.findEdge(1, 2));
      expect(edges).toContain(topo.findEdge(0, 2));
    });

    it('Vertex -> Face: selects face only when ALL vertices are selected', () => {
      const topo = buildSelectionTopology(singleQuadMeshData);
      expect(convertVertexToFaceSelection([0, 1], topo)).toEqual([]);
      expect(convertVertexToFaceSelection([0, 1, 2], topo)).toEqual([0]);
      expect(convertVertexToFaceSelection([0, 1, 2, 3], topo)).toEqual([0, 1]);
    });

    it('Edge -> Vertex: selects all vertices of selected edges', () => {
      const topo = buildSelectionTopology(singleQuadMeshData);
      const e01 = topo.findEdge(0, 1)!;
      expect(convertEdgeToVertexSelection([e01], topo)).toEqual([0, 1]);
    });

    it('Unified convertSelection handles all conversions seamlessly', () => {
      const topo = buildSelectionTopology(singleQuadMeshData);
      expect(convertSelection('vertex', 'edge', [0, 1], topo)).toEqual([topo.findEdge(0, 1)!]);
      expect(convertSelection('vertex', 'face', [0, 1, 2], topo)).toEqual([0]);
      expect(convertSelection('face', 'vertex', [0], topo)).toEqual([0, 1, 2]);
    });

    it('switchSelectionMode transforms EditMeshSelectionState correctly', () => {
      const topo = buildSelectionTopology(singleQuadMeshData);
      const initial: EditMeshSelectionState = {
        elementModes: ['vertex'],
        selectedVertexIndices: [0, 1, 2],
        selectedEdgeIndices: [],
        selectedFaceIndices: [],
        activeVertexIndex: 2,
        activeEdgeIndex: null,
        activeFaceIndex: null,
      };

      const switched = switchSelectionMode(initial, 'face', topo);
      expect(switched.elementModes).toEqual(['face']);
      expect(switched.selectedFaceIndices).toEqual([0]);
      expect(switched.activeFaceIndex).toBe(0);
    });
  });

  describe('Select All, Deselect All, Invert Selection', () => {
    it('selectAllElements selects all elements of active mode', () => {
      const topo = buildSelectionTopology(singleQuadMeshData);
      expect(selectAllElements('vertex', topo)).toEqual([0, 1, 2, 3]);
      expect(selectAllElements('edge', topo)).toHaveLength(5);
      expect(selectAllElements('face', topo)).toEqual([0, 1]);
    });

    it('deselectAllElements returns empty array', () => {
      expect(deselectAllElements()).toEqual([]);
    });

    it('invertElementSelection inverts current selection', () => {
      const topo = buildSelectionTopology(singleQuadMeshData);
      expect(invertElementSelection('vertex', [0, 2], topo)).toEqual([1, 3]);
      expect(invertElementSelection('face', [0], topo)).toEqual([1]);
    });
  });

  describe('Select Linked / Connected Components ("L")', () => {
    // Two disconnected triangles: T0: (0,1,2), T1: (3,4,5)
    const twoIslands: IMeshData = {
      vertices: new Float32Array([
        0,
        0,
        0,
        1,
        0,
        0,
        0,
        1,
        0, // Island 1
        10,
        0,
        0,
        11,
        0,
        0,
        10,
        1,
        0, // Island 2
      ]),
      indices: new Uint16Array([
        0,
        1,
        2, // Face 0
        3,
        4,
        5, // Face 1
      ]),
    };

    it('selects only the connected component of the seed vertex', () => {
      const topo = buildSelectionTopology(twoIslands);
      const linkedFrom0 = selectLinked('vertex', [0], topo);
      expect(linkedFrom0).toEqual([0, 1, 2]);

      const linkedFrom4 = selectLinked('vertex', [4], topo);
      expect(linkedFrom4).toEqual([3, 4, 5]);
    });

    it('selectLinkedIsland returns vertices, edges, and faces of island', () => {
      const topo = buildSelectionTopology(twoIslands);
      const island = selectLinkedIsland({ mode: 'face', index: 0 }, topo);
      expect(island.vertexIndices).toEqual([0, 1, 2]);
      expect(island.faceIndices).toEqual([0]);
      expect(island.edgeIndices).toHaveLength(3);
    });
  });

  describe('Grow & Shrink Selection', () => {
    it('growSelection expands vertex selection to immediate neighbors', () => {
      const topo = buildSelectionTopology(create2x2Grid());
      // Center vertex is v4
      const grown = growSelection('vertex', [4], topo, 1);
      // v4 connects to neighbors (1, 3, 5, 7, etc.)
      expect(grown).toContain(4);
      expect(grown).toContain(1);
      expect(grown).toContain(3);
      expect(grown).toContain(5);
      expect(grown).toContain(7);
      expect(grown.length).toBeGreaterThan(4);
    });

    it('shrinkSelection contracts boundary elements', () => {
      const topo = buildSelectionTopology(create2x2Grid());
      const allVerts = selectAllElements('vertex', topo);
      expect(allVerts).toHaveLength(9);

      // Shrinking full 2x2 grid leaves only the interior vertex v4
      const shrunk = shrinkSelection('vertex', allVerts, topo, 1);
      expect(shrunk).toEqual([4]);
    });

    it('shrinkSelection on fully shrunk set does not crash', () => {
      const topo = buildSelectionTopology(singleQuadMeshData);
      const empty = shrinkSelection('face', [0], topo, 1);
      expect(empty).toEqual([]);
    });
  });

  describe('Boundary Edges & Non-Manifold Elements', () => {
    it('detects boundary edges on an open quad mesh', () => {
      const topo = buildSelectionTopology(singleQuadMeshData);
      const bEdges = getBoundaryEdges(topo);
      // In a single quad (4 perimeter edges and 1 interior diagonal), 4 are boundary edges
      expect(bEdges).toHaveLength(4);
      const diagEdge = topo.findEdge(0, 2)!;
      expect(bEdges).not.toContain(diagEdge);
    });

    it('identifies non-manifold edges when 3 faces share an edge', () => {
      // Mesh with 3 triangles sharing edge (0, 1)
      const nonManifoldData: IMeshData = {
        vertices: new Float32Array([0, 0, 0, 1, 0, 0, 0, 1, 0, 0, -1, 0, 0, 0, 1]),
        indices: new Uint16Array([
          0,
          1,
          2, // F0
          0,
          1,
          3, // F1
          0,
          1,
          4, // F2
        ]),
      };
      const topo = buildSelectionTopology(nonManifoldData);
      const nmEdges = getNonManifoldEdges(topo);
      const sharedEdge = topo.findEdge(0, 1)!;
      expect(nmEdges).toContain(sharedEdge);

      const nmVerts = getNonManifoldVertices(topo);
      expect(nmVerts).toContain(0);
      expect(nmVerts).toContain(1);
    });

    it('selectBoundaryOrNonManifold returns matching element indices', () => {
      const topo = buildSelectionTopology(singleQuadMeshData);
      const boundaryEdges = selectBoundaryOrNonManifold('edge', 'boundary', topo);
      expect(boundaryEdges).toHaveLength(4);

      const boundaryVerts = selectBoundaryOrNonManifold('vertex', 'boundary', topo);
      expect(boundaryVerts).toEqual([0, 1, 2, 3]);
    });
  });

  describe('Edge Loop & Edge Ring Selection', () => {
    it('selectEdgeLoop traces boundary loop along perimeter', () => {
      const topo = buildSelectionTopology(create2x2Grid());
      // Edge (0, 1) is a bottom boundary edge
      const startEdge = topo.findEdge(0, 1)!;
      const loop = selectEdgeLoop(startEdge, topo);
      expect(loop).toContain(startEdge);
      expect(loop.length).toBeGreaterThan(1);
      // All edges in this boundary loop should be boundary edges
      const boundaryEdges = new Set(getBoundaryEdges(topo));
      for (const eIdx of loop) {
        expect(boundaryEdges.has(eIdx)).toBe(true);
      }
    });

    it('selectEdgeRing traces parallel edges across quad faces', () => {
      // Native quad mesh representation: 2 quads side by side
      // v0 - v1 - v2
      //  |   |    |
      // v3 - v4 - v5
      const quadFacesTopology = buildSelectionTopology({
        vertices: new Float32Array([0, 0, 0, 1, 0, 0, 2, 0, 0, 0, 1, 0, 1, 1, 0, 2, 1, 0]),
        faces: [{ vertexIndices: [0, 1, 4, 3] }, { vertexIndices: [1, 2, 5, 4] }],
      });

      const leftEdge = quadFacesTopology.findEdge(0, 3)!;
      const midEdge = quadFacesTopology.findEdge(1, 4)!;
      const rightEdge = quadFacesTopology.findEdge(2, 5)!;

      const ring = selectEdgeRing(leftEdge, quadFacesTopology);
      expect(ring).toContain(leftEdge);
      expect(ring).toContain(midEdge);
      expect(ring).toContain(rightEdge);
    });
  });

  describe('Centroid & Bounding Box Utilities', () => {
    it('computes median point accurately', () => {
      const positions = new Float32Array([0, 0, 0, 2, 0, 0, 0, 2, 0, 2, 2, 0]);
      const median = computeMedianPoint(positions, [0, 1, 2, 3]);
      expect(median.x).toBeCloseTo(1);
      expect(median.y).toBeCloseTo(1);
      expect(median.z).toBeCloseTo(0);
    });

    it('computes bounding box accurately', () => {
      const positions = new Float32Array([-1, -2, -3, 4, 5, 6]);
      const bbox = computeBoundingBox(positions);
      expect(bbox.min).toEqual({ x: -1, y: -2, z: -3 });
      expect(bbox.max).toEqual({ x: 4, y: 5, z: 6 });
      expect(bbox.center).toEqual({ x: 1.5, y: 1.5, z: 1.5 });
      expect(bbox.size).toEqual({ x: 5, y: 7, z: 9 });
    });
  });
});
