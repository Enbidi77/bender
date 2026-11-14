import React, { useEffect, useRef } from 'react';
import { Key, Move, RotateCcw, Maximize2, Sparkles } from 'lucide-react';

export type KeyframeOptionType = 'Location' | 'Rotation' | 'Scale' | 'LocRotScale';

export interface KeyframeMenuModalProps {
  isOpen: boolean;
  position?: { x: number; y: number };
  targetNodeName?: string;
  currentFrame: number;
  onClose: () => void;
  onSelectOption: (option: KeyframeOptionType) => void;
}

interface MenuEntry {
  id: KeyframeOptionType;
  label: string;
  keyHint: string;
  icon: React.ReactNode;
  description: string;
}

export const KeyframeMenuModal: React.FC<KeyframeMenuModalProps> = ({
  isOpen,
  position,
  targetNodeName,
  currentFrame,
  onClose,
  onSelectOption,
}) => {
  const menuRef = useRef<HTMLDivElement>(null);

  const entries: MenuEntry[] = [
    {
      id: 'Location',
      label: 'Location',
      keyHint: 'L',
      icon: <Move size={14} className="text-blue-400" />,
      description: 'Key position.x, y, z',
    },
    {
      id: 'Rotation',
      label: 'Rotation',
      keyHint: 'R',
      icon: <RotateCcw size={14} className="text-emerald-400" />,
      description: 'Key rotation.x, y, z',
    },
    {
      id: 'Scale',
      label: 'Scale',
      keyHint: 'S',
      icon: <Maximize2 size={14} className="text-amber-400" />,
      description: 'Key scale.x, y, z',
    },
    {
      id: 'LocRotScale',
      label: 'LocRotScale',
      keyHint: 'A',
      icon: <Sparkles size={14} className="text-purple-400" />,
      description: 'Key Location, Rotation, and Scale simultaneously',
    },
  ];

  // Hotkey navigation and outside click handling
  useEffect(() => {
    if (!isOpen) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        onClose();
        return;
      }

      if (e.key === 'l' || e.key === 'L' || e.key === '1') {
        e.preventDefault();
        onSelectOption('Location');
        onClose();
        return;
      }
      if (e.key === 'r' || e.key === 'R' || e.key === '2') {
        e.preventDefault();
        onSelectOption('Rotation');
        onClose();
        return;
      }
      if (e.key === 's' || e.key === 'S' || e.key === '3') {
        e.preventDefault();
        onSelectOption('Scale');
        onClose();
        return;
      }
      if (e.key === 'a' || e.key === 'A' || e.key === '4' || e.key === 'Enter') {
        e.preventDefault();
        onSelectOption('LocRotScale');
        onClose();
        return;
      }
    };

    const handlePointerDown = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        onClose();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('mousedown', handlePointerDown);

    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('mousedown', handlePointerDown);
    };
  }, [isOpen, onClose, onSelectOption]);

  if (!isOpen) return null;

  // Positioning
  const menuStyle: React.CSSProperties = position
    ? {
        position: 'fixed',
        left: `${Math.min(position.x, typeof window !== 'undefined' ? window.innerWidth - 240 : 500)}px`,
        top: `${Math.min(position.y, typeof window !== 'undefined' ? window.innerHeight - 260 : 400)}px`,
      }
    : {
        position: 'fixed',
        left: '50%',
        top: '40%',
        transform: 'translate(-50%, -50%)',
      };

  return (
    <div
      ref={menuRef}
      style={menuStyle}
      className="z-50 min-w-[220px] bg-[#242529] border border-[#3e4046] rounded-md shadow-2xl py-1.5 px-1 text-xs select-none animate-in fade-in zoom-in-95 duration-100"
    >
      {/* Menu Header */}
      <div className="px-2.5 py-1.5 border-b border-[#35373d] mb-1 flex items-center justify-between">
        <div className="flex items-center gap-1.5 text-gray-200 font-semibold">
          <Key size={13} className="text-amber-400" />
          <span>Insert Keyframe</span>
        </div>
        <span className="text-[10px] text-gray-400 font-mono">Frame {currentFrame}</span>
      </div>

      {targetNodeName && (
        <div className="px-2.5 py-0.5 text-[10px] text-gray-400 truncate mb-1">
          Target: <span className="text-gray-300 font-medium">{targetNodeName}</span>
        </div>
      )}

      {/* Options List */}
      <div className="flex flex-col gap-0.5">
        {entries.map((item) => (
          <button
            key={item.id}
            type="button"
            onClick={() => {
              onSelectOption(item.id);
              onClose();
            }}
            className="w-full flex items-center justify-between px-2.5 py-1.5 rounded hover:bg-[#354868] text-gray-200 hover:text-white transition-colors group text-left"
          >
            <div className="flex items-center gap-2">
              {item.icon}
              <span className="font-medium text-xs">{item.label}</span>
            </div>
            <kbd className="text-[10px] text-gray-400 group-hover:text-amber-300 font-mono bg-[#1c1d20] group-hover:bg-[#283852] px-1.5 py-0.5 rounded border border-[#3a3b40]">
              {item.keyHint}
            </kbd>
          </button>
        ))}
      </div>
    </div>
  );
};
