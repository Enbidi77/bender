import React, { useState, useEffect, useRef } from 'react';
import { Search, ArrowRight } from 'lucide-react';
import { cn } from '../common/Button.js';

export interface CommandPaletteAction {
  id: string;
  name: string;
  category: 'File' | 'Edit' | 'Add' | 'View' | 'Object' | 'General';
  shortcut?: string;
  onExecute: () => void;
}

export interface CommandPaletteProps {
  isOpen: boolean;
  onClose: () => void;
  actions: CommandPaletteAction[];
}

export const CommandPalette: React.FC<CommandPaletteProps> = ({
  isOpen,
  onClose,
  actions,
}) => {
  const [query, setQuery] = useState<string>('');
  const [selectedIndex, setSelectedIndex] = useState<number>(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (isOpen) {
      setQuery('');
      setSelectedIndex(0);
      setTimeout(() => inputRef.current?.focus(), 50);
    }
  }, [isOpen]);

  const filteredActions = actions.filter((action) => {
    const q = query.toLowerCase().trim();
    if (!q) return true;
    return (
      action.name.toLowerCase().includes(q) ||
      action.category.toLowerCase().includes(q) ||
      (action.shortcut && action.shortcut.toLowerCase().includes(q))
    );
  });

  useEffect(() => {
    setSelectedIndex(0);
  }, [query]);

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setSelectedIndex((prev) => (prev + 1) % Math.max(1, filteredActions.length));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setSelectedIndex((prev) =>
        prev === 0 ? Math.max(0, filteredActions.length - 1) : prev - 1,
      );
    } else if (e.key === 'Enter') {
      e.preventDefault();
      if (filteredActions[selectedIndex]) {
        filteredActions[selectedIndex].onExecute();
        onClose();
      }
    } else if (e.key === 'Escape') {
      onClose();
    }
  };

  if (!isOpen) return null;

  return (
    <div
      onClick={onClose}
      className="fixed inset-0 z-50 flex items-start justify-center pt-24 px-4 bg-black/60 backdrop-blur-xs select-none"
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="w-full max-w-lg bg-[#282828] border border-[#3e3e3e] rounded-lg shadow-2xl flex flex-col overflow-hidden text-gray-200 animate-in fade-in zoom-in-95 duration-100"
      >
        {/* Search Input Bar */}
        <div className="flex items-center px-3 py-2.5 bg-[#202020] border-b border-[#353535] gap-2">
          <Search size={15} className="text-gray-400 shrink-0" />
          <input
            ref={inputRef}
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Type a command or search actions..."
            className="w-full bg-transparent text-sm text-gray-100 placeholder-gray-500 focus:outline-none"
          />
          <kbd className="text-[10px] bg-[#2e2e2e] text-gray-400 px-1.5 py-0.5 rounded border border-[#3e3e3e] font-mono">
            ESC
          </kbd>
        </div>

        {/* Results List */}
        <div ref={listRef} className="max-h-72 overflow-y-auto p-1.5 space-y-0.5">
          {filteredActions.length === 0 ? (
            <div className="p-6 text-center text-xs text-gray-500">
              No matching commands found.
            </div>
          ) : (
            filteredActions.map((action, idx) => {
              const isSelected = idx === selectedIndex;
              return (
                <div
                  key={action.id}
                  onClick={() => {
                    action.onExecute();
                    onClose();
                  }}
                  onMouseEnter={() => setSelectedIndex(idx)}
                  className={cn(
                    'flex items-center justify-between px-3 py-2 rounded text-xs cursor-pointer transition-colors',
                    {
                      'bg-[#4772b3] text-white': isSelected,
                      'hover:bg-[#353535] text-gray-300': !isSelected,
                    },
                  )}
                >
                  <div className="flex items-center gap-2">
                    <span
                      className={cn(
                        'text-[10px] uppercase font-bold tracking-wider px-1.5 py-0.5 rounded',
                        {
                          'bg-white/20 text-white': isSelected,
                          'bg-[#202020] text-gray-400': !isSelected,
                        },
                      )}
                    >
                      {action.category}
                    </span>
                    <span className="font-medium">{action.name}</span>
                  </div>

                  <div className="flex items-center gap-2">
                    {action.shortcut && (
                      <kbd
                        className={cn(
                          'text-[10px] font-mono px-1.5 py-0.5 rounded',
                          {
                            'bg-white/20 text-white': isSelected,
                            'bg-[#202020] text-gray-400 border border-[#3e3e3e]': !isSelected,
                          },
                        )}
                      >
                        {action.shortcut}
                      </kbd>
                    )}
                    {isSelected && <ArrowRight size={12} className="opacity-80" />}
                  </div>
                </div>
              );
            })
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between px-3 py-1.5 bg-[#202020] border-t border-[#353535] text-[10px] text-gray-400 font-mono">
          <div className="flex items-center gap-2">
            <span>↑↓ to navigate</span>
            <span>•</span>
            <span>↵ to select</span>
            <span>•</span>
            <span>esc to close</span>
          </div>
          <span>{filteredActions.length} commands</span>
        </div>
      </div>
    </div>
  );
};
