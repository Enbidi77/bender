import React, { useState } from 'react';
import type { SculptBrushType } from '@blender-elt/contracts';
import { BrushIcon } from './BrushIcons.js';
import { SCULPT_BRUSH_DEFINITIONS, type SculptBrushMetadata } from './types.js';
import { cn } from '../common/Button.js';
import { ChevronRight } from 'lucide-react';

export interface SculptToolbarProps {
  activeBrush: SculptBrushType;
  onSelectBrush: (brush: SculptBrushType) => void;
  className?: string;
  isExpanded?: boolean;
  onToggleExpanded?: () => void;
}

export const SculptToolbar: React.FC<SculptToolbarProps> = ({
  activeBrush,
  onSelectBrush,
  className = '',
  isExpanded = false,
  onToggleExpanded,
}) => {
  const [hoveredBrush, setHoveredBrush] = useState<SculptBrushMetadata | null>(null);

  // Group brushes by category for clean Blender-style grouping
  const volumeBrushes = SCULPT_BRUSH_DEFINITIONS.filter((b) => b.category === 'volume');
  const polishBrushes = SCULPT_BRUSH_DEFINITIONS.filter((b) => b.category === 'polish');
  const deformBrushes = SCULPT_BRUSH_DEFINITIONS.filter((b) => b.category === 'deform');
  const maskBrushes = SCULPT_BRUSH_DEFINITIONS.filter((b) => b.category === 'mask');

  const renderToolButton = (brush: SculptBrushMetadata) => {
    const isActive = activeBrush === brush.id;

    return (
      <button
        key={brush.id}
        onClick={() => onSelectBrush(brush.id)}
        onMouseEnter={() => setHoveredBrush(brush)}
        onMouseLeave={() => setHoveredBrush(null)}
        title={`${brush.name} (${brush.shortcut})\n${brush.description}`}
        aria-label={`${brush.name} brush`}
        className={cn(
          'relative flex items-center justify-center rounded transition-all select-none',
          isExpanded ? 'w-full h-8 px-2 justify-start gap-2 text-xs' : 'w-8 h-8 mx-auto',
          isActive
            ? 'bg-[#4772b3] text-white shadow-xs'
            : 'text-gray-300 hover:text-white hover:bg-[#383838]',
        )}
      >
        <BrushIcon type={brush.id} size={16} className="shrink-0" />
        {isExpanded && <span className="truncate font-medium">{brush.name}</span>}
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
      aria-label="Sculpt Tools"
    >
      {/* Optional expand toggle */}
      {onToggleExpanded && (
        <button
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

      {/* Toolbar Buttons List */}
      <div className="flex flex-col gap-1 overflow-y-auto px-1 scrollbar-none">
        {/* 1. Volume Group */}
        <div className="flex flex-col gap-0.5">{volumeBrushes.map(renderToolButton)}</div>

        <div className="w-5 mx-auto border-b border-[#353535] my-0.5" />

        {/* 2. Polish / Shape Group */}
        <div className="flex flex-col gap-0.5">{polishBrushes.map(renderToolButton)}</div>

        <div className="w-5 mx-auto border-b border-[#353535] my-0.5" />

        {/* 3. Deform Group */}
        <div className="flex flex-col gap-0.5">{deformBrushes.map(renderToolButton)}</div>

        <div className="w-5 mx-auto border-b border-[#353535] my-0.5" />

        {/* 4. Mask Group */}
        <div className="flex flex-col gap-0.5">{maskBrushes.map(renderToolButton)}</div>
      </div>

      {/* Floating Hover Card for Detailed Tooltip */}
      {hoveredBrush && !isExpanded && (
        <div
          role="tooltip"
          className="absolute left-11 z-50 bg-[#1d1e22] text-gray-200 border border-[#3e3e3e] shadow-xl rounded px-2.5 py-1.5 pointer-events-none w-52"
          style={{ top: 'auto' }}
        >
          <div className="flex items-center justify-between mb-0.5">
            <span className="font-semibold text-xs text-white">{hoveredBrush.name}</span>
            <kbd className="px-1.5 py-0.5 rounded bg-[#2b2b2b] text-[10px] font-mono text-gray-400 border border-[#3e3e3e]">
              {hoveredBrush.shortcut}
            </kbd>
          </div>
          <p className="text-[11px] text-gray-400 leading-tight">{hoveredBrush.description}</p>
        </div>
      )}
    </aside>
  );
};
