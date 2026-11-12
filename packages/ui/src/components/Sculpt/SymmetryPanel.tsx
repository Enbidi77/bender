import React from 'react';
import type { SymmetryConfig } from '@blender-elt/contracts';
import { cn } from '../common/Button.js';
import { FlipHorizontal, RotateCw, Globe } from 'lucide-react';

export interface SymmetryPanelProps {
  symmetry: SymmetryConfig;
  onUpdateSymmetry: (updates: Partial<SymmetryConfig>) => void;
  coordinateSpace?: 'object' | 'world';
  onChangeCoordinateSpace?: (space: 'object' | 'world') => void;
  className?: string;
}

export const SymmetryPanel: React.FC<SymmetryPanelProps> = ({
  symmetry,
  onUpdateSymmetry,
  coordinateSpace = 'object',
  onChangeCoordinateSpace,
  className = '',
}) => {
  const radial = symmetry.radial || { axis: 'z', count: 1 };

  return (
    <div className={cn('flex flex-col space-y-2 select-none text-xs text-gray-200', className)}>
      {/* 1. Mirror Symmetry Across Axes */}
      <div className="p-2.5 bg-[#202020] rounded border border-[#303030] space-y-2.5">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-1.5 font-semibold text-gray-300">
            <FlipHorizontal size={13} className="text-[#80b4f0]" />
            <span>Mirror Symmetry</span>
          </div>
          <button
            onClick={() =>
              onChangeCoordinateSpace?.(coordinateSpace === 'object' ? 'world' : 'object')
            }
            title={`Symmetry Space: ${coordinateSpace}`}
            className="text-[10px] px-1.5 py-0.5 rounded bg-[#181818] border border-[#383838] text-gray-400 hover:text-white capitalize flex items-center gap-1"
          >
            <Globe size={10} />
            <span>{coordinateSpace}</span>
          </button>
        </div>

        {/* Axis Mirror Pills: X (Red), Y (Green), Z (Blue) */}
        <div className="grid grid-cols-3 gap-1.5">
          {/* X Axis */}
          <button
            onClick={() => onUpdateSymmetry({ x: !symmetry.x })}
            title="Mirror across X axis"
            className={cn(
              'flex items-center justify-center gap-1.5 py-1.5 px-3 rounded font-bold text-xs transition-colors border',
              symmetry.x
                ? 'bg-[#e04b4b] text-white border-red-500 shadow-xs'
                : 'bg-[#1c1c1c] text-red-400 border-[#383838] hover:bg-[#2b2b2b]',
            )}
          >
            <span>X</span>
            <span className="text-[10px] font-normal opacity-80">{symmetry.x ? 'ON' : 'OFF'}</span>
          </button>

          {/* Y Axis */}
          <button
            onClick={() => onUpdateSymmetry({ y: !symmetry.y })}
            title="Mirror across Y axis"
            className={cn(
              'flex items-center justify-center gap-1.5 py-1.5 px-3 rounded font-bold text-xs transition-colors border',
              symmetry.y
                ? 'bg-[#4bb84b] text-white border-green-500 shadow-xs'
                : 'bg-[#1c1c1c] text-green-400 border-[#383838] hover:bg-[#2b2b2b]',
            )}
          >
            <span>Y</span>
            <span className="text-[10px] font-normal opacity-80">{symmetry.y ? 'ON' : 'OFF'}</span>
          </button>

          {/* Z Axis */}
          <button
            onClick={() => onUpdateSymmetry({ z: !symmetry.z })}
            title="Mirror across Z axis"
            className={cn(
              'flex items-center justify-center gap-1.5 py-1.5 px-3 rounded font-bold text-xs transition-colors border',
              symmetry.z
                ? 'bg-[#4b7be0] text-white border-blue-500 shadow-xs'
                : 'bg-[#1c1c1c] text-blue-400 border-[#383838] hover:bg-[#2b2b2b]',
            )}
          >
            <span>Z</span>
            <span className="text-[10px] font-normal opacity-80">{symmetry.z ? 'ON' : 'OFF'}</span>
          </button>
        </div>
      </div>

      {/* 2. Radial Symmetry Section */}
      <div className="p-2.5 bg-[#202020] rounded border border-[#303030] space-y-2.5">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-1.5 font-semibold text-gray-300">
            <RotateCw size={13} className="text-[#80b4f0]" />
            <span>Radial Symmetry</span>
          </div>
          {radial.count > 1 && (
            <span className="text-[10px] text-amber-400 font-mono font-bold">{radial.count}x</span>
          )}
        </div>

        {/* Radial Axis Selection */}
        <div className="flex items-center gap-2">
          <span className="text-[11px] text-gray-400">Axis:</span>
          <div className="flex items-center gap-1 flex-1">
            {(['x', 'y', 'z'] as const).map((axis) => {
              const isSelected = radial.axis === axis;
              return (
                <button
                  key={axis}
                  onClick={() =>
                    onUpdateSymmetry({
                      radial: { ...radial, axis },
                    })
                  }
                  className={cn(
                    'flex-1 py-1 rounded text-xs font-bold uppercase transition-colors border',
                    isSelected
                      ? 'bg-[#4772b3] text-white border-[#60a5fa]'
                      : 'bg-[#1c1c1c] text-gray-400 border-[#383838] hover:bg-[#2b2b2b]',
                  )}
                >
                  {axis}
                </button>
              );
            })}
          </div>
        </div>

        {/* Radial Count Slider + Input */}
        <div>
          <div className="flex items-center justify-between text-[11px] text-gray-400 mb-1">
            <span>Radial Count</span>
            <span className="font-mono text-gray-200">{radial.count}</span>
          </div>
          <input
            type="range"
            min="1"
            max="64"
            step="1"
            value={radial.count}
            onChange={(e) =>
              onUpdateSymmetry({
                radial: { ...radial, count: parseInt(e.target.value, 10) },
              })
            }
            className="w-full accent-[#4772b3] bg-[#181818] h-1.5 rounded-lg appearance-none cursor-pointer"
          />
        </div>
      </div>
    </div>
  );
};
