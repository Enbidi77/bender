import React from 'react';
import {
  Move,
  RotateCw,
  Maximize2,
  MousePointer,
  Magnet,
  Grid as GridIcon,
  Focus,
  Globe,
} from 'lucide-react';
import { useViewportContext } from '../context/ViewportContext.js';
import { useCameraControls } from '../hooks/useCameraControls.js';
import type { ShadingMode, StandardViewpoint } from '../types.js';

export const ViewportToolbar: React.FC = () => {
  const {
    config,
    setConfig,
    setGizmoType,
    setTransformSpace,
    setShadingMode,
    snapConfig,
    setSnapConfig,
    toggleSnapping,
    cameraProjection,
    toggleCameraProjection,
    showToolbar,
  } = useViewportContext();

  const { focusSelection, setStandardViewpoint } = useCameraControls();

  if (!showToolbar) {
    return null;
  }

  const shadingModes: { id: ShadingMode; label: string }[] = [
    { id: 'wireframe', label: 'Wire' },
    { id: 'solid', label: 'Solid' },
    { id: 'material', label: 'Mat' },
    { id: 'rendered', label: 'Render' },
  ];

  return (
    <div className="absolute top-3 right-3 flex items-center gap-2 z-10 select-none text-xs">
      {/* Gizmo Tools Group */}
      <div className="flex items-center bg-[#25262b]/90 backdrop-blur-md rounded border border-[#3e404b] p-0.5 shadow-lg">
        <button
          type="button"
          onClick={() => setGizmoType('none')}
          title="Select (Q)"
          className={`p-1.5 rounded transition-colors ${
            config.gizmoType === 'none'
              ? 'bg-[#4772b3] text-white shadow-sm'
              : 'text-gray-400 hover:text-white hover:bg-[#34363f]'
          }`}
        >
          <MousePointer size={14} />
        </button>
        <button
          type="button"
          onClick={() => setGizmoType('translate')}
          title="Translate (G)"
          className={`p-1.5 rounded transition-colors ${
            config.gizmoType === 'translate'
              ? 'bg-[#4772b3] text-white shadow-sm'
              : 'text-gray-400 hover:text-white hover:bg-[#34363f]'
          }`}
        >
          <Move size={14} />
        </button>
        <button
          type="button"
          onClick={() => setGizmoType('rotate')}
          title="Rotate (R)"
          className={`p-1.5 rounded transition-colors ${
            config.gizmoType === 'rotate'
              ? 'bg-[#4772b3] text-white shadow-sm'
              : 'text-gray-400 hover:text-white hover:bg-[#34363f]'
          }`}
        >
          <RotateCw size={14} />
        </button>
        <button
          type="button"
          onClick={() => setGizmoType('scale')}
          title="Scale (S)"
          className={`p-1.5 rounded transition-colors ${
            config.gizmoType === 'scale'
              ? 'bg-[#4772b3] text-white shadow-sm'
              : 'text-gray-400 hover:text-white hover:bg-[#34363f]'
          }`}
        >
          <Maximize2 size={14} />
        </button>
      </div>

      {/* Transform Space (Global / Local) */}
      <button
        type="button"
        onClick={() =>
          setTransformSpace(config.transformSpace === 'world' ? 'local' : 'world')
        }
        title={`Orientation: ${config.transformSpace === 'world' ? 'Global' : 'Local'}`}
        className="flex items-center gap-1 bg-[#25262b]/90 backdrop-blur-md px-2 py-1 rounded border border-[#3e404b] text-gray-300 hover:text-white hover:bg-[#34363f] shadow-lg text-[11px]"
      >
        <Globe size={13} className="text-blue-400" />
        <span className="capitalize">{config.transformSpace}</span>
      </button>

      {/* Snapping Toggle & Config */}
      <div className="flex items-center bg-[#25262b]/90 backdrop-blur-md rounded border border-[#3e404b] p-0.5 shadow-lg">
        <button
          type="button"
          onClick={toggleSnapping}
          title={`Snapping: ${snapConfig.enabled ? 'Enabled' : 'Disabled'} (Shift+Tab)`}
          className={`p-1.5 rounded transition-colors ${
            snapConfig.enabled
              ? 'bg-amber-600 text-white shadow-sm'
              : 'text-gray-400 hover:text-white hover:bg-[#34363f]'
          }`}
        >
          <Magnet size={14} />
        </button>
        {snapConfig.enabled && (
          <select
            value={snapConfig.translationSnap}
            onChange={(e) => setSnapConfig({ translationSnap: Number(e.target.value) })}
            className="bg-transparent text-gray-200 text-[11px] px-1 py-0.5 focus:outline-none cursor-pointer"
          >
            <option value="0.1" className="bg-[#25262b]">0.1m</option>
            <option value="0.5" className="bg-[#25262b]">0.5m</option>
            <option value="1.0" className="bg-[#25262b]">1.0m</option>
            <option value="2.0" className="bg-[#25262b]">2.0m</option>
          </select>
        )}
      </div>

      {/* Camera & Navigation Group */}
      <div className="flex items-center bg-[#25262b]/90 backdrop-blur-md rounded border border-[#3e404b] p-0.5 shadow-lg">
        {/* Persp / Ortho toggle */}
        <button
          type="button"
          onClick={toggleCameraProjection}
          title="Toggle Perspective / Orthographic (Numpad 5)"
          className="px-2 py-1 text-[11px] font-medium text-gray-300 hover:text-white rounded hover:bg-[#34363f]"
        >
          {cameraProjection === 'perspective' ? 'Persp' : 'Ortho'}
        </button>

        {/* Viewpoint selector */}
        <select
          aria-label="Standard Viewpoint"
          onChange={(e) => setStandardViewpoint(e.target.value as StandardViewpoint)}
          defaultValue=""
          className="bg-transparent text-gray-300 text-[11px] px-1 py-0.5 focus:outline-none cursor-pointer"
        >
          <option value="" disabled className="bg-[#25262b]">
            View
          </option>
          <option value="perspective" className="bg-[#25262b]">
            Perspective (5)
          </option>
          <option value="front" className="bg-[#25262b]">
            Front (1)
          </option>
          <option value="right" className="bg-[#25262b]">
            Right (3)
          </option>
          <option value="top" className="bg-[#25262b]">
            Top (7)
          </option>
          <option value="camera" className="bg-[#25262b]">
            Camera (0)
          </option>
        </select>

        {/* Focus selected */}
        <button
          type="button"
          onClick={() => focusSelection()}
          title="Focus on Selection (F or .)"
          className="p-1.5 text-gray-400 hover:text-white rounded hover:bg-[#34363f]"
        >
          <Focus size={14} />
        </button>
      </div>

      {/* Shading Mode Switcher */}
      <div className="flex items-center bg-[#25262b]/90 backdrop-blur-md rounded border border-[#3e404b] p-0.5 shadow-lg">
        {shadingModes.map((item) => (
          <button
            key={item.id}
            type="button"
            onClick={() => setShadingMode(item.id)}
            title={`${item.id.charAt(0).toUpperCase() + item.id.slice(1)} Shading`}
            className={`px-2 py-1 rounded text-[11px] font-medium transition-colors ${
              config.shadingMode === item.id
                ? 'bg-[#4772b3] text-white shadow-sm'
                : 'text-gray-400 hover:text-white hover:bg-[#34363f]'
            }`}
          >
            {item.label}
          </button>
        ))}
      </div>

      {/* Grid Floor Toggle */}
      <button
        type="button"
        onClick={() =>
          setConfig({
            grid: { ...config.grid, visible: !config.grid.visible },
          })
        }
        title="Toggle Floor Grid"
        className={`p-1.5 rounded bg-[#25262b]/90 backdrop-blur-md border border-[#3e404b] shadow-lg transition-colors ${
          config.grid.visible
            ? 'text-blue-400'
            : 'text-gray-500 hover:text-gray-300'
        }`}
      >
        <GridIcon size={14} />
      </button>
    </div>
  );
};
