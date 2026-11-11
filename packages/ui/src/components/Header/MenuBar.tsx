import React, { useState, useEffect, useRef } from 'react';
import { cn } from '../common/Button.js';
import { ChevronRight } from 'lucide-react';

export interface MenuItem {
  id: string;
  label: string;
  shortcut?: string;
  disabled?: boolean;
  action?: () => void;
  items?: MenuItem[];
  separator?: boolean;
}

export interface MenuCategory {
  id: string;
  label: string;
  items: MenuItem[];
}

export interface MenuBarProps {
  onAction?: (actionId: string) => void;
  className?: string;
  customCategories?: MenuCategory[];
}

export const MenuBar: React.FC<MenuBarProps> = ({ onAction, className = '', customCategories }) => {
  const [activeMenuId, setActiveMenuId] = useState<string | null>(null);
  const [activeSubmenuId, setActiveSubmenuId] = useState<string | null>(null);
  const menuBarRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleDocumentClick = (e: MouseEvent) => {
      if (menuBarRef.current && !menuBarRef.current.contains(e.target as Node)) {
        setActiveMenuId(null);
        setActiveSubmenuId(null);
      }
    };
    document.addEventListener('mousedown', handleDocumentClick);
    return () => document.removeEventListener('mousedown', handleDocumentClick);
  }, []);

  const defaultCategories: MenuCategory[] = [
    {
      id: 'file',
      label: 'File',
      items: [
        { id: 'file:new', label: 'New', shortcut: 'Ctrl+N' },
        { id: 'file:open', label: 'Open...', shortcut: 'Ctrl+O' },
        { id: 'file:save', label: 'Save', shortcut: 'Ctrl+S' },
        { id: 'file:save-as', label: 'Save As...', shortcut: 'Ctrl+Shift+S' },
        { id: 'sep1', label: '', separator: true },
        {
          id: 'file:import',
          label: 'Import',
          items: [
            { id: 'import:gltf', label: 'glTF / GLB (.gltf, .glb)' },
            { id: 'import:obj', label: 'Wavefront (.obj)' },
            { id: 'import:stl', label: 'STL (.stl)' },
          ],
        },
        {
          id: 'file:export',
          label: 'Export',
          items: [
            { id: 'export:gltf', label: 'glTF 2.0 (.gltf)' },
            { id: 'export:glb', label: 'glTF Binary (.glb)' },
            { id: 'export:obj', label: 'Wavefront (.obj)' },
            { id: 'export:stl', label: 'STL (.stl)' },
          ],
        },
        { id: 'sep2', label: '', separator: true },
        { id: 'app:preferences', label: 'Preferences...', shortcut: 'Ctrl+,' },
        { id: 'app:exit', label: 'Exit', shortcut: 'Ctrl+Q' },
      ],
    },
    {
      id: 'edit',
      label: 'Edit',
      items: [
        { id: 'edit:undo', label: 'Undo', shortcut: 'Ctrl+Z' },
        { id: 'edit:redo', label: 'Redo', shortcut: 'Ctrl+Y' },
        { id: 'sep3', label: '', separator: true },
        { id: 'app:preferences', label: 'Preferences...', shortcut: 'Ctrl+,' },
      ],
    },
    {
      id: 'add',
      label: 'Add',
      items: [
        {
          id: 'add:mesh',
          label: 'Mesh',
          items: [
            { id: 'add:mesh:cube', label: 'Cube' },
            { id: 'add:mesh:sphere', label: 'Sphere' },
            { id: 'add:mesh:cylinder', label: 'Cylinder' },
            { id: 'add:mesh:cone', label: 'Cone' },
            { id: 'add:mesh:plane', label: 'Plane' },
            { id: 'add:mesh:torus', label: 'Torus' },
          ],
        },
        {
          id: 'add:light',
          label: 'Light',
          items: [
            { id: 'add:light:point', label: 'Point Light' },
            { id: 'add:light:directional', label: 'Directional Light' },
            { id: 'add:light:spot', label: 'Spot Light' },
          ],
        },
        { id: 'add:camera', label: 'Camera' },
      ],
    },
    {
      id: 'view',
      label: 'View',
      items: [
        {
          id: 'view:viewpoint',
          label: 'Viewpoint',
          items: [
            { id: 'view:front', label: 'Front', shortcut: 'Numpad 1' },
            { id: 'view:right', label: 'Right', shortcut: 'Numpad 3' },
            { id: 'view:top', label: 'Top', shortcut: 'Numpad 7' },
            { id: 'view:camera', label: 'Active Camera', shortcut: 'Numpad 0' },
            { id: 'view:persp-ortho', label: 'Persp/Ortho', shortcut: 'Numpad 5' },
          ],
        },
        { id: 'view:focus', label: 'Frame Selected', shortcut: 'F' },
        { id: 'sep4', label: '', separator: true },
        { id: 'view:toggle-grid', label: 'Toggle Grid' },
        { id: 'view:toggle-stats', label: 'Toggle Stats' },
        { id: 'view:toggle-wireframe', label: 'Toggle Wireframe' },
      ],
    },
    {
      id: 'object',
      label: 'Object',
      items: [
        { id: 'object:duplicate', label: 'Duplicate', shortcut: 'Shift+D' },
        { id: 'object:delete', label: 'Delete', shortcut: 'X / Delete' },
        { id: 'object:rename', label: 'Rename', shortcut: 'F2' },
      ],
    },
    {
      id: 'help',
      label: 'Help',
      items: [
        { id: 'help:shortcuts', label: 'Keyboard Shortcuts', shortcut: 'Ctrl+/' },
        { id: 'help:about', label: 'About Blender-ELT' },
      ],
    },
  ];

  const categories = customCategories || defaultCategories;

  const handleItemClick = (item: MenuItem) => {
    if (item.disabled || item.separator) return;
    if (item.items) return; // Has submenu

    if (item.action) {
      item.action();
    } else if (onAction) {
      onAction(item.id);
    }
    setActiveMenuId(null);
    setActiveSubmenuId(null);
  };

  return (
    <div ref={menuBarRef} className={cn('flex items-center select-none text-xs', className)}>
      {categories.map((category) => {
        const isOpen = activeMenuId === category.id;

        return (
          <div key={category.id} className="relative">
            <button
              onClick={() => {
                setActiveMenuId(isOpen ? null : category.id);
                setActiveSubmenuId(null);
              }}
              onMouseEnter={() => {
                if (activeMenuId !== null) {
                  setActiveMenuId(category.id);
                  setActiveSubmenuId(null);
                }
              }}
              className={cn(
                'px-2 py-1 rounded text-gray-300 hover:text-white hover:bg-[#383838] transition-colors',
                {
                  'bg-[#383838] text-white': isOpen,
                },
              )}
            >
              {category.label}
            </button>

            {/* Top-level Dropdown */}
            {isOpen && (
              <div className="absolute left-0 top-full mt-1 min-w-[200px] bg-[#232323] border border-[#3e3e3e] rounded shadow-xl py-1 z-50 animate-in fade-in zoom-in-95 duration-75">
                {category.items.map((item, idx) => {
                  if (item.separator) {
                    return <div key={`sep-${idx}`} className="h-[1px] bg-[#353535] my-1" />;
                  }

                  const hasSubmenu = item.items && item.items.length > 0;
                  const isSubmenuOpen = activeSubmenuId === item.id;

                  return (
                    <div
                      key={item.id}
                      className="relative"
                      onMouseEnter={() => {
                        if (hasSubmenu) {
                          setActiveSubmenuId(item.id);
                        } else {
                          setActiveSubmenuId(null);
                        }
                      }}
                    >
                      <button
                        onClick={() => handleItemClick(item)}
                        disabled={item.disabled}
                        className={cn(
                          'w-full flex items-center justify-between px-3 py-1.5 text-xs text-left text-gray-300 hover:bg-[#4772b3] hover:text-white transition-colors cursor-pointer',
                          {
                            'opacity-40 pointer-events-none': item.disabled,
                            'bg-[#353535]': isSubmenuOpen,
                          },
                        )}
                      >
                        <span>{item.label}</span>
                        <div className="flex items-center gap-2">
                          {item.shortcut && (
                            <span className="text-[10px] text-gray-500 group-hover:text-gray-200">
                              {item.shortcut}
                            </span>
                          )}
                          {hasSubmenu && <ChevronRight size={12} className="text-gray-400" />}
                        </div>
                      </button>

                      {/* Nested Submenu */}
                      {hasSubmenu && isSubmenuOpen && (
                        <div className="absolute left-full top-0 ml-0.5 min-w-[180px] bg-[#232323] border border-[#3e3e3e] rounded shadow-xl py-1 z-50">
                          {item.items?.map((subItem) => (
                            <button
                              key={subItem.id}
                              onClick={() => handleItemClick(subItem)}
                              disabled={subItem.disabled}
                              className="w-full flex items-center justify-between px-3 py-1.5 text-xs text-left text-gray-300 hover:bg-[#4772b3] hover:text-white transition-colors cursor-pointer"
                            >
                              <span>{subItem.label}</span>
                              {subItem.shortcut && (
                                <span className="text-[10px] text-gray-500">
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
            )}
          </div>
        );
      })}
    </div>
  );
};
