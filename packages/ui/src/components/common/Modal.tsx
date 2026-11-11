import React, { useEffect } from 'react';
import { X } from 'lucide-react';
import { cn } from './Button.js';

export interface ModalProps {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  children: React.ReactNode;
  width?: string;
  footer?: React.ReactNode;
}

export const Modal: React.FC<ModalProps> = ({
  isOpen,
  onClose,
  title,
  children,
  width = 'max-w-md',
  footer,
}) => {
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isOpen) {
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs select-none">
      <div
        className={cn(
          'w-full bg-[#282828] border border-[#3e3e3e] rounded-lg shadow-2xl flex flex-col overflow-hidden text-gray-200 animate-in fade-in zoom-in-95 duration-100',
          width,
        )}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-2.5 bg-[#202020] border-b border-[#181818]">
          <h2 className="text-xs font-bold text-gray-200">{title}</h2>
          <button
            onClick={onClose}
            className="p-1 rounded text-gray-400 hover:text-white hover:bg-[#383838] transition-colors"
          >
            <X size={14} />
          </button>
        </div>

        {/* Content */}
        <div className="p-4 overflow-y-auto max-h-[75vh] text-xs space-y-3">{children}</div>

        {/* Footer */}
        {footer && (
          <div className="flex items-center justify-end gap-2 px-4 py-2.5 bg-[#202020] border-t border-[#181818]">
            {footer}
          </div>
        )}
      </div>
    </div>
  );
};
