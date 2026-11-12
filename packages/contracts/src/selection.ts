import type { Vector3, Euler } from './scene.js';
import type { EditElementMode } from './modeling.js';

/**
 * Selection operation modes (standard Blender behavior)
 */
export type SelectionMode = 'set' | 'add' | 'subtract' | 'invert';

/**
 * 3D Pivot Point / Transform Center options
 */
export type PivotPoint =
  'bounding-box-center' | 'median-point' | 'individual-origins' | '3d-cursor' | 'active-element';

/**
 * 3D Cursor representation
 */
export interface Cursor3D {
  position: Vector3;
  rotation: Euler;
}

/**
 * Object Mode Selection State
 */
export interface ObjectSelectionState {
  /**
   * The primary active object (highlighted with yellow outline in Blender).
   * Inspector properties and modifiers target this node.
   */
  activeNodeId: string | null;

  /**
   * Set of all selected object IDs (highlighted with orange outline in Blender).
   */
  selectedNodeIds: string[];

  /**
   * Sequential history of selections; last item is usually activeNodeId.
   */
  selectionOrder: string[];
}

/**
 * Edit Mode Selection State for fine-grained mesh sub-elements
 */
export interface EditMeshSelectionState {
  /**
   * Active element selection masks (can support multiple simultaneous masks)
   */
  elementModes: EditElementMode[];

  /**
   * Selected element indices
   */
  selectedVertexIndices: number[];
  selectedEdgeIndices: number[];
  selectedFaceIndices: number[];

  /**
   * Active element within current selection
   */
  activeVertexIndex: number | null;
  activeEdgeIndex: number | null;
  activeFaceIndex: number | null;
}

/**
 * Screen-space box selection rectangle
 */
export interface BoxSelectionRect {
  startX: number;
  startY: number;
  endX: number;
  endY: number;
  mode: SelectionMode;
}

/**
 * Screen-to-world raycast hit test result
 */
export interface RaycastHitResult {
  nodeId: string;
  point: Vector3;
  distance: number;
  normal?: Vector3;
  faceIndex?: number;
}

/**
 * Unified Selection Model spanning Object Mode, Edit Mode, and Viewport Tools
 */
export interface UnifiedSelectionModel {
  object: ObjectSelectionState;
  edit: EditMeshSelectionState;
  pivotPoint: PivotPoint;
  cursor3D: Cursor3D;
}
