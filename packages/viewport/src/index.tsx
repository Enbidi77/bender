import React from 'react';
import type {
  ViewportConfig,
  GizmoType,
  ShadingMode,
  GridConfig,
  ViewportMode,
} from '@blender-elt/contracts';

export type { ViewportConfig, GizmoType, ShadingMode, GridConfig, ViewportMode };

export const DEFAULT_GRID_CONFIG: GridConfig = {
  visible: true,
  size: 20,
  divisions: 20,
  colorCenterLine: '#444444',
  colorGrid: '#2a2b30',
  showAxes: true,
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

export interface ViewportProps {
  config?: Partial<ViewportConfig>;
  className?: string;
  children?: React.ReactNode;
}

/**
 * Viewport container component placeholder
 */
export const ViewportContainer: React.FC<ViewportProps> = ({ className = '', children }) => {
  return (
    <div
      className={`relative w-full h-full overflow-hidden select-none bg-[#1d1e22] ${className}`}
      data-testid="viewport-container"
    >
      {children}
    </div>
  );
};
