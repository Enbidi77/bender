import type React from 'react';
import type { StoreApi } from 'zustand/vanilla';
import type {
  ViewportMode,
  GizmoType,
  TransformSpace,
  ShadingMode,
  GridConfig,
  SelectionInfo,
  ViewportCameraState,
  ViewportConfig,
  CameraProjection,
  Transform,
  Vector3,
  Euler,
  SceneNode,
  ICommand,
} from '@blender-elt/contracts';
import type { SceneGraphState, SelectionStoreState } from '@blender-elt/scene-core';
import type { CommandManager } from '@blender-elt/commands';

export type {
  ViewportMode,
  GizmoType,
  TransformSpace,
  ShadingMode,
  GridConfig,
  SelectionInfo,
  ViewportCameraState,
  ViewportConfig,
  CameraProjection,
  Transform,
  Vector3,
  Euler,
  SceneNode,
};

/**
 * Snapping configuration for transforms in viewport
 */
export interface SnapConfig {
  enabled: boolean;
  translationSnap: number;
  rotationSnap: number; // in radians
  scaleSnap: number;
}

/**
 * Axis constraint lock for transformations in viewport
 */
export type AxisLock = 'X' | 'Y' | 'Z' | null;

/**
 * Standard camera view presets inspired by Blender Numpad
 */
export type StandardViewpoint =
  'front' | 'back' | 'right' | 'left' | 'top' | 'bottom' | 'perspective' | 'camera';

/**
 * Context and store state for Viewport
 */
export interface ViewportState {
  config: ViewportConfig;
  snapConfig: SnapConfig;
  cameraProjection: CameraProjection;
  activeViewpoint: StandardViewpoint;
  isGizmoDragging: boolean;
  axisLock: AxisLock;
  hoveredNodeId: string | null;
  showStats: boolean;
  showToolbar: boolean;
  showOverlays: boolean;
  show3DCursor: boolean;
  activeCameraId: string | null;

  // Actions
  setConfig: (config: Partial<ViewportConfig>) => void;
  setMode: (mode: ViewportMode) => void;
  setGizmoType: (type: GizmoType) => void;
  setTransformSpace: (space: TransformSpace) => void;
  setShadingMode: (mode: ShadingMode) => void;
  setSnapConfig: (snap: Partial<SnapConfig>) => void;
  toggleSnapping: () => void;
  setCameraProjection: (projection: CameraProjection) => void;
  toggleCameraProjection: () => void;
  setActiveViewpoint: (viewpoint: StandardViewpoint) => void;
  setIsGizmoDragging: (dragging: boolean) => void;
  setAxisLock: (axis: AxisLock) => void;
  toggleAxisLock: (axis: 'X' | 'Y' | 'Z') => void;
  setHoveredNodeId: (id: string | null) => void;
  setShowStats: (show: boolean) => void;
  setShowToolbar: (show: boolean) => void;
  setShowOverlays: (show: boolean) => void;
  setShow3DCursor: (show: boolean) => void;
  setActiveCameraId: (id: string | null) => void;
}

/**
 * Callbacks and props for ViewportContainer
 */
export interface ViewportProps {
  /** Scene Graph Zustand store instance */
  sceneStore?: StoreApi<SceneGraphState>;
  /** Selection Zustand store instance */
  selectionStore?: StoreApi<SelectionStoreState>;
  /** CommandManager instance for undo/redo history */
  commandManager?: CommandManager;
  /** Initial or controlled viewport configuration */
  config?: Partial<ViewportConfig>;
  /** Initial snapping configuration */
  snapConfig?: Partial<SnapConfig>;
  /** Controlled camera projection */
  cameraProjection?: CameraProjection;
  /** CSS class names for styling container */
  className?: string;
  /** Inline style overrides */
  style?: React.CSSProperties;
  /** Whether to show the top floating toolbar */
  showToolbar?: boolean;
  /** Whether to show viewport badges and info overlay */
  showOverlays?: boolean;
  /** Whether to show FPS and polycount stats overlay */
  showStats?: boolean;
  /** Whether to show 3D cursor overlay */
  show3DCursor?: boolean;
  /** Initial or controlled axis lock */
  axisLock?: AxisLock;
  /** Callback fired when an object transform is finalized via gizmo */
  onTransformCommit?: (nodeId: string, oldTransform: Transform, newTransform: Transform) => void;
  /** Callback fired when selection changes via viewport raycasting */
  onSelectNode?: (nodeId: string | null, multi: boolean) => void;
  /** Callback fired when viewport config changes */
  onConfigChange?: (config: ViewportConfig) => void;
  /** Callback fired when axis lock changes */
  onAxisLockChange?: (axis: AxisLock) => void;
  /** Children to render inside the viewport overlay layer */
  children?: React.ReactNode;
}

export type ViewportContainerProps = ViewportProps;

/**
 * Payload interface for transform command
 */
export interface TransformCommandPayload {
  nodeId: string;
  nodeName?: string;
  previousTransform: Transform;
  newTransform: Transform;
  sceneStore?: StoreApi<SceneGraphState>;
}

export type { ICommand, CommandManager };
