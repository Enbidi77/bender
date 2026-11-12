import React, { useState, useMemo } from 'react';
import type { VoxelRemeshConfig } from '@blender-elt/contracts';
import { cn } from '../common/Button.js';
import { NumberInput } from '../common/Input.js';
import { Modal } from '../common/Modal.js';
import { Layers, AlertTriangle, Play, CheckCircle2 } from 'lucide-react';

export interface RemeshPanelProps {
  config: VoxelRemeshConfig;
  onUpdateConfig: (updates: Partial<VoxelRemeshConfig>) => void;
  onExecuteRemesh: (config: VoxelRemeshConfig) => void;
  isRemeshing?: boolean;
  meshBoundingBox?: { x: number; y: number; z: number };
  currentVertexCount?: number;
  currentTriangleCount?: number;
  className?: string;
}

export const RemeshPanel: React.FC<RemeshPanelProps> = ({
  config,
  onUpdateConfig,
  onExecuteRemesh,
  isRemeshing = false,
  meshBoundingBox = { x: 2, y: 2, z: 2 },
  currentVertexCount = 0,
  currentTriangleCount = 0,
  className = '',
}) => {
  const [showSafetyModal, setShowSafetyModal] = useState<boolean>(false);

  // Approximate surface area: 2 * (xy + yz + zx)
  const surfaceArea = useMemo(() => {
    const { x, y, z } = meshBoundingBox;
    return 2 * (x * y + y * z + z * x);
  }, [meshBoundingBox]);

  // Estimated triangle count: surfaceArea / (voxelSize^2 * 0.5)
  const estimatedTriangles = useMemo(() => {
    const v = Math.max(0.001, config.voxelSize);
    const voxelFaceArea = v * v;
    const est = Math.round((surfaceArea / voxelFaceArea) * 2);
    // Apply adaptivity reduction if adaptivity > 0
    const adaptivityReduction = 1 - (config.adaptivity || 0) * 0.4;
    return Math.max(12, Math.round(est * adaptivityReduction));
  }, [surfaceArea, config.voxelSize, config.adaptivity]);

  const SAFETY_THRESHOLD = 800000;
  const isHighDensity = estimatedTriangles > SAFETY_THRESHOLD;

  const handleRemeshClick = () => {
    if (isHighDensity) {
      setShowSafetyModal(true);
    } else {
      onExecuteRemesh(config);
    }
  };

  const handleConfirmSafetyRemesh = () => {
    setShowSafetyModal(false);
    onExecuteRemesh(config);
  };

  return (
    <div className={cn('flex flex-col space-y-2 select-none text-xs text-gray-200', className)}>
      {/* 1. Header Card */}
      <div className="p-2.5 bg-[#202020] rounded border border-[#303030] flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Layers size={14} className="text-[#80b4f0]" />
          <div>
            <span className="font-semibold text-gray-200">Voxel Remesher</span>
            <p className="text-[10px] text-gray-400">
              Reconstructs uniform manifold quad-like surface
            </p>
          </div>
        </div>
      </div>

      {/* 2. Voxel Parameters */}
      <div className="p-2.5 bg-[#202020] rounded border border-[#303030] space-y-3">
        {/* Voxel Size */}
        <div>
          <div className="flex items-center justify-between text-[11px] text-gray-400 mb-1">
            <span className="font-semibold text-gray-300">Voxel Size</span>
            <div className="flex items-center gap-1">
              <NumberInput
                value={config.voxelSize}
                min={0.005}
                max={0.5}
                step={0.005}
                onChange={(v) => onUpdateConfig({ voxelSize: Math.max(0.005, v) })}
                unit="m"
                className="w-20"
              />
            </div>
          </div>
          <input
            type="range"
            min="0.005"
            max="0.2"
            step="0.005"
            value={config.voxelSize}
            onChange={(e) => onUpdateConfig({ voxelSize: parseFloat(e.target.value) })}
            className="w-full accent-[#4772b3] bg-[#181818] h-1.5 rounded-lg appearance-none cursor-pointer"
          />
        </div>

        {/* Adaptivity */}
        <div>
          <div className="flex items-center justify-between text-[11px] text-gray-400 mb-1">
            <span>Adaptivity (Decimate Flat Areas)</span>
            <span className="font-mono text-gray-300">
              {Math.round((config.adaptivity || 0) * 100)}%
            </span>
          </div>
          <input
            type="range"
            min="0"
            max="1"
            step="0.05"
            value={config.adaptivity || 0}
            onChange={(e) => onUpdateConfig({ adaptivity: parseFloat(e.target.value) })}
            className="w-full accent-[#4772b3] bg-[#181818] h-1.5 rounded-lg appearance-none cursor-pointer"
          />
        </div>

        {/* Toggles */}
        <div className="space-y-1.5 border-t border-[#303030] pt-2">
          <div className="flex items-center justify-between">
            <span className="text-[11px] text-gray-300">Smooth Normals</span>
            <input
              type="checkbox"
              checked={config.smoothNormals ?? true}
              onChange={(e) => onUpdateConfig({ smoothNormals: e.target.checked })}
              className="accent-[#4772b3] rounded cursor-pointer w-4 h-4"
            />
          </div>
          <div className="flex items-center justify-between">
            <span className="text-[11px] text-gray-300">Preserve Volume</span>
            <input
              type="checkbox"
              checked={config.preserveVolume ?? true}
              onChange={(e) => onUpdateConfig({ preserveVolume: e.target.checked })}
              className="accent-[#4772b3] rounded cursor-pointer w-4 h-4"
            />
          </div>
        </div>
      </div>

      {/* 3. Triangle Estimation Card */}
      <div className="p-2.5 bg-[#1b1c1e] rounded border border-[#2e2f33] space-y-1.5">
        <div className="flex items-center justify-between text-[11px]">
          <span className="text-gray-400">Current Mesh:</span>
          <span className="font-mono text-gray-300">
            {currentVertexCount.toLocaleString()} verts / {currentTriangleCount.toLocaleString()}{' '}
            tris
          </span>
        </div>
        <div className="flex items-center justify-between text-[11px]">
          <span className="text-gray-400">Estimated Result:</span>
          <span
            className={cn(
              'font-mono font-semibold',
              isHighDensity ? 'text-amber-400' : 'text-[#80b4f0]',
            )}
          >
            ~{estimatedTriangles.toLocaleString()} triangles
          </span>
        </div>
        {isHighDensity && (
          <div className="flex items-center gap-1.5 text-[10px] text-amber-400 bg-amber-950/30 p-1.5 rounded border border-amber-800/40">
            <AlertTriangle size={12} className="shrink-0" />
            <span>High density (&gt;800k tris) may increase remesh time and memory usage.</span>
          </div>
        )}
      </div>

      {/* 4. Execute Remesh Button */}
      <button
        onClick={handleRemeshClick}
        disabled={isRemeshing}
        className={cn(
          'w-full py-2 px-3 rounded font-bold text-xs flex items-center justify-center gap-2 transition-all shadow-md',
          isRemeshing
            ? 'bg-[#333] text-gray-500 cursor-not-allowed'
            : isHighDensity
              ? 'bg-amber-600 hover:bg-amber-500 text-white'
              : 'bg-[#4772b3] hover:bg-[#5885cb] text-white',
        )}
      >
        <Play size={13} className={cn(isRemeshing && 'animate-spin')} />
        <span>{isRemeshing ? 'Remeshing Geometry...' : 'Voxel Remesh (Ctrl+R)'}</span>
      </button>

      {/* Safety Confirmation Modal */}
      <Modal
        isOpen={showSafetyModal}
        onClose={() => setShowSafetyModal(false)}
        title="High Density Remesh Warning"
      >
        <div className="space-y-4 text-xs text-gray-200">
          <div className="flex items-start gap-3 bg-amber-950/40 border border-amber-800/60 p-3 rounded">
            <AlertTriangle size={24} className="text-amber-400 shrink-0 mt-0.5" />
            <div>
              <p className="font-semibold text-amber-300">Intensive Geometry Operation</p>
              <p className="text-[11px] text-gray-300 mt-1">
                The requested voxel size (
                <span className="font-mono text-white">{config.voxelSize}m</span>) will generate
                approximately{' '}
                <span className="font-mono font-bold text-amber-400">
                  {estimatedTriangles.toLocaleString()}
                </span>{' '}
                triangles.
              </p>
              <p className="text-[11px] text-gray-400 mt-1">
                On lower-spec hardware or browser tabs, this may cause momentary UI
                unresponsiveness.
              </p>
            </div>
          </div>

          <div className="flex justify-end gap-2 pt-2">
            <button
              onClick={() => setShowSafetyModal(false)}
              className="px-3 py-1.5 rounded bg-[#333] hover:bg-[#444] text-gray-200 transition-colors"
            >
              Cancel
            </button>
            <button
              onClick={handleConfirmSafetyRemesh}
              className="px-3 py-1.5 rounded bg-amber-600 hover:bg-amber-500 text-white font-semibold transition-colors flex items-center gap-1.5"
            >
              <CheckCircle2 size={13} />
              <span>Proceed Anyway</span>
            </button>
          </div>
        </div>
      </Modal>
    </div>
  );
};
