import React, { useState } from 'react';
import type {
  BrushFalloffType,
  SculptBrushConfig,
  SculptStrokeSettings,
} from '@blender-elt/contracts';
import { BrushIcon, FalloffCurvePreview } from './BrushIcons.js';
import { SCULPT_BRUSH_DEFINITIONS, BRUSH_METADATA_MAP } from './types.js';
import { Accordion } from '../common/Accordion.js';
import { NumberInput } from '../common/Input.js';
import { Select } from '../common/Select.js';
import { cn } from '../common/Button.js';
import { Sliders, Plus, Minus, Tablet, Wind } from 'lucide-react';

export interface BrushSettingsPanelProps {
  brushConfig: SculptBrushConfig;
  onUpdateBrushConfig: (updates: Partial<SculptBrushConfig>) => void;
  strokeSettings?: SculptStrokeSettings;
  onUpdateStrokeSettings?: (updates: Partial<SculptStrokeSettings>) => void;
  className?: string;
}

export const BrushSettingsPanel: React.FC<BrushSettingsPanelProps> = ({
  brushConfig,
  onUpdateBrushConfig,
  strokeSettings = {
    spacing: 10,
    smoothStroke: false,
    smoothStrokeFactor: 0.5,
    useAccumulate: true,
    frontFacesOnly: false,
  },
  onUpdateStrokeSettings,
  className = '',
}) => {
  const [radiusUnit, setRadiusUnit] = useState<'px' | 'cm'>('px');
  const metadata = BRUSH_METADATA_MAP[brushConfig.type] || SCULPT_BRUSH_DEFINITIONS[0];

  const falloffTypes: { id: BrushFalloffType; label: string }[] = [
    { id: 'smooth', label: 'Smooth' },
    { id: 'sphere', label: 'Sphere' },
    { id: 'sharp', label: 'Sharp' },
    { id: 'linear', label: 'Linear' },
    { id: 'constant', label: 'Constant' },
  ];

  return (
    <div className={cn('flex flex-col space-y-2 select-none text-xs text-gray-200', className)}>
      {/* 1. Active Brush Header Card */}
      <div className="p-2.5 bg-[#202020] rounded border border-[#303030] flex items-center justify-between">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded bg-[#333] flex items-center justify-center text-white shadow-xs">
            <BrushIcon type={brushConfig.type} size={18} />
          </div>
          <div>
            <div className="flex items-center gap-1.5">
              <span className="font-bold text-gray-200">{metadata.name}</span>
              <kbd className="px-1.5 py-0.5 rounded bg-[#1c1c1c] text-[10px] font-mono text-gray-400 border border-[#3e3e3e]">
                {metadata.shortcut}
              </kbd>
            </div>
            <span className="text-[10px] text-gray-400">
              {metadata.category.charAt(0).toUpperCase() + metadata.category.slice(1)} Brush
            </span>
          </div>
        </div>

        {/* Direction Toggle: Add (+) vs Subtract (-) */}
        <div className="flex items-center bg-[#181818] border border-[#3a3a3a] rounded p-0.5">
          <button
            onClick={() => onUpdateBrushConfig({ direction: 'add' })}
            title="Direction: Add (Displace Outward)"
            className={cn(
              'px-2 py-1 rounded text-xs font-bold transition-colors flex items-center gap-1',
              brushConfig.direction === 'add'
                ? 'bg-[#4772b3] text-white shadow-xs'
                : 'text-gray-400 hover:text-white',
            )}
          >
            <Plus size={12} />
            <span>Add</span>
          </button>
          <button
            onClick={() => onUpdateBrushConfig({ direction: 'subtract' })}
            title="Direction: Subtract (Invert / Carve Inward) (Hold Ctrl)"
            className={cn(
              'px-2 py-1 rounded text-xs font-bold transition-colors flex items-center gap-1',
              brushConfig.direction === 'subtract'
                ? 'bg-[#e04b4b] text-white shadow-xs'
                : 'text-gray-400 hover:text-white',
            )}
          >
            <Minus size={12} />
            <span>Sub</span>
          </button>
        </div>
      </div>

      {/* 2. Core Brush Parameters (Radius, Strength) */}
      <div className="p-2.5 bg-[#202020] rounded border border-[#303030] space-y-3">
        {/* Radius */}
        <div>
          <div className="flex items-center justify-between text-[11px] text-gray-400 mb-1">
            <div className="flex items-center gap-1">
              <span className="font-semibold text-gray-300">Radius</span>
              <button
                onClick={() => setRadiusUnit((u) => (u === 'px' ? 'cm' : 'px'))}
                title="Toggle pixel / world units"
                className="text-[10px] px-1 rounded bg-[#2a2a2a] text-gray-400 hover:text-white border border-[#383838]"
              >
                {radiusUnit}
              </button>
            </div>
            <div className="flex items-center gap-1.5">
              {/* Pressure sensitivity button */}
              <button
                onClick={() =>
                  onUpdateBrushConfig({
                    pressureAffectsSize: !brushConfig.pressureAffectsSize,
                  })
                }
                title="Stylus Pressure modifies Radius"
                className={cn(
                  'p-1 rounded transition-colors',
                  brushConfig.pressureAffectsSize
                    ? 'bg-[#4772b3] text-white'
                    : 'text-gray-500 hover:text-gray-300 bg-[#282828]',
                )}
              >
                <Tablet size={11} />
              </button>
              <NumberInput
                value={brushConfig.radius}
                min={1}
                max={500}
                step={1}
                onChange={(v) => onUpdateBrushConfig({ radius: Math.max(1, v) })}
                className="w-16"
              />
            </div>
          </div>
          <input
            type="range"
            min="1"
            max="300"
            value={brushConfig.radius}
            onChange={(e) => onUpdateBrushConfig({ radius: parseInt(e.target.value, 10) })}
            className="w-full accent-[#4772b3] bg-[#181818] h-1.5 rounded-lg appearance-none cursor-pointer"
          />
        </div>

        {/* Strength */}
        <div>
          <div className="flex items-center justify-between text-[11px] text-gray-400 mb-1">
            <span className="font-semibold text-gray-300">Strength</span>
            <div className="flex items-center gap-1.5">
              {/* Pressure sensitivity button */}
              <button
                onClick={() =>
                  onUpdateBrushConfig({
                    pressureAffectsStrength: !brushConfig.pressureAffectsStrength,
                  })
                }
                title="Stylus Pressure modifies Strength"
                className={cn(
                  'p-1 rounded transition-colors',
                  brushConfig.pressureAffectsStrength
                    ? 'bg-[#4772b3] text-white'
                    : 'text-gray-500 hover:text-gray-300 bg-[#282828]',
                )}
              >
                <Tablet size={11} />
              </button>
              <span className="font-mono text-gray-200">
                {Math.round(brushConfig.strength * 100)}%
              </span>
            </div>
          </div>
          <input
            type="range"
            min="0.01"
            max="1.0"
            step="0.01"
            value={brushConfig.strength}
            onChange={(e) => onUpdateBrushConfig({ strength: parseFloat(e.target.value) })}
            className="w-full accent-[#4772b3] bg-[#181818] h-1.5 rounded-lg appearance-none cursor-pointer"
          />
        </div>
      </div>

      {/* 3. Falloff Profile Selector */}
      <div className="p-2.5 bg-[#202020] rounded border border-[#303030] space-y-2">
        <span className="text-[11px] font-semibold text-gray-300 block">Falloff Curve</span>
        <div className="grid grid-cols-5 gap-1">
          {falloffTypes.map((falloff) => {
            const isActive = brushConfig.falloff === falloff.id;
            return (
              <button
                key={falloff.id}
                onClick={() => onUpdateBrushConfig({ falloff: falloff.id })}
                title={falloff.label}
                className={cn(
                  'flex flex-col items-center justify-center p-1.5 rounded border transition-colors',
                  isActive
                    ? 'bg-[#3b5998] border-[#60a5fa]'
                    : 'bg-[#1e1e1e] border-[#383838] hover:bg-[#2c2c2c]',
                )}
              >
                <FalloffCurvePreview type={falloff.id} active={isActive} width={32} height={18} />
                <span className="text-[9px] mt-1 truncate">{falloff.label}</span>
              </button>
            );
          })}
        </div>
      </div>

      {/* 4. Stroke Settings Accordion */}
      <Accordion title="Stroke & Spacing" icon={<Wind size={13} />} defaultExpanded={true}>
        <div className="space-y-3 pt-1">
          {/* Spacing */}
          <div>
            <div className="flex items-center justify-between text-[11px] text-gray-400 mb-1">
              <span>Spacing (% of Radius)</span>
              <span className="font-mono text-gray-200">{brushConfig.spacing || 10}%</span>
            </div>
            <input
              type="range"
              min="1"
              max="100"
              step="1"
              value={brushConfig.spacing || 10}
              onChange={(e) => onUpdateBrushConfig({ spacing: parseInt(e.target.value, 10) })}
              className="w-full accent-[#4772b3] bg-[#181818] h-1.5 rounded-lg appearance-none cursor-pointer"
            />
          </div>

          {/* Smooth Stroke (Lazy Mouse) */}
          <div className="space-y-1.5 border-t border-[#303030] pt-2">
            <div className="flex items-center justify-between">
              <span className="text-[11px] text-gray-300">Smooth Stroke (Lazy Mouse)</span>
              <input
                type="checkbox"
                checked={strokeSettings.smoothStroke}
                onChange={(e) => onUpdateStrokeSettings?.({ smoothStroke: e.target.checked })}
                className="accent-[#4772b3] rounded cursor-pointer w-4 h-4"
              />
            </div>
            {strokeSettings.smoothStroke && (
              <div>
                <div className="flex items-center justify-between text-[10px] text-gray-400 mb-1">
                  <span>Smooth Factor</span>
                  <span className="font-mono">
                    {Math.round(strokeSettings.smoothStrokeFactor * 100)}%
                  </span>
                </div>
                <input
                  type="range"
                  min="0.1"
                  max="0.95"
                  step="0.05"
                  value={strokeSettings.smoothStrokeFactor}
                  onChange={(e) =>
                    onUpdateStrokeSettings?.({
                      smoothStrokeFactor: parseFloat(e.target.value),
                    })
                  }
                  className="w-full accent-[#4772b3] bg-[#181818] h-1.5 rounded-lg appearance-none cursor-pointer"
                />
              </div>
            )}
          </div>

          {/* Front Faces Only */}
          <div className="flex items-center justify-between pt-1">
            <span className="text-[11px] text-gray-300">Front Faces Only</span>
            <input
              type="checkbox"
              checked={strokeSettings.frontFacesOnly}
              onChange={(e) => onUpdateStrokeSettings?.({ frontFacesOnly: e.target.checked })}
              className="accent-[#4772b3] rounded cursor-pointer w-4 h-4"
            />
          </div>

          {/* Accumulate */}
          <div className="flex items-center justify-between pt-1">
            <span className="text-[11px] text-gray-300">Accumulate Stroke</span>
            <input
              type="checkbox"
              checked={strokeSettings.useAccumulate}
              onChange={(e) => onUpdateStrokeSettings?.({ useAccumulate: e.target.checked })}
              className="accent-[#4772b3] rounded cursor-pointer w-4 h-4"
            />
          </div>
        </div>
      </Accordion>

      {/* 5. Advanced Brush Parameters Accordion */}
      <Accordion
        title="Advanced Brush Controls"
        icon={<Sliders size={13} />}
        defaultExpanded={false}
      >
        <div className="space-y-3 pt-1">
          {/* Auto Smooth */}
          <div>
            <div className="flex items-center justify-between text-[11px] text-gray-400 mb-1">
              <span>Auto-Smooth</span>
              <span className="font-mono text-gray-200">
                {Math.round((brushConfig.autoSmooth || 0) * 100)}%
              </span>
            </div>
            <input
              type="range"
              min="0"
              max="1"
              step="0.05"
              value={brushConfig.autoSmooth || 0}
              onChange={(e) => onUpdateBrushConfig({ autoSmooth: parseFloat(e.target.value) })}
              className="w-full accent-[#4772b3] bg-[#181818] h-1.5 rounded-lg appearance-none cursor-pointer"
            />
          </div>

          {/* Normal Weight */}
          <div>
            <div className="flex items-center justify-between text-[11px] text-gray-400 mb-1">
              <span>Normal Weight</span>
              <span className="font-mono text-gray-200">
                {Math.round((brushConfig.normalWeight ?? 1) * 100)}%
              </span>
            </div>
            <input
              type="range"
              min="0"
              max="1"
              step="0.05"
              value={brushConfig.normalWeight ?? 1}
              onChange={(e) => onUpdateBrushConfig({ normalWeight: parseFloat(e.target.value) })}
              className="w-full accent-[#4772b3] bg-[#181818] h-1.5 rounded-lg appearance-none cursor-pointer"
            />
          </div>

          {/* Crease Pinch (for Crease brush) */}
          {brushConfig.type === 'crease' && (
            <div>
              <div className="flex items-center justify-between text-[11px] text-gray-400 mb-1">
                <span>Crease Pinch Factor</span>
                <span className="font-mono text-gray-200">
                  {Math.round((brushConfig.creasePinch ?? 0.5) * 100)}%
                </span>
              </div>
              <input
                type="range"
                min="0"
                max="1"
                step="0.05"
                value={brushConfig.creasePinch ?? 0.5}
                onChange={(e) => onUpdateBrushConfig({ creasePinch: parseFloat(e.target.value) })}
                className="w-full accent-[#4772b3] bg-[#181818] h-1.5 rounded-lg appearance-none cursor-pointer"
              />
            </div>
          )}

          {/* Elastic Deform Mode */}
          {brushConfig.type === 'elastic-deform' && (
            <Select
              label="Deformation Mode"
              value={brushConfig.elasticDeformMode || 'volume'}
              onChange={(e) =>
                onUpdateBrushConfig({
                  elasticDeformMode: e.target.value as 'volume' | 'scale' | 'twist',
                })
              }
              options={[
                { label: 'Volume Preservation', value: 'volume' },
                { label: 'Scale / Stretch', value: 'scale' },
                { label: 'Twist / Torsion', value: 'twist' },
              ]}
            />
          )}
        </div>
      </Accordion>
    </div>
  );
};
