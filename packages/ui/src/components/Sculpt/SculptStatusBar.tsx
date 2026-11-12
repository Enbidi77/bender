import React from 'react';
import type { SculptBrushType, SymmetryConfig } from '@blender-elt/contracts';
import { BrushIcon } from './BrushIcons.js';
import { BRUSH_METADATA_MAP, SCULPT_BRUSH_DEFINITIONS } from './types.js';
import { cn } from '../common/Button.js';
import { Activity, Shield } from 'lucide-react';

export interface SculptStatusBarProps {
  activeBrush: SculptBrushType;
  brushDirection?: 'add' | 'subtract';
  vertexCount?: number;
  faceCount?: number;
  lastStrokeDurationMs?: number;
  strokeSamplesCount?: number;
  symmetry?: SymmetryConfig;
  maskEnabled?: boolean;
  maskCoveragePercent?: number;
  className?: string;
}

export const SculptStatusBar: React.FC<SculptStatusBarProps> = ({
  activeBrush,
  brushDirection = 'add',
  vertexCount = 0,
  faceCount = 0,
  lastStrokeDurationMs = 0,
  strokeSamplesCount,
  symmetry,
  maskEnabled = true,
  maskCoveragePercent = 0,
  className = '',
}) => {
  const meta = BRUSH_METADATA_MAP[activeBrush] || SCULPT_BRUSH_DEFINITIONS[0];

  const activeSymmetryAxes = [
    symmetry?.x ? 'X' : null,
    symmetry?.y ? 'Y' : null,
    symmetry?.z ? 'Z' : null,
  ].filter(Boolean);

  return (
    <div
      className={cn(
        'flex items-center justify-between h-6 bg-[#1a1b1e] border-t border-[#26272b] px-3 select-none text-[11px] text-gray-400 font-mono z-20',
        className,
      )}
      aria-label="Sculpt Status Bar"
    >
      {/* Left: Active Brush & Direction */}
      <div className="flex items-center gap-3">
        <div className="flex items-center gap-1.5 font-sans font-semibold text-gray-200">
          <BrushIcon type={activeBrush} size={14} className="text-[#80b4f0]" />
          <span>{meta.name}</span>
          <span
            className={cn(
              'text-[10px] px-1 py-0.2 rounded font-mono font-bold',
              brushDirection === 'add'
                ? 'bg-blue-900/60 text-blue-300'
                : 'bg-red-900/60 text-red-300',
            )}
          >
            {brushDirection === 'add' ? '+ADD' : '-SUB'}
          </span>
        </div>

        {/* Symmetry Pills */}
        {activeSymmetryAxes.length > 0 && (
          <div className="hidden sm:flex items-center gap-1 font-sans text-[10px]">
            <span className="text-gray-500">Sym:</span>
            {symmetry?.x && (
              <span className="px-1 rounded bg-[#e04b4b]/30 text-red-300 font-bold">X</span>
            )}
            {symmetry?.y && (
              <span className="px-1 rounded bg-[#4bb84b]/30 text-green-300 font-bold">Y</span>
            )}
            {symmetry?.z && (
              <span className="px-1 rounded bg-[#4b7be0]/30 text-blue-300 font-bold">Z</span>
            )}
            {symmetry?.radial && symmetry.radial.count > 1 && (
              <span className="px-1 rounded bg-amber-900/40 text-amber-300 font-bold">
                {symmetry.radial.count}R
              </span>
            )}
          </div>
        )}

        {/* Mask indicator */}
        {maskEnabled && maskCoveragePercent > 0 && (
          <div className="hidden md:flex items-center gap-1 text-[10px] text-gray-400">
            <Shield size={11} className="text-[#80b4f0]" />
            <span>Mask: {Math.round(maskCoveragePercent)}%</span>
          </div>
        )}
      </div>

      {/* Right: Geometry polycounts & stroke metrics */}
      <div className="flex items-center gap-4">
        {/* Stroke timing metrics */}
        {lastStrokeDurationMs > 0 && (
          <div className="hidden sm:flex items-center gap-1 text-gray-400">
            <Activity size={11} className="text-emerald-400" />
            <span>{lastStrokeDurationMs.toFixed(1)}ms</span>
            {strokeSamplesCount !== undefined && strokeSamplesCount > 0 && (
              <span className="text-gray-500">({strokeSamplesCount} pts)</span>
            )}
          </div>
        )}

        {/* Polycount */}
        <div className="flex items-center gap-2 text-gray-300">
          <div className="flex items-center gap-1">
            <span className="text-gray-500">Verts:</span>
            <span>{vertexCount.toLocaleString()}</span>
          </div>
          <span className="text-gray-600">|</span>
          <div className="flex items-center gap-1">
            <span className="text-gray-500">Faces:</span>
            <span>{faceCount.toLocaleString()}</span>
          </div>
        </div>
      </div>
    </div>
  );
};
