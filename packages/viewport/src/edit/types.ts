import type * as THREE from 'three';
import type {
  EditElementMode,
  SelectionMode,
  Vector3,
  MeshOperation,
} from '@blender-elt/contracts';

export type { EditElementMode, SelectionMode, Vector3, MeshOperation };

/**
 * Result of raycasting or picking an edit element
 */
export interface EditRaycastHit {
  type: EditElementMode;
  elementIndex: number;
  distance: number;
  worldPoint: Vector3;
  localPoint: Vector3;
  normal?: Vector3;
  mesh: THREE.Mesh;
}

/**
 * State of hovered elements in edit mode
 */
export interface EditHoverState {
  hoveredVertexIndex: number | null;
  hoveredEdgeIndex: number | null;
  hoveredFaceIndex: number | null;
  hitPoint: Vector3 | null;
}

/**
 * 2D Screen-space box selection rectangle
 */
export interface ScreenBoxRect {
  x1: number;
  y1: number;
  x2: number;
  y2: number;
  active: boolean;
}

/**
 * Modal tool types supported in edit mode
 */
export type EditModalType =
  'none' | 'translate' | 'rotate' | 'scale' | 'extrude' | 'inset' | 'bevel' | 'loopcut' | 'knife';

/**
 * State of active modal tool session
 */
export interface EditModalState {
  active: boolean;
  type: EditModalType;
  axisLock: 'X' | 'Y' | 'Z' | null;
  numericInput: string;
  startPointer: { x: number; y: number };
  currentValue: number;
}

/**
 * Color palette and visual styling for edit mode overlays
 */
export interface EditOverlayColors {
  vertexUnselected: string;
  vertexSelected: string;
  vertexHovered: string;
  edgeUnselected: string;
  edgeSelected: string;
  edgeHovered: string;
  faceSelected: string;
  faceOpacity: number;
  normals: string;
}

export const DEFAULT_EDIT_OVERLAY_COLORS: EditOverlayColors = {
  vertexUnselected: '#222222',
  vertexSelected: '#f49b42',
  vertexHovered: '#ffffff',
  edgeUnselected: '#333333',
  edgeSelected: '#f49b42',
  edgeHovered: '#00e5ff',
  faceSelected: '#f49b42',
  faceOpacity: 0.35,
  normals: '#00e5ff',
};
