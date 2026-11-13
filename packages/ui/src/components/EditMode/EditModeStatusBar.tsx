import React from 'react';
import type { EditModeTool, EditElementMode } from '@blender-elt/contracts';
import { EDIT_TOOL_METADATA_MAP, type EditSelectionStats } from './types.js';
import { cn } from '../common/Button.js';
import { SlidersHorizontal, Info } from 'lucide-react';

export interface EditModeStatusBarProps {
  activeTool: EditModeTool;
  activeElementModes: EditElementMode[];
  selectionStats?: EditSelectionStats;
  className?: string;
}

export const EditModeStatusBar: React.FC<EditModeStatusBarProps> = ({
  activeTool,
  activeElementModes,
  selectionStats = {
    selectedVertices: 0,
    totalVertices: 0,
    selectedEdges: 0,
    totalEdges: 0,
    selectedFaces: 0,
    totalFaces: 0,
  },
  className = '',
}) => {
  const toolMeta = EDIT_TOOL_METADATA_MAP[activeTool];

  return (
    <footer
      aria-label="Edit Mode Status Bar"
      className={cn(
        'h-6 bg-[#202022] border-t border-[#181818] px-3 flex items-center justify-between text-[11px] text-gray-300 select-none z-10 shrink-0',
        className,
      )}
    >
      {/* Left: Active Tool and Mode Badges */}
      <div className="flex items-center gap-3">
        {/* Tool Indicator */}
        <div className="flex items-center gap-1.5 font-medium text-white">
          <SlidersHorizontal size={12} className="text-[#4772b3]" />
          <span>{toolMeta?.name || activeTool}</span>
          {toolMeta?.shortcut && (
            <kbd className="px-1 py-0.2 rounded bg-[#2b2b2b] text-[9px] font-mono text-gray-400 border border-[#3e3e3e]">
              {toolMeta.shortcut}
            </kbd>
          )}
        </div>

        <div className="h-3 w-[1px] bg-[#353538]" />

        {/* Active Selection Modes */}
        <div className="flex items-center gap-1">
          <span className="text-gray-400">Mode:</span>
          {activeElementModes.map((mode) => (
            <span
              key={mode}
              className="px-1.5 py-0.2 rounded bg-[#2a374a] text-blue-300 border border-[#385175] text-[10px] font-medium capitalize"
            >
              {mode}
            </span>
          ))}
        </div>
      </div>

      {/* Center: Quick Hotkey Tips */}
      <div className="hidden lg:flex items-center gap-2 text-gray-400 text-[10px]">
        <Info size={11} className="text-gray-500" />
        <span>G: Move</span>
        <span>•</span>
        <span>R: Rotate</span>
        <span>•</span>
        <span>S: Scale</span>
        <span>•</span>
        <span>E: Extrude</span>
        <span>•</span>
        <span>I: Inset</span>
        <span>•</span>
        <span>Ctrl+B: Bevel</span>
        <span>•</span>
        <span>X: Delete Menu</span>
      </div>

      {/* Right: Polycounts & Element Counts */}
      <div className="flex items-center gap-3 font-mono text-[10px]">
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
    </footer>
  );
};
