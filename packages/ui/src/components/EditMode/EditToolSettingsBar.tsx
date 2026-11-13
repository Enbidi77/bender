import React from 'react';
import type { EditModeTool } from '@blender-elt/contracts';
import { EDIT_TOOL_METADATA_MAP, type EditModeSettings } from './types.js';
import { cn } from '../common/Button.js';
import { SlidersHorizontal } from 'lucide-react';

export interface EditToolSettingsBarProps {
  activeTool: EditModeTool;
  settings: EditModeSettings;
  onUpdateSettings: (updates: Partial<EditModeSettings>) => void;
  onApplyOperation?: (operation: string, params: Record<string, unknown>) => void;
  className?: string;
}

export const EditToolSettingsBar: React.FC<EditToolSettingsBarProps> = ({
  activeTool,
  settings,
  onUpdateSettings,
  onApplyOperation,
  className = '',
}) => {
  const toolMeta = EDIT_TOOL_METADATA_MAP[activeTool];

  const updateExtrude = (updates: Partial<EditModeSettings['extrude']>) => {
    const updated = { ...settings.extrude, ...updates };
    onUpdateSettings({ extrude: updated });
    onApplyOperation?.('extrude', updated);
  };

  const updateInset = (updates: Partial<EditModeSettings['inset']>) => {
    const updated = { ...settings.inset, ...updates };
    onUpdateSettings({ inset: updated });
    onApplyOperation?.('inset', updated);
  };

  const updateBevel = (updates: Partial<EditModeSettings['bevel']>) => {
    const updated = { ...settings.bevel, ...updates };
    onUpdateSettings({ bevel: updated });
    onApplyOperation?.('bevel', updated);
  };

  const updateLoopcut = (updates: Partial<EditModeSettings['loopcut']>) => {
    const updated = { ...settings.loopcut, ...updates };
    onUpdateSettings({ loopcut: updated });
    onApplyOperation?.('loopcut', updated);
  };

  const updateKnife = (updates: Partial<EditModeSettings['knife']>) => {
    const updated = { ...settings.knife, ...updates };
    onUpdateSettings({ knife: updated });
    onApplyOperation?.('knife', updated);
  };

  const updateSpin = (updates: Partial<EditModeSettings['spin']>) => {
    const updated = { ...settings.spin, ...updates };
    onUpdateSettings({ spin: updated });
    onApplyOperation?.('spin', updated);
  };

  const updateSmooth = (updates: Partial<EditModeSettings['smooth']>) => {
    const updated = { ...settings.smooth, ...updates };
    onUpdateSettings({ smooth: updated });
    onApplyOperation?.('smooth', updated);
  };

  const updateTransform = (updates: Partial<EditModeSettings['transform']>) => {
    const updated = { ...settings.transform, ...updates };
    onUpdateSettings({ transform: updated });
  };

  return (
    <div
      role="region"
      aria-label="Edit Tool Settings Bar"
      className={cn(
        'flex items-center gap-3 bg-[#242424] border-b border-[#181818] px-3 py-1 text-xs text-gray-200 select-none overflow-x-auto scrollbar-none',
        className,
      )}
    >
      {/* Active Tool Name Badge */}
      <div className="flex items-center gap-1.5 shrink-0 pr-2 border-r border-[#3a3a3a]">
        <SlidersHorizontal size={13} className="text-[#4772b3]" />
        <span className="font-semibold text-white text-[11px]">{toolMeta?.name || activeTool}</span>
        {toolMeta?.shortcut && (
          <kbd className="px-1 py-0.2 rounded bg-[#1e1e1e] text-[9px] font-mono text-gray-400 border border-[#3e3e3e]">
            {toolMeta.shortcut}
          </kbd>
        )}
      </div>

      {/* Tool-Specific Controls */}
      {activeTool === 'extrude' && (
        <div className="flex items-center gap-3 shrink-0">
          <label className="flex items-center gap-1.5">
            <span className="text-gray-400 text-[11px]">Distance:</span>
            <input
              type="number"
              step="0.1"
              value={settings.extrude.distance}
              onChange={(e) => updateExtrude({ distance: parseFloat(e.target.value) || 0 })}
              className="w-16 bg-[#181818] border border-[#3e3e3e] rounded px-1.5 py-0.5 text-xs text-white focus:outline-none focus:border-[#4772b3]"
            />
          </label>

          <label className="flex items-center gap-1.5">
            <span className="text-gray-400 text-[11px]">Direction:</span>
            <select
              value={settings.extrude.direction}
              onChange={(e) => updateExtrude({ direction: e.target.value as any })}
              className="bg-[#181818] border border-[#3e3e3e] rounded px-1.5 py-0.5 text-xs text-white focus:outline-none focus:border-[#4772b3]"
            >
              <option value="normal">Normal</option>
              <option value="x">X Axis</option>
              <option value="y">Y Axis</option>
              <option value="z">Z Axis</option>
              <option value="individual">Individual</option>
            </select>
          </label>

          <label className="flex items-center gap-1.5 cursor-pointer">
            <input
              type="checkbox"
              checked={settings.extrude.flipNormals}
              onChange={(e) => updateExtrude({ flipNormals: e.target.checked })}
              className="rounded bg-[#181818] border-[#3e3e3e] text-[#4772b3] focus:ring-0"
            />
            <span className="text-gray-300 text-[11px]">Flip Normals</span>
          </label>

          <label className="flex items-center gap-1.5 cursor-pointer">
            <input
              type="checkbox"
              checked={settings.extrude.dissolveOrthogonal}
              onChange={(e) => updateExtrude({ dissolveOrthogonal: e.target.checked })}
              className="rounded bg-[#181818] border-[#3e3e3e] text-[#4772b3] focus:ring-0"
            />
            <span className="text-gray-300 text-[11px]">Dissolve Orthogonal</span>
          </label>
        </div>
      )}

      {activeTool === 'inset' && (
        <div className="flex items-center gap-3 shrink-0">
          <label className="flex items-center gap-1.5">
            <span className="text-gray-400 text-[11px]">Thickness:</span>
            <input
              type="number"
              step="0.05"
              min="0"
              value={settings.inset.thickness}
              onChange={(e) => updateInset({ thickness: parseFloat(e.target.value) || 0 })}
              className="w-16 bg-[#181818] border border-[#3e3e3e] rounded px-1.5 py-0.5 text-xs text-white focus:outline-none focus:border-[#4772b3]"
            />
          </label>

          <label className="flex items-center gap-1.5">
            <span className="text-gray-400 text-[11px]">Depth:</span>
            <input
              type="number"
              step="0.05"
              value={settings.inset.depth}
              onChange={(e) => updateInset({ depth: parseFloat(e.target.value) || 0 })}
              className="w-16 bg-[#181818] border border-[#3e3e3e] rounded px-1.5 py-0.5 text-xs text-white focus:outline-none focus:border-[#4772b3]"
            />
          </label>

          <label className="flex items-center gap-1.5 cursor-pointer">
            <input
              type="checkbox"
              checked={settings.inset.individual}
              onChange={(e) => updateInset({ individual: e.target.checked })}
              className="rounded bg-[#181818] border-[#3e3e3e] text-[#4772b3] focus:ring-0"
            />
            <span className="text-gray-300 text-[11px]">Individual</span>
          </label>

          <label className="flex items-center gap-1.5 cursor-pointer">
            <input
              type="checkbox"
              checked={settings.inset.selectOuter}
              onChange={(e) => updateInset({ selectOuter: e.target.checked })}
              className="rounded bg-[#181818] border-[#3e3e3e] text-[#4772b3] focus:ring-0"
            />
            <span className="text-gray-300 text-[11px]">Select Outer</span>
          </label>
        </div>
      )}

      {activeTool === 'bevel' && (
        <div className="flex items-center gap-3 shrink-0">
          <label className="flex items-center gap-1.5">
            <span className="text-gray-400 text-[11px]">Width:</span>
            <input
              type="number"
              step="0.02"
              min="0"
              value={settings.bevel.width}
              onChange={(e) => updateBevel({ width: parseFloat(e.target.value) || 0 })}
              className="w-16 bg-[#181818] border border-[#3e3e3e] rounded px-1.5 py-0.5 text-xs text-white focus:outline-none focus:border-[#4772b3]"
            />
          </label>

          <label className="flex items-center gap-1.5">
            <span className="text-gray-400 text-[11px]">Segments:</span>
            <input
              type="number"
              min="1"
              max="32"
              value={settings.bevel.segments}
              onChange={(e) => updateBevel({ segments: parseInt(e.target.value, 10) || 1 })}
              className="w-12 bg-[#181818] border border-[#3e3e3e] rounded px-1.5 py-0.5 text-xs text-white focus:outline-none focus:border-[#4772b3]"
            />
          </label>

          <div className="flex items-center bg-[#181818] border border-[#3e3e3e] rounded p-0.5">
            <button
              type="button"
              onClick={() => updateBevel({ target: 'edge' })}
              className={cn(
                'px-1.5 py-0.5 rounded text-[10px] font-medium transition-colors',
                settings.bevel.target === 'edge'
                  ? 'bg-[#4772b3] text-white'
                  : 'text-gray-400 hover:text-white',
              )}
            >
              Edges
            </button>
            <button
              type="button"
              onClick={() => updateBevel({ target: 'vertex' })}
              className={cn(
                'px-1.5 py-0.5 rounded text-[10px] font-medium transition-colors',
                settings.bevel.target === 'vertex'
                  ? 'bg-[#4772b3] text-white'
                  : 'text-gray-400 hover:text-white',
              )}
            >
              Vertices
            </button>
          </div>

          <label className="flex items-center gap-1.5 cursor-pointer">
            <input
              type="checkbox"
              checked={settings.bevel.clampOverlap}
              onChange={(e) => updateBevel({ clampOverlap: e.target.checked })}
              className="rounded bg-[#181818] border-[#3e3e3e] text-[#4772b3] focus:ring-0"
            />
            <span className="text-gray-300 text-[11px]">Clamp Overlap</span>
          </label>
        </div>
      )}

      {activeTool === 'loopcut' && (
        <div className="flex items-center gap-3 shrink-0">
          <label className="flex items-center gap-1.5">
            <span className="text-gray-400 text-[11px]">Number of Cuts:</span>
            <input
              type="number"
              min="1"
              max="64"
              value={settings.loopcut.cuts}
              onChange={(e) => updateLoopcut({ cuts: parseInt(e.target.value, 10) || 1 })}
              className="w-12 bg-[#181818] border border-[#3e3e3e] rounded px-1.5 py-0.5 text-xs text-white focus:outline-none focus:border-[#4772b3]"
            />
          </label>

          <label className="flex items-center gap-1.5">
            <span className="text-gray-400 text-[11px]">Falloff / Factor:</span>
            <input
              type="range"
              min="-1"
              max="1"
              step="0.05"
              value={settings.loopcut.factor}
              onChange={(e) => updateLoopcut({ factor: parseFloat(e.target.value) || 0 })}
              className="w-20 accent-[#4772b3]"
            />
            <span className="text-[10px] font-mono w-8">{settings.loopcut.factor.toFixed(2)}</span>
          </label>

          <label className="flex items-center gap-1.5">
            <span className="text-gray-400 text-[11px]">Smoothness:</span>
            <input
              type="number"
              step="0.1"
              value={settings.loopcut.smoothness}
              onChange={(e) => updateLoopcut({ smoothness: parseFloat(e.target.value) || 0 })}
              className="w-14 bg-[#181818] border border-[#3e3e3e] rounded px-1.5 py-0.5 text-xs text-white focus:outline-none focus:border-[#4772b3]"
            />
          </label>
        </div>
      )}

      {activeTool === 'knife' && (
        <div className="flex items-center gap-3 shrink-0">
          <label className="flex items-center gap-1.5 cursor-pointer">
            <input
              type="checkbox"
              checked={settings.knife.onlySelected}
              onChange={(e) => updateKnife({ onlySelected: e.target.checked })}
              className="rounded bg-[#181818] border-[#3e3e3e] text-[#4772b3] focus:ring-0"
            />
            <span className="text-gray-300 text-[11px]">Only Selected</span>
          </label>

          <label className="flex items-center gap-1.5 cursor-pointer">
            <input
              type="checkbox"
              checked={settings.knife.occlude}
              onChange={(e) => updateKnife({ occlude: e.target.checked })}
              className="rounded bg-[#181818] border-[#3e3e3e] text-[#4772b3] focus:ring-0"
            />
            <span className="text-gray-300 text-[11px]">Occlude Geometry</span>
          </label>
        </div>
      )}

      {activeTool === 'spin' && (
        <div className="flex items-center gap-3 shrink-0">
          <label className="flex items-center gap-1.5">
            <span className="text-gray-400 text-[11px]">Steps:</span>
            <input
              type="number"
              min="1"
              max="128"
              value={settings.spin.steps}
              onChange={(e) => updateSpin({ steps: parseInt(e.target.value, 10) || 1 })}
              className="w-12 bg-[#181818] border border-[#3e3e3e] rounded px-1.5 py-0.5 text-xs text-white focus:outline-none focus:border-[#4772b3]"
            />
          </label>

          <label className="flex items-center gap-1.5">
            <span className="text-gray-400 text-[11px]">Angle:</span>
            <input
              type="number"
              step="5"
              value={settings.spin.angle}
              onChange={(e) => updateSpin({ angle: parseFloat(e.target.value) || 0 })}
              className="w-16 bg-[#181818] border border-[#3e3e3e] rounded px-1.5 py-0.5 text-xs text-white focus:outline-none focus:border-[#4772b3]"
            />
            <span className="text-[10px] text-gray-400">deg</span>
          </label>

          <label className="flex items-center gap-1.5">
            <span className="text-gray-400 text-[11px]">Axis:</span>
            <select
              value={settings.spin.axis}
              onChange={(e) => updateSpin({ axis: e.target.value as any })}
              className="bg-[#181818] border border-[#3e3e3e] rounded px-1.5 py-0.5 text-xs text-white focus:outline-none focus:border-[#4772b3]"
            >
              <option value="x">X Axis</option>
              <option value="y">Y Axis</option>
              <option value="z">Z Axis</option>
            </select>
          </label>
        </div>
      )}

      {activeTool === 'smooth' && (
        <div className="flex items-center gap-3 shrink-0">
          <label className="flex items-center gap-1.5">
            <span className="text-gray-400 text-[11px]">Factor:</span>
            <input
              type="range"
              min="0"
              max="1"
              step="0.05"
              value={settings.smooth.factor}
              onChange={(e) => updateSmooth({ factor: parseFloat(e.target.value) || 0 })}
              className="w-20 accent-[#4772b3]"
            />
            <span className="text-[10px] font-mono w-8">{settings.smooth.factor.toFixed(2)}</span>
          </label>

          <label className="flex items-center gap-1.5">
            <span className="text-gray-400 text-[11px]">Iterations:</span>
            <input
              type="number"
              min="1"
              max="50"
              value={settings.smooth.iterations}
              onChange={(e) => updateSmooth({ iterations: parseInt(e.target.value, 10) || 1 })}
              className="w-12 bg-[#181818] border border-[#3e3e3e] rounded px-1.5 py-0.5 text-xs text-white focus:outline-none focus:border-[#4772b3]"
            />
          </label>
        </div>
      )}

      {(activeTool === 'move' ||
        activeTool === 'rotate' ||
        activeTool === 'scale' ||
        activeTool === 'select' ||
        activeTool === 'cursor') && (
        <div className="flex items-center gap-3 shrink-0">
          <label className="flex items-center gap-1.5">
            <span className="text-gray-400 text-[11px]">Orientation:</span>
            <select
              value={settings.transform.orientation}
              onChange={(e) => updateTransform({ orientation: e.target.value as any })}
              className="bg-[#181818] border border-[#3e3e3e] rounded px-1.5 py-0.5 text-xs text-white focus:outline-none focus:border-[#4772b3]"
            >
              <option value="global">Global</option>
              <option value="local">Local</option>
              <option value="normal">Normal</option>
            </select>
          </label>

          <label className="flex items-center gap-1.5">
            <span className="text-gray-400 text-[11px]">Proportional:</span>
            <select
              value={settings.transform.proportionalEditing}
              onChange={(e) => updateTransform({ proportionalEditing: e.target.value as any })}
              className="bg-[#181818] border border-[#3e3e3e] rounded px-1.5 py-0.5 text-xs text-white focus:outline-none focus:border-[#4772b3]"
            >
              <option value="off">Disabled</option>
              <option value="smooth">Smooth</option>
              <option value="sphere">Sphere</option>
              <option value="linear">Linear</option>
            </select>
          </label>

          {settings.transform.proportionalEditing !== 'off' && (
            <label className="flex items-center gap-1.5">
              <span className="text-gray-400 text-[11px]">Size:</span>
              <input
                type="number"
                step="0.1"
                min="0.1"
                value={settings.transform.proportionalSize}
                onChange={(e) =>
                  updateTransform({ proportionalSize: parseFloat(e.target.value) || 1.0 })
                }
                className="w-14 bg-[#181818] border border-[#3e3e3e] rounded px-1.5 py-0.5 text-xs text-white focus:outline-none focus:border-[#4772b3]"
              />
            </label>
          )}
        </div>
      )}
    </div>
  );
};
