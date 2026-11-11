import React, { useRef } from 'react';
import {
  Play,
  Pause,
  Square,
  SkipBack,
  SkipForward,
  ChevronLeft,
  ChevronRight,
  Repeat,
  Activity,
} from 'lucide-react';
import { cn } from '../common/Button.js';

export interface TimelineBarProps {
  currentFrame: number;
  startFrame?: number;
  endFrame?: number;
  fps?: number;
  isPlaying?: boolean;
  loop?: boolean;
  onSetFrame: (frame: number) => void;
  onPlay?: () => void;
  onPause?: () => void;
  onStop?: () => void;
  onTogglePlay?: () => void;
  onNextFrame?: () => void;
  onPrevFrame?: () => void;
  onJumpStart?: () => void;
  onJumpEnd?: () => void;
  onToggleLoop?: () => void;
  onChangeStartFrame?: (val: number) => void;
  onChangeEndFrame?: (val: number) => void;
  onChangeFps?: (val: number) => void;
  selectedObjectName?: string;
  selectedObjectType?: string;
  totalVertices?: number;
  totalFaces?: number;
  totalObjects?: number;
  viewportFps?: number;
  className?: string;
}

export const TimelineBar: React.FC<TimelineBarProps> = ({
  currentFrame,
  startFrame = 1,
  endFrame = 250,
  fps = 24,
  isPlaying = false,
  loop = true,
  onSetFrame,
  onTogglePlay,
  onStop,
  onNextFrame,
  onPrevFrame,
  onJumpStart,
  onJumpEnd,
  onToggleLoop,
  onChangeStartFrame,
  onChangeEndFrame,
  onChangeFps,
  selectedObjectName,
  selectedObjectType,
  totalVertices = 8,
  totalFaces = 6,
  totalObjects = 3,
  viewportFps = 60,
  className = '',
}) => {
  const scrubberRef = useRef<HTMLDivElement>(null);

  const handleScrubberMouseDown = (e: React.MouseEvent<HTMLDivElement>) => {
    updateFrameFromMouseEvent(e);

    const handleMouseMove = (moveEvent: MouseEvent) => {
      updateFrameFromMouseEvent(moveEvent);
    };

    const handleMouseUp = () => {
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
    };

    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('mouseup', handleMouseUp);
  };

  const updateFrameFromMouseEvent = (e: MouseEvent | React.MouseEvent) => {
    if (!scrubberRef.current) return;
    const rect = scrubberRef.current.getBoundingClientRect();
    const pos = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width));
    const range = endFrame - startFrame;
    const targetFrame = Math.round(startFrame + pos * range);
    onSetFrame(targetFrame);
  };

  const progressPercent = Math.max(
    0,
    Math.min(100, ((currentFrame - startFrame) / (endFrame - startFrame)) * 100),
  );

  return (
    <footer
      className={cn(
        'flex flex-col bg-[#282828] border-t border-[#181818] select-none text-xs text-gray-200 z-20',
        className,
      )}
    >
      {/* 1. Timeline Controls & Scrubber */}
      <div className="flex items-center h-9 px-3 gap-3">
        {/* Playback Controls */}
        <div className="flex items-center gap-0.5 bg-[#202020] border border-[#3e3e3e] rounded p-0.5">
          <button
            onClick={onJumpStart}
            title="Jump to Start (Shift+Left)"
            className="p-1 rounded text-gray-400 hover:text-white hover:bg-[#383838]"
          >
            <SkipBack size={12} />
          </button>
          <button
            onClick={onPrevFrame}
            title="Previous Frame (Left)"
            className="p-1 rounded text-gray-400 hover:text-white hover:bg-[#383838]"
          >
            <ChevronLeft size={13} />
          </button>
          <button
            onClick={onTogglePlay}
            title="Play / Pause (Space)"
            className={cn('p-1 rounded text-gray-300 hover:text-white hover:bg-[#383838]', {
              'bg-[#4772b3] text-white hover:bg-[#5885c7]': isPlaying,
            })}
          >
            {isPlaying ? (
              <Pause size={12} className="fill-current" />
            ) : (
              <Play size={12} className="fill-current" />
            )}
          </button>
          <button
            onClick={onStop}
            title="Stop"
            className="p-1 rounded text-gray-400 hover:text-white hover:bg-[#383838]"
          >
            <Square size={11} className="fill-current" />
          </button>
          <button
            onClick={onNextFrame}
            title="Next Frame (Right)"
            className="p-1 rounded text-gray-400 hover:text-white hover:bg-[#383838]"
          >
            <ChevronRight size={13} />
          </button>
          <button
            onClick={onJumpEnd}
            title="Jump to End (Shift+Right)"
            className="p-1 rounded text-gray-400 hover:text-white hover:bg-[#383838]"
          >
            <SkipForward size={12} />
          </button>
          <button
            onClick={onToggleLoop}
            title="Loop Playback"
            className={cn('p-1 rounded text-gray-400 hover:text-white hover:bg-[#383838]', {
              'text-[#4772b3]': loop,
            })}
          >
            <Repeat size={12} />
          </button>
        </div>

        {/* Frame range inputs */}
        <div className="flex items-center gap-2">
          {/* Current Frame */}
          <div className="flex items-center gap-1 bg-[#1d1e22] border border-[#3e3e3e] rounded px-1.5 py-0.5">
            <span className="text-[10px] text-gray-400 font-semibold">Frame:</span>
            <input
              type="number"
              value={currentFrame}
              onChange={(e) => onSetFrame(parseInt(e.target.value) || 0)}
              className="w-12 bg-transparent text-right font-mono text-xs text-white focus:outline-none"
            />
          </div>

          {/* Start and End frames */}
          <div className="hidden sm:flex items-center gap-1 text-[11px] text-gray-400">
            <span>Start:</span>
            <input
              type="number"
              value={startFrame}
              onChange={(e) => onChangeStartFrame?.(parseInt(e.target.value) || 1)}
              className="w-10 bg-[#1d1e22] border border-[#3e3e3e] rounded px-1 py-0.5 text-center font-mono text-gray-300 focus:outline-none"
            />
            <span className="ml-1">End:</span>
            <input
              type="number"
              value={endFrame}
              onChange={(e) => onChangeEndFrame?.(parseInt(e.target.value) || 250)}
              className="w-12 bg-[#1d1e22] border border-[#3e3e3e] rounded px-1 py-0.5 text-center font-mono text-gray-300 focus:outline-none"
            />
          </div>

          {/* FPS Selector */}
          {onChangeFps && (
            <select
              value={fps}
              onChange={(e) => onChangeFps(parseInt(e.target.value))}
              className="hidden md:inline bg-[#1d1e22] border border-[#3e3e3e] rounded px-1 py-0.5 text-[11px] text-gray-300 focus:outline-none"
            >
              <option value={24}>24 fps</option>
              <option value={30}>30 fps</option>
              <option value={60}>60 fps</option>
            </select>
          )}
        </div>

        {/* Timeline Scrubber Track */}
        <div
          ref={scrubberRef}
          onMouseDown={handleScrubberMouseDown}
          className="flex-1 h-5 bg-[#1d1e22] rounded border border-[#3e3e3e] relative cursor-pointer overflow-hidden group shadow-inner"
        >
          {/* Subtle frame ticks background */}
          <div className="absolute inset-0 flex justify-between pointer-events-none opacity-20 px-2">
            {Array.from({ length: 11 }).map((_, i) => (
              <div key={i} className="h-full w-[1px] bg-gray-500" />
            ))}
          </div>

          {/* Progress bar */}
          <div
            className="h-full bg-[#4772b3]/25 transition-all duration-75 pointer-events-none"
            style={{ width: `${progressPercent}%` }}
          />

          {/* Playhead thumb line */}
          <div
            className="absolute top-0 bottom-0 w-1 bg-[#4772b3] pointer-events-none transform -translate-x-1/2 flex items-center justify-center shadow-md"
            style={{ left: `${progressPercent}%` }}
          >
            <div className="w-2.5 h-2.5 bg-white rounded-full shadow-xs" />
          </div>
        </div>
      </div>

      {/* 2. Integrated Status Bar */}
      <div className="flex items-center justify-between h-5 bg-[#202020] border-t border-[#181818] px-3 text-[10px] text-gray-400 font-mono">
        {/* Left: Active object selection */}
        <div className="flex items-center gap-3">
          {selectedObjectName ? (
            <div className="flex items-center gap-1.5">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
              <span className="text-gray-300 font-medium">Selected: {selectedObjectName}</span>
              {selectedObjectType && (
                <span className="text-gray-500 capitalize">({selectedObjectType})</span>
              )}
            </div>
          ) : (
            <span className="text-gray-500 italic">No Selection</span>
          )}
        </div>

        {/* Right: Scene stats and Viewport FPS */}
        <div className="flex items-center gap-4">
          <div className="hidden sm:flex items-center gap-2 text-gray-400">
            <span>Objects: {totalObjects}</span>
            <span>•</span>
            <span>Verts: {totalVertices}</span>
            <span>•</span>
            <span>Faces: {totalFaces}</span>
          </div>

          <div className="flex items-center gap-1 text-emerald-400">
            <Activity size={10} />
            <span>{viewportFps.toFixed(1)} FPS</span>
          </div>
        </div>
      </div>
    </footer>
  );
};
