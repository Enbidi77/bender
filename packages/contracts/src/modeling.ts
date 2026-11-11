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
  | 'loopcut'
  | 'merge'
  | 'smooth'
  | 'flip-normals';

export interface MeshOperation {
  type: MeshOperationType;
  targetIndices: number[];
  parameters: Record<string, unknown>;
}
