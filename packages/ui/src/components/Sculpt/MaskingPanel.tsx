import React, { useState } from 'react';
import type { SculptMaskOperation } from '@blender-elt/contracts';
import { cn } from '../common/Button.js';
import {
  Shield,
  Eye,
  EyeOff,
  RotateCcw,
  Sparkles,
  Maximize2,
  Minimize2,
  BoxSelect,
  Lasso,
  Paintbrush,
  Flame,
} from 'lucide-react';

export type MaskGestureMode = 'brush' | 'box' | 'lasso';

export interface MaskingPanelProps {
  maskEnabled?: boolean;
  onToggleMaskEnabled?: (enabled: boolean) => void;
  activeGestureMode?: MaskGestureMode;
  onChangeGestureMode?: (mode: MaskGestureMode) => void;
  onMaskOperation: (operation: SculptMaskOperation) => void;
  maskCoveragePercent?: number;
  className?: string;
}

export const MaskingPanel: React.FC<MaskingPanelProps> = ({
  maskEnabled = true,
  onToggleMaskEnabled,
  activeGestureMode = 'brush',
  onChangeGestureMode,
  onMaskOperation,
  maskCoveragePercent = 0,
  className = '',
}) => {
  const [localGestureMode, setLocalGestureMode] = useState<MaskGestureMode>(activeGestureMode);

  const gestureMode = onChangeGestureMode ? activeGestureMode : localGestureMode;
  const setGestureMode = (mode: MaskGestureMode) => {
    if (onChangeGestureMode) onChangeGestureMode(mode);
    setLocalGestureMode(mode);
  };

  const gestureOptions: {
    id: MaskGestureMode;
    label: string;
    icon: React.ReactNode;
    shortcut: string;
  }[] = [
    { id: 'brush', label: 'Paint', icon: <Paintbrush size={12} />, shortcut: 'M' },
    { id: 'box', label: 'Box', icon: <BoxSelect size={12} />, shortcut: 'B' },
    { id: 'lasso', label: 'Lasso', icon: <Lasso size={12} />, shortcut: 'Shift+Ctrl+L' },
  ];

  return (
    <div className={cn('flex flex-col space-y-2 select-none text-xs text-gray-200', className)}>
      {/* 1. Mask Header & Status */}
      <div className="p-2.5 bg-[#202020] rounded border border-[#303030] flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Shield size={14} className="text-[#80b4f0]" />
          <div>
            <div className="flex items-center gap-1.5">
              <span className="font-semibold text-gray-200">Sculpt Mask</span>
              {maskCoveragePercent > 0 && (
                <span className="text-[10px] px-1 py-0.2 rounded bg-[#333] text-gray-300 font-mono">
                  {Math.round(maskCoveragePercent)}%
                </span>
              )}
            </div>
            <span className="text-[10px] text-gray-400">Protects vertices from sculpting</span>
          </div>
        </div>

        {/* Mask Overlay Visibility Toggle */}
        {onToggleMaskEnabled && (
          <button
            onClick={() => onToggleMaskEnabled(!maskEnabled)}
            title={maskEnabled ? 'Hide mask overlay' : 'Show mask overlay'}
            className={cn(
              'p-1.5 rounded transition-colors',
              maskEnabled
                ? 'bg-[#4772b3] text-white'
                : 'text-gray-400 hover:text-white bg-[#1c1c1c] border border-[#383838]',
            )}
          >
            {maskEnabled ? <Eye size={13} /> : <EyeOff size={13} />}
          </button>
        )}
      </div>

      {/* 2. Selection Gesture Mode (Brush, Box, Lasso) */}
      <div className="p-2.5 bg-[#202020] rounded border border-[#303030] space-y-2">
        <span className="text-[11px] font-semibold text-gray-300 block">Gesture Tool</span>
        <div className="grid grid-cols-3 gap-1">
          {gestureOptions.map((opt) => {
            const isSelected = gestureMode === opt.id;
            return (
              <button
                key={opt.id}
                onClick={() => setGestureMode(opt.id)}
                title={`${opt.label} Mask (${opt.shortcut})`}
                className={cn(
                  'flex items-center justify-center gap-1.5 py-1.5 px-2 rounded font-medium text-xs transition-colors border',
                  isSelected
                    ? 'bg-[#4772b3] text-white border-[#60a5fa] shadow-xs'
                    : 'bg-[#1c1c1c] text-gray-400 border-[#383838] hover:bg-[#2b2b2b]',
                )}
              >
                {opt.icon}
                <span>{opt.label}</span>
              </button>
            );
          })}
        </div>
      </div>

      {/* 3. Global Mask Actions */}
      <div className="p-2.5 bg-[#202020] rounded border border-[#303030] space-y-2">
        <span className="text-[11px] font-semibold text-gray-300 block">Mask Operations</span>

        {/* Invert & Clear row */}
        <div className="grid grid-cols-2 gap-1.5">
          <button
            onClick={() => onMaskOperation('invert')}
            title="Invert current mask weights (Ctrl+I)"
            className="flex items-center justify-center gap-1.5 py-1.5 px-2 rounded bg-[#2b2b2b] hover:bg-[#383838] text-gray-200 border border-[#3e3e3e] font-medium transition-colors"
          >
            <RotateCcw size={12} className="text-[#80b4f0]" />
            <span>Invert (Ctrl+I)</span>
          </button>
          <button
            onClick={() => onMaskOperation('clear')}
            title="Clear all mask protection (Alt+M)"
            className="flex items-center justify-center gap-1.5 py-1.5 px-2 rounded bg-[#2b2b2b] hover:bg-[#383838] text-gray-200 border border-[#3e3e3e] font-medium transition-colors"
          >
            <Flame size={12} className="text-amber-400" />
            <span>Clear (Alt+M)</span>
          </button>
        </div>

        {/* Filter Operations: Smooth & Sharpen */}
        <div className="grid grid-cols-2 gap-1.5">
          <button
            onClick={() => onMaskOperation('smooth')}
            title="Smooth mask boundaries"
            className="flex items-center justify-center gap-1.5 py-1.5 px-2 rounded bg-[#1f1f1f] hover:bg-[#2d2d2d] text-gray-300 border border-[#383838] transition-colors"
          >
            <Sparkles size={12} className="text-blue-400" />
            <span>Smooth</span>
          </button>
          <button
            onClick={() => onMaskOperation('sharpen')}
            title="Sharpen and contrast mask weights"
            className="flex items-center justify-center gap-1.5 py-1.5 px-2 rounded bg-[#1f1f1f] hover:bg-[#2d2d2d] text-gray-300 border border-[#383838] transition-colors"
          >
            <span>Sharpen</span>
          </button>
        </div>

        {/* Filter Operations: Grow & Shrink */}
        <div className="grid grid-cols-2 gap-1.5">
          <button
            onClick={() => onMaskOperation('grow')}
            title="Expand mask outward to neighboring vertices"
            className="flex items-center justify-center gap-1.5 py-1.5 px-2 rounded bg-[#1f1f1f] hover:bg-[#2d2d2d] text-gray-300 border border-[#383838] transition-colors"
          >
            <Maximize2 size={12} className="text-emerald-400" />
            <span>Grow Mask</span>
          </button>
          <button
            onClick={() => onMaskOperation('shrink')}
            title="Contract mask inward"
            className="flex items-center justify-center gap-1.5 py-1.5 px-2 rounded bg-[#1f1f1f] hover:bg-[#2d2d2d] text-gray-300 border border-[#383838] transition-colors"
          >
            <Minimize2 size={12} className="text-rose-400" />
            <span>Shrink Mask</span>
          </button>
        </div>

        {/* Flood Fill */}
        <button
          onClick={() => onMaskOperation('fill')}
          title="Fill entire mesh with 100% protective mask"
          className="w-full py-1.5 rounded bg-[#1a1a1a] hover:bg-[#262626] text-gray-400 hover:text-white border border-[#333] transition-colors"
        >
          Fill All (100% Mask)
        </button>
      </div>
    </div>
  );
};
