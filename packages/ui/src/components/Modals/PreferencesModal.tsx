import React from 'react';
import { Modal } from '../common/Modal.js';
import { Button } from '../common/Button.js';
import { Select } from '../common/Select.js';
import { useTheme } from '../../theme/ThemeContext.js';
import type { ShadingMode } from '@blender-elt/contracts';

export interface PreferencesModalProps {
  isOpen: boolean;
  onClose: () => void;
  defaultShadingMode?: ShadingMode;
  onChangeDefaultShadingMode?: (mode: ShadingMode) => void;
  defaultFps?: number;
  onChangeDefaultFps?: (fps: number) => void;
}

export const PreferencesModal: React.FC<PreferencesModalProps> = ({
  isOpen,
  onClose,
  defaultShadingMode = 'solid',
  onChangeDefaultShadingMode,
  defaultFps = 24,
  onChangeDefaultFps,
}) => {
  const { theme, setTheme } = useTheme();

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Blender-ELT Preferences" width="max-w-md">
      <div className="space-y-4">
        {/* Interface Section */}
        <div className="space-y-2">
          <h3 className="text-xs font-bold text-gray-200 uppercase tracking-wider border-b border-[#383838] pb-1">
            Interface Theme
          </h3>
          <div className="grid grid-cols-2 gap-2">
            <button
              onClick={() => setTheme('dark')}
              className={`p-2.5 rounded border text-left transition-colors ${
                theme === 'dark'
                  ? 'border-[#4772b3] bg-[#2d3748] text-white'
                  : 'border-[#383838] bg-[#1f2024] text-gray-400 hover:text-white'
              }`}
            >
              <div className="font-semibold text-xs">Blender Dark</div>
              <div className="text-[10px] text-gray-400 mt-0.5">
                Default classic #1d1e22 palette
              </div>
            </button>

            <button
              onClick={() => setTheme('light')}
              className={`p-2.5 rounded border text-left transition-colors ${
                theme === 'light'
                  ? 'border-[#4772b3] bg-[#2d3748] text-white'
                  : 'border-[#383838] bg-[#1f2024] text-gray-400 hover:text-white'
              }`}
            >
              <div className="font-semibold text-xs">Blender Light</div>
              <div className="text-[10px] text-gray-400 mt-0.5">High contrast daytime theme</div>
            </button>
          </div>
        </div>

        {/* Viewport Defaults */}
        <div className="space-y-2">
          <h3 className="text-xs font-bold text-gray-200 uppercase tracking-wider border-b border-[#383838] pb-1">
            Viewport Defaults
          </h3>
          <Select
            label="Default Shading Mode"
            value={defaultShadingMode}
            onChange={(e) => onChangeDefaultShadingMode?.(e.target.value as ShadingMode)}
            options={[
              { label: 'Wireframe', value: 'wireframe' },
              { label: 'Solid (Clay)', value: 'solid' },
              { label: 'Material Preview', value: 'material' },
              { label: 'Rendered (Realtime)', value: 'rendered' },
            ]}
          />

          <Select
            label="Default Animation Framerate (FPS)"
            value={String(defaultFps)}
            onChange={(e) => onChangeDefaultFps?.(Number(e.target.value))}
            options={[
              { label: '24 FPS (Film)', value: '24' },
              { label: '30 FPS (Video)', value: '30' },
              { label: '60 FPS (Interactive / Games)', value: '60' },
            ]}
          />
        </div>

        <div className="pt-2 flex justify-end">
          <Button variant="primary" size="sm" onClick={onClose}>
            Apply & Close
          </Button>
        </div>
      </div>
    </Modal>
  );
};
