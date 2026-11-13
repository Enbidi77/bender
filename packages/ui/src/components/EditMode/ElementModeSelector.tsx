import React from 'react';
import type { EditElementMode } from '@blender-elt/contracts';
import { VertexSelectIcon, EdgeSelectIcon, FaceSelectIcon } from './EditModeIcons.js';
import { cn } from '../common/Button.js';

export interface ElementModeSelectorProps {
  /**
   * Currently active element selection modes (can contain 1, 2, or all 3)
   */
  activeModes: EditElementMode[];

  /**
   * Callback when a selection mode is switched (supports Shift+click multi-selection)
   */
  onSelectMode: (mode: EditElementMode, isMultiSelect?: boolean) => void;

  /**
   * Optional custom class name
   */
  className?: string;
}

export const ElementModeSelector: React.FC<ElementModeSelectorProps> = ({
  activeModes,
  onSelectMode,
  className = '',
}) => {
  const modes: {
    id: EditElementMode;
    label: string;
    shortcut: string;
    icon: React.ReactNode;
  }[] = [
    {
      id: 'vertex',
      label: 'Vertex Select',
      shortcut: '1',
      icon: <VertexSelectIcon size={14} />,
    },
    {
      id: 'edge',
      label: 'Edge Select',
      shortcut: '2',
      icon: <EdgeSelectIcon size={14} />,
    },
    {
      id: 'face',
      label: 'Face Select',
      shortcut: '3',
      icon: <FaceSelectIcon size={14} />,
    },
  ];

  const handleClick = (e: React.MouseEvent, mode: EditElementMode) => {
    e.preventDefault();
    const isMultiSelect = e.shiftKey;
    onSelectMode(mode, isMultiSelect);
  };

  return (
    <div
      role="group"
      aria-label="Element Selection Mode"
      className={cn(
        'flex items-center bg-[#1d1e22] border border-[#3e3e3e] rounded p-0.5 gap-0.5 select-none',
        className,
      )}
    >
      {modes.map((m) => {
        const isActive = activeModes.includes(m.id);

        return (
          <button
            key={m.id}
            type="button"
            onClick={(e) => handleClick(e, m.id)}
            title={`${m.label} (${m.shortcut})\nShift+Click to multi-select`}
            aria-label={`${m.label} (${m.shortcut})`}
            aria-pressed={isActive}
            className={cn(
              'flex items-center gap-1 px-1.5 py-0.5 rounded text-[11px] font-medium transition-all',
              isActive
                ? 'bg-[#4772b3] text-white shadow-xs'
                : 'text-gray-400 hover:text-gray-200 hover:bg-[#323338]',
            )}
          >
            {m.icon}
            <span className="text-[10px] font-mono opacity-80">{m.shortcut}</span>
          </button>
        );
      })}
    </div>
  );
};
