import type { Vector3 } from './scene.js';

/**
 * Available professional sculpt brushes
 */
export type SculptBrushType =
  | 'draw'
  | 'draw-sharp'
  | 'clay'
  | 'clay-strips'
  | 'inflate'
  | 'blob'
  | 'crease'
  | 'pinch'
  | 'smooth'
  | 'flatten'
  | 'scrape'
  | 'grab'
  | 'elastic-deform'
  | 'mask';

/**
 * Mathematical brush falloff attenuation profiles
 */
export type BrushFalloffType = 'smooth' | 'sphere' | 'constant' | 'sharp' | 'linear';

/**
 * Individual brush operational parameters
 */
export interface SculptBrushConfig {
  type: SculptBrushType;
  radius: number;
  strength: number;
  falloff: BrushFalloffType;
  spacing: number;
  direction: 'add' | 'subtract';
  autoSmooth?: number;
  planeOffset?: number;
  normalWeight?: number;
  creasePinch?: number;
  clayAngle?: number;
  elasticDeformMode?: 'volume' | 'scale' | 'twist';
  useStylusPressure?: boolean;
  pressureAffectsSize?: boolean;
  pressureAffectsStrength?: boolean;
}

/**
 * Global sculpt stroke evaluation and spacing settings
 */
export interface SculptStrokeSettings {
  spacing: number;
  smoothStroke: boolean;
  smoothStrokeFactor: number;
  useAccumulate: boolean;
  frontFacesOnly: boolean;
}

/**
 * Multi-axis mirror and radial symmetry configuration
 */
export interface SymmetryConfig {
  x: boolean;
  y: boolean;
  z: boolean;
  radial?: {
    axis: 'x' | 'y' | 'z';
    count: number;
  };
}

/**
 * Per-vertex scalar sculpt mask storage (0.0 = unmasked, 1.0 = fully protected)
 */
export interface SculptMaskData {
  weights: Float32Array;
  vertexCount: number;
  inverted?: boolean;
}

/**
 * Mask global manipulation operations
 */
export type SculptMaskOperation =
  'invert' | 'clear' | 'fill' | 'smooth' | 'sharpen' | 'blur' | 'grow' | 'shrink';

/**
 * Sparse vertex delta payload for undo/redo commands
 */
export interface SculptMeshDelta {
  nodeId: string;
  indices: Uint32Array;
  oldPositions: Float32Array;
  newPositions: Float32Array;
  oldNormals?: Float32Array;
  newNormals?: Float32Array;
  oldMasks?: Float32Array;
  newMasks?: Float32Array;
}

/**
 * Point sample along an interactive sculpt stroke
 */
export interface SculptStrokePoint {
  point: Vector3;
  normal: Vector3;
  pressure: number;
  viewVector?: Vector3;
  timestamp: number;
}

/**
 * Surface hit test query result
 */
export interface SculptHitTestResult {
  hit: boolean;
  point: Vector3;
  normal: Vector3;
  faceIndex?: number;
  distance: number;
}

/**
 * High-resolution Voxel Remeshing configuration
 */
export interface VoxelRemeshConfig {
  voxelSize: number;
  adaptivity?: number;
  smoothNormals?: boolean;
  preserveVolume?: boolean;
  safetyCapMaxVertices?: number;
}

/**
 * Comprehensive Sculpt Mode session state
 */
export interface SculptSessionState {
  activeNodeId: string | null;
  isStroking: boolean;
  activeBrush: SculptBrushType;
  brushConfig: SculptBrushConfig;
  strokeSettings: SculptStrokeSettings;
  symmetry: SymmetryConfig;
  maskEnabled: boolean;
  vertexCount: number;
  trianglesCount: number;
  lastStrokeDurationMs: number;
}
