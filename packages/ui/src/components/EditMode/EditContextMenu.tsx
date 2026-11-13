import React, { useEffect, useRef, useState } from 'react';
import type { EditElementMode } from '@blender-elt/contracts';
import { cn } from '../common/Button.js';
import { ChevronRight } from 'lucide-react';

export interface EditContextMenuProps {
  isOpen: boolean;
  position: { x: number; y: number };
  elementMode: EditElementMode;
  onClose: () => void;
  onSelectAction: (actionId: string, params?: Record<string, unknown>) => void;
  hasSelection?: boolean;
}

interface MenuItem {
  id: string;
  label: string;
  shortcut?: string;
  divider?: boolean;
  disabled?: boolean;
  danger?: boolean;
  children?: MenuItem[];
  params?: Record<string, unknown>;
}

export const EditContextMenu: React.FC<EditContextMenuProps> = ({
  isOpen,
  position,
  elementMode,
  onClose,
  onSelectAction,
  hasSelection = true,
}) => {
  const menuRef = useRef<HTMLDivElement>(null);
  const [activeSubmenu, setActiveSubmenu] = useState<string | null>(null);

  // Close on Escape or click outside
  useEffect(() => {
    if (!isOpen) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault();
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
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  // Build items based on active element selection mode
  const getMenuItems = (): { title: string; items: MenuItem[] } => {
    switch (elementMode) {
      case 'vertex':
        return {
          title: 'Vertex Specials',
          items: [
            { id: 'extrude', label: 'Extrude Vertices', shortcut: 'E' },
            {
              id: 'bevel',
              label: 'Bevel Vertices',
              shortcut: 'Ctrl+Shift+B',
              params: { target: 'vertex' },
            },
            { id: 'connect-path', label: 'Connect Vertex Path', shortcut: 'J' },
            { id: 'slide', label: 'Slide Vertex', shortcut: 'Shift+V' },
            { divider: true, id: 'd1', label: '' },
            {
              id: 'merge-submenu',
              label: 'Merge Vertices',
              children: [
                { id: 'merge', label: 'At Center', params: { type: 'center' } },
                { id: 'merge', label: 'At Cursor', params: { type: 'cursor' } },
                { id: 'merge', label: 'Collapse', params: { type: 'collapse' } },
                { id: 'merge', label: 'By Distance', params: { type: 'distance' } },
              ],
            },
            { id: 'create-edge', label: 'New Edge/Face from Vertices', shortcut: 'F' },
            { id: 'separate', label: 'Separate', shortcut: 'P' },
            { divider: true, id: 'd2', label: '' },
            {
              id: 'dissolve',
              label: 'Dissolve Vertices',
              shortcut: 'Ctrl+X',
              params: { target: 'vertices' },
            },
            {
              id: 'delete',
              label: 'Delete Vertices',
              shortcut: 'X',
              danger: true,
              params: { target: 'vertices' },
            },
          ],
        };
      case 'edge':
        return {
          title: 'Edge Specials',
          items: [
            { id: 'extrude', label: 'Extrude Edges', shortcut: 'E' },
            { id: 'subdivide', label: 'Subdivide' },
            { id: 'bevel', label: 'Bevel Edges', shortcut: 'Ctrl+B', params: { target: 'edge' } },
            { id: 'slide', label: 'Edge Slide' },
            { divider: true, id: 'd1', label: '' },
            { id: 'select-loop', label: 'Edge Loops', shortcut: 'Alt+Click' },
            { id: 'select-ring', label: 'Edge Rings', shortcut: 'Ctrl+Alt+Click' },
            { id: 'bridge-loops', label: 'Bridge Edge Loops' },
            { id: 'rotate-edge', label: 'Rotate Edge CW' },
            { id: 'mark-seam', label: 'Mark Seam' },
            { id: 'clear-seam', label: 'Clear Seam' },
            { divider: true, id: 'd2', label: '' },
            {
              id: 'dissolve',
              label: 'Dissolve Edges',
              shortcut: 'Ctrl+X',
              params: { target: 'edges' },
            },
            {
              id: 'delete',
              label: 'Delete Edges',
              shortcut: 'X',
              danger: true,
              params: { target: 'edges' },
            },
          ],
        };
      case 'face':
      default:
        return {
          title: 'Face Specials',
          items: [
            { id: 'extrude', label: 'Extrude Faces', shortcut: 'E' },
            { id: 'extrude-normals', label: 'Extrude Faces Along Normals', shortcut: 'Alt+E' },
            { id: 'extrude-individual', label: 'Extrude Individual Faces' },
            { id: 'inset', label: 'Inset Faces', shortcut: 'I' },
            { id: 'bevel', label: 'Bevel Faces', shortcut: 'Ctrl+B' },
            { divider: true, id: 'd1', label: '' },
            { id: 'subdivide', label: 'Subdivide' },
            { id: 'triangulate', label: 'Triangulate Faces', shortcut: 'Ctrl+T' },
            { id: 'poke', label: 'Poke Faces', shortcut: 'Alt+P' },
            { id: 'flip-normals', label: 'Flip Normals' },
            { id: 'shade-smooth', label: 'Shade Smooth' },
            { id: 'shade-flat', label: 'Shade Flat' },
            { divider: true, id: 'd2', label: '' },
            {
              id: 'dissolve',
              label: 'Dissolve Faces',
              shortcut: 'Ctrl+X',
              params: { target: 'faces' },
            },
            {
              id: 'delete',
              label: 'Delete Faces',
              shortcut: 'X',
              danger: true,
              params: { target: 'faces' },
            },
          ],
        };
    }
  };

  const { title, items } = getMenuItems();

  const handleAction = (item: MenuItem) => {
    if (item.disabled || item.divider) return;
    onSelectAction(item.id, item.params);
    onClose();
  };

  // Adjust coordinates to keep within screen bounds
  const clampedX = Math.min(
    position.x,
    typeof window !== 'undefined' ? window.innerWidth - 240 : position.x,
  );
  const clampedY = Math.min(
    position.y,
    typeof window !== 'undefined' ? window.innerHeight - 380 : position.y,
  );

  return (
    <div
      ref={menuRef}
      role="menu"
      aria-label={title}
      className="fixed z-50 min-w-56 bg-[#202020] border border-[#3e3e3e] rounded shadow-2xl py-1 text-xs select-none backdrop-blur-md animate-in fade-in zoom-in-95 duration-75"
      style={{ left: `${clampedX}px`, top: `${clampedY}px` }}
    >
      {/* Menu Header Title */}
      <div className="px-3 py-1 text-[11px] font-semibold text-gray-400 border-b border-[#303030] tracking-wider uppercase">
        {title}
      </div>

      {/* Menu Items */}
      <div className="py-1">
        {items.map((item, idx) => {
          if (item.divider) {
            return <div key={`div-${idx}`} className="my-1 border-t border-[#323232]" />;
          }

          const hasSubmenu = item.children && item.children.length > 0;
          const isSubmenuOpen = activeSubmenu === item.id;

          return (
            <div
              key={item.id + idx}
              className="relative"
              onMouseEnter={() => (hasSubmenu ? setActiveSubmenu(item.id) : setActiveSubmenu(null))}
            >
              <button
                type="button"
                onClick={() => !hasSubmenu && handleAction(item)}
                disabled={item.disabled || (!hasSelection && item.id !== 'separate')}
                className={cn(
                  'w-full flex items-center justify-between px-3 py-1.5 text-left text-gray-300 hover:bg-[#4772b3] hover:text-white transition-colors disabled:opacity-40 disabled:pointer-events-none',
                  item.danger && 'hover:bg-red-700',
                )}
              >
                <span>{item.label}</span>
                <div className="flex items-center gap-1.5">
                  {item.shortcut && (
                    <span className="text-[10px] text-gray-400 group-hover:text-gray-200 font-mono">
                      {item.shortcut}
                    </span>
                  )}
                  {hasSubmenu && <ChevronRight size={12} className="text-gray-400" />}
                </div>
              </button>

              {/* Submenu Flyout */}
              {hasSubmenu && isSubmenuOpen && (
                <div className="absolute left-full top-0 ml-1 min-w-44 bg-[#202020] border border-[#3e3e3e] rounded shadow-2xl py-1 z-50">
                  {item.children!.map((subItem, sIdx) => (
                    <button
                      key={subItem.id + sIdx}
                      type="button"
                      onClick={() => handleAction(subItem)}
                      className="w-full flex items-center justify-between px-3 py-1.5 text-left text-gray-300 hover:bg-[#4772b3] hover:text-white transition-colors"
                    >
                      <span>{subItem.label}</span>
                      {subItem.shortcut && (
                        <span className="text-[10px] text-gray-400 font-mono">
                          {subItem.shortcut}
                        </span>
                      )}
                    </button>
                  ))}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
};
