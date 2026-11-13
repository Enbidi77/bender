import React from 'react';
import type { EditModeTool, EditElementMode } from '@blender-elt/contracts';
import { EDIT_TOOL_METADATA_MAP, type EditModeSettings, type EditSelectionStats } from './types.js';
import { Accordion } from '../common/Accordion.js';
import { cn } from '../common/Button.js';
import { Sliders, Layers, Wrench, Scissors, Sparkles, Maximize } from 'lucide-react';

export interface EditToolSettingsPanelProps {
  activeTool: EditModeTool;
  onSelectTool?: (tool: EditModeTool) => void;
  settings: EditModeSettings;
  onUpdateSettings: (updates: Partial<EditModeSettings>) => void;
  activeElementModes?: EditElementMode[];
  selectionStats?: EditSelectionStats;
  onExecuteOperation?: (opType: string, params?: Record<string, unknown>) => void;
  className?: string;
}

export const EditToolSettingsPanel: React.FC<EditToolSettingsPanelProps> = ({
  activeTool,
  settings,
  onUpdateSettings,
  activeElementModes = ['vertex'],
  selectionStats = {
    selectedVertices: 0,
    totalVertices: 0,
    selectedEdges: 0,
    totalEdges: 0,
    selectedFaces: 0,
    totalFaces: 0,
  },
  onExecuteOperation,
  className = '',
}) => {
  const toolMeta = EDIT_TOOL_METADATA_MAP[activeTool];

  const updateExtrude = (updates: Partial<EditModeSettings['extrude']>) => {
    onUpdateSettings({ extrude: { ...settings.extrude, ...updates } });
  };

  const updateInset = (updates: Partial<EditModeSettings['inset']>) => {
    onUpdateSettings({ inset: { ...settings.inset, ...updates } });
  };

  const updateBevel = (updates: Partial<EditModeSettings['bevel']>) => {
    onUpdateSettings({ bevel: { ...settings.bevel, ...updates } });
  };

  const updateLoopcut = (updates: Partial<EditModeSettings['loopcut']>) => {
    onUpdateSettings({ loopcut: { ...settings.loopcut, ...updates } });
  };

  const updateMerge = (updates: Partial<EditModeSettings['merge']>) => {
    onUpdateSettings({ merge: { ...settings.merge, ...updates } });
  };

  const updateSmooth = (updates: Partial<EditModeSettings['smooth']>) => {
    onUpdateSettings({ smooth: { ...settings.smooth, ...updates } });
  };

  return (
    <div
      role="region"
      aria-label="Edit Tool Settings Panel"
      className={cn('flex flex-col gap-2 p-2 text-xs text-gray-200 select-none', className)}
    >
      {/* 1. Active Tool Header Card */}
      <div className="bg-[#202124] border border-[#383a42] rounded p-2.5 flex items-center justify-between">
        <div className="flex flex-col">
          <div className="flex items-center gap-2">
            <Sliders size={14} className="text-[#4772b3]" />
            <span className="font-semibold text-white text-sm">{toolMeta?.name || activeTool}</span>
          </div>
          <span className="text-[11px] text-gray-400 mt-0.5">{toolMeta?.description}</span>
        </div>
        {toolMeta?.shortcut && (
          <kbd className="px-2 py-0.5 rounded bg-[#2a2c33] text-[11px] font-mono text-gray-300 border border-[#3e404b]">
            {toolMeta.shortcut}
          </kbd>
        )}
      </div>

      {/* 2. Selection Polycount Statistics */}
      <div className="bg-[#1e1f23] border border-[#323338] rounded p-2 text-[11px] flex justify-between items-center text-gray-300">
        <div className="flex items-center gap-1.5 font-medium">
          <Layers size={13} className="text-gray-400" />
          <span>Selection ({activeElementModes.join(', ')}):</span>
        </div>
        <div className="flex items-center gap-3 font-mono">
          <span title="Selected Vertices / Total Vertices">
            Verts:{' '}
            <strong className="text-amber-400 font-bold">{selectionStats.selectedVertices}</strong>/
            {selectionStats.totalVertices}
          </span>
          <span title="Selected Edges / Total Edges">
            Edges:{' '}
            <strong className="text-amber-400 font-bold">{selectionStats.selectedEdges}</strong>/
            {selectionStats.totalEdges}
          </span>
          <span title="Selected Faces / Total Faces">
            Faces:{' '}
            <strong className="text-amber-400 font-bold">{selectionStats.selectedFaces}</strong>/
            {selectionStats.totalFaces}
          </span>
        </div>
      </div>

      {/* 3. Active Tool Parameters Accordion */}
      <Accordion title="Active Tool Parameters" defaultExpanded={true}>
        <div className="flex flex-col gap-2.5 py-1">
          {activeTool === 'extrude' && (
            <>
              <div className="flex items-center justify-between">
                <span className="text-gray-400">Extrude Distance:</span>
                <input
                  type="number"
                  step="0.1"
                  value={settings.extrude.distance}
                  onChange={(e) => updateExtrude({ distance: parseFloat(e.target.value) || 0 })}
                  className="w-20 bg-[#181818] border border-[#3e3e3e] rounded px-2 py-0.5 text-right font-mono"
                />
              </div>

              <div className="flex items-center justify-between">
                <span className="text-gray-400">Direction:</span>
                <select
                  value={settings.extrude.direction}
                  onChange={(e) => updateExtrude({ direction: e.target.value as any })}
                  className="w-28 bg-[#181818] border border-[#3e3e3e] rounded px-1.5 py-0.5"
                >
                  <option value="normal">Along Normal</option>
                  <option value="x">X Axis</option>
                  <option value="y">Y Axis</option>
                  <option value="z">Z Axis</option>
                  <option value="individual">Individual</option>
                </select>
              </div>

              <div className="flex items-center justify-between">
                <span className="text-gray-400">Flip Normals:</span>
                <input
                  type="checkbox"
                  checked={settings.extrude.flipNormals}
                  onChange={(e) => updateExtrude({ flipNormals: e.target.checked })}
                  className="rounded bg-[#181818] border-[#3e3e3e] text-[#4772b3]"
                />
              </div>

              <div className="flex items-center justify-between">
                <span className="text-gray-400">Dissolve Orthogonal:</span>
                <input
                  type="checkbox"
                  checked={settings.extrude.dissolveOrthogonal}
                  onChange={(e) => updateExtrude({ dissolveOrthogonal: e.target.checked })}
                  className="rounded bg-[#181818] border-[#3e3e3e] text-[#4772b3]"
                />
              </div>

              <button
                type="button"
                onClick={() =>
                  onExecuteOperation?.(
                    'extrude',
                    settings.extrude as unknown as Record<string, unknown>,
                  )
                }
                className="w-full mt-1 py-1 rounded bg-[#4772b3] hover:bg-[#5885c7] text-white font-medium transition-colors"
              >
                Apply Extrude (E)
              </button>
            </>
          )}

          {activeTool === 'inset' && (
            <>
              <div className="flex items-center justify-between">
                <span className="text-gray-400">Thickness:</span>
                <input
                  type="number"
                  step="0.05"
                  min="0"
                  value={settings.inset.thickness}
                  onChange={(e) => updateInset({ thickness: parseFloat(e.target.value) || 0 })}
                  className="w-20 bg-[#181818] border border-[#3e3e3e] rounded px-2 py-0.5 text-right font-mono"
                />
              </div>

              <div className="flex items-center justify-between">
                <span className="text-gray-400">Depth / Offset:</span>
                <input
                  type="number"
                  step="0.05"
                  value={settings.inset.depth}
                  onChange={(e) => updateInset({ depth: parseFloat(e.target.value) || 0 })}
                  className="w-20 bg-[#181818] border border-[#3e3e3e] rounded px-2 py-0.5 text-right font-mono"
                />
              </div>

              <div className="flex items-center justify-between">
                <span className="text-gray-400">Individual Faces:</span>
                <input
                  type="checkbox"
                  checked={settings.inset.individual}
                  onChange={(e) => updateInset({ individual: e.target.checked })}
                  className="rounded bg-[#181818] border-[#3e3e3e] text-[#4772b3]"
                />
              </div>

              <button
                type="button"
                onClick={() =>
                  onExecuteOperation?.(
                    'inset',
                    settings.inset as unknown as Record<string, unknown>,
                  )
                }
                className="w-full mt-1 py-1 rounded bg-[#4772b3] hover:bg-[#5885c7] text-white font-medium transition-colors"
              >
                Apply Inset (I)
              </button>
            </>
          )}

          {activeTool === 'bevel' && (
            <>
              <div className="flex items-center justify-between">
                <span className="text-gray-400">Width:</span>
                <input
                  type="number"
                  step="0.02"
                  min="0"
                  value={settings.bevel.width}
                  onChange={(e) => updateBevel({ width: parseFloat(e.target.value) || 0 })}
                  className="w-20 bg-[#181818] border border-[#3e3e3e] rounded px-2 py-0.5 text-right font-mono"
                />
              </div>

              <div className="flex items-center justify-between">
                <span className="text-gray-400">Segments:</span>
                <input
                  type="number"
                  min="1"
                  max="32"
                  value={settings.bevel.segments}
                  onChange={(e) => updateBevel({ segments: parseInt(e.target.value, 10) || 1 })}
                  className="w-16 bg-[#181818] border border-[#3e3e3e] rounded px-2 py-0.5 text-right font-mono"
                />
              </div>

              <div className="flex items-center justify-between">
                <span className="text-gray-400">Mode:</span>
                <div className="flex items-center bg-[#181818] border border-[#3e3e3e] rounded p-0.5">
                  <button
                    type="button"
                    onClick={() => updateBevel({ target: 'edge' })}
                    className={cn(
                      'px-2 py-0.5 rounded text-[11px]',
                      settings.bevel.target === 'edge'
                        ? 'bg-[#4772b3] text-white'
                        : 'text-gray-400 hover:text-white',
                    )}
                  >
                    Edge
                  </button>
                  <button
                    type="button"
                    onClick={() => updateBevel({ target: 'vertex' })}
                    className={cn(
                      'px-2 py-0.5 rounded text-[11px]',
                      settings.bevel.target === 'vertex'
                        ? 'bg-[#4772b3] text-white'
                        : 'text-gray-400 hover:text-white',
                    )}
                  >
                    Vertex
                  </button>
                </div>
              </div>

              <button
                type="button"
                onClick={() =>
                  onExecuteOperation?.(
                    'bevel',
                    settings.bevel as unknown as Record<string, unknown>,
                  )
                }
                className="w-full mt-1 py-1 rounded bg-[#4772b3] hover:bg-[#5885c7] text-white font-medium transition-colors"
              >
                Apply Bevel (Ctrl+B)
              </button>
            </>
          )}

          {activeTool === 'loopcut' && (
            <>
              <div className="flex items-center justify-between">
                <span className="text-gray-400">Number of Cuts:</span>
                <input
                  type="number"
                  min="1"
                  max="32"
                  value={settings.loopcut.cuts}
                  onChange={(e) => updateLoopcut({ cuts: parseInt(e.target.value, 10) || 1 })}
                  className="w-16 bg-[#181818] border border-[#3e3e3e] rounded px-2 py-0.5 text-right font-mono"
                />
              </div>

              <div className="flex items-center justify-between">
                <span className="text-gray-400">Factor:</span>
                <div className="flex items-center gap-2">
                  <input
                    type="range"
                    min="-1"
                    max="1"
                    step="0.05"
                    value={settings.loopcut.factor}
                    onChange={(e) => updateLoopcut({ factor: parseFloat(e.target.value) || 0 })}
                    className="w-24 accent-[#4772b3]"
                  />
                  <span className="text-[10px] font-mono w-7">
                    {settings.loopcut.factor.toFixed(2)}
                  </span>
                </div>
              </div>

              <button
                type="button"
                onClick={() =>
                  onExecuteOperation?.(
                    'loopcut',
                    settings.loopcut as unknown as Record<string, unknown>,
                  )
                }
                className="w-full mt-1 py-1 rounded bg-[#4772b3] hover:bg-[#5885c7] text-white font-medium transition-colors"
              >
                Apply Loop Cut (Ctrl+R)
              </button>
            </>
          )}

          {activeTool === 'smooth' && (
            <>
              <div className="flex items-center justify-between">
                <span className="text-gray-400">Smoothing Factor:</span>
                <input
                  type="number"
                  step="0.05"
                  min="0"
                  max="1"
                  value={settings.smooth.factor}
                  onChange={(e) => updateSmooth({ factor: parseFloat(e.target.value) || 0 })}
                  className="w-20 bg-[#181818] border border-[#3e3e3e] rounded px-2 py-0.5 text-right font-mono"
                />
              </div>

              <div className="flex items-center justify-between">
                <span className="text-gray-400">Iterations:</span>
                <input
                  type="number"
                  min="1"
                  max="50"
                  value={settings.smooth.iterations}
                  onChange={(e) => updateSmooth({ iterations: parseInt(e.target.value, 10) || 1 })}
                  className="w-16 bg-[#181818] border border-[#3e3e3e] rounded px-2 py-0.5 text-right font-mono"
                />
              </div>

              <button
                type="button"
                onClick={() =>
                  onExecuteOperation?.(
                    'smooth',
                    settings.smooth as unknown as Record<string, unknown>,
                  )
                }
                className="w-full mt-1 py-1 rounded bg-[#4772b3] hover:bg-[#5885c7] text-white font-medium transition-colors"
              >
                Apply Smooth Vertices
              </button>
            </>
          )}

          {activeTool !== 'extrude' &&
            activeTool !== 'inset' &&
            activeTool !== 'bevel' &&
            activeTool !== 'loopcut' &&
            activeTool !== 'smooth' && (
              <div className="text-gray-400 text-[11px] italic py-1">
                {toolMeta?.name} active. Click or drag in viewport to interact.
              </div>
            )}
        </div>
      </Accordion>

      {/* 4. Quick Mesh Operations Section */}
      <Accordion title="Mesh Operations" defaultExpanded={true}>
        <div className="grid grid-cols-2 gap-1.5 py-1">
          <button
            type="button"
            onClick={() => onExecuteOperation?.('subdivide')}
            className="flex items-center gap-1.5 px-2 py-1.5 rounded bg-[#2b2b2b] hover:bg-[#383838] hover:text-white text-gray-300 border border-[#3a3a3a] transition-colors"
          >
            <Scissors size={12} className="text-blue-400" />
            <span>Subdivide</span>
          </button>

          <button
            type="button"
            onClick={() =>
              onExecuteOperation?.(
                'extrude',
                settings.extrude as unknown as Record<string, unknown>,
              )
            }
            className="flex items-center gap-1.5 px-2 py-1.5 rounded bg-[#2b2b2b] hover:bg-[#383838] hover:text-white text-gray-300 border border-[#3a3a3a] transition-colors"
          >
            <Maximize size={12} className="text-green-400" />
            <span>Extrude Region</span>
          </button>

          <button
            type="button"
            onClick={() =>
              onExecuteOperation?.('inset', settings.inset as unknown as Record<string, unknown>)
            }
            className="flex items-center gap-1.5 px-2 py-1.5 rounded bg-[#2b2b2b] hover:bg-[#383838] hover:text-white text-gray-300 border border-[#3a3a3a] transition-colors"
          >
            <Wrench size={12} className="text-amber-400" />
            <span>Inset Faces</span>
          </button>

          <button
            type="button"
            onClick={() =>
              onExecuteOperation?.('bevel', settings.bevel as unknown as Record<string, unknown>)
            }
            className="flex items-center gap-1.5 px-2 py-1.5 rounded bg-[#2b2b2b] hover:bg-[#383838] hover:text-white text-gray-300 border border-[#3a3a3a] transition-colors"
          >
            <Wrench size={12} className="text-purple-400" />
            <span>Bevel</span>
          </button>

          <button
            type="button"
            onClick={() =>
              onExecuteOperation?.('smooth', settings.smooth as unknown as Record<string, unknown>)
            }
            className="flex items-center gap-1.5 px-2 py-1.5 rounded bg-[#2b2b2b] hover:bg-[#383838] hover:text-white text-gray-300 border border-[#3a3a3a] transition-colors"
          >
            <Sparkles size={12} className="text-cyan-400" />
            <span>Smooth Mesh</span>
          </button>

          <button
            type="button"
            onClick={() => onExecuteOperation?.('flip-normals')}
            className="flex items-center gap-1.5 px-2 py-1.5 rounded bg-[#2b2b2b] hover:bg-[#383838] hover:text-white text-gray-300 border border-[#3a3a3a] transition-colors"
          >
            <Layers size={12} className="text-teal-400" />
            <span>Flip Normals</span>
          </button>

          <button
            type="button"
            onClick={() => onExecuteOperation?.('triangulate')}
            className="flex items-center gap-1.5 px-2 py-1.5 rounded bg-[#2b2b2b] hover:bg-[#383838] hover:text-white text-gray-300 border border-[#3a3a3a] transition-colors"
          >
            <Layers size={12} className="text-indigo-400" />
            <span>Triangulate</span>
          </button>

          <button
            type="button"
            onClick={() => onExecuteOperation?.('bridge-loops')}
            className="flex items-center gap-1.5 px-2 py-1.5 rounded bg-[#2b2b2b] hover:bg-[#383838] hover:text-white text-gray-300 border border-[#3a3a3a] transition-colors"
          >
            <Layers size={12} className="text-rose-400" />
            <span>Bridge Loops</span>
          </button>
        </div>
      </Accordion>

      {/* 5. Merge Operations Section */}
      <Accordion title="Merge Vertices">
        <div className="flex flex-col gap-2 py-1">
          <div className="flex items-center justify-between">
            <span className="text-gray-400">Distance Threshold:</span>
            <input
              type="number"
              step="0.001"
              min="0.0001"
              value={settings.merge.distance}
              onChange={(e) => updateMerge({ distance: parseFloat(e.target.value) || 0.001 })}
              className="w-20 bg-[#181818] border border-[#3e3e3e] rounded px-2 py-0.5 text-right font-mono"
            />
          </div>

          <div className="grid grid-cols-2 gap-1.5 mt-1">
            <button
              type="button"
              onClick={() =>
                onExecuteOperation?.('merge', {
                  type: 'distance',
                  distance: settings.merge.distance,
                })
              }
              className="px-2 py-1 rounded bg-[#2b2b2b] hover:bg-[#4772b3] text-gray-200 hover:text-white border border-[#3a3a3a] text-center"
            >
              By Distance
            </button>
            <button
              type="button"
              onClick={() => onExecuteOperation?.('merge', { type: 'center' })}
              className="px-2 py-1 rounded bg-[#2b2b2b] hover:bg-[#4772b3] text-gray-200 hover:text-white border border-[#3a3a3a] text-center"
            >
              At Center
            </button>
            <button
              type="button"
              onClick={() => onExecuteOperation?.('merge', { type: 'cursor' })}
              className="px-2 py-1 rounded bg-[#2b2b2b] hover:bg-[#4772b3] text-gray-200 hover:text-white border border-[#3a3a3a] text-center"
            >
              At Cursor
            </button>
            <button
              type="button"
              onClick={() => onExecuteOperation?.('merge', { type: 'collapse' })}
              className="px-2 py-1 rounded bg-[#2b2b2b] hover:bg-[#4772b3] text-gray-200 hover:text-white border border-[#3a3a3a] text-center"
            >
              Collapse
            </button>
          </div>
        </div>
      </Accordion>

      {/* 6. Delete & Dissolve Section */}
      <Accordion title="Delete & Dissolve">
        <div className="flex flex-col gap-1.5 py-1">
          <div className="grid grid-cols-3 gap-1">
            <button
              type="button"
              onClick={() => onExecuteOperation?.('delete', { target: 'vertices' })}
              className="px-1.5 py-1 rounded bg-[#2c1d1d] hover:bg-red-700 text-red-200 hover:text-white text-[10px] text-center border border-red-900/50"
            >
              Del Verts
            </button>
            <button
              type="button"
              onClick={() => onExecuteOperation?.('delete', { target: 'edges' })}
              className="px-1.5 py-1 rounded bg-[#2c1d1d] hover:bg-red-700 text-red-200 hover:text-white text-[10px] text-center border border-red-900/50"
            >
              Del Edges
            </button>
            <button
              type="button"
              onClick={() => onExecuteOperation?.('delete', { target: 'faces' })}
              className="px-1.5 py-1 rounded bg-[#2c1d1d] hover:bg-red-700 text-red-200 hover:text-white text-[10px] text-center border border-red-900/50"
            >
              Del Faces
            </button>
          </div>

          <div className="grid grid-cols-3 gap-1 mt-0.5">
            <button
              type="button"
              onClick={() => onExecuteOperation?.('dissolve', { target: 'vertices' })}
              className="px-1.5 py-1 rounded bg-[#26242a] hover:bg-[#4a3b6e] text-purple-200 hover:text-white text-[10px] text-center border border-purple-900/50"
            >
              Dissolve V
            </button>
            <button
              type="button"
              onClick={() => onExecuteOperation?.('dissolve', { target: 'edges' })}
              className="px-1.5 py-1 rounded bg-[#26242a] hover:bg-[#4a3b6e] text-purple-200 hover:text-white text-[10px] text-center border border-purple-900/50"
            >
              Dissolve E
            </button>
            <button
              type="button"
              onClick={() => onExecuteOperation?.('dissolve', { target: 'faces' })}
              className="px-1.5 py-1 rounded bg-[#26242a] hover:bg-[#4a3b6e] text-purple-200 hover:text-white text-[10px] text-center border border-purple-900/50"
            >
              Dissolve F
            </button>
          </div>
        </div>
      </Accordion>
    </div>
  );
};
