import React from 'react';
import { Modal } from '../common/Modal.js';
import { Button } from '../common/Button.js';
import { Box, Sparkles, Layers, Cpu } from 'lucide-react';

export interface AboutModalProps {
  isOpen: boolean;
  onClose: () => void;
  appVersion?: string;
}

export const AboutModal: React.FC<AboutModalProps> = ({
  isOpen,
  onClose,
  appVersion = '0.1.0',
}) => {
  return (
    <Modal isOpen={isOpen} onClose={onClose} title="About Blender-ELT" width="max-w-md">
      <div className="flex flex-col items-center text-center py-2 space-y-3">
        {/* Branding Emblem */}
        <div className="w-14 h-14 rounded-2xl bg-gradient-to-tr from-[#ea7600] to-[#f49b42] flex items-center justify-center text-white text-2xl font-black shadow-lg">
          B
        </div>

        <div>
          <h2 className="text-base font-bold text-white tracking-wide">Blender-ELT</h2>
          <p className="text-xs text-amber-400 font-mono">v{appVersion} (Alpha Release)</p>
        </div>

        <p className="text-xs text-gray-300 leading-relaxed max-w-sm">
          A lightweight, responsive, and extensible 3D desktop suite inspired by Blender. Built on
          modern web and desktop technologies: TypeScript, Three.js, React Three Fiber, and
          Electron.
        </p>

        {/* Feature badges */}
        <div className="grid grid-cols-2 gap-2 w-full pt-2 text-left">
          <div className="bg-[#1f2024] p-2 rounded border border-[#333] flex items-center gap-2">
            <Box size={14} className="text-orange-400" />
            <span className="text-[11px] text-gray-300">Three.js Engine</span>
          </div>
          <div className="bg-[#1f2024] p-2 rounded border border-[#333] flex items-center gap-2">
            <Layers size={14} className="text-sky-400" />
            <span className="text-[11px] text-gray-300">Zustand Scene Graph</span>
          </div>
          <div className="bg-[#1f2024] p-2 rounded border border-[#333] flex items-center gap-2">
            <Sparkles size={14} className="text-yellow-400" />
            <span className="text-[11px] text-gray-300">PBR Materials</span>
          </div>
          <div className="bg-[#1f2024] p-2 rounded border border-[#333] flex items-center gap-2">
            <Cpu size={14} className="text-emerald-400" />
            <span className="text-[11px] text-gray-300">Electron Desktop</span>
          </div>
        </div>

        <div className="pt-2 w-full flex justify-end">
          <Button variant="primary" size="sm" onClick={onClose}>
            Close
          </Button>
        </div>
      </div>
    </Modal>
  );
};
