import React, { useState } from 'react';
import { Sliders, Move, Palette, Sun, Video, Box, RotateCcw } from 'lucide-react';
import { Accordion } from '../common/Accordion.js';
import { NumberInput, TextInput } from '../common/Input.js';
import { Select } from '../common/Select.js';
import { cn } from '../common/Button.js';
import type {
  SceneNode,
  MeshNode,
  LightNode,
  CameraNode,
  Vector3,
  Euler,
  PBRMaterialConfig,
  MaterialPreset,
  LightType,
  CameraProjection,
} from '@blender-elt/contracts';

export interface PropertiesPanelProps {
  node: SceneNode | null;
  materialConfig?: PBRMaterialConfig;
  onUpdateTransform?: (
    nodeId: string,
    transform: { position?: Vector3; rotation?: Euler; scale?: Vector3 },
  ) => void;
  onUpdateName?: (nodeId: string, name: string) => void;
  onUpdateMaterial?: (nodeId: string, material: Partial<PBRMaterialConfig>) => void;
  onApplyMaterialPreset?: (nodeId: string, preset: MaterialPreset) => void;
  onUpdateLight?: (nodeId: string, updates: Partial<LightNode>) => void;
  onUpdateCamera?: (nodeId: string, updates: Partial<CameraNode>) => void;
  className?: string;
}

const MATERIAL_PRESETS: { label: string; value: MaterialPreset }[] = [
  { label: 'Default Gray (Clay)', value: 'default-clay' },
  { label: 'Matte Clay', value: 'matte-clay' },
  { label: 'Glossy Plastic', value: 'glossy-plastic' },
  { label: 'Brushed Metal', value: 'brushed-metal' },
  { label: 'Pure Chrome', value: 'chrome' },
  { label: 'Gold', value: 'gold' },
  { label: 'Copper', value: 'copper' },
  { label: 'Glass', value: 'glass' },
  { label: 'Soft Rubber', value: 'rubber' },
  { label: 'Rough Wood', value: 'rough-wood' },
  { label: 'Car Paint', value: 'car-paint' },
];

export const PropertiesPanel: React.FC<PropertiesPanelProps> = ({
  node,
  materialConfig = {
    color: '#cccccc',
    roughness: 0.5,
    metalness: 0.0,
    emission: '#000000',
    opacity: 1.0,
    transparent: false,
    wireframe: false,
  },
  onUpdateTransform,
  onUpdateName,
  onUpdateMaterial,
  onApplyMaterialPreset,
  onUpdateLight,
  onUpdateCamera,
  className = '',
}) => {
  const [selectedPreset, setSelectedPreset] = useState<string>('default-clay');

  if (!node) {
    return (
      <div
        className={cn(
          'flex flex-col items-center justify-center h-full p-6 text-center bg-[#242424] text-gray-500 text-xs select-none',
          className,
        )}
      >
        <Sliders size={24} className="mb-2 opacity-30 text-gray-400" />
        <p className="font-semibold text-gray-400">No Object Selected</p>
        <p className="text-[11px] mt-1 text-gray-500">
          Select an object in the 3D viewport or outliner to view and edit its properties.
        </p>
      </div>
    );
  }

  // Radians to degrees converter for Euler
  const radToDeg = (rad: number) => Math.round(rad * (180 / Math.PI) * 10) / 10;
  const degToRad = (deg: number) => deg * (Math.PI / 180);

  const pos = node.transform.position;
  const rot = node.transform.rotation;
  const scl = node.transform.scale;

  const handlePositionChange = (axis: 'x' | 'y' | 'z', val: number) => {
    onUpdateTransform?.(node.id, {
      position: { ...pos, [axis]: val },
    });
  };

  const handleRotationChange = (axis: 'x' | 'y' | 'z', degVal: number) => {
    onUpdateTransform?.(node.id, {
      rotation: { ...rot, [axis]: degToRad(degVal) },
    });
  };

  const handleScaleChange = (axis: 'x' | 'y' | 'z', val: number) => {
    onUpdateTransform?.(node.id, {
      scale: { ...scl, [axis]: Math.max(0.001, val) },
    });
  };

  const handleResetTransform = () => {
    onUpdateTransform?.(node.id, {
      position: { x: 0, y: 0, z: 0 },
      rotation: { x: 0, y: 0, z: 0 },
      scale: { x: 1, y: 1, z: 1 },
    });
  };

  return (
    <div className={cn('flex flex-col h-full bg-[#242424] overflow-y-auto select-none', className)}>
      {/* Header with Object Name and Type */}
      <div className="p-3 bg-[#202020] border-b border-[#181818] space-y-2">
        <div className="flex items-center justify-between">
          <span className="text-[10px] uppercase font-bold tracking-wider px-1.5 py-0.5 rounded bg-[#333] text-gray-300">
            {node.type}
          </span>
          <span className="text-[10px] text-gray-500 font-mono">{node.id}</span>
        </div>

        <TextInput
          value={node.name}
          onChange={(e) => onUpdateName?.(node.id, e.target.value)}
          className="text-xs font-semibold"
          placeholder="Object Name"
        />
      </div>

      {/* 1. Transform Accordion */}
      <Accordion
        title="Transform"
        icon={<Move size={13} />}
        defaultExpanded={true}
        headerAction={
          <button
            onClick={handleResetTransform}
            title="Reset Transform"
            className="p-1 rounded text-gray-400 hover:text-white hover:bg-[#383838]"
          >
            <RotateCcw size={11} />
          </button>
        }
      >
        <div className="space-y-2.5">
          {/* Location */}
          <div>
            <span className="text-[11px] font-medium text-gray-400 block mb-1">Location</span>
            <div className="grid grid-cols-3 gap-1">
              <NumberInput
                label="X"
                labelColor="text-red-400"
                value={pos.x}
                onChange={(v) => handlePositionChange('x', v)}
                unit="m"
              />
              <NumberInput
                label="Y"
                labelColor="text-green-400"
                value={pos.y}
                onChange={(v) => handlePositionChange('y', v)}
                unit="m"
              />
              <NumberInput
                label="Z"
                labelColor="text-blue-400"
                value={pos.z}
                onChange={(v) => handlePositionChange('z', v)}
                unit="m"
              />
            </div>
          </div>

          {/* Rotation */}
          <div>
            <span className="text-[11px] font-medium text-gray-400 block mb-1">Rotation</span>
            <div className="grid grid-cols-3 gap-1">
              <NumberInput
                label="X"
                labelColor="text-red-400"
                value={radToDeg(rot.x)}
                step={5}
                onChange={(v) => handleRotationChange('x', v)}
                unit="°"
              />
              <NumberInput
                label="Y"
                labelColor="text-green-400"
                value={radToDeg(rot.y)}
                step={5}
                onChange={(v) => handleRotationChange('y', v)}
                unit="°"
              />
              <NumberInput
                label="Z"
                labelColor="text-blue-400"
                value={radToDeg(rot.z)}
                step={5}
                onChange={(v) => handleRotationChange('z', v)}
                unit="°"
              />
            </div>
          </div>

          {/* Scale */}
          <div>
            <span className="text-[11px] font-medium text-gray-400 block mb-1">Scale</span>
            <div className="grid grid-cols-3 gap-1">
              <NumberInput
                label="X"
                labelColor="text-red-400"
                value={scl.x}
                min={0.001}
                step={0.1}
                onChange={(v) => handleScaleChange('x', v)}
              />
              <NumberInput
                label="Y"
                labelColor="text-green-400"
                value={scl.y}
                min={0.001}
                step={0.1}
                onChange={(v) => handleScaleChange('y', v)}
              />
              <NumberInput
                label="Z"
                labelColor="text-blue-400"
                value={scl.z}
                min={0.001}
                step={0.1}
                onChange={(v) => handleScaleChange('z', v)}
              />
            </div>
          </div>
        </div>
      </Accordion>

      {/* 2. Material Accordion (for Mesh Nodes) */}
      {node.type === 'mesh' && (
        <Accordion title="Material" icon={<Palette size={13} />} defaultExpanded={true}>
          <div className="space-y-3">
            {/* Presets */}
            {onApplyMaterialPreset && (
              <Select
                label="Material Preset"
                value={selectedPreset}
                onChange={(e) => {
                  const val = e.target.value as MaterialPreset;
                  setSelectedPreset(val);
                  onApplyMaterialPreset(node.id, val);
                }}
                options={MATERIAL_PRESETS}
              />
            )}

            {/* Base Color Picker */}
            <div>
              <label className="text-[11px] text-gray-400 block mb-1">Base Color</label>
              <div className="flex items-center gap-2">
                <input
                  type="color"
                  value={materialConfig.color || '#cccccc'}
                  onChange={(e) =>
                    onUpdateMaterial?.(node.id, {
                      color: e.target.value,
                    })
                  }
                  className="w-8 h-7 rounded border border-[#3e3e3e] bg-transparent cursor-pointer p-0.5"
                />
                <input
                  type="text"
                  value={materialConfig.color || '#cccccc'}
                  onChange={(e) =>
                    onUpdateMaterial?.(node.id, {
                      color: e.target.value,
                    })
                  }
                  className="flex-1 bg-[#1d1e22] text-xs font-mono px-2 py-1 rounded border border-[#3e3e3e] text-gray-200"
                />
              </div>
            </div>

            {/* Roughness Slider */}
            <div>
              <div className="flex items-center justify-between text-[11px] text-gray-400 mb-1">
                <span>Roughness</span>
                <span className="font-mono text-gray-300">
                  {materialConfig.roughness.toFixed(2)}
                </span>
              </div>
              <input
                type="range"
                min="0"
                max="1"
                step="0.01"
                value={materialConfig.roughness}
                onChange={(e) =>
                  onUpdateMaterial?.(node.id, {
                    roughness: parseFloat(e.target.value),
                  })
                }
                className="w-full accent-[#4772b3] bg-[#1d1e22] h-1.5 rounded-lg appearance-none cursor-pointer"
              />
            </div>

            {/* Metalness Slider */}
            <div>
              <div className="flex items-center justify-between text-[11px] text-gray-400 mb-1">
                <span>Metalness</span>
                <span className="font-mono text-gray-300">
                  {materialConfig.metalness.toFixed(2)}
                </span>
              </div>
              <input
                type="range"
                min="0"
                max="1"
                step="0.01"
                value={materialConfig.metalness}
                onChange={(e) =>
                  onUpdateMaterial?.(node.id, {
                    metalness: parseFloat(e.target.value),
                  })
                }
                className="w-full accent-[#4772b3] bg-[#1d1e22] h-1.5 rounded-lg appearance-none cursor-pointer"
              />
            </div>

            {/* Opacity Slider */}
            <div>
              <div className="flex items-center justify-between text-[11px] text-gray-400 mb-1">
                <span>Opacity</span>
                <span className="font-mono text-gray-300">{materialConfig.opacity.toFixed(2)}</span>
              </div>
              <input
                type="range"
                min="0"
                max="1"
                step="0.01"
                value={materialConfig.opacity}
                onChange={(e) =>
                  onUpdateMaterial?.(node.id, {
                    opacity: parseFloat(e.target.value),
                    transparent: parseFloat(e.target.value) < 1.0,
                  })
                }
                className="w-full accent-[#4772b3] bg-[#1d1e22] h-1.5 rounded-lg appearance-none cursor-pointer"
              />
            </div>

            {/* Wireframe toggle */}
            <div className="flex items-center justify-between pt-1">
              <span className="text-[11px] text-gray-300">Wireframe</span>
              <input
                type="checkbox"
                checked={materialConfig.wireframe || false}
                onChange={(e) =>
                  onUpdateMaterial?.(node.id, {
                    wireframe: e.target.checked,
                  })
                }
                className="accent-[#4772b3] rounded cursor-pointer w-4 h-4"
              />
            </div>
          </div>
        </Accordion>
      )}

      {/* 3. Light Accordion (for Light Nodes) */}
      {node.type === 'light' && (
        <Accordion title="Light Settings" icon={<Sun size={13} />} defaultExpanded={true}>
          {(() => {
            const lightNode = node as LightNode;
            return (
              <div className="space-y-3">
                <Select
                  label="Type"
                  value={lightNode.lightType}
                  onChange={(e) =>
                    onUpdateLight?.(node.id, {
                      lightType: e.target.value as LightType,
                    })
                  }
                  options={[
                    { label: 'Point', value: 'point' },
                    { label: 'Directional', value: 'directional' },
                    { label: 'Spot', value: 'spot' },
                    { label: 'Ambient', value: 'ambient' },
                  ]}
                />

                {/* Color */}
                <div>
                  <label className="text-[11px] text-gray-400 block mb-1">Color</label>
                  <div className="flex items-center gap-2">
                    <input
                      type="color"
                      value={lightNode.color || '#ffffff'}
                      onChange={(e) => onUpdateLight?.(node.id, { color: e.target.value })}
                      className="w-8 h-7 rounded border border-[#3e3e3e] bg-transparent cursor-pointer p-0.5"
                    />
                    <input
                      type="text"
                      value={lightNode.color || '#ffffff'}
                      onChange={(e) => onUpdateLight?.(node.id, { color: e.target.value })}
                      className="flex-1 bg-[#1d1e22] text-xs font-mono px-2 py-1 rounded border border-[#3e3e3e] text-gray-200"
                    />
                  </div>
                </div>

                {/* Intensity */}
                <div>
                  <NumberInput
                    label="Power / Intensity"
                    value={lightNode.intensity}
                    step={50}
                    min={0}
                    max={10000}
                    onChange={(v) => onUpdateLight?.(node.id, { intensity: v })}
                    unit="W"
                  />
                </div>

                {/* Distance / Decay */}
                {lightNode.distance !== undefined && (
                  <NumberInput
                    label="Distance"
                    value={lightNode.distance}
                    step={1}
                    min={0}
                    onChange={(v) => onUpdateLight?.(node.id, { distance: v })}
                    unit="m"
                  />
                )}

                {/* Spot Light Angle */}
                {lightNode.lightType === 'spot' && (
                  <NumberInput
                    label="Spot Angle"
                    value={lightNode.angle ? radToDeg(lightNode.angle) : 45}
                    step={5}
                    min={5}
                    max={90}
                    onChange={(v) => onUpdateLight?.(node.id, { angle: degToRad(v) })}
                    unit="°"
                  />
                )}
              </div>
            );
          })()}
        </Accordion>
      )}

      {/* 4. Camera Accordion (for Camera Nodes) */}
      {node.type === 'camera' && (
        <Accordion title="Camera Lens" icon={<Video size={13} />} defaultExpanded={true}>
          {(() => {
            const camNode = node as CameraNode;
            return (
              <div className="space-y-3">
                <Select
                  label="Projection"
                  value={camNode.projection}
                  onChange={(e) =>
                    onUpdateCamera?.(node.id, {
                      projection: e.target.value as CameraProjection,
                    })
                  }
                  options={[
                    { label: 'Perspective', value: 'perspective' },
                    { label: 'Orthographic', value: 'orthographic' },
                  ]}
                />

                {camNode.projection === 'perspective' && (
                  <NumberInput
                    label="Field of View"
                    value={camNode.fov}
                    min={10}
                    max={150}
                    step={1}
                    onChange={(v) => onUpdateCamera?.(node.id, { fov: v })}
                    unit="°"
                  />
                )}

                <NumberInput
                  label="Clip Start"
                  value={camNode.near}
                  min={0.001}
                  step={0.1}
                  onChange={(v) => onUpdateCamera?.(node.id, { near: v })}
                  unit="m"
                />

                <NumberInput
                  label="Clip End"
                  value={camNode.far}
                  min={1}
                  step={10}
                  onChange={(v) => onUpdateCamera?.(node.id, { far: v })}
                  unit="m"
                />
              </div>
            );
          })()}
        </Accordion>
      )}

      {/* 5. Geometry Accordion (for Mesh Nodes) */}
      {node.type === 'mesh' && (
        <Accordion title="Mesh Geometry" icon={<Box size={13} />} defaultExpanded={true}>
          {(() => {
            const mesh = node as MeshNode;
            const prim = mesh.primitiveType || 'cube';
            let vCount = 8;
            let fCount = 6;
            if (prim === 'sphere') {
              vCount = 482;
              fCount = 960;
            } else if (prim === 'cylinder') {
              vCount = 66;
              fCount = 64;
            } else if (prim === 'plane') {
              vCount = 4;
              fCount = 2;
            } else if (prim === 'torus') {
              vCount = 512;
              fCount = 1024;
            } else if (prim === 'cone') {
              vCount = 34;
              fCount = 33;
            }

            return (
              <div className="space-y-1.5 text-xs text-gray-400">
                <div className="flex justify-between">
                  <span>Primitive:</span>
                  <span className="font-medium text-gray-200 capitalize">{prim}</span>
                </div>
                <div className="flex justify-between">
                  <span>Vertices:</span>
                  <span className="font-mono text-gray-200">{vCount}</span>
                </div>
                <div className="flex justify-between">
                  <span>Faces / Polygons:</span>
                  <span className="font-mono text-gray-200">{fCount}</span>
                </div>
              </div>
            );
          })()}
        </Accordion>
      )}
    </div>
  );
};
