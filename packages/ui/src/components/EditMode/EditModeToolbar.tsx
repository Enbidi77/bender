import React, { useState } from 'react';
import type { EditModeTool } from '@blender-elt/contracts';
import { MousePointer, Move, RotateCw, Maximize2, ChevronRight } from 'lucide-react';
import {
  Cursor3DIcon,
  ExtrudeIcon,
  InsetIcon,
  BevelIcon,
  LoopCutIcon,
  KnifeIcon,
  PolyBuildIcon,
  SpinIcon,
  SmoothIcon,
} from './EditModeIcons.js';
import { EDIT_MODE_TOOLS, type EditModeToolMetadata } from './types.js';
import { cn } from '../common/Button.js';

export interface EditModeToolbarProps {
  activeTool: EditModeTool;
  onSelectTool: (tool: EditModeTool) => void;
  className?: string;
  isExpanded?: boolean;
  onToggleExpanded?: () => void;
}

export const EditModeToolbar: React.FC<EditModeToolbarProps> = ({
  activeTool,
  onSelectTool,
  className = '',
  isExpanded = false,
  onToggleExpanded,
}) => {
  const [hoveredTool, setHoveredTool] = useState<EditModeToolMetadata | null>(null);

  // Filter tools by category
  const selectionTools = EDIT_MODE_TOOLS.filter((t) => t.category === 'selection');
  const transformTools = EDIT_MODE_TOOLS.filter((t) => t.category === 'transform');
  const meshTools = EDIT_MODE_TOOLS.filter((t) => t.category === 'mesh');
  const advancedTools = EDIT_MODE_TOOLS.filter((t) => t.category === 'advanced');

  const getToolIcon = (toolId: EditModeTool) => {
    switch (toolId) {
      case 'select':
        return <MousePointer size={15} />;
      case 'cursor':
        return <Cursor3DIcon size={15} />;
      case 'move':
        return <Move size={15} />;
      case 'rotate':
        return <RotateCw size={15} />;
      case 'scale':
        return <Maximize2 size={15} />;
      case 'extrude':
        return <ExtrudeIcon size={15} />;
      case 'inset':
        return <InsetIcon size={15} />;
      case 'bevel':
        return <BevelIcon size={15} />;
      case 'loopcut':
        return <LoopCutIcon size={15} />;
      case 'knife':
        return <KnifeIcon size={15} />;
      case 'polybuild':
        return <PolyBuildIcon size={15} />;
      case 'spin':
        return <SpinIcon size={15} />;
      case 'smooth':
        return <SmoothIcon size={15} />;
      default:
        return <MousePointer size={15} />;
    }
  };

  const renderToolButton = (tool: EditModeToolMetadata) => {
    const isActive = activeTool === tool.id;

    return (
      <button
        key={tool.id}
        type="button"
        onClick={() => onSelectTool(tool.id)}
        onMouseEnter={() => setHoveredTool(tool)}
        onMouseLeave={() => setHoveredTool(null)}
        title={`${tool.name} ${tool.shortcut ? `(${tool.shortcut})` : ''}\n${tool.description}`}
        aria-label={`${tool.name} tool`}
        aria-pressed={isActive}
        className={cn(
          'relative flex items-center justify-center rounded transition-all select-none',
          isExpanded ? 'w-full h-8 px-2 justify-start gap-2 text-xs' : 'w-8 h-8 mx-auto',
          isActive
            ? 'bg-[#4772b3] text-white shadow-xs'
            : 'text-gray-300 hover:text-white hover:bg-[#383838]',
        )}
      >
        <span className="shrink-0 flex items-center justify-center">{getToolIcon(tool.id)}</span>
        {isExpanded && <span className="truncate font-medium">{tool.name}</span>}
        {/* Active edge indicator */}
        {isActive && !isExpanded && (
          <span className="absolute left-0 top-1 bottom-1 w-0.5 bg-[#80b4f0] rounded-r" />
        )}
      </button>
    );
  };

  return (
    <aside
      className={cn(
        'flex flex-col bg-[#242424] border-r border-[#181818] py-1.5 select-none z-20 shrink-0 transition-all duration-150',
        isExpanded ? 'w-36' : 'w-10',
        className,
      )}
      aria-label="Edit Mode Tools"
    >
      {/* Expand / Collapse toggle */}
      {onToggleExpanded && (
        <button
          type="button"
          onClick={onToggleExpanded}
          title={isExpanded ? 'Collapse toolbar' : 'Expand toolbar'}
          className="flex items-center justify-center w-7 h-5 mx-auto mb-1 text-gray-400 hover:text-white hover:bg-[#333] rounded"
        >
          <ChevronRight
            size={12}
            className={cn('transition-transform', isExpanded && 'rotate-180')}
          />
        </button>
      )}

      {/* Tools list */}
      <div className="flex flex-col gap-1 overflow-y-auto px-1 scrollbar-none">
        {/* 1. Selection & Cursor */}
        <div className="flex flex-col gap-0.5">{selectionTools.map(renderToolButton)}</div>

        <div className="w-5 mx-auto border-b border-[#353535] my-0.5" />

        {/* 2. Transform (Move, Rotate, Scale) */}
        <div className="flex flex-col gap-0.5">{transformTools.map(renderToolButton)}</div>

        <div className="w-5 mx-auto border-b border-[#353535] my-0.5" />

        {/* 3. Core Mesh Ops (Extrude, Inset, Bevel, Loop Cut, Knife) */}
        <div className="flex flex-col gap-0.5">{meshTools.map(renderToolButton)}</div>

        <div className="w-5 mx-auto border-b border-[#353535] my-0.5" />

        {/* 4. Advanced Mesh Ops (Poly Build, Spin, Smooth) */}
        <div className="flex flex-col gap-0.5">{advancedTools.map(renderToolButton)}</div>
      </div>

      {/* Floating Hover Card */}
      {hoveredTool && !isExpanded && (
        <div
          role="tooltip"
          className="absolute left-11 z-50 bg-[#1d1e22] text-gray-200 border border-[#3e3e3e] shadow-xl rounded px-2.5 py-1.5 pointer-events-none w-52"
          style={{ top: 'auto' }}
        >
          <div className="flex items-center justify-between mb-0.5">
            <span className="font-semibold text-xs text-white">{hoveredTool.name}</span>
            {hoveredTool.shortcut && (
              <kbd className="px-1.5 py-0.5 rounded bg-[#2b2b2b] text-[10px] font-mono text-gray-400 border border-[#3e3e3e]">
                {hoveredTool.shortcut}
              </kbd>
            )}
          </div>
          <p className="text-[11px] text-gray-400 leading-tight">{hoveredTool.description}</p>
        </div>
      )}
    </aside>
  );
};
