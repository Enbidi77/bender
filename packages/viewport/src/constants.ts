import type { GridConfig, ViewportConfig, SnapConfig, StandardViewpoint } from './types.js';

export const DEFAULT_GRID_CONFIG: GridConfig = {
  visible: true,
  size: 20,
  divisions: 20,
  colorCenterLine: '#4f535d',
  colorGrid: '#282a30',
  showAxes: true,
  fadeDistance: 45,
};

export const DEFAULT_SNAP_CONFIG: SnapConfig = {
  enabled: false,
  translationSnap: 0.5,
  rotationSnap: (15 * Math.PI) / 180, // 15 degrees in radians
  scaleSnap: 0.1,
};

export const DEFAULT_VIEWPORT_CONFIG: ViewportConfig = {
  mode: 'object',
  gizmoType: 'translate',
  transformSpace: 'world',
  shadingMode: 'solid',
  grid: DEFAULT_GRID_CONFIG,
  showWireframeOverlay: false,
  showNormalsOverlay: false,
  showFloor: true,
};

/**
 * Standard viewpoint camera angles and directions
 */
export const VIEWPOINT_CONFIGS: Record<
  StandardViewpoint,
  {
    name: string;
    position: [number, number, number];
    up?: [number, number, number];
    isOrtho?: boolean;
    numpad: string;
  }
> = {
  front: {
    name: 'Front View',
    position: [0, 0, 10],
    up: [0, 1, 0],
    isOrtho: true,
    numpad: 'Numpad 1',
  },
  back: {
    name: 'Back View',
    position: [0, 0, -10],
    up: [0, 1, 0],
    isOrtho: true,
    numpad: 'Ctrl + Numpad 1',
  },
  right: {
    name: 'Right View',
    position: [10, 0, 0],
    up: [0, 1, 0],
    isOrtho: true,
    numpad: 'Numpad 3',
  },
  left: {
    name: 'Left View',
    position: [-10, 0, 0],
    up: [0, 1, 0],
    isOrtho: true,
    numpad: 'Ctrl + Numpad 3',
  },
  top: {
    name: 'Top View',
    position: [0, 10, 0],
    up: [0, 0, -1],
    isOrtho: true,
    numpad: 'Numpad 7',
  },
  bottom: {
    name: 'Bottom View',
    position: [0, -10, 0],
    up: [0, 0, 1],
    isOrtho: true,
    numpad: 'Ctrl + Numpad 7',
  },
  perspective: {
    name: 'User Perspective',
    position: [7.35889, 4.95831, 6.92579],
    up: [0, 1, 0],
    isOrtho: false,
    numpad: 'Numpad 5',
  },
  camera: {
    name: 'Camera View',
    position: [7.35889, 4.95831, 6.92579],
    up: [0, 1, 0],
    isOrtho: false,
    numpad: 'Numpad 0',
  },
};

/**
 * Standard colors used for viewport visuals
 */
export const VIEWPORT_COLORS = {
  background: '#1d1e22',
  selectionPrimary: '#ff9800', // Active Blender selection orange
  selectionSecondary: '#f39c12',
  hoverHighlight: '#4fc3f7',
  axisX: '#e74c3c',
  axisY: '#2ecc71',
  axisZ: '#3498db',
  solidClay: '#b0b0b0',
  wireframe: '#4fc3f7',
  gridFloor: '#282a30',
  gridCenter: '#4f535d',
};
