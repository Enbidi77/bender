import type { Vector3 } from './scene.js';

/**
 * Supported 3D primitive types
 */
export type PrimitiveType = 'cube' | 'sphere' | 'plane' | 'cylinder' | 'cone' | 'torus';

/**
 * Parameters for standard geometric primitives
 */
export interface PrimitiveParameters {
  cube?: {
    width?: number;
    height?: number;
    depth?: number;
    widthSegments?: number;
    heightSegments?: number;
    depthSegments?: number;
  };
  sphere?: {
    radius?: number;
    widthSegments?: number;
    heightSegments?: number;
  };
  plane?: {
    width?: number;
    height?: number;
    widthSegments?: number;
    heightSegments?: number;
  };
  cylinder?: {
    radiusTop?: number;
    radiusBottom?: number;
    height?: number;
    radialSegments?: number;
    heightSegments?: number;
  };
  cone?: {
    radius?: number;
    height?: number;
    radialSegments?: number;
  };
  torus?: {
    radius?: number;
    tube?: number;
    radialSegments?: number;
    tubularSegments?: number;
  };
}

/**
 * Low-level Raw Mesh Data
 */
export interface IMeshData {
  vertices: Float32Array | number[];
  normals?: Float32Array | number[];
  uvs?: Float32Array | number[];
  indices?: Uint32Array | Uint16Array | number[];
}

/**
 * Topology element structures for Edit Mode
 */
export interface VertexData {
  index: number;
  position: Vector3;
  normal?: Vector3;
  uv?: [number, number];
  selected?: boolean;
}

export interface EdgeData {
  index: number;
  v1: number;
  v2: number;
  selected?: boolean;
}

export interface FaceData {
  index: number;
  vertexIndices: number[];
  edgeIndices?: number[];
  normal?: Vector3;
  selected?: boolean;
}

/**
 * Edit Mode Selection State
 */
export type EditElementMode = 'vertex' | 'edge' | 'face';

/**
 * Available interactive modeling tools in Edit Mode
 */
export type EditModeTool =
  | 'select'
  | 'cursor'
  | 'move'
  | 'rotate'
  | 'scale'
  | 'extrude'
  | 'inset'
  | 'bevel'
  | 'loopcut'
  | 'knife'
  | 'polybuild'
  | 'spin'
  | 'smooth';

export interface EditModeSelection {
  mode: EditElementMode;
  selectedIndices: number[];
}

/**
 * Mesh Operation Types and Payload
 */
export type MeshOperationType =
  | 'extrude'
  | 'subdivide'
  | 'bevel'
  | 'inset'
  | 'delete'
  | 'dissolve'
  | 'loopcut'
  | 'knife-cut'
  | 'merge'
  | 'smooth'
  | 'flip-normals'
  | 'triangulate'
  | 'bridge-loops'
  | 'fill-loop'
  | 'slide'
  | 'create-edge'
  | 'separate';

export interface MeshOperation<TParams = Record<string, unknown>> {
  type: MeshOperationType;
  targetIndices: number[];
  parameters: TParams;
}

/**
 * Operation-specific parameter definitions
 */
export interface ExtrudeOperationParams {
  distance?: number;
  direction?: Vector3;
  individual?: boolean;
}

export interface InsetOperationParams {
  thickness?: number;
  depth?: number;
  individual?: boolean;
}

export interface BevelOperationParams {
  width?: number;
  segments?: number;
  mode?: 'edge' | 'vertex';
  clampOverlap?: boolean;
}

export interface SubdivideOperationParams {
  iterations?: number;
  smoothness?: number;
  cuts?: number;
}

export interface MergeOperationParams {
  type?: 'center' | 'distance' | 'collapse';
  distance?: number;
}

export interface DeleteOperationParams {
  target?: 'vertices' | 'edges' | 'faces' | 'only-faces';
}

export interface DissolveOperationParams {
  target?: 'vertices' | 'edges' | 'faces';
}

export interface LoopCutOperationParams {
  edgeIndex?: number;
  factor?: number; // 0 to 1 along edge
  cuts?: number;
}

export interface KnifeCutOperationParams {
  points?: Vector3[];
  planeNormal?: Vector3;
  planePoint?: Vector3;
  v1?: number;
  v2?: number;
  edgeIndex?: number;
  factor?: number;
}

export interface SlideOperationParams {
  factor: number; // -1 to 1 or 0 to 1
  edgeIndex?: number;
  mode?: 'vertex' | 'edge';
}

/**
 * Topology validation and invariant reporting
 */
export interface TopologyValidationIssue {
  severity: 'error' | 'warning';
  code:
    | 'dangling-vertex'
    | 'dangling-edge'
    | 'degenerate-face'
    | 'unreferenced-index'
    | 'inconsistent-winding'
    | 'non-manifold-edge'
    | 'zero-area-face';
  message: string;
  elementIndices?: number[];
  elementType?: EditElementMode;
}

export interface TopologyValidationResult {
  isValid: boolean;
  issues: TopologyValidationIssue[];
}

/**
 * Geometric and topological statistics
 */
export interface TopologyStats {
  vertexCount: number;
  edgeCount: number;
  faceCount: number;
  triangleCount: number;
  quadCount: number;
  ngonCount: number;
  boundaryEdgeCount: number;
  nonManifoldEdgeCount: number;
  surfaceArea: number;
  boundingBox: {
    min: Vector3;
    max: Vector3;
    size: Vector3;
    center: Vector3;
  };
}
