import React from 'react';
import { Undo2, Redo2, Sun, Moon, Search, Minus, Square, X } from 'lucide-react';
import { MenuBar, type MenuCategory } from './MenuBar.js';
import { useTheme } from '../../theme/ThemeContext.js';
import { cn } from '../common/Button.js';
import type { ViewportMode, WorkspaceDefinition } from '@blender-elt/contracts';

export interface HeaderProps {
  projectName?: string;
  isDirty?: boolean;
  canUndo?: boolean;
  canRedo?: boolean;
  onUndo?: () => void;
  onRedo?: () => void;
  onMenuAction?: (actionId: string) => void;
  customCategories?: MenuCategory[];
  viewportMode?: ViewportMode;
  onViewportModeChange?: (mode: ViewportMode) => void;
  workspaces?: WorkspaceDefinition[];
  activeWorkspaceId?: string;
  onSelectWorkspace?: (workspaceId: string) => void;
  headerPrefix?: React.ReactNode;
  headerSuffix?: React.ReactNode;
  onOpenCommandPalette?: () => void;
  onMinimize?: () => void;
  onMaximize?: () => void;
  onClose?: () => void;
  className?: string;
}

export const Header: React.FC<HeaderProps> = ({
  projectName = 'Untitled.belt',
  isDirty = false,
  canUndo = false,
  canRedo = false,
  onUndo,
  onRedo,
  onMenuAction,
  customCategories,
  viewportMode = 'object',
  onViewportModeChange,
  workspaces,
  activeWorkspaceId,
  onSelectWorkspace,
  headerPrefix,
  headerSuffix,
  onOpenCommandPalette,
  onMinimize,
  onMaximize,
  onClose,
  className = '',
}) => {
  const { theme, toggleTheme } = useTheme();

  return (
    <header
      className={cn(
        'flex items-center justify-between h-9 bg-[#282828] border-b border-[#181818] px-2 select-none text-xs text-gray-200 z-30',
        className,
      )}
    >
      {/* Left: App Logo + MenuBar + Mode Switcher + Workspaces */}
      <div className="flex items-center gap-3">
        {headerPrefix}

        {/* App Branding */}
        <div className="flex items-center gap-1.5 font-bold tracking-tight text-white mr-1">
          <div className="w-5 h-5 rounded-full bg-gradient-to-tr from-[#ea7600] to-[#f49b42] flex items-center justify-center text-[11px] font-black text-white shadow-sm">
            B
          </div>
          <span className="hidden sm:inline text-xs font-semibold">Blender-ELT</span>
        </div>

        {/* MenuBar */}
        <MenuBar onAction={onMenuAction} customCategories={customCategories} />

        {/* Mode Selector */}
        {onViewportModeChange && (
          <div className="hidden md:flex items-center bg-[#1d1e22] border border-[#3e3e3e] rounded px-1 py-0.5 ml-1">
            <select
              value={viewportMode}
              onChange={(e) => onViewportModeChange(e.target.value as ViewportMode)}
              className="bg-transparent text-gray-200 text-xs focus:outline-none cursor-pointer pr-1"
            >
              <option value="object" className="bg-[#282828]">
                Object Mode
              </option>
              <option value="edit" className="bg-[#282828]">
                Edit Mode
              </option>
              <option value="sculpt" className="bg-[#282828]">
                Sculpt Mode
              </option>
            </select>
          </div>
        )}

        {/* Workspace Switching Tabs */}
        {workspaces && workspaces.length > 0 && (
          <div className="hidden xl:flex items-center gap-0.5 border-l border-[#3a3a3a] pl-2 ml-1">
            {workspaces.map((ws) => {
              const isActive = ws.id === activeWorkspaceId;
              return (
                <button
                  key={ws.id}
                  onClick={() => onSelectWorkspace?.(ws.id)}
                  title={`Switch to ${ws.name} workspace`}
                  className={cn(
                    'px-2 py-0.5 rounded text-[11px] font-medium transition-colors',
                    isActive
                      ? 'bg-[#3c3d42] text-white shadow-xs border-b border-[#4772b3]'
                      : 'text-gray-400 hover:text-gray-200 hover:bg-[#323236]',
                  )}
                >
                  {ws.name}
                </button>
              );
            })}
          </div>
        )}
      </div>

      {/* Center: Project Name & Dirty indicator */}
      <div className="hidden lg:flex items-center gap-1.5 font-mono text-[11px] text-gray-400 bg-[#1f2024] px-3 py-1 rounded border border-[#323338]">
        <span className="text-gray-300 font-medium">{projectName}</span>
        {isDirty && (
          <span className="text-amber-400 font-bold text-xs" title="Unsaved changes">
            *
          </span>
        )}
      </div>

      {/* Right: Quick actions + Theme switcher + Window Controls */}
      <div className="flex items-center gap-2">
        {headerSuffix}
        {/* Command Search Button */}
        {onOpenCommandPalette && (
          <button
            onClick={onOpenCommandPalette}
            title="Search actions (Ctrl+K or F3)"
            className="flex items-center gap-1.5 px-2 py-1 rounded bg-[#202020] hover:bg-[#353535] text-gray-400 hover:text-white border border-[#383838] transition-colors"
          >
            <Search size={12} />
            <span className="hidden sm:inline text-[11px]">Search</span>
            <kbd className="hidden md:inline text-[9px] bg-[#1d1e22] px-1 py-0.5 rounded text-gray-500 font-mono">
              Ctrl+K
            </kbd>
          </button>
        )}

        {/* Undo / Redo */}
        <div className="flex items-center gap-0.5 bg-[#1d1e22] border border-[#3e3e3e] rounded p-0.5">
          <button
            onClick={onUndo}
            disabled={!canUndo}
            title="Undo (Ctrl+Z)"
            className={cn(
              'p-1 rounded text-gray-400 hover:text-white hover:bg-[#383838] transition-colors',
              { 'opacity-30 pointer-events-none': !canUndo },
            )}
          >
            <Undo2 size={13} />
          </button>
          <button
            onClick={onRedo}
            disabled={!canRedo}
            title="Redo (Ctrl+Y)"
            className={cn(
              'p-1 rounded text-gray-400 hover:text-white hover:bg-[#383838] transition-colors',
              { 'opacity-30 pointer-events-none': !canRedo },
            )}
          >
            <Redo2 size={13} />
          </button>
        </div>

        {/* Theme Switcher */}
        <button
          onClick={toggleTheme}
          title={`Switch to ${theme === 'dark' ? 'Light' : 'Dark'} Theme`}
          className="p-1.5 rounded hover:bg-[#383838] text-gray-300 hover:text-white transition-colors"
        >
          {theme === 'dark' ? <Sun size={13} /> : <Moon size={13} />}
        </button>

        {/* Desktop Window Controls */}
        <div className="flex items-center gap-0.5 pl-1 border-l border-[#3e3e3e]">
          {onMinimize && (
            <button
              onClick={onMinimize}
              className="p-1 rounded hover:bg-[#383838] text-gray-400 hover:text-white transition-colors"
              title="Minimize"
            >
              <Minus size={12} />
            </button>
          )}
          {onMaximize && (
            <button
              onClick={onMaximize}
              className="p-1 rounded hover:bg-[#383838] text-gray-400 hover:text-white transition-colors"
              title="Maximize"
            >
              <Square size={10} />
            </button>
          )}
          {onClose && (
            <button
              onClick={onClose}
              className="p-1 rounded hover:bg-red-600 text-gray-400 hover:text-white transition-colors"
              title="Close"
            >
              <X size={12} />
            </button>
          )}
        </div>
      </div>
    </header>
  );
};
