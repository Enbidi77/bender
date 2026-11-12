import React, { useState } from 'react';
import type { SculptBrushType, SculptBrushConfig, SymmetryConfig } from '@blender-elt/contracts';
import { BrushIcon } from './BrushIcons.js';
import { BRUSH_METADATA_MAP, SCULPT_BRUSH_DEFINITIONS } from './types.js';
import { BrushPicker } from './BrushPicker.js';
import { cn } from '../common/Button.js';
import { Plus, Minus, ChevronDown, Tablet } from 'lucide-react';

export interface SculptTopBarProps {
  activeBrush: SculptBrushType;
  brushConfig: SculptBrushConfig;
  onUpdateBrushConfig: (updates: Partial<SculptBrushConfig>) => void;
  onSelectBrush: (brush: SculptBrushType) => void;
  symmetry: SymmetryConfig;
  onUpdateSymmetry: (updates: Partial<SymmetryConfig>) => void;
  className?: string;
}

export const SculptTopBar: React.FC<SculptTopBarProps> = ({
  activeBrush,
  brushConfig,
  onUpdateBrushConfig,
  onSelectBrush,
  symmetry,
  onUpdateSymmetry,
  className = '',
}) => {
  const [showPicker, setShowPicker] = useState<boolean>(false);
  const metadata = BRUSH_METADATA_MAP[activeBrush] || SCULPT_BRUSH_DEFINITIONS[0];

  return (
    <div
      className={cn(
        'flex items-center gap-2 px-2 py-0.5 bg-[#252528] text-xs text-gray-200 select-none relative',
        className,
      )}
    >
      {/* 1. Brush Picker Dropdown Trigger */}
      <div className="relative">
        <button
          onClick={() => setShowPicker((p) => !p)}
          className="flex items-center gap-1.5 px-2 py-1 rounded bg-[#1e1e20] hover:bg-[#323236] border border-[#3e3e44] text-xs font-semibold text-white transition-colors"
          title={`Active Brush: ${metadata.name} (${metadata.shortcut})`}
        >
          <BrushIcon type={activeBrush} size={14} className="text-[#80b4f0]" />
          <span>{metadata.name}</span>
          <ChevronDown size={11} className="text-gray-400" />
        </button>

        {showPicker && (
          <div className="absolute left-0 top-full mt-1 z-50">
            <BrushPicker
              activeBrush={activeBrush}
              onSelectBrush={(brush) => {
                onSelectBrush(brush);
                setShowPicker(false);
              }}
              onClose={() => setShowPicker(false)}
            />
          </div>
        )}
      </div>

      <div className="h-4 w-px bg-[#3e3e44] mx-0.5" />

      {/* 2. Radius quick control */}
      <div className="flex items-center gap-1.5 bg-[#1e1e20] px-2 py-0.5 rounded border border-[#38383e]">
        <span className="text-[11px] text-gray-400 font-medium">Radius:</span>
        <input
          type="range"
          min="1"
          max="200"
          value={brushConfig.radius}
          onChange={(e) => onUpdateBrushConfig({ radius: parseInt(e.target.value, 10) })}
          className="w-16 accent-[#4772b3] bg-[#141416] h-1.5 rounded-lg appearance-none cursor-pointer"
        />
        <span className="font-mono text-gray-200 text-[11px] w-9 text-right">
          {brushConfig.radius}px
        </span>
        <button
          onClick={() =>
            onUpdateBrushConfig({
              pressureAffectsSize: !brushConfig.pressureAffectsSize,
            })
          }
          title="Pressure alters Radius"
          className={cn(
            'p-0.5 rounded',
            brushConfig.pressureAffectsSize
              ? 'text-[#80b4f0]'
              : 'text-gray-500 hover:text-gray-300',
          )}
        >
          <Tablet size={11} />
        </button>
      </div>

      {/* 3. Strength quick control */}
      <div className="flex items-center gap-1.5 bg-[#1e1e20] px-2 py-0.5 rounded border border-[#38383e]">
        <span className="text-[11px] text-gray-400 font-medium">Strength:</span>
        <input
          type="range"
          min="0.01"
          max="1.0"
          step="0.01"
          value={brushConfig.strength}
          onChange={(e) => onUpdateBrushConfig({ strength: parseFloat(e.target.value) })}
          className="w-16 accent-[#4772b3] bg-[#141416] h-1.5 rounded-lg appearance-none cursor-pointer"
        />
        <span className="font-mono text-gray-200 text-[11px] w-9 text-right">
          {Math.round(brushConfig.strength * 100)}%
        </span>
        <button
          onClick={() =>
            onUpdateBrushConfig({
              pressureAffectsStrength: !brushConfig.pressureAffectsStrength,
            })
          }
          title="Pressure alters Strength"
          className={cn(
            'p-0.5 rounded',
            brushConfig.pressureAffectsStrength
              ? 'text-[#80b4f0]'
              : 'text-gray-500 hover:text-gray-300',
          )}
        >
          <Tablet size={11} />
        </button>
      </div>

      {/* 4. Direction (+ / -) */}
      <div className="flex items-center bg-[#1e1e20] border border-[#3a3a40] rounded p-0.5">
        <button
          onClick={() => onUpdateBrushConfig({ direction: 'add' })}
          title="Add (+)"
          className={cn(
            'p-1 rounded text-xs transition-colors',
            brushConfig.direction === 'add'
              ? 'bg-[#4772b3] text-white'
              : 'text-gray-400 hover:text-white',
          )}
        >
          <Plus size={12} />
        </button>
        <button
          onClick={() => onUpdateBrushConfig({ direction: 'subtract' })}
          title="Subtract (-) (Ctrl)"
          className={cn(
            'p-1 rounded text-xs transition-colors',
            brushConfig.direction === 'subtract'
              ? 'bg-[#e04b4b] text-white'
              : 'text-gray-400 hover:text-white',
          )}
        >
          <Minus size={12} />
        </button>
      </div>

      <div className="h-4 w-px bg-[#3e3e44] mx-0.5" />

      {/* 5. Symmetry X/Y/Z Quick Pills */}
      <div className="flex items-center gap-0.5 bg-[#1e1e20] border border-[#3a3a40] rounded p-0.5">
        <span className="text-[10px] text-gray-500 font-medium px-1">Sym:</span>
        <button
          onClick={() => onUpdateSymmetry({ x: !symmetry.x })}
          title="Toggle X Mirror"
          className={cn(
            'px-1.5 py-0.5 rounded text-[10px] font-bold transition-colors',
            symmetry.x ? 'bg-[#e04b4b] text-white shadow-xs' : 'text-gray-500 hover:text-gray-300',
          )}
        >
          X
        </button>
        <button
          onClick={() => onUpdateSymmetry({ y: !symmetry.y })}
          title="Toggle Y Mirror"
          className={cn(
            'px-1.5 py-0.5 rounded text-[10px] font-bold transition-colors',
            symmetry.y ? 'bg-[#4bb84b] text-white shadow-xs' : 'text-gray-500 hover:text-gray-300',
          )}
        >
          Y
        </button>
        <button
          onClick={() => onUpdateSymmetry({ z: !symmetry.z })}
          title="Toggle Z Mirror"
          className={cn(
            'px-1.5 py-0.5 rounded text-[10px] font-bold transition-colors',
            symmetry.z ? 'bg-[#4b7be0] text-white shadow-xs' : 'text-gray-500 hover:text-gray-300',
          )}
        >
          Z
        </button>
      </div>
    </div>
  );
};
