import type {
  Vector3,
  IMeshData,
  EditElementMode,
  EditMeshSelectionState,
} from '@blender-elt/contracts';

/**
 * Lightweight topology vertex representation
 */
export interface TopologyVertex {
  index: number;
  position: Vector3;
}

/**
 * Lightweight topology edge representation
 */
export interface TopologyEdge {
  index: number;
  v1: number;
  v2: number;
}

/**
 * Lightweight topology face representation
 */
export interface TopologyFace {
  index: number;
  vertexIndices: number[];
  edgeIndices: number[];
  normal?: Vector3;
}

/**
 * Topology graph data structure optimized for Edit Mode selection algorithms,
 * boundary detection, island traversal, and edge loop/ring traversal.
 */
export class SelectionTopology {
  public vertices: TopologyVertex[] = [];
  public edges: TopologyEdge[] = [];
  public faces: TopologyFace[] = [];

  // Adjacency mappings
  public vertexToEdges: Map<number, Set<number>> = new Map();
  public vertexToFaces: Map<number, Set<number>> = new Map();
  public edgeToFaces: Map<number, Set<number>> = new Map();
  public edgeLookup: Map<string, number> = new Map(); // key "minV_maxV" -> edgeIndex

  constructor(
    vertices: TopologyVertex[] = [],
    edges: TopologyEdge[] = [],
    faces: TopologyFace[] = [],
  ) {
    this.vertices = vertices;
    this.edges = edges;
    this.faces = faces;
    this.buildAdjacencies();
  }

  private buildAdjacencies(): void {
    this.vertexToEdges.clear();
    this.vertexToFaces.clear();
    this.edgeToFaces.clear();
    this.edgeLookup.clear();

    for (let i = 0; i < this.vertices.length; i++) {
      this.vertexToEdges.set(i, new Set());
      this.vertexToFaces.set(i, new Set());
    }

    for (const edge of this.edges) {
      const minV = Math.min(edge.v1, edge.v2);
      const maxV = Math.max(edge.v1, edge.v2);
      this.edgeLookup.set(`${minV}_${maxV}`, edge.index);
      this.edgeToFaces.set(edge.index, new Set());

      let setV1 = this.vertexToEdges.get(edge.v1);
      if (!setV1) {
        setV1 = new Set();
        this.vertexToEdges.set(edge.v1, setV1);
      }
      setV1.add(edge.index);

      let setV2 = this.vertexToEdges.get(edge.v2);
      if (!setV2) {
        setV2 = new Set();
        this.vertexToEdges.set(edge.v2, setV2);
      }
      setV2.add(edge.index);
    }

    for (const face of this.faces) {
      for (const vIdx of face.vertexIndices) {
        let setV = this.vertexToFaces.get(vIdx);
        if (!setV) {
          setV = new Set();
          this.vertexToFaces.set(vIdx, setV);
        }
        setV.add(face.index);
      }

      for (const eIdx of face.edgeIndices) {
        let setE = this.edgeToFaces.get(eIdx);
        if (!setE) {
          setE = new Set();
          this.edgeToFaces.set(eIdx, setE);
        }
        setE.add(face.index);
      }
    }
  }

  /**
   * Helper to look up an edge index by its two endpoint vertices
   */
  public findEdge(v1: number, v2: number): number | undefined {
    const minV = Math.min(v1, v2);
    const maxV = Math.max(v1, v2);
    return this.edgeLookup.get(`${minV}_${maxV}`);
  }

  /**
   * Retrieves adjacent vertex indices for a given vertex
   */
  public getVertexNeighbors(vertexIndex: number): number[] {
    const edgeIndices = this.vertexToEdges.get(vertexIndex);
    if (!edgeIndices) return [];
    const neighbors: number[] = [];
    for (const eIdx of edgeIndices) {
      const edge = this.edges[eIdx];
      if (edge) {
        neighbors.push(edge.v1 === vertexIndex ? edge.v2 : edge.v1);
      }
    }
    return neighbors;
  }

  /**
   * Retrieves adjacent edge indices sharing a vertex with the given edge
   */
  public getEdgeNeighbors(edgeIndex: number): number[] {
    const edge = this.edges[edgeIndex];
    if (!edge) return [];
    const neighbors = new Set<number>();
    const e1 = this.vertexToEdges.get(edge.v1);
    const e2 = this.vertexToEdges.get(edge.v2);
    if (e1) {
      for (const idx of e1) {
        if (idx !== edgeIndex) neighbors.add(idx);
      }
    }
    if (e2) {
      for (const idx of e2) {
        if (idx !== edgeIndex) neighbors.add(idx);
      }
    }
    return Array.from(neighbors);
  }

  /**
   * Retrieves adjacent face indices sharing at least one edge with the given face
   */
  public getFaceNeighbors(faceIndex: number): number[] {
    const face = this.faces[faceIndex];
    if (!face) return [];
    const neighbors = new Set<number>();
    for (const eIdx of face.edgeIndices) {
      const facesSharingEdge = this.edgeToFaces.get(eIdx);
      if (facesSharingEdge) {
        for (const fIdx of facesSharingEdge) {
          if (fIdx !== faceIndex) neighbors.add(fIdx);
        }
      }
    }
    return Array.from(neighbors);
  }
}

/**
 * Builds a SelectionTopology from IMeshData or raw arrays.
 * Supports triangle meshes, indexed meshes, and explicit face topologies.
 */
export function buildSelectionTopology(
  data:
    | IMeshData
    | {
        vertices: Float32Array | number[];
        indices?: Uint32Array | Uint16Array | number[];
        faces?: Array<{ vertexIndices: number[] }>;
      },
): SelectionTopology {
  const rawVerts = data.vertices;
  const numVerts = Math.floor(rawVerts.length / 3);
  const vertices: TopologyVertex[] = new Array(numVerts);

  for (let i = 0; i < numVerts; i++) {
    vertices[i] = {
      index: i,
      position: {
        x: rawVerts[i * 3],
        y: rawVerts[i * 3 + 1],
        z: rawVerts[i * 3 + 2],
      },
    };
  }

  const edgeMap = new Map<string, TopologyEdge>();
  let edgeIndexCounter = 0;

  const getOrAddEdge = (v1: number, v2: number): number => {
    const minV = Math.min(v1, v2);
    const maxV = Math.max(v1, v2);
    const key = `${minV}_${maxV}`;
    const existing = edgeMap.get(key);
    if (existing) {
      return existing.index;
    }
    const newEdge: TopologyEdge = {
      index: edgeIndexCounter++,
      v1: minV,
      v2: maxV,
    };
    edgeMap.set(key, newEdge);
    return newEdge.index;
  };

  const faces: TopologyFace[] = [];

  const rawFaces = (data as any).faces as Array<{ vertexIndices: number[] }> | undefined;
  if (rawFaces && Array.isArray(rawFaces) && rawFaces.length > 0) {
    for (let fIdx = 0; fIdx < rawFaces.length; fIdx++) {
      const vi = rawFaces[fIdx].vertexIndices;
      const count = vi.length;
      const edgeIndices: number[] = new Array(count);
      for (let i = 0; i < count; i++) {
        const next = (i + 1) % count;
        edgeIndices[i] = getOrAddEdge(vi[i], vi[next]);
      }
      faces.push({
        index: fIdx,
        vertexIndices: [...vi],
        edgeIndices,
      });
    }
  } else if (data.indices && data.indices.length >= 3) {
    const indices = Array.from(data.indices);
    for (let i = 0; i < indices.length; i += 3) {
      const v0 = indices[i];
      const v1 = indices[i + 1];
      const v2 = indices[i + 2];

      const e0 = getOrAddEdge(v0, v1);
      const e1 = getOrAddEdge(v1, v2);
      const e2 = getOrAddEdge(v2, v0);

      faces.push({
        index: faces.length,
        vertexIndices: [v0, v1, v2],
        edgeIndices: [e0, e1, e2],
      });
    }
  } else {
    // Non-indexed triangle list
    for (let i = 0; i < numVerts; i += 3) {
      if (i + 2 < numVerts) {
        const v0 = i;
        const v1 = i + 1;
        const v2 = i + 2;

        const e0 = getOrAddEdge(v0, v1);
        const e1 = getOrAddEdge(v1, v2);
        const e2 = getOrAddEdge(v2, v0);

        faces.push({
          index: faces.length,
          vertexIndices: [v0, v1, v2],
          edgeIndices: [e0, e1, e2],
        });
      }
    }
  }

  return new SelectionTopology(vertices, Array.from(edgeMap.values()), faces);
}

// ============================================================================
// 1. Selection Mode Conversion Algorithms
// ============================================================================

/**
 * Vertex -> Edge conversion:
 * An edge is selected if and only if BOTH of its endpoint vertices are selected.
 */
export function convertVertexToEdgeSelection(
  selectedVertices: number[] | Set<number>,
  topology: SelectionTopology,
): number[] {
  const vSet = selectedVertices instanceof Set ? selectedVertices : new Set(selectedVertices);
  const result: number[] = [];
  for (const edge of topology.edges) {
    if (vSet.has(edge.v1) && vSet.has(edge.v2)) {
      result.push(edge.index);
    }
  }
  return result;
}

/**
 * Edge -> Face conversion:
 * A face is selected if and only if ALL of its boundary edges are selected.
 */
export function convertEdgeToFaceSelection(
  selectedEdges: number[] | Set<number>,
  topology: SelectionTopology,
): number[] {
  const eSet = selectedEdges instanceof Set ? selectedEdges : new Set(selectedEdges);
  const result: number[] = [];
  for (const face of topology.faces) {
    if (face.edgeIndices.length > 0 && face.edgeIndices.every((eIdx) => eSet.has(eIdx))) {
      result.push(face.index);
    }
  }
  return result;
}

/**
 * Face -> Vertex conversion:
 * All vertices that belong to ANY selected face are selected.
 */
export function convertFaceToVertexSelection(
  selectedFaces: number[] | Set<number>,
  topology: SelectionTopology,
): number[] {
  const fSet = selectedFaces instanceof Set ? selectedFaces : new Set(selectedFaces);
  const vSet = new Set<number>();
  for (const fIdx of fSet) {
    const face = topology.faces[fIdx];
    if (face) {
      for (const v of face.vertexIndices) {
        vSet.add(v);
      }
    }
  }
  return Array.from(vSet).sort((a, b) => a - b);
}

/**
 * Face -> Edge conversion:
 * All edges that belong to ANY selected face are selected.
 */
export function convertFaceToEdgeSelection(
  selectedFaces: number[] | Set<number>,
  topology: SelectionTopology,
): number[] {
  const fSet = selectedFaces instanceof Set ? selectedFaces : new Set(selectedFaces);
  const eSet = new Set<number>();
  for (const fIdx of fSet) {
    const face = topology.faces[fIdx];
    if (face) {
      for (const e of face.edgeIndices) {
        eSet.add(e);
      }
    }
  }
  return Array.from(eSet).sort((a, b) => a - b);
}

/**
 * Vertex -> Face conversion:
 * A face is selected if and only if ALL of its vertices are selected.
 */
export function convertVertexToFaceSelection(
  selectedVertices: number[] | Set<number>,
  topology: SelectionTopology,
): number[] {
  const vSet = selectedVertices instanceof Set ? selectedVertices : new Set(selectedVertices);
  const result: number[] = [];
  for (const face of topology.faces) {
    if (face.vertexIndices.length > 0 && face.vertexIndices.every((vIdx) => vSet.has(vIdx))) {
      result.push(face.index);
    }
  }
  return result;
}

/**
 * Edge -> Vertex conversion:
 * All vertices that are endpoints of ANY selected edge are selected.
 */
export function convertEdgeToVertexSelection(
  selectedEdges: number[] | Set<number>,
  topology: SelectionTopology,
): number[] {
  const eSet = selectedEdges instanceof Set ? selectedEdges : new Set(selectedEdges);
  const vSet = new Set<number>();
  for (const eIdx of eSet) {
    const edge = topology.edges[eIdx];
    if (edge) {
      vSet.add(edge.v1);
      vSet.add(edge.v2);
    }
  }
  return Array.from(vSet).sort((a, b) => a - b);
}

/**
 * Unified conversion function translating selected indices between any two element modes.
 */
export function convertSelection(
  fromMode: EditElementMode,
  toMode: EditElementMode,
  indices: number[],
  topology: SelectionTopology,
): number[] {
  if (fromMode === toMode) {
    return [...indices];
  }

  if (fromMode === 'vertex' && toMode === 'edge') {
    return convertVertexToEdgeSelection(indices, topology);
  }
  if (fromMode === 'vertex' && toMode === 'face') {
    return convertVertexToFaceSelection(indices, topology);
  }
  if (fromMode === 'edge' && toMode === 'vertex') {
    return convertEdgeToVertexSelection(indices, topology);
  }
  if (fromMode === 'edge' && toMode === 'face') {
    return convertEdgeToFaceSelection(indices, topology);
  }
  if (fromMode === 'face' && toMode === 'vertex') {
    return convertFaceToVertexSelection(indices, topology);
  }
  if (fromMode === 'face' && toMode === 'edge') {
    return convertFaceToEdgeSelection(indices, topology);
  }

  return [];
}

/**
 * Switches the active selection mode in an EditMeshSelectionState according to Blender standards:
 * updates elementModes, converts selected indices, and sets active element.
 */
export function switchSelectionMode(
  state: EditMeshSelectionState,
  newMode: EditElementMode,
  topology: SelectionTopology,
): EditMeshSelectionState {
  const currentPrimaryMode = state.elementModes[0] ?? 'vertex';
  let currentIndices: number[] = [];

  switch (currentPrimaryMode) {
    case 'vertex':
      currentIndices = state.selectedVertexIndices;
      break;
    case 'edge':
      currentIndices = state.selectedEdgeIndices;
      break;
    case 'face':
      currentIndices = state.selectedFaceIndices;
      break;
  }

  const convertedIndices = convertSelection(currentPrimaryMode, newMode, currentIndices, topology);
  const activeElement =
    convertedIndices.length > 0 ? convertedIndices[convertedIndices.length - 1] : null;

  return {
    ...state,
    elementModes: [newMode],
    selectedVertexIndices:
      newMode === 'vertex'
        ? convertedIndices
        : convertSelection(newMode, 'vertex', convertedIndices, topology),
    selectedEdgeIndices:
      newMode === 'edge'
        ? convertedIndices
        : convertSelection(newMode, 'edge', convertedIndices, topology),
    selectedFaceIndices:
      newMode === 'face'
        ? convertedIndices
        : convertSelection(newMode, 'face', convertedIndices, topology),
    activeVertexIndex: newMode === 'vertex' ? activeElement : null,
    activeEdgeIndex: newMode === 'edge' ? activeElement : null,
    activeFaceIndex: newMode === 'face' ? activeElement : null,
  };
}

// ============================================================================
// 2. Select All, Deselect All, Invert Selection
// ============================================================================

/**
 * Select All ('A') for the specified mode
 */
export function selectAllElements(mode: EditElementMode, topology: SelectionTopology): number[] {
  let count = 0;
  switch (mode) {
    case 'vertex':
      count = topology.vertices.length;
      break;
    case 'edge':
      count = topology.edges.length;
      break;
    case 'face':
      count = topology.faces.length;
      break;
  }
  const result: number[] = new Array(count);
  for (let i = 0; i < count; i++) {
    result[i] = i;
  }
  return result;
}

/**
 * Deselect All ('Alt+A')
 */
export function deselectAllElements(): number[] {
  return [];
}

/**
 * Invert Selection ('Ctrl+I') for the specified mode
 */
export function invertElementSelection(
  mode: EditElementMode,
  currentSelected: number[],
  topology: SelectionTopology,
): number[] {
  const set = new Set(currentSelected);
  let totalCount = 0;
  switch (mode) {
    case 'vertex':
      totalCount = topology.vertices.length;
      break;
    case 'edge':
      totalCount = topology.edges.length;
      break;
    case 'face':
      totalCount = topology.faces.length;
      break;
  }

  const inverted: number[] = [];
  for (let i = 0; i < totalCount; i++) {
    if (!set.has(i)) {
      inverted.push(i);
    }
  }
  return inverted;
}

// ============================================================================
// 3. Select Linked / Connected Components ('L')
// ============================================================================

/**
 * Selects all topologically connected components (islands) reachable from seedIndices.
 */
export function selectLinked(
  mode: EditElementMode,
  seedIndices: number[],
  topology: SelectionTopology,
): number[] {
  if (seedIndices.length === 0) return [];

  if (mode === 'vertex') {
    const visited = new Set<number>(seedIndices);
    const queue: number[] = [...seedIndices];

    while (queue.length > 0) {
      const v = queue.shift()!;
      const neighbors = topology.getVertexNeighbors(v);
      for (const n of neighbors) {
        if (!visited.has(n)) {
          visited.add(n);
          queue.push(n);
        }
      }
    }
    return Array.from(visited).sort((a, b) => a - b);
  }

  if (mode === 'edge') {
    const visited = new Set<number>(seedIndices);
    const queue: number[] = [...seedIndices];

    while (queue.length > 0) {
      const e = queue.shift()!;
      const neighbors = topology.getEdgeNeighbors(e);
      for (const n of neighbors) {
        if (!visited.has(n)) {
          visited.add(n);
          queue.push(n);
        }
      }
    }
    return Array.from(visited).sort((a, b) => a - b);
  }

  if (mode === 'face') {
    const visited = new Set<number>(seedIndices);
    const queue: number[] = [...seedIndices];

    while (queue.length > 0) {
      const f = queue.shift()!;
      const neighbors = topology.getFaceNeighbors(f);
      for (const n of neighbors) {
        if (!visited.has(n)) {
          visited.add(n);
          queue.push(n);
        }
      }
    }
    return Array.from(visited).sort((a, b) => a - b);
  }

  return [];
}

/**
 * Selects entire connected island across all element modes given an initial seed.
 */
export function selectLinkedIsland(
  seed: { mode: EditElementMode; index: number },
  topology: SelectionTopology,
): { vertexIndices: number[]; edgeIndices: number[]; faceIndices: number[] } {
  // Convert seed to vertex seeds
  let initialVertices: number[] = [];
  switch (seed.mode) {
    case 'vertex':
      initialVertices = [seed.index];
      break;
    case 'edge':
      initialVertices = convertEdgeToVertexSelection([seed.index], topology);
      break;
    case 'face':
      initialVertices = convertFaceToVertexSelection([seed.index], topology);
      break;
  }

  const linkedVertices = selectLinked('vertex', initialVertices, topology);
  const vSet = new Set(linkedVertices);

  const linkedEdges: number[] = [];
  for (const edge of topology.edges) {
    if (vSet.has(edge.v1) && vSet.has(edge.v2)) {
      linkedEdges.push(edge.index);
    }
  }

  const linkedFaces: number[] = [];
  for (const face of topology.faces) {
    if (face.vertexIndices.every((v) => vSet.has(v))) {
      linkedFaces.push(face.index);
    }
  }

  return {
    vertexIndices: linkedVertices,
    edgeIndices: linkedEdges,
    faceIndices: linkedFaces,
  };
}

// ============================================================================
// 4. Grow / Shrink Selection (Adjacent Neighbors)
// ============================================================================

/**
 * Grow selection ('Ctrl+Numpad+'): expands selection to adjacent immediate neighbors.
 */
export function growSelection(
  mode: EditElementMode,
  currentSelected: number[],
  topology: SelectionTopology,
  steps: number = 1,
): number[] {
  let activeSet = new Set<number>(currentSelected);

  for (let s = 0; s < steps; s++) {
    const nextSet = new Set<number>(activeSet);

    if (mode === 'vertex') {
      for (const v of activeSet) {
        const neighbors = topology.getVertexNeighbors(v);
        for (const n of neighbors) {
          nextSet.add(n);
        }
      }
    } else if (mode === 'edge') {
      for (const e of activeSet) {
        const neighbors = topology.getEdgeNeighbors(e);
        for (const n of neighbors) {
          nextSet.add(n);
        }
      }
    } else if (mode === 'face') {
      for (const f of activeSet) {
        const neighbors = topology.getFaceNeighbors(f);
        for (const n of neighbors) {
          nextSet.add(n);
        }
      }
    }

    activeSet = nextSet;
  }

  return Array.from(activeSet).sort((a, b) => a - b);
}

/**
 * Shrink selection ('Ctrl+Numpad-'): removes boundary elements adjacent to unselected neighbors.
 */
export function shrinkSelection(
  mode: EditElementMode,
  currentSelected: number[],
  topology: SelectionTopology,
  steps: number = 1,
): number[] {
  let activeSet = new Set<number>(currentSelected);

  for (let s = 0; s < steps; s++) {
    if (activeSet.size === 0) break;
    const toRemove = new Set<number>();

    if (mode === 'vertex') {
      for (const v of activeSet) {
        const neighbors = topology.getVertexNeighbors(v);
        const isMeshBoundary = Array.from(topology.vertexToEdges.get(v) || []).some(
          (eIdx) => (topology.edgeToFaces.get(eIdx)?.size ?? 0) <= 1,
        );
        if (isMeshBoundary || neighbors.some((n) => !activeSet.has(n))) {
          toRemove.add(v);
        }
      }
    } else if (mode === 'edge') {
      for (const e of activeSet) {
        const neighbors = topology.getEdgeNeighbors(e);
        const isMeshBoundary = (topology.edgeToFaces.get(e)?.size ?? 0) <= 1;
        if (isMeshBoundary || neighbors.length === 0 || neighbors.some((n) => !activeSet.has(n))) {
          toRemove.add(e);
        }
      }
    } else if (mode === 'face') {
      for (const f of activeSet) {
        const face = topology.faces[f];
        if (!face) continue;
        let isBoundary = false;
        for (const eIdx of face.edgeIndices) {
          const facesSharingEdge = topology.edgeToFaces.get(eIdx);
          if (!facesSharingEdge || facesSharingEdge.size <= 1) {
            // Mesh boundary edge: face is on the outer boundary
            isBoundary = true;
            break;
          }
          for (const neighborFace of facesSharingEdge) {
            if (!activeSet.has(neighborFace)) {
              isBoundary = true;
              break;
            }
          }
          if (isBoundary) break;
        }
        if (isBoundary) {
          toRemove.add(f);
        }
      }
    }

    for (const id of toRemove) {
      activeSet.delete(id);
    }
  }

  return Array.from(activeSet).sort((a, b) => a - b);
}

// ============================================================================
// 5. Boundary Edges & Non-Manifold Elements
// ============================================================================

/**
 * Returns indices of all boundary edges (edges with exactly 1 adjacent face).
 */
export function getBoundaryEdges(topology: SelectionTopology): number[] {
  const boundaryEdges: number[] = [];
  for (const edge of topology.edges) {
    const faces = topology.edgeToFaces.get(edge.index);
    if (faces && faces.size === 1) {
      boundaryEdges.push(edge.index);
    }
  }
  return boundaryEdges;
}

/**
 * Returns indices of non-manifold edges (shared by > 2 faces or 0 faces).
 */
export function getNonManifoldEdges(topology: SelectionTopology): number[] {
  const nonManifold: number[] = [];
  for (const edge of topology.edges) {
    const faces = topology.edgeToFaces.get(edge.index);
    if (!faces || faces.size !== 2) {
      // 0 faces: wire edge; > 2 faces: non-manifold branch
      if (!faces || faces.size === 0 || faces.size > 2) {
        nonManifold.push(edge.index);
      }
    }
  }
  return nonManifold;
}

/**
 * Returns indices of non-manifold vertices (vertices with non-manifold edges
 * or disconnected face fans meeting at a single vertex).
 */
export function getNonManifoldVertices(topology: SelectionTopology): number[] {
  const nonManifold = new Set<number>();

  // Any vertex of a non-manifold edge is non-manifold
  const nonManifoldEdges = getNonManifoldEdges(topology);
  for (const eIdx of nonManifoldEdges) {
    const edge = topology.edges[eIdx];
    if (edge) {
      nonManifold.add(edge.v1);
      nonManifold.add(edge.v2);
    }
  }

  // Check for multi-fan (pinch-point) vertices
  for (let vIdx = 0; vIdx < topology.vertices.length; vIdx++) {
    if (nonManifold.has(vIdx)) continue;
    const faceSet = topology.vertexToFaces.get(vIdx);
    if (!faceSet || faceSet.size <= 1) continue;

    // Check connectivity of incident faces around this vertex via shared incident edges
    const incidentFaces = Array.from(faceSet);
    const incidentEdges = Array.from(topology.vertexToEdges.get(vIdx) || []);

    const edgeToIncidentFaces = new Map<number, number[]>();
    for (const eIdx of incidentEdges) {
      const faces = topology.edgeToFaces.get(eIdx);
      if (faces) {
        const shared = Array.from(faces).filter((f) => faceSet.has(f));
        edgeToIncidentFaces.set(eIdx, shared);
      }
    }

    // Build face-to-face adjacency graph around vertex
    const faceGraph = new Map<number, Set<number>>();
    for (const f of incidentFaces) {
      faceGraph.set(f, new Set());
    }

    for (const [_eIdx, sharedFaces] of edgeToIncidentFaces) {
      if (sharedFaces.length === 2) {
        faceGraph.get(sharedFaces[0])?.add(sharedFaces[1]);
        faceGraph.get(sharedFaces[1])?.add(sharedFaces[0]);
      }
    }

    // BFS to count connected face components around vertex
    const visitedFaces = new Set<number>();
    let components = 0;

    for (const f of incidentFaces) {
      if (!visitedFaces.has(f)) {
        components++;
        if (components > 1) {
          nonManifold.add(vIdx);
          break;
        }
        const q = [f];
        visitedFaces.add(f);
        while (q.length > 0) {
          const curr = q.shift()!;
          const neighbors = faceGraph.get(curr);
          if (neighbors) {
            for (const n of neighbors) {
              if (!visitedFaces.has(n)) {
                visitedFaces.add(n);
                q.push(n);
              }
            }
          }
        }
      }
    }
  }

  return Array.from(nonManifold).sort((a, b) => a - b);
}

/**
 * Select boundary edges or non-manifold elements for Edit Mode
 */
export function selectBoundaryOrNonManifold(
  mode: EditElementMode,
  type: 'boundary' | 'non-manifold',
  topology: SelectionTopology,
): number[] {
  if (type === 'boundary') {
    const boundaryEdges = getBoundaryEdges(topology);
    if (mode === 'edge') return boundaryEdges;
    if (mode === 'vertex') return convertEdgeToVertexSelection(boundaryEdges, topology);
    if (mode === 'face') {
      const boundaryFaces = new Set<number>();
      for (const eIdx of boundaryEdges) {
        const faces = topology.edgeToFaces.get(eIdx);
        if (faces) {
          for (const f of faces) boundaryFaces.add(f);
        }
      }
      return Array.from(boundaryFaces).sort((a, b) => a - b);
    }
  }

  if (type === 'non-manifold') {
    if (mode === 'vertex') return getNonManifoldVertices(topology);
    if (mode === 'edge') return getNonManifoldEdges(topology);
    if (mode === 'face') {
      const nonManifoldEdges = getNonManifoldEdges(topology);
      const faces = new Set<number>();
      for (const eIdx of nonManifoldEdges) {
        const fSet = topology.edgeToFaces.get(eIdx);
        if (fSet) {
          for (const f of fSet) faces.add(f);
        }
      }
      return Array.from(faces).sort((a, b) => a - b);
    }
  }

  return [];
}

// ============================================================================
// 6. Edge Loop & Edge Ring Selection Algorithms
// ============================================================================

/**
 * Edge Loop Selection (Alt + Click on edge in Blender):
 * Traces a continuous path of edges across 4-way junctions (quads) or along boundary edges.
 */
export function selectEdgeLoop(seedEdgeIndex: number, topology: SelectionTopology): number[] {
  const seedEdge = topology.edges[seedEdgeIndex];
  if (!seedEdge) return [];

  const loopEdges = new Set<number>([seedEdgeIndex]);

  // Extend in both directions: starting from seedEdge.v1 and seedEdge.v2
  const extendDirection = (startVertex: number, fromEdgeIndex: number) => {
    let currVertex = startVertex;
    let currEdgeIndex = fromEdgeIndex;

    while (true) {
      const currEdge = topology.edges[currEdgeIndex];
      if (!currEdge) break;

      const incidentEdges = Array.from(topology.vertexToEdges.get(currVertex) || []);
      const incidentFaces = Array.from(topology.vertexToFaces.get(currVertex) || []);

      // Case 1: Boundary loop extension
      const facesOfCurrEdge = topology.edgeToFaces.get(currEdgeIndex);
      const isBoundaryEdge = facesOfCurrEdge && facesOfCurrEdge.size === 1;

      if (isBoundaryEdge) {
        // Find the other boundary edge at currVertex
        const otherBoundaryEdges = incidentEdges.filter((eIdx) => {
          if (eIdx === currEdgeIndex) return false;
          const fSet = topology.edgeToFaces.get(eIdx);
          return fSet && fSet.size === 1;
        });

        if (otherBoundaryEdges.length === 1) {
          const nextEdgeIndex = otherBoundaryEdges[0];
          if (loopEdges.has(nextEdgeIndex)) break; // Closed loop
          loopEdges.add(nextEdgeIndex);
          const nextEdge = topology.edges[nextEdgeIndex];
          currVertex = nextEdge.v1 === currVertex ? nextEdge.v2 : nextEdge.v1;
          currEdgeIndex = nextEdgeIndex;
          continue;
        } else {
          break; // Boundary fork or dead end
        }
      }

      // Case 2: Interior quad loop across 4-valence vertex
      if (incidentEdges.length === 4 && incidentFaces.length === 4) {
        // Find opposite edge: the unique incident edge that does NOT share any face with currEdge
        const currFaces = topology.edgeToFaces.get(currEdgeIndex) || new Set();
        const oppositeEdges = incidentEdges.filter((eIdx) => {
          if (eIdx === currEdgeIndex) return false;
          const eFaces = topology.edgeToFaces.get(eIdx);
          if (!eFaces) return true;
          for (const f of eFaces) {
            if (currFaces.has(f)) return false; // Shares a face, not opposite
          }
          return true;
        });

        if (oppositeEdges.length === 1) {
          const nextEdgeIndex = oppositeEdges[0];
          if (loopEdges.has(nextEdgeIndex)) break; // Closed loop
          loopEdges.add(nextEdgeIndex);
          const nextEdge = topology.edges[nextEdgeIndex];
          currVertex = nextEdge.v1 === currVertex ? nextEdge.v2 : nextEdge.v1;
          currEdgeIndex = nextEdgeIndex;
          continue;
        }
      }

      // Extraordinary vertex (pole) or unsupported topology: stop extension
      break;
    }
  };

  extendDirection(seedEdge.v1, seedEdgeIndex);
  extendDirection(seedEdge.v2, seedEdgeIndex);

  return Array.from(loopEdges).sort((a, b) => a - b);
}

/**
 * Edge Ring Selection (Ctrl + Alt + Click on edge in Blender):
 * Selects parallel edges across a sequence of quad faces.
 */
export function selectEdgeRing(seedEdgeIndex: number, topology: SelectionTopology): number[] {
  const seedEdge = topology.edges[seedEdgeIndex];
  if (!seedEdge) return [];

  const ringEdges = new Set<number>([seedEdgeIndex]);

  // Helper to find the opposite edge in a quad face (native quad or triangulated quad)
  const getOppositeEdgeInFace = (face: TopologyFace, edgeIndex: number): number | undefined => {
    if (face.edgeIndices.length === 4) {
      // Native quad: cyclic order of edges [e0, e1, e2, e3]
      const idx = face.edgeIndices.indexOf(edgeIndex);
      if (idx !== -1) {
        return face.edgeIndices[(idx + 2) % 4];
      }
    }
    return undefined;
  };

  const seedFaces = Array.from(topology.edgeToFaces.get(seedEdgeIndex) || []);

  for (const initialFaceIndex of seedFaces) {
    let currFaceIndex = initialFaceIndex;
    let currEdgeIndex = seedEdgeIndex;

    while (true) {
      const face = topology.faces[currFaceIndex];
      if (!face) break;

      let oppEdgeIndex = getOppositeEdgeInFace(face, currEdgeIndex);

      // If faces are triangulated, detect adjacent triangle sharing diagonal to form a quad
      if (oppEdgeIndex === undefined && face.vertexIndices.length === 3) {
        // Look for companion triangle that shares an edge not equal to currEdgeIndex
        const otherEdges = face.edgeIndices.filter((e) => e !== currEdgeIndex);
        for (const sharedEdge of otherEdges) {
          const facesSharing = Array.from(topology.edgeToFaces.get(sharedEdge) || []).filter(
            (f) => f !== currFaceIndex,
          );
          if (facesSharing.length === 1) {
            const compFace = topology.faces[facesSharing[0]];
            if (compFace && compFace.vertexIndices.length === 3) {
              // The opposite edge is the remaining external edge in compFace
              const compOtherEdges = compFace.edgeIndices.filter((e) => e !== sharedEdge);
              if (compOtherEdges.length === 2) {
                // Find edge parallel to currEdge (does not share vertices with currEdge)
                const cEdge = topology.edges[currEdgeIndex];
                const parallelEdge = compOtherEdges.find((candIdx) => {
                  const cand = topology.edges[candIdx];
                  return (
                    cand &&
                    cand.v1 !== cEdge.v1 &&
                    cand.v1 !== cEdge.v2 &&
                    cand.v2 !== cEdge.v1 &&
                    cand.v2 !== cEdge.v2
                  );
                });
                if (parallelEdge !== undefined) {
                  oppEdgeIndex = parallelEdge;
                  currFaceIndex = compFace.index;
                  break;
                }
              }
            }
          }
        }
      }

      if (oppEdgeIndex === undefined) break;
      if (ringEdges.has(oppEdgeIndex)) break; // Loop closed

      ringEdges.add(oppEdgeIndex);

      // Step across oppEdgeIndex to find next face
      const facesAcross = Array.from(topology.edgeToFaces.get(oppEdgeIndex) || []).filter(
        (f) => f !== currFaceIndex,
      );
      if (facesAcross.length === 1) {
        currFaceIndex = facesAcross[0];
        currEdgeIndex = oppEdgeIndex;
      } else {
        break; // Boundary or junction
      }
    }
  }

  return Array.from(ringEdges).sort((a, b) => a - b);
}

// ============================================================================
// 7. Math & Centroid Utilities
// ============================================================================

/**
 * Calculates the geometric median (centroid) point of a set of vertex indices.
 */
export function computeMedianPoint(
  positions: Float32Array | number[],
  vertexIndices: number[],
): Vector3 {
  if (vertexIndices.length === 0) {
    return { x: 0, y: 0, z: 0 };
  }

  let sumX = 0;
  let sumY = 0;
  let sumZ = 0;
  let count = 0;

  for (const idx of vertexIndices) {
    const pIdx = idx * 3;
    if (pIdx + 2 < positions.length) {
      sumX += positions[pIdx];
      sumY += positions[pIdx + 1];
      sumZ += positions[pIdx + 2];
      count++;
    }
  }

  if (count === 0) return { x: 0, y: 0, z: 0 };
  return {
    x: sumX / count,
    y: sumY / count,
    z: sumZ / count,
  };
}

/**
 * Calculates axis-aligned bounding box of vertex indices.
 */
export function computeBoundingBox(
  positions: Float32Array | number[],
  vertexIndices?: number[],
): { min: Vector3; max: Vector3; center: Vector3; size: Vector3 } {
  const numVerts = Math.floor(positions.length / 3);
  const indices =
    vertexIndices && vertexIndices.length > 0
      ? vertexIndices
      : Array.from({ length: numVerts }, (_, i) => i);

  if (indices.length === 0) {
    return {
      min: { x: 0, y: 0, z: 0 },
      max: { x: 0, y: 0, z: 0 },
      center: { x: 0, y: 0, z: 0 },
      size: { x: 0, y: 0, z: 0 },
    };
  }

  let minX = Infinity,
    minY = Infinity,
    minZ = Infinity;
  let maxX = -Infinity,
    maxY = -Infinity,
    maxZ = -Infinity;

  for (const idx of indices) {
    const pIdx = idx * 3;
    const x = positions[pIdx];
    const y = positions[pIdx + 1];
    const z = positions[pIdx + 2];

    if (x < minX) minX = x;
    if (y < minY) minY = y;
    if (z < minZ) minZ = z;

    if (x > maxX) maxX = x;
    if (y > maxY) maxY = y;
    if (z > maxZ) maxZ = z;
  }

  return {
    min: { x: minX, y: minY, z: minZ },
    max: { x: maxX, y: maxY, z: maxZ },
    center: {
      x: (minX + maxX) * 0.5,
      y: (minY + maxY) * 0.5,
      z: (minZ + maxZ) * 0.5,
    },
    size: {
      x: maxX - minX,
      y: maxY - minY,
      z: maxZ - minZ,
    },
  };
}
