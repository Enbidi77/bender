import React from 'react';
import type { ViewportContainerProps } from './types.js';
import { ViewportProvider } from './context/ViewportContext.js';
import { ViewportCanvas } from './ViewportCanvas.js';
import { ViewportToolbar } from './ui/ViewportToolbar.js';
import { ViewportInfoOverlay } from './ui/ViewportInfoOverlay.js';
import { useViewportHotkeys } from './hooks/useViewportHotkeys.js';

const ViewportContent: React.FC<{ children?: React.ReactNode }> = ({ children }) => {
  // Activate standard Blender hotkeys (G, R, S, F, Numpad 1/3/7/5/0/., etc.)
  useViewportHotkeys(true);

  return (
    <div className="relative w-full h-full overflow-hidden select-none bg-[#1d1e22] text-gray-200">
      {/* 3D WebGL Canvas */}
      <ViewportCanvas />

      {/* Floating Toolbar and Badges */}
      <ViewportToolbar />
      <ViewportInfoOverlay />

      {/* Custom user overlay children */}
      {children}
    </div>
  );
};

/**
 * Reusable Blender 3D Viewport container.
 * Drops cleanly into desktop layouts, panels, or custom scenes.
 */
export const ViewportContainer: React.FC<ViewportContainerProps> = ({
  className = '',
  style,
  children,
  ...props
}) => {
  return (
    <div
      className={`relative w-full h-full overflow-hidden select-none ${className}`}
      style={style}
      data-testid="viewport-container"
    >
      <ViewportProvider {...props}>
        <ViewportContent>{children}</ViewportContent>
      </ViewportProvider>
    </div>
  );
};
