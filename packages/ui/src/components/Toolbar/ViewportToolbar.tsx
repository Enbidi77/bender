import React, { useState } from 'react';
import { MousePointer, Move, RotateCw, Maximize2, Box, Compass } from 'lucide-react';
import { cn } from '../common/Button.js';
import type { GizmoType, PrimitiveType } from '@blender-elt/contracts';

export interface ViewportToolbarProps {
  activeGizmo: GizmoType;
  onChangeGizmo: (gizmo: GizmoType) => void;
  onAddPrimitive?: (type: PrimitiveType) => void;
  onViewpointChange?: (viewpoint: 'front' | 'right' | 'top' | 'camera') => void;
  className?: string;
}

export const ViewportToolbar: React.FC<ViewportToolbarProps> = ({
  activeGizmo,
  onChangeGizmo,
  onAddPrimitive,
  onViewpointChange,
  className = '',
}) => {
  const [showAddMenu, setShowAddMenu] = useState<boolean>(false);
  const [showViewMenu, setShowViewMenu] = useState<boolean>(false);

  const tools: { id: GizmoType; label: string; shortcut: string; icon: React.ReactNode }[] = [
    {
      id: 'none',
      label: 'Select Box',
      shortcut: 'W',
      icon: <MousePointer size={15} />,
    },
    {
      id: 'translate',
      label: 'Translate / Grab',
      shortcut: 'G',
      icon: <Move size={15} />,
    },
    {
      id: 'rotate',
      label: 'Rotate',
      shortcut: 'R',
      icon: <RotateCw size={15} />,
    },
    {
      id: 'scale',
      label: 'Scale',
      shortcut: 'S',
      icon: <Maximize2 size={15} />,
    },
  ];

  const primitives: { type: PrimitiveType; label: string }[] = [
    { type: 'cube', label: 'Cube' },
    { type: 'sphere', label: 'Sphere' },
    { type: 'cylinder', label: 'Cylinder' },
    { type: 'cone', label: 'Cone' },
    { type: 'plane', label: 'Plane' },
    { type: 'torus', label: 'Torus' },
  ];

  return (
    <aside
      className={cn(
        'w-10 bg-[#282828] border-r border-[#181818] flex flex-col items-center py-2 gap-1 select-none z-10',
        className,
      )}
    >
      {/* Transformation Gizmo Tools */}
      {tools.map((t) => {
        const isActive = activeGizmo === t.id;
        return (
          <button
            key={t.id}
            onClick={() => onChangeGizmo(t.id)}
            title={`${t.label} (${t.shortcut})`}
            className={cn(
              'p-2 rounded transition-colors text-gray-400 hover:text-white hover:bg-[#383838]',
              {
                'bg-[#4772b3] text-white hover:bg-[#5885c7]': isActive,
              },
            )}
          >
            {t.icon}
          </button>
        );
      })}

      <div className="w-5 h-[1px] bg-[#3a3a3a] my-1" />

      {/* Add Primitive Flyout */}
      <div className="relative">
        <button
          onClick={() => {
            setShowAddMenu(!showAddMenu);
            setShowViewMenu(false);
          }}
          title="Add Mesh Primitive"
          className={cn(
            'p-2 rounded text-gray-400 hover:text-white hover:bg-[#383838] transition-colors',
            { 'bg-[#383838] text-white': showAddMenu },
          )}
        >
          <Box size={15} />
        </button>

        {showAddMenu && (
          <div className="absolute left-full top-0 ml-1.5 w-32 bg-[#202020] border border-[#3e3e3e] rounded shadow-xl py-1 z-50 text-xs">
            {primitives.map((p) => (
              <button
                key={p.type}
                onClick={() => {
                  onAddPrimitive?.(p.type);
                  setShowAddMenu(false);
                }}
                className="w-full text-left px-3 py-1.5 text-gray-300 hover:bg-[#4772b3] hover:text-white transition-colors"
              >
                {p.label}
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Viewpoint Navigation Flyout */}
      {onViewpointChange && (
        <div className="relative">
          <button
            onClick={() => {
              setShowViewMenu(!showViewMenu);
              setShowAddMenu(false);
            }}
            title="Standard Viewpoints"
            className={cn(
              'p-2 rounded text-gray-400 hover:text-white hover:bg-[#383838] transition-colors',
              { 'bg-[#383838] text-white': showViewMenu },
            )}
          >
            <Compass size={15} />
          </button>

          {showViewMenu && (
            <div className="absolute left-full top-0 ml-1.5 w-36 bg-[#202020] border border-[#3e3e3e] rounded shadow-xl py-1 z-50 text-xs">
              <button
                onClick={() => {
                  onViewpointChange('front');
                  setShowViewMenu(false);
                }}
                className="w-full flex justify-between px-3 py-1.5 text-gray-300 hover:bg-[#4772b3] hover:text-white"
              >
                <span>Front</span>
                <span className="text-[10px] text-gray-500">Num 1</span>
              </button>
              <button
                onClick={() => {
                  onViewpointChange('right');
                  setShowViewMenu(false);
                }}
                className="w-full flex justify-between px-3 py-1.5 text-gray-300 hover:bg-[#4772b3] hover:text-white"
              >
                <span>Right</span>
                <span className="text-[10px] text-gray-500">Num 3</span>
              </button>
              <button
                onClick={() => {
                  onViewpointChange('top');
                  setShowViewMenu(false);
                }}
                className="w-full flex justify-between px-3 py-1.5 text-gray-300 hover:bg-[#4772b3] hover:text-white"
              >
                <span>Top</span>
                <span className="text-[10px] text-gray-500">Num 7</span>
              </button>
              <button
                onClick={() => {
                  onViewpointChange('camera');
                  setShowViewMenu(false);
                }}
                className="w-full flex justify-between px-3 py-1.5 text-gray-300 hover:bg-[#4772b3] hover:text-white"
              >
                <span>Camera</span>
                <span className="text-[10px] text-gray-500">Num 0</span>
              </button>
            </div>
          )}
        </div>
      )}
    </aside>
  );
};
