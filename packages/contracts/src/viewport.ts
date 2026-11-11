import type { CameraProjection, Vector3 } from './scene.js';
import type { ShadingMode } from './materials.js';

/**
 * Top-level application viewport interaction modes
 */
export type ViewportMode =
  'object' | 'edit' | 'sculpt' | 'vertex-paint' | 'weight-paint' | 'texture-paint';

/**
 * Transformation gizmo types
 */
export type GizmoType = 'translate' | 'rotate' | 'scale' | 'none';

/**
 * Transformation coordinate space
 */
export type TransformSpace = 'world' | 'local';

/**
 * Ground grid and axis rendering configuration
 */
export interface GridConfig {
  visible: boolean;
  size: number;
  divisions: number;
  colorCenterLine: string;
  colorGrid: string;
  showAxes: boolean;
  fadeDistance?: number;
}

/**
 * Selection state in the viewport/outliner
 */
export interface SelectionInfo {
  primaryId: string | null;
  selectedIds: string[];
  count: number;
}

/**
 * Viewport Camera runtime state
 */
export interface ViewportCameraState {
  position: Vector3;
  target: Vector3;
  projection: CameraProjection;
  fov: number;
  zoom: number;
  orthographicScale?: number;
}

/**
 * Comprehensive Viewport Settings State
 */
export interface ViewportConfig {
  mode: ViewportMode;
  gizmoType: GizmoType;
  transformSpace: TransformSpace;
  shadingMode: ShadingMode;
  grid: GridConfig;
  showWireframeOverlay: boolean;
  showNormalsOverlay: boolean;
  showFloor: boolean;
}
