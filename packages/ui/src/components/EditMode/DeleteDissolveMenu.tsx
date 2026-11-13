import React, { useEffect, useRef } from 'react';
import { Trash2 } from 'lucide-react';

export interface DeleteDissolveMenuProps {
  isOpen: boolean;
  position: { x: number; y: number };
  onClose: () => void;
  onSelectOption: (optionId: string, params?: Record<string, unknown>) => void;
}

interface DeleteOption {
  id: string;
  label: string;
  key: string;
  category: 'delete' | 'dissolve' | 'collapse';
  params: Record<string, unknown>;
  danger?: boolean;
}

export const DeleteDissolveMenu: React.FC<DeleteDissolveMenuProps> = ({
  isOpen,
  position,
  onClose,
  onSelectOption,
}) => {
  const menuRef = useRef<HTMLDivElement>(null);

  const options: DeleteOption[] = [
    // Delete
    {
      id: 'delete-vertices',
      label: 'Vertices',
      key: 'V',
      category: 'delete',
      params: { type: 'delete', target: 'vertices' },
      danger: true,
    },
    {
      id: 'delete-edges',
      label: 'Edges',
      key: 'E',
      category: 'delete',
      params: { type: 'delete', target: 'edges' },
      danger: true,
    },
    {
      id: 'delete-faces',
      label: 'Faces',
      key: 'F',
      category: 'delete',
      params: { type: 'delete', target: 'faces' },
      danger: true,
    },
    {
      id: 'delete-only-edges-faces',
      label: 'Only Edges & Faces',
      key: 'O',
      category: 'delete',
      params: { type: 'delete', target: 'edges-faces' },
    },
    {
      id: 'delete-only-faces',
      label: 'Only Faces',
      key: 'K',
      category: 'delete',
      params: { type: 'delete', target: 'only-faces' },
    },

    // Dissolve
    {
      id: 'dissolve-vertices',
      label: 'Dissolve Vertices',
      key: 'D',
      category: 'dissolve',
      params: { type: 'dissolve', target: 'vertices' },
    },
    {
      id: 'dissolve-edges',
      label: 'Dissolve Edges',
      key: 'G',
      category: 'dissolve',
      params: { type: 'dissolve', target: 'edges' },
    },
    {
      id: 'dissolve-faces',
      label: 'Dissolve Faces',
      key: 'S',
      category: 'dissolve',
      params: { type: 'dissolve', target: 'faces' },
    },

    // Collapse
    {
      id: 'edge-collapse',
      label: 'Edge Collapse',
      key: 'C',
      category: 'collapse',
      params: { type: 'merge', typeParam: 'collapse' },
    },
    {
      id: 'edge-loops',
      label: 'Edge Loops',
      key: 'L',
      category: 'collapse',
      params: { type: 'dissolve', target: 'edge-loops' },
    },
  ];

  useEffect(() => {
    if (!isOpen) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        onClose();
        return;
      }

      // Check single-key shortcuts
      const matched = options.find((opt) => opt.key.toLowerCase() === e.key.toLowerCase());
      if (matched) {
        e.preventDefault();
        onSelectOption(matched.id, matched.params);
        onClose();
      }
    };

    const handleClickOutside = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        onClose();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('mousedown', handleClickOutside);

    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('mousedown', handleClickOutside);
    };
  }, [isOpen, onClose, onSelectOption]);

  if (!isOpen) return null;

  const deleteItems = options.filter((o) => o.category === 'delete');
  const dissolveItems = options.filter((o) => o.category === 'dissolve');
  const collapseItems = options.filter((o) => o.category === 'collapse');

  const handleSelect = (opt: DeleteOption) => {
    onSelectOption(opt.id, opt.params);
    onClose();
  };

  const clampedX = Math.min(
    position.x,
    typeof window !== 'undefined' ? window.innerWidth - 200 : position.x,
  );
  const clampedY = Math.min(
    position.y,
    typeof window !== 'undefined' ? window.innerHeight - 340 : position.y,
  );

  return (
    <div
      ref={menuRef}
      role="menu"
      aria-label="Delete / Dissolve Menu"
      className="fixed z-50 min-w-52 bg-[#202020] border border-[#3e3e3e] rounded shadow-2xl py-1 text-xs select-none backdrop-blur-md animate-in fade-in zoom-in-95 duration-75"
      style={{ left: `${clampedX}px`, top: `${clampedY}px` }}
    >
      <div className="flex items-center gap-1.5 px-3 py-1.5 text-[11px] font-semibold text-gray-300 border-b border-[#303030]">
        <Trash2 size={13} className="text-red-400" />
        <span className="uppercase tracking-wider">Delete</span>
      </div>

      <div className="py-1">
        {deleteItems.map((opt) => (
          <button
            key={opt.id}
            type="button"
            onClick={() => handleSelect(opt)}
            className="w-full flex items-center justify-between px-3 py-1 text-left text-gray-300 hover:bg-red-700 hover:text-white transition-colors"
          >
            <span>{opt.label}</span>
            <span className="text-[10px] font-mono text-gray-400">{opt.key}</span>
          </button>
        ))}
      </div>

      <div className="my-1 border-t border-[#303030]" />

      <div className="py-0.5">
        {dissolveItems.map((opt) => (
          <button
            key={opt.id}
            type="button"
            onClick={() => handleSelect(opt)}
            className="w-full flex items-center justify-between px-3 py-1 text-left text-gray-300 hover:bg-[#4772b3] hover:text-white transition-colors"
          >
            <span>{opt.label}</span>
            <span className="text-[10px] font-mono text-gray-400">{opt.key}</span>
          </button>
        ))}
      </div>

      <div className="my-1 border-t border-[#303030]" />

      <div className="py-0.5">
        {collapseItems.map((opt) => (
          <button
            key={opt.id}
            type="button"
            onClick={() => handleSelect(opt)}
            className="w-full flex items-center justify-between px-3 py-1 text-left text-gray-300 hover:bg-[#4772b3] hover:text-white transition-colors"
          >
            <span>{opt.label}</span>
            <span className="text-[10px] font-mono text-gray-400">{opt.key}</span>
          </button>
        ))}
      </div>
    </div>
  );
};
