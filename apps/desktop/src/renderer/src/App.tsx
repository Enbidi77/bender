import React, { useState } from 'react';
import {
  Box,
  Eye,
  Maximize2,
  Minus,
  Move,
  Play,
  RotateCw,
  Square,
  Video,
  Sun,
  Layers,
  X,
} from 'lucide-react';
import type { ViewportMode, GizmoType, ShadingMode } from '@blender-elt/contracts';

export const App: React.FC = () => {
  const [viewportMode, setViewportMode] = useState<ViewportMode>('object');
  const [gizmoType, setGizmoType] = useState<GizmoType>('translate');
  const [shadingMode, setShadingMode] = useState<ShadingMode>('solid');
  const [selectedNodeId, setSelectedNodeId] = useState<string>('cube-default');
  const [currentFrame, setCurrentFrame] = useState<number>(1);
  const [isPlaying, setIsPlaying] = useState<boolean>(false);

  // Scene items
  const sceneItems = [
    {
      id: 'cube-default',
      name: 'Cube',
      type: 'mesh',
      icon: <Box size={14} className="text-orange-400" />,
    },
    {
      id: 'camera-default',
      name: 'Camera',
      type: 'camera',
      icon: <Video size={14} className="text-blue-400" />,
    },
    {
      id: 'light-default',
      name: 'Light',
      type: 'light',
      icon: <Sun size={14} className="text-yellow-400" />,
    },
  ];

  return (
    <div className="flex flex-col w-screen h-screen overflow-hidden bg-[#1d1e22] text-[#dedede] select-none text-xs">
      {/* 1. Top Menu & Header Bar */}
      <header className="flex items-center justify-between h-8 bg-[#282828] border-b border-[#181818] px-2">
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-1.5 font-bold text-gray-200">
            <span className="w-4 h-4 rounded-full bg-gradient-to-tr from-orange-500 to-amber-300 flex items-center justify-center text-[10px] text-white">
              B
            </span>
            <span>Blender-ELT</span>
          </div>

          <nav className="flex items-center gap-1 text-gray-300">
            <button className="px-2 py-0.5 rounded hover:bg-[#3e3e3e]">File</button>
            <button className="px-2 py-0.5 rounded hover:bg-[#3e3e3e]">Edit</button>
            <button className="px-2 py-0.5 rounded hover:bg-[#3e3e3e]">Render</button>
            <button className="px-2 py-0.5 rounded hover:bg-[#3e3e3e]">Window</button>
            <button className="px-2 py-0.5 rounded hover:bg-[#3e3e3e]">Help</button>
          </nav>

          {/* Mode Switcher */}
          <div className="flex items-center bg-[#1d1e22] rounded px-1.5 py-0.5 border border-[#3e3e3e]">
            <select
              value={viewportMode}
              onChange={(e) => setViewportMode(e.target.value as ViewportMode)}
              className="bg-transparent text-gray-200 text-xs focus:outline-none cursor-pointer"
            >
              <option value="object">Object Mode</option>
              <option value="edit">Edit Mode</option>
              <option value="sculpt">Sculpt Mode</option>
            </select>
          </div>
        </div>

        {/* Viewport Shading & Window Controls */}
        <div className="flex items-center gap-3">
          <div className="flex items-center bg-[#1d1e22] rounded p-0.5 border border-[#3e3e3e]">
            {(['wireframe', 'solid', 'material', 'rendered'] as ShadingMode[]).map((mode) => (
              <button
                key={mode}
                onClick={() => setShadingMode(mode)}
                className={`px-2 py-0.5 rounded capitalize ${
                  shadingMode === mode
                    ? 'bg-[#4772b3] text-white font-medium'
                    : 'text-gray-400 hover:text-white'
                }`}
              >
                {mode}
              </button>
            ))}
          </div>

          <div className="flex items-center gap-1">
            <button
              onClick={() => window.electronBridge?.minimize?.()}
              className="p-1 rounded hover:bg-[#3e3e3e]"
            >
              <Minus size={12} />
            </button>
            <button
              onClick={() => window.electronBridge?.maximize?.()}
              className="p-1 rounded hover:bg-[#3e3e3e]"
            >
              <Square size={10} />
            </button>
            <button
              onClick={() => window.electronBridge?.close?.()}
              className="p-1 rounded hover:bg-red-600"
            >
              <X size={12} />
            </button>
          </div>
        </div>
      </header>

      {/* 2. Main Workspace Layout */}
      <div className="flex flex-1 overflow-hidden relative">
        {/* Left Toolbar */}
        <aside className="w-10 bg-[#282828] border-r border-[#181818] flex flex-col items-center py-2 gap-1.5 z-10">
          <button
            onClick={() => setGizmoType('translate')}
            title="Translate (G)"
            className={`p-1.5 rounded ${
              gizmoType === 'translate'
                ? 'bg-[#4772b3] text-white'
                : 'text-gray-400 hover:bg-[#3e3e3e]'
            }`}
          >
            <Move size={16} />
          </button>
          <button
            onClick={() => setGizmoType('rotate')}
            title="Rotate (R)"
            className={`p-1.5 rounded ${
              gizmoType === 'rotate'
                ? 'bg-[#4772b3] text-white'
                : 'text-gray-400 hover:bg-[#3e3e3e]'
            }`}
          >
            <RotateCw size={16} />
          </button>
          <button
            onClick={() => setGizmoType('scale')}
            title="Scale (S)"
            className={`p-1.5 rounded ${
              gizmoType === 'scale' ? 'bg-[#4772b3] text-white' : 'text-gray-400 hover:bg-[#3e3e3e]'
            }`}
          >
            <Maximize2 size={16} />
          </button>
          <div className="w-6 h-[1px] bg-[#3e3e3e] my-1" />
          <button title="Add Mesh" className="p-1.5 rounded text-gray-400 hover:bg-[#3e3e3e]">
            <Box size={16} />
          </button>
        </aside>

        {/* Central 3D Viewport Area */}
        <main className="flex-1 relative bg-[#1d1e22] overflow-hidden flex flex-col items-center justify-center">
          {/* Viewport Overlay Info */}
          <div className="absolute top-2 left-3 pointer-events-none text-gray-400 flex flex-col gap-0.5 z-10">
            <span className="font-semibold text-gray-200">User Perspective</span>
            <span>Mode: {viewportMode}</span>
            <span>Shading: {shadingMode}</span>
          </div>

          {/* 3D Canvas / Mock 3D View */}
          <div className="w-full h-full flex flex-col items-center justify-center">
            {/* Interactive 3D visual preview */}
            <div className="relative w-64 h-64 border border-[#3e3e3e] rounded bg-[#25262b] flex items-center justify-center shadow-2xl">
              <div className="w-32 h-32 bg-orange-600/30 border-2 border-orange-500 rounded transform -rotate-12 skew-y-6 flex items-center justify-center text-orange-200 font-mono shadow-inner">
                {selectedNodeId === 'cube-default' ? 'Active Cube' : selectedNodeId}
              </div>
              <div className="absolute bottom-2 right-2 text-[10px] text-gray-500 font-mono">
                X: 0.00 Y: 0.00 Z: 0.00
              </div>
            </div>
            <p className="mt-4 text-gray-500">3D Viewport Ready (React Three Fiber & Three.js)</p>
          </div>
        </main>

        {/* Right Sidebar: Outliner & Properties */}
        <aside className="w-72 bg-[#282828] border-l border-[#181818] flex flex-col">
          {/* Outliner */}
          <div className="h-1/2 border-b border-[#181818] flex flex-col">
            <div className="px-3 py-1.5 bg-[#232323] border-b border-[#181818] flex items-center justify-between font-semibold text-gray-300">
              <span className="flex items-center gap-1.5">
                <Layers size={14} /> Outliner
              </span>
              <span className="text-[10px] text-gray-500">Scene Collection</span>
            </div>
            <div className="flex-1 p-2 overflow-y-auto">
              {sceneItems.map((item) => (
                <div
                  key={item.id}
                  onClick={() => setSelectedNodeId(item.id)}
                  className={`flex items-center justify-between px-2 py-1 rounded cursor-pointer ${
                    selectedNodeId === item.id
                      ? 'bg-[#4772b3] text-white'
                      : 'hover:bg-[#353535] text-gray-300'
                  }`}
                >
                  <div className="flex items-center gap-2">
                    {item.icon}
                    <span>{item.name}</span>
                  </div>
                  <Eye size={12} className="text-gray-400 hover:text-white" />
                </div>
              ))}
            </div>
          </div>

          {/* Properties Panel */}
          <div className="h-1/2 flex flex-col">
            <div className="px-3 py-1.5 bg-[#232323] border-b border-[#181818] font-semibold text-gray-300">
              Properties - Transform
            </div>
            <div className="flex-1 p-3 overflow-y-auto space-y-3">
              <div>
                <span className="text-[11px] text-gray-400 block mb-1">Location</span>
                <div className="grid grid-cols-3 gap-1">
                  <div className="bg-[#1d1e22] px-2 py-1 rounded border border-[#3e3e3e] text-center">
                    <span className="text-red-400 mr-1">X</span>0.00 m
                  </div>
                  <div className="bg-[#1d1e22] px-2 py-1 rounded border border-[#3e3e3e] text-center">
                    <span className="text-green-400 mr-1">Y</span>0.00 m
                  </div>
                  <div className="bg-[#1d1e22] px-2 py-1 rounded border border-[#3e3e3e] text-center">
                    <span className="text-blue-400 mr-1">Z</span>0.00 m
                  </div>
                </div>
              </div>

              <div>
                <span className="text-[11px] text-gray-400 block mb-1">Rotation</span>
                <div className="grid grid-cols-3 gap-1">
                  <div className="bg-[#1d1e22] px-2 py-1 rounded border border-[#3e3e3e] text-center">
                    <span className="text-red-400 mr-1">X</span>0°
                  </div>
                  <div className="bg-[#1d1e22] px-2 py-1 rounded border border-[#3e3e3e] text-center">
                    <span className="text-green-400 mr-1">Y</span>0°
                  </div>
                  <div className="bg-[#1d1e22] px-2 py-1 rounded border border-[#3e3e3e] text-center">
                    <span className="text-blue-400 mr-1">Z</span>0°
                  </div>
                </div>
              </div>

              <div>
                <span className="text-[11px] text-gray-400 block mb-1">Scale</span>
                <div className="grid grid-cols-3 gap-1">
                  <div className="bg-[#1d1e22] px-2 py-1 rounded border border-[#3e3e3e] text-center">
                    <span className="text-red-400 mr-1">X</span>1.00
                  </div>
                  <div className="bg-[#1d1e22] px-2 py-1 rounded border border-[#3e3e3e] text-center">
                    <span className="text-green-400 mr-1">Y</span>1.00
                  </div>
                  <div className="bg-[#1d1e22] px-2 py-1 rounded border border-[#3e3e3e] text-center">
                    <span className="text-blue-400 mr-1">Z</span>1.00
                  </div>
                </div>
              </div>
            </div>
          </div>
        </aside>
      </div>

      {/* 3. Bottom Timeline Bar */}
      <footer className="h-10 bg-[#282828] border-t border-[#181818] flex items-center px-3 gap-3">
        <div className="flex items-center gap-1">
          <button
            onClick={() => setIsPlaying(!isPlaying)}
            className="p-1.5 rounded hover:bg-[#3e3e3e] text-gray-300"
          >
            <Play size={14} className={isPlaying ? 'fill-current text-green-400' : ''} />
          </button>
        </div>

        <div className="flex items-center gap-2 text-xs">
          <span>Frame:</span>
          <input
            type="number"
            value={currentFrame}
            onChange={(e) => setCurrentFrame(Number(e.target.value))}
            className="w-14 bg-[#1d1e22] border border-[#3e3e3e] px-1 py-0.5 rounded text-center"
          />
          <span className="text-gray-500">/ 250</span>
        </div>

        {/* Timeline track scrub simulator */}
        <div className="flex-1 h-3 bg-[#1d1e22] rounded border border-[#3e3e3e] relative cursor-pointer">
          <div
            className="h-full bg-blue-500/30 rounded"
            style={{ width: `${(currentFrame / 250) * 100}%` }}
          />
        </div>
      </footer>
    </div>
  );
};
