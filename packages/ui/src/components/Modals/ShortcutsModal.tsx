import React from 'react';
import { Modal } from '../common/Modal.js';
import { Button } from '../common/Button.js';

export interface ShortcutsModalProps {
  isOpen: boolean;
  onClose: () => void;
}

interface ShortcutItem {
  key: string;
  desc: string;
}

interface ShortcutCategory {
  title: string;
  items: ShortcutItem[];
}

export const ShortcutsModal: React.FC<ShortcutsModalProps> = ({ isOpen, onClose }) => {
  const categories: ShortcutCategory[] = [
    {
      title: 'Viewport Navigation',
      items: [
        { key: 'Left Click + Drag', desc: 'Rotate / Orbit viewport camera' },
        { key: 'Shift + Drag', desc: 'Pan viewport camera' },
        { key: 'Mouse Wheel', desc: 'Zoom camera in / out' },
        { key: 'F or .', desc: 'Frame / Focus selected object' },
        { key: 'Numpad 1', desc: 'Front viewpoint' },
        { key: 'Numpad 3', desc: 'Right viewpoint' },
        { key: 'Numpad 7', desc: 'Top viewpoint' },
        { key: 'Numpad 0', desc: 'Active camera view' },
        { key: 'Numpad 5', desc: 'Toggle Perspective / Orthographic' },
      ],
    },
    {
      title: 'Transformation & Tools',
      items: [
        { key: 'G', desc: 'Grab / Translate tool' },
        { key: 'R', desc: 'Rotate tool' },
        { key: 'S', desc: 'Scale tool' },
        { key: 'W', desc: 'Select Box tool' },
      ],
    },
    {
      title: 'Object Management',
      items: [
        { key: 'Shift + D', desc: 'Duplicate selected object' },
        { key: 'X or Delete', desc: 'Delete selected object' },
        { key: 'F2', desc: 'Rename selected object' },
        { key: 'H', desc: 'Hide selected object' },
        { key: 'Alt + H', desc: 'Unhide / reveal all objects' },
      ],
    },
    {
      title: 'Animation & Playback',
      items: [
        { key: 'Space', desc: 'Toggle Timeline Play / Pause' },
        { key: 'Left Arrow', desc: 'Step to previous frame' },
        { key: 'Right Arrow', desc: 'Step to next frame' },
        { key: 'Shift + Left', desc: 'Jump to start frame' },
        { key: 'Shift + Right', desc: 'Jump to end frame' },
      ],
    },
    {
      title: 'Project & Global',
      items: [
        { key: 'Ctrl + Z', desc: 'Undo last action' },
        { key: 'Ctrl + Y / Ctrl+Shift+Z', desc: 'Redo previously undone action' },
        { key: 'Ctrl + S', desc: 'Save current project' },
        { key: 'Ctrl + Shift + S', desc: 'Save project as...' },
        { key: 'Ctrl + O', desc: 'Open project file' },
        { key: 'Ctrl + N', desc: 'Create new project' },
        { key: 'Ctrl + K or F3', desc: 'Open Command Palette' },
      ],
    },
  ];

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Blender-ELT Keyboard Shortcuts"
      width="max-w-xl"
    >
      <div className="space-y-4 max-h-[60vh] overflow-y-auto pr-1">
        {categories.map((cat) => (
          <div key={cat.title} className="space-y-1.5">
            <h3 className="text-xs font-bold text-gray-200 uppercase tracking-wider border-b border-[#383838] pb-1">
              {cat.title}
            </h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5 pt-0.5">
              {cat.items.map((item, idx) => (
                <div
                  key={idx}
                  className="flex items-center justify-between bg-[#1f2024] px-2 py-1 rounded border border-[#333]"
                >
                  <span className="text-[11px] text-gray-300">{item.desc}</span>
                  <kbd className="text-[10px] font-mono bg-[#282828] text-amber-400 px-1.5 py-0.5 rounded border border-[#444] shrink-0 ml-2">
                    {item.key}
                  </kbd>
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>

      <div className="pt-2 flex justify-end">
        <Button variant="primary" size="sm" onClick={onClose}>
          Got it
        </Button>
      </div>
    </Modal>
  );
};
