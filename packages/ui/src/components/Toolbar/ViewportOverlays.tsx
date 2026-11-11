import React, { useState } from 'react';
import {
  Grid,
  Magnet,
  Maximize,
  Box,
} from 'lucide-react';
import { cn } from '../common/Button.js';
import type { ShadingMode, CameraProjection } from '@blender-elt/contracts';

export interface ViewportOverlaysProps {
  shadingMode: ShadingMode;
  onChangeShadingMode: (mode: ShadingMode) => void;
  projection?: CameraProjection;
  onToggleProjection?: () => void;
  onFocusSelection?: () => void;
  showGrid?: boolean;
  onToggleGrid?: () => void;
  showWireframe?: boolean;
  onToggleWireframe?: () => void;
  snapping?: boolean;
  onToggleSnapping?: () => void;
  snapIncrement?: number;
  onChangeSnapIncrement?: (val: number) => void;
  className?: string;
}

export const ViewportOverlays: React.FC<ViewportOverlaysProps> = ({
  shadingMode,
  onChangeShadingMode,
  projection = 'perspective',
  onToggleProjection,
  onFocusSelection,
  showGrid = true,
  onToggleGrid,
  showWireframe = false,
  onToggleWireframe,
  snapping = false,
  onToggleSnapping,
  snapIncrement = 1.0,
  onChangeSnapIncrement,
  className = '',
}) => {
  const [showSnapMenu, setShowSnapMenu] = useState<boolean>(false);

  const shadingModes: { id: ShadingMode; label: string }[] = [
    { id: 'wireframe', label: 'Wire' },
    { id: 'solid', label: 'Solid' },
    { id: 'material', label: 'Material' },
    { id: 'rendered', label: 'Render' },
  ];

  return (
    <div
      className={cn(
        'flex items-center gap-2 select-none text-xs pointer-events-auto',
        className,
      )}
    >
      {/* 1. Snapping Controls */}
      <div className="flex items-center bg-[#242424]/90 backdrop-blur-xs border border-[#3e3e3e] rounded p-0.5 shadow-md">
        <button
          onClick={onToggleSnapping}
          title={snapping ? 'Snapping ON' : 'Snapping OFF'}
          className={cn('p-1 rounded text-gray-400 hover:text-white transition-colors', {
            'bg-[#4772b3] text-white': snapping,
          })}
        >
          <Magnet size={13} />
        </button>

        {onChangeSnapIncrement && (
          <div className="relative">
            <button
              onClick={() => setShowSnapMenu(!showSnapMenu)}
              title="Snap increment"
              className="px-1.5 py-0.5 text-[10px] text-gray-300 hover:text-white font-mono"
            >
              {snapIncrement}m
            </button>
            {showSnapMenu && (
              <div className="absolute right-0 top-full mt-1 bg-[#202020] border border-[#3e3e3e] rounded shadow-xl py-1 z-50 text-[11px] w-20">
                {[0.1, 0.25, 0.5, 1.0, 2.0].map((inc) => (
                  <button
                    key={inc}
                    onClick={() => {
                      onChangeSnapIncrement(inc);
                      setShowSnapMenu(false);
                    }}
                    className={cn(
                      'w-full text-center py-1 hover:bg-[#4772b3] hover:text-white text-gray-300 font-mono',
                      { 'bg-[#353535] text-white': snapIncrement === inc },
                    )}
                  >
                    {inc}m
                  </button>
                ))}
              </div>
            )}
          </div>
        )}
      </div>

      {/* 2. Grid & Wireframe Overlays */}
      <div className="flex items-center bg-[#242424]/90 backdrop-blur-xs border border-[#3e3e3e] rounded p-0.5 shadow-md">
        {onToggleGrid && (
          <button
            onClick={onToggleGrid}
            title={showGrid ? 'Hide Grid' : 'Show Grid'}
            className={cn('p-1 rounded text-gray-400 hover:text-white transition-colors', {
              'bg-[#383838] text-white': showGrid,
            })}
          >
            <Grid size={13} />
          </button>
        )}
        {onToggleWireframe && (
          <button
            onClick={onToggleWireframe}
            title={showWireframe ? 'Hide Wireframe Overlay' : 'Show Wireframe Overlay'}
            className={cn('p-1 rounded text-gray-400 hover:text-white transition-colors', {
              'bg-[#383838] text-white': showWireframe,
            })}
          >
            <Box size={13} />
          </button>
        )}
      </div>

      {/* 3. Camera Projection & Focus */}
      <div className="flex items-center bg-[#242424]/90 backdrop-blur-xs border border-[#3e3e3e] rounded p-0.5 shadow-md">
        {onToggleProjection && (
          <button
            onClick={onToggleProjection}
            title={`Switch to ${projection === 'perspective' ? 'Orthographic' : 'Perspective'}`}
            className="px-2 py-0.5 rounded text-[11px] font-medium text-gray-300 hover:text-white hover:bg-[#383838] transition-colors"
          >
            {projection === 'perspective' ? 'Persp' : 'Ortho'}
          </button>
        )}
        {onFocusSelection && (
          <button
            onClick={onFocusSelection}
            title="Focus Selection (F or .)"
            className="p-1 rounded text-gray-400 hover:text-white hover:bg-[#383838] transition-colors"
          >
            <Maximize size={13} />
          </button>
        )}
      </div>

      {/* 4. Shading Mode Switcher */}
      <div className="flex items-center bg-[#242424]/90 backdrop-blur-xs border border-[#3e3e3e] rounded p-0.5 shadow-md">
        {shadingModes.map((mode) => (
          <button
            key={mode.id}
            onClick={() => onChangeShadingMode(mode.id)}
            className={cn(
              'px-2 py-0.5 rounded text-[11px] font-medium capitalize transition-colors',
              {
                'bg-[#4772b3] text-white shadow-xs': shadingMode === mode.id,
                'text-gray-400 hover:text-white hover:bg-[#383838]': shadingMode !== mode.id,
              },
            )}
          >
            {mode.label}
          </button>
        ))}
      </div>
    </div>
  );
};
