import React, { useState, useEffect } from 'react';
import { Undo2, Redo2, Sun, Moon, Search, Minus, Square, X } from 'lucide-react';
import { MenuBar, type MenuCategory } from './MenuBar.js';
import { useTheme } from '../../theme/ThemeContext.js';
import { cn } from '../common/Button.js';
import type {
  ViewportMode,
  WorkspaceDefinition,
  SculptBrushType,
  SculptBrushConfig,
  SymmetryConfig,
  EditElementMode,
} from '@blender-elt/contracts';
import { SculptTopBar } from '../Sculpt/SculptTopBar.js';
import { ElementModeSelector } from '../EditMode/ElementModeSelector.js';

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
  editElementModes?: EditElementMode[];
  onSelectEditElementMode?: (mode: EditElementMode, isMultiSelect?: boolean) => void;
  activeSculptBrush?: SculptBrushType;
  sculptBrushConfig?: SculptBrushConfig;
  onUpdateSculptBrushConfig?: (updates: Partial<SculptBrushConfig>) => void;
  onSelectSculptBrush?: (brush: SculptBrushType) => void;
  sculptSymmetry?: SymmetryConfig;
  onUpdateSculptSymmetry?: (updates: Partial<SymmetryConfig>) => void;
  sculptTopBar?: React.ReactNode;
  onOpenCommandPalette?: () => void;
  onMinimize?: () => void;
  onMaximize?: () => void;
  onClose?: () => void;
  isMaximized?: boolean;
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
  editElementModes,
  onSelectEditElementMode,
  activeSculptBrush,
  sculptBrushConfig,
  onUpdateSculptBrushConfig,
  onSelectSculptBrush,
  sculptSymmetry,
  onUpdateSculptSymmetry,
  sculptTopBar,
  onOpenCommandPalette,
  onMinimize,
  onMaximize,
  onClose,
  isMaximized = false,
  className = '',
}) => {
  const { theme, toggleTheme } = useTheme();

  // Desktop detection & maximized state tracking
  const isDesktop =
    typeof window !== 'undefined' &&
    Boolean((window as any).electronBridge || (window as any).electronAPI);

  const [internalIsMaximized, setInternalIsMaximized] = useState(false);

  useEffect(() => {
    if (typeof window === 'undefined') return undefined;
    const bridge = (window as any).electronBridge || (window as any).electronAPI;
    if (bridge?.isMaximized) {
      Promise.resolve(bridge.isMaximized()).then((val: boolean) =>
        setInternalIsMaximized(Boolean(val)),
      );
    }
    if (bridge?.onMaximizedChange) {
      return bridge.onMaximizedChange((max: boolean) => setInternalIsMaximized(max));
    }
    return undefined;
  }, []);

  const effectivelyMaximized = isMaximized || internalIsMaximized;

  const handleMinimize = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (onMinimize) {
      onMinimize();
    }
    if (typeof window !== 'undefined') {
      const bridge = (window as any).electronBridge || (window as any).electronAPI;
      bridge?.minimize?.();
    }
  };

  const handleMaximize = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (onMaximize) {
      onMaximize();
    }
    if (typeof window !== 'undefined') {
      const bridge = (window as any).electronBridge || (window as any).electronAPI;
      bridge?.maximize?.();
    }
  };

  const handleClose = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (onClose) {
      onClose();
    }
    if (typeof window !== 'undefined') {
      const bridge = (window as any).electronBridge || (window as any).electronAPI;
      bridge?.close?.();
    }
  };

  const handleHeaderDoubleClick = (e: React.MouseEvent) => {
    // Only toggle maximize/restore when double-clicking empty header background
    const target = e.target as HTMLElement;
    if (
      target.closest('button, select, input, a, [role="button"], [role="menuitem"], .app-no-drag')
    ) {
      return;
    }
    handleMaximize(e);
  };

  return (
    <header
      style={{ WebkitAppRegion: 'drag' } as React.CSSProperties}
      onDoubleClick={handleHeaderDoubleClick}
      className={cn(
        'flex items-center justify-between h-9 bg-[#282828] border-b border-[#181818] px-2 select-none text-xs text-gray-200 z-30',
        className,
      )}
    >
      {/* Left: App Logo + MenuBar + Mode Switcher + Workspaces */}
      <div
        className="flex items-center gap-3"
        style={{ WebkitAppRegion: 'no-drag' } as React.CSSProperties}
      >
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

        {/* Edit Mode Element Selection Mode Buttons */}
        {viewportMode === 'edit' && editElementModes && onSelectEditElementMode && (
          <ElementModeSelector
            activeModes={editElementModes}
            onSelectMode={onSelectEditElementMode}
            className="hidden md:flex ml-1"
          />
        )}

        {/* Sculpt Mode Top-Bar Tool Controls */}
        {(viewportMode === 'sculpt' || activeWorkspaceId === 'sculpting') && (
          <div className="hidden md:flex items-center ml-1 border-l border-[#3a3a3a] pl-2">
            {sculptTopBar
              ? sculptTopBar
              : activeSculptBrush &&
                sculptBrushConfig &&
                onUpdateSculptBrushConfig &&
                onSelectSculptBrush &&
                sculptSymmetry &&
                onUpdateSculptSymmetry && (
                  <SculptTopBar
                    activeBrush={activeSculptBrush}
                    brushConfig={sculptBrushConfig}
                    onUpdateBrushConfig={onUpdateSculptBrushConfig}
                    onSelectBrush={onSelectSculptBrush}
                    symmetry={sculptSymmetry}
                    onUpdateSymmetry={onUpdateSculptSymmetry}
                  />
                )}
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
      <div
        className="flex items-center gap-2"
        style={{ WebkitAppRegion: 'no-drag' } as React.CSSProperties}
      >
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
        {(onMinimize || onMaximize || onClose || isDesktop) && (
          <div
            style={{ WebkitAppRegion: 'no-drag' } as React.CSSProperties}
            className="app-no-drag flex items-center ml-1 border-l border-[#3e3e3e] -mr-2"
          >
            <button
              type="button"
              onClick={handleMinimize}
              style={{ WebkitAppRegion: 'no-drag' } as React.CSSProperties}
              className="app-no-drag h-9 w-10 flex items-center justify-center text-gray-400 hover:text-white hover:bg-[#383838] transition-colors cursor-pointer select-none"
              title="Minimize to Taskbar"
              aria-label="Minimize"
            >
              <Minus size={14} />
            </button>
            <button
              type="button"
              onClick={handleMaximize}
              style={{ WebkitAppRegion: 'no-drag' } as React.CSSProperties}
              className="app-no-drag h-9 w-10 flex items-center justify-center text-gray-400 hover:text-white hover:bg-[#383838] transition-colors cursor-pointer select-none"
              title={effectivelyMaximized ? 'Restore Down' : 'Maximize'}
              aria-label={effectivelyMaximized ? 'Restore Down' : 'Maximize'}
            >
              {effectivelyMaximized ? (
                <svg
                  width="11"
                  height="11"
                  viewBox="0 0 11 11"
                  fill="none"
                  xmlns="http://www.w3.org/2000/svg"
                  className="stroke-current"
                >
                  <path d="M2.5 1.5H9.5V8.5H8.5V2.5H2.5V1.5Z" fill="currentColor" />
                  <rect
                    x="1.5"
                    y="3.5"
                    width="6.5"
                    height="6.5"
                    stroke="currentColor"
                    strokeWidth="1.2"
                    fill="none"
                  />
                </svg>
              ) : (
                <Square size={11} />
              )}
            </button>
            <button
              type="button"
              onClick={handleClose}
              style={{ WebkitAppRegion: 'no-drag' } as React.CSSProperties}
              className="app-no-drag h-9 w-11 flex items-center justify-center text-gray-400 hover:text-white hover:bg-[#e81123] transition-colors cursor-pointer select-none"
              title="Close Application"
              aria-label="Close"
            >
              <X size={14} />
            </button>
          </div>
        )}
      </div>
    </header>
  );
};
