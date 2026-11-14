import React, { useRef } from 'react';
import {
  Play,
  Pause,
  Square,
  SkipBack,
  SkipForward,
  ChevronLeft,
  ChevronRight,
  ChevronsLeft,
  ChevronsRight,
  Repeat,
  Activity,
  Circle,
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
  onNextKeyframe?: () => void;
  onPrevKeyframe?: () => void;
  onToggleLoop?: () => void;
  onChangeStartFrame?: (val: number) => void;
  onChangeEndFrame?: (val: number) => void;
  onChangeFps?: (val: number) => void;
  autoKeying?: boolean;
  onToggleAutoKeying?: () => void;
  keyframeMarkers?: number[];
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
  onNextKeyframe,
  onPrevKeyframe,
  onToggleLoop,
  onChangeStartFrame,
  onChangeEndFrame,
  onChangeFps,
  autoKeying = false,
  onToggleAutoKeying,
  keyframeMarkers = [],
  selectedObjectName,
  selectedObjectType,
  totalVertices = 8,
  totalFaces = 6,
  totalObjects = 3,
  viewportFps = 60,
  className = '',
}) => {
  const scrubberRef = useRef<HTMLDivElement>(null);

  // Helper for Prev Keyframe
  const handlePrevKeyframe = () => {
    if (onPrevKeyframe) {
      onPrevKeyframe();
      return;
    }
    if (keyframeMarkers.length > 0) {
      const sorted = [...keyframeMarkers].sort((a, b) => a - b);
      const prevKeys = sorted.filter((f) => f < currentFrame);
      if (prevKeys.length > 0) {
        onSetFrame(prevKeys[prevKeys.length - 1]);
      } else {
        onSetFrame(startFrame);
      }
    }
  };

  // Helper for Next Keyframe
  const handleNextKeyframe = () => {
    if (onNextKeyframe) {
      onNextKeyframe();
      return;
    }
    if (keyframeMarkers.length > 0) {
      const sorted = [...keyframeMarkers].sort((a, b) => a - b);
      const nextKeys = sorted.filter((f) => f > currentFrame);
      if (nextKeys.length > 0) {
        onSetFrame(nextKeys[0]);
      } else {
        onSetFrame(endFrame);
      }
    }
  };

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
    const range = Math.max(1, endFrame - startFrame);
    const targetFrame = Math.round(startFrame + pos * range);
    onSetFrame(targetFrame);
  };

  const range = Math.max(1, endFrame - startFrame);
  const progressPercent = Math.max(0, Math.min(100, ((currentFrame - startFrame) / range) * 100));

  // Deduplicate and filter markers within active range
  const uniqueMarkers = Array.from(new Set(keyframeMarkers))
    .filter((f) => f >= startFrame && f <= endFrame)
    .sort((a, b) => a - b);

  return (
    <footer
      className={cn(
        'flex flex-col bg-[#282828] border-t border-[#181818] select-none text-xs text-gray-200 z-20',
        className,
      )}
    >
      {/* 1. Timeline Controls & Scrubber */}
      <div className="flex items-center h-9 px-3 gap-3">
        {/* Auto-Keying Button */}
        <button
          onClick={onToggleAutoKeying}
          title={`Auto-Keying (${autoKeying ? 'Enabled' : 'Disabled'}) (Shift+Alt+K)`}
          aria-label="Auto-Keying"
          data-active={autoKeying}
          className={cn(
            'flex items-center justify-center w-7 h-7 rounded border transition-colors',
            autoKeying
              ? 'bg-red-600/30 border-red-500 text-red-400 hover:bg-red-600/50 hover:text-red-300 shadow-sm'
              : 'bg-[#202020] border-[#3e3e3e] text-gray-400 hover:text-white hover:bg-[#383838]',
          )}
        >
          <Circle
            size={12}
            className={cn(
              'transition-transform',
              autoKeying && 'fill-red-500 text-red-500 scale-110',
            )}
          />
        </button>

        {/* Playback & Transport Controls */}
        <div className="flex items-center gap-0.5 bg-[#202020] border border-[#3e3e3e] rounded p-0.5">
          {/* Jump Start (Shift+Left) */}
          <button
            onClick={onJumpStart}
            title="Jump to Start (Shift+Left)"
            aria-label="Jump to Start"
            className="p-1 rounded text-gray-400 hover:text-white hover:bg-[#383838]"
          >
            <SkipBack size={12} />
          </button>

          {/* Prev Keyframe (Down) */}
          <button
            onClick={handlePrevKeyframe}
            title="Previous Keyframe (Down)"
            aria-label="Previous Keyframe"
            className="p-1 rounded text-gray-400 hover:text-white hover:bg-[#383838]"
          >
            <ChevronsLeft size={13} />
          </button>

          {/* Prev Frame (Left) */}
          <button
            onClick={onPrevFrame}
            title="Previous Frame (Left)"
            aria-label="Previous Frame"
            className="p-1 rounded text-gray-400 hover:text-white hover:bg-[#383838]"
          >
            <ChevronLeft size={13} />
          </button>

          {/* Play / Pause (Space) */}
          <button
            onClick={onTogglePlay}
            title="Play / Pause (Space)"
            aria-label="Play / Pause"
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

          {/* Stop */}
          <button
            onClick={onStop}
            title="Stop"
            aria-label="Stop"
            className="p-1 rounded text-gray-400 hover:text-white hover:bg-[#383838]"
          >
            <Square size={11} className="fill-current" />
          </button>

          {/* Next Frame (Right) */}
          <button
            onClick={onNextFrame}
            title="Next Frame (Right)"
            aria-label="Next Frame"
            className="p-1 rounded text-gray-400 hover:text-white hover:bg-[#383838]"
          >
            <ChevronRight size={13} />
          </button>

          {/* Next Keyframe (Up) */}
          <button
            onClick={handleNextKeyframe}
            title="Next Keyframe (Up)"
            aria-label="Next Keyframe"
            className="p-1 rounded text-gray-400 hover:text-white hover:bg-[#383838]"
          >
            <ChevronsRight size={13} />
          </button>

          {/* Jump End (Shift+Right) */}
          <button
            onClick={onJumpEnd}
            title="Jump to End (Shift+Right)"
            aria-label="Jump to End"
            className="p-1 rounded text-gray-400 hover:text-white hover:bg-[#383838]"
          >
            <SkipForward size={12} />
          </button>

          {/* Loop toggle */}
          <button
            onClick={onToggleLoop}
            title="Loop Playback"
            aria-label="Loop Playback"
            className={cn('p-1 rounded text-gray-400 hover:text-white hover:bg-[#383838]', {
              'text-[#4772b3] bg-[#4772b3]/20': loop,
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
              aria-label="Current Frame"
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
              aria-label="Start Frame"
              value={startFrame}
              onChange={(e) => onChangeStartFrame?.(parseInt(e.target.value) || 1)}
              className="w-10 bg-[#1d1e22] border border-[#3e3e3e] rounded px-1 py-0.5 text-center font-mono text-gray-300 focus:outline-none"
            />
            <span className="ml-1">End:</span>
            <input
              type="number"
              aria-label="End Frame"
              value={endFrame}
              onChange={(e) => onChangeEndFrame?.(parseInt(e.target.value) || 250)}
              className="w-12 bg-[#1d1e22] border border-[#3e3e3e] rounded px-1 py-0.5 text-center font-mono text-gray-300 focus:outline-none"
            />
          </div>

          {/* FPS Selector */}
          {onChangeFps && (
            <select
              aria-label="FPS Selector"
              value={fps}
              onChange={(e) => onChangeFps(parseInt(e.target.value))}
              className="hidden md:inline bg-[#1d1e22] border border-[#3e3e3e] rounded px-1 py-0.5 text-[11px] text-gray-300 focus:outline-none cursor-pointer"
            >
              <option value={24}>24 fps</option>
              <option value={30}>30 fps</option>
              <option value={60}>60 fps</option>
            </select>
          )}
        </div>

        {/* Timeline Scrubber Track with Keyframe Markers */}
        <div
          ref={scrubberRef}
          onMouseDown={handleScrubberMouseDown}
          role="slider"
          aria-label="Timeline Scrubber"
          aria-valuenow={currentFrame}
          aria-valuemin={startFrame}
          aria-valuemax={endFrame}
          className="flex-1 h-5 bg-[#1d1e22] rounded border border-[#3e3e3e] relative cursor-pointer overflow-hidden group shadow-inner"
        >
          {/* Subtle frame ticks background */}
          <div className="absolute inset-0 flex justify-between pointer-events-none opacity-20 px-2">
            {Array.from({ length: 11 }).map((_, i) => (
              <div key={i} className="h-full w-[1px] bg-gray-500" />
            ))}
          </div>

          {/* Keyframe Markers (vertical ticks or dots on scrubber track) */}
          {uniqueMarkers.map((frame) => {
            const markerPct = ((frame - startFrame) / range) * 100;
            return (
              <div
                key={frame}
                data-testid={`keyframe-marker-${frame}`}
                title={`Keyframe at frame ${frame}`}
                onClick={(e) => {
                  e.stopPropagation();
                  onSetFrame(frame);
                }}
                style={{ left: `${markerPct}%` }}
                className="absolute top-0 bottom-0 w-[3px] bg-amber-400 hover:bg-yellow-200 transform -translate-x-1/2 z-10 cursor-pointer shadow-[0_0_2px_rgba(245,158,11,0.8)]"
              >
                {/* Diamond dot in center of marker */}
                <div className="w-1.5 h-1.5 bg-amber-300 rotate-45 absolute top-1/2 -translate-y-1/2 -translate-x-[2px] rounded-xs shadow-xs" />
              </div>
            );
          })}

          {/* Progress bar */}
          <div
            className="h-full bg-[#4772b3]/25 transition-all duration-75 pointer-events-none"
            style={{ width: `${progressPercent}%` }}
          />

          {/* Playhead thumb line */}
          <div
            className="absolute top-0 bottom-0 w-1 bg-[#4772b3] pointer-events-none transform -translate-x-1/2 flex items-center justify-center shadow-md z-20"
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
