import React, { useState, useEffect, useMemo, useCallback } from 'react';
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
  Circle,
  Clock,
  Film,
  Activity,
} from 'lucide-react';
import { timelineStore } from '@blender-elt/animation';
import { cn } from '../common/Button.js';
import { TimelineBar } from './TimelineBar.js';
import { DopeSheetView, type DopeSheetChannel } from './DopeSheetView.js';
import { GraphEditorView } from './GraphEditorView.js';

export type AnimationEditorTab = 'timeline' | 'dopesheet' | 'grapheditor';

export interface AnimationBottomPanelProps {
  activeTab?: AnimationEditorTab;
  onTabChange?: (tab: AnimationEditorTab) => void;
  currentFrame?: number;
  startFrame?: number;
  endFrame?: number;
  fps?: number;
  isPlaying?: boolean;
  loop?: boolean;
  autoKeying?: boolean;
  onSetFrame?: (frame: number) => void;
  onTogglePlay?: () => void;
  onStop?: () => void;
  onNextFrame?: () => void;
  onPrevFrame?: () => void;
  onJumpStart?: () => void;
  onJumpEnd?: () => void;
  onNextKeyframe?: () => void;
  onPrevKeyframe?: () => void;
  onToggleLoop?: () => void;
  onToggleAutoKeying?: () => void;
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

export const AnimationBottomPanel: React.FC<AnimationBottomPanelProps> = ({
  activeTab: propsActiveTab,
  onTabChange,
  currentFrame: propsCurrentFrame,
  startFrame: propsStartFrame,
  endFrame: propsEndFrame,
  fps: propsFps,
  isPlaying: propsIsPlaying,
  loop: propsLoop,
  autoKeying: propsAutoKeying,
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
  onToggleAutoKeying,
  onChangeStartFrame,
  onChangeEndFrame,
  onChangeFps,
  selectedObjectName,
  selectedObjectType,
  totalVertices,
  totalFaces,
  totalObjects,
  viewportFps,
  className = '',
}) => {
  const [localActiveTab, setLocalActiveTab] = useState<AnimationEditorTab>('timeline');
  const activeTab = propsActiveTab ?? localActiveTab;

  const handleTabSelect = (tab: AnimationEditorTab) => {
    if (onTabChange) onTabChange(tab);
    else setLocalActiveTab(tab);
  };

  // Subscribe to timelineStore
  const [storeState, setStoreState] = useState(() => timelineStore.getState());
  useEffect(() => {
    const unsub = timelineStore.subscribe((state) => setStoreState(state));
    return () => unsub();
  }, []);

  const currentFrame = propsCurrentFrame ?? storeState.currentFrame;
  const startFrame = propsStartFrame ?? storeState.startFrame;
  const endFrame = propsEndFrame ?? storeState.endFrame;
  const fps = propsFps ?? storeState.fps;
  const isPlaying = propsIsPlaying ?? storeState.isPlaying;
  const loop = propsLoop ?? storeState.loop;
  const autoKeying = propsAutoKeying ?? storeState.autoKeyingEnabled;

  // Derive channels and keyframe markers for TimelineBar
  const activeChannels: DopeSheetChannel[] = useMemo(() => {
    const actId = storeState.activeActionId;
    if (actId && storeState.actions[actId]) {
      return storeState.actions[actId].channels.map((c) => ({
        id: c.id,
        name: c.name,
        targetNodeId: c.targetNodeId,
        propertyPath: c.propertyPath,
        keyframes: c.keyframes,
        color: c.color,
        muted: c.muted,
        locked: c.locked,
      }));
    }
    if (storeState.tracks.length > 0) {
      return storeState.tracks.map((t) => ({
        id: t.id,
        name: t.name || t.property,
        targetNodeId: t.targetNodeId,
        propertyPath: t.propertyPath || t.property,
        keyframes: t.keyframes,
        color: t.color,
        muted: t.muted,
        locked: t.locked,
      }));
    }
    return [];
  }, [storeState.actions, storeState.activeActionId, storeState.tracks]);

  const keyframeMarkers = useMemo(() => {
    const set = new Set<number>();
    activeChannels.forEach((c) => {
      c.keyframes.forEach((k) => set.add(k.frame));
    });
    return Array.from(set).sort((a, b) => a - b);
  }, [activeChannels]);

  // Transport handlers
  const handleSetFrame = useCallback(
    (frame: number) => {
      if (onSetFrame) onSetFrame(frame);
      else timelineStore.getState().setFrame(frame);
    },
    [onSetFrame],
  );

  const handleTogglePlay = useCallback(() => {
    if (onTogglePlay) onTogglePlay();
    else timelineStore.getState().togglePlay();
  }, [onTogglePlay]);

  const handleStop = useCallback(() => {
    if (onStop) onStop();
    else timelineStore.getState().stop();
  }, [onStop]);

  const handleNextFrame = useCallback(() => {
    if (onNextFrame) onNextFrame();
    else timelineStore.getState().nextFrame();
  }, [onNextFrame]);

  const handlePrevFrame = useCallback(() => {
    if (onPrevFrame) onPrevFrame();
    else timelineStore.getState().prevFrame();
  }, [onPrevFrame]);

  const handleJumpStart = useCallback(() => {
    if (onJumpStart) onJumpStart();
    else timelineStore.getState().jumpToStart();
  }, [onJumpStart]);

  const handleJumpEnd = useCallback(() => {
    if (onJumpEnd) onJumpEnd();
    else timelineStore.getState().jumpToEnd();
  }, [onJumpEnd]);

  const handleToggleLoop = useCallback(() => {
    if (onToggleLoop) onToggleLoop();
    else timelineStore.getState().setLoop(!loop);
  }, [onToggleLoop, loop]);

  const handleToggleAutoKeying = useCallback(() => {
    if (onToggleAutoKeying) onToggleAutoKeying();
    else timelineStore.getState().setAutoKeying(!autoKeying);
  }, [onToggleAutoKeying, autoKeying]);

  const handlePrevKeyframe = useCallback(() => {
    if (onPrevKeyframe) {
      onPrevKeyframe();
      return;
    }
    const prevKeys = keyframeMarkers.filter((f) => f < currentFrame);
    if (prevKeys.length > 0) {
      handleSetFrame(prevKeys[prevKeys.length - 1]);
    } else {
      handleSetFrame(startFrame);
    }
  }, [onPrevKeyframe, keyframeMarkers, currentFrame, handleSetFrame, startFrame]);

  const handleNextKeyframe = useCallback(() => {
    if (onNextKeyframe) {
      onNextKeyframe();
      return;
    }
    const nextKeys = keyframeMarkers.filter((f) => f > currentFrame);
    if (nextKeys.length > 0) {
      handleSetFrame(nextKeys[0]);
    } else {
      handleSetFrame(endFrame);
    }
  }, [onNextKeyframe, keyframeMarkers, currentFrame, handleSetFrame, endFrame]);

  const handleChangeStart = useCallback(
    (val: number) => {
      if (onChangeStartFrame) onChangeStartFrame(val);
      else timelineStore.getState().setFrameRange(val, endFrame);
    },
    [onChangeStartFrame, endFrame],
  );

  const handleChangeEnd = useCallback(
    (val: number) => {
      if (onChangeEndFrame) onChangeEndFrame(val);
      else timelineStore.getState().setFrameRange(startFrame, val);
    },
    [onChangeEndFrame, startFrame],
  );

  const handleChangeFps = useCallback(
    (val: number) => {
      if (onChangeFps) onChangeFps(val);
      else timelineStore.getState().setFps(val);
    },
    [onChangeFps],
  );

  return (
    <div
      data-testid="animation-bottom-panel"
      className={cn(
        'flex flex-col bg-[#242424] border-t border-[#181818] select-none text-xs text-gray-200 z-20 overflow-hidden',
        activeTab === 'timeline' ? 'h-auto' : 'h-64 sm:h-72 md:h-80',
        className,
      )}
    >
      {/* 1. Shared Unified Top Navigation Toolbar */}
      <div className="flex items-center justify-between h-8 px-2.5 bg-[#282828] border-b border-[#181818] shrink-0">
        {/* Left: Tab Switcher Buttons */}
        <div className="flex items-center gap-1">
          <button
            onClick={() => handleTabSelect('timeline')}
            data-testid="tab-timeline"
            className={cn(
              'flex items-center gap-1.5 px-2.5 py-1 rounded text-[11px] font-medium transition-colors',
              activeTab === 'timeline'
                ? 'bg-[#383838] text-white shadow-xs border-b-2 border-[#4772b3]'
                : 'text-gray-400 hover:text-white hover:bg-[#303030]',
            )}
          >
            <Clock size={12} className={activeTab === 'timeline' ? 'text-[#4772b3]' : ''} />
            <span>Timeline</span>
          </button>

          <button
            onClick={() => handleTabSelect('dopesheet')}
            data-testid="tab-dopesheet"
            className={cn(
              'flex items-center gap-1.5 px-2.5 py-1 rounded text-[11px] font-medium transition-colors',
              activeTab === 'dopesheet'
                ? 'bg-[#383838] text-white shadow-xs border-b-2 border-[#4772b3]'
                : 'text-gray-400 hover:text-white hover:bg-[#303030]',
            )}
          >
            <Film size={12} className={activeTab === 'dopesheet' ? 'text-[#4772b3]' : ''} />
            <span>Dope Sheet</span>
          </button>

          <button
            onClick={() => handleTabSelect('grapheditor')}
            data-testid="tab-grapheditor"
            className={cn(
              'flex items-center gap-1.5 px-2.5 py-1 rounded text-[11px] font-medium transition-colors',
              activeTab === 'grapheditor'
                ? 'bg-[#383838] text-white shadow-xs border-b-2 border-[#4772b3]'
                : 'text-gray-400 hover:text-white hover:bg-[#303030]',
            )}
          >
            <Activity size={12} className={activeTab === 'grapheditor' ? 'text-[#38a169]' : ''} />
            <span>Graph Editor</span>
          </button>
        </div>

        {/* Center: Full Shared Transport Controls (Visible in Dope Sheet & Graph Editor tabs) */}
        {activeTab !== 'timeline' && (
          <div className="flex items-center gap-1 bg-[#1e1e1e] border border-[#3e3e3e] rounded p-0.5">
            {/* Auto-Keying Button */}
            <button
              onClick={handleToggleAutoKeying}
              title={`Auto-Keying (${autoKeying ? 'Enabled' : 'Disabled'}) (Shift+Alt+K)`}
              aria-label="Auto-Keying"
              className={cn(
                'p-1 rounded transition-colors',
                autoKeying
                  ? 'bg-red-600/30 text-red-400'
                  : 'text-gray-400 hover:text-white hover:bg-[#383838]',
              )}
            >
              <Circle size={11} className={cn(autoKeying && 'fill-red-500 text-red-500')} />
            </button>

            <button
              onClick={handleJumpStart}
              title="Jump to Start (Shift+Left)"
              className="p-1 rounded text-gray-400 hover:text-white hover:bg-[#383838]"
            >
              <SkipBack size={11} />
            </button>
            <button
              onClick={handlePrevKeyframe}
              title="Previous Keyframe (Down)"
              className="p-1 rounded text-gray-400 hover:text-white hover:bg-[#383838]"
            >
              <ChevronsLeft size={12} />
            </button>
            <button
              onClick={handlePrevFrame}
              title="Previous Frame (Left)"
              className="p-1 rounded text-gray-400 hover:text-white hover:bg-[#383838]"
            >
              <ChevronLeft size={12} />
            </button>
            <button
              onClick={handleTogglePlay}
              title="Play / Pause (Space)"
              className={cn('p-1 rounded text-gray-300 hover:text-white hover:bg-[#383838]', {
                'bg-[#4772b3] text-white': isPlaying,
              })}
            >
              {isPlaying ? (
                <Pause size={11} className="fill-current" />
              ) : (
                <Play size={11} className="fill-current" />
              )}
            </button>
            <button
              onClick={handleStop}
              title="Stop"
              className="p-1 rounded text-gray-400 hover:text-white hover:bg-[#383838]"
            >
              <Square size={10} className="fill-current" />
            </button>
            <button
              onClick={handleNextFrame}
              title="Next Frame (Right)"
              className="p-1 rounded text-gray-400 hover:text-white hover:bg-[#383838]"
            >
              <ChevronRight size={12} />
            </button>
            <button
              onClick={handleNextKeyframe}
              title="Next Keyframe (Up)"
              className="p-1 rounded text-gray-400 hover:text-white hover:bg-[#383838]"
            >
              <ChevronsRight size={12} />
            </button>
            <button
              onClick={handleJumpEnd}
              title="Jump to End (Shift+Right)"
              className="p-1 rounded text-gray-400 hover:text-white hover:bg-[#383838]"
            >
              <SkipForward size={11} />
            </button>
            <button
              onClick={handleToggleLoop}
              title="Loop Playback"
              className={cn('p-1 rounded text-gray-400 hover:text-white hover:bg-[#383838]', {
                'text-[#4772b3] bg-[#4772b3]/20': loop,
              })}
            >
              <Repeat size={11} />
            </button>
          </div>
        )}

        {/* Right: Frame Range & FPS (Visible in Dope Sheet & Graph Editor tabs) */}
        {activeTab !== 'timeline' && (
          <div className="flex items-center gap-2">
            <div className="flex items-center gap-1 bg-[#1e1e1e] border border-[#3e3e3e] rounded px-1.5 py-0.5">
              <span className="text-[10px] text-gray-400 font-semibold">Frame:</span>
              <input
                type="number"
                value={currentFrame}
                onChange={(e) => handleSetFrame(parseInt(e.target.value) || 0)}
                className="w-10 bg-transparent text-right font-mono text-[11px] text-white focus:outline-none"
              />
            </div>

            <div className="hidden sm:flex items-center gap-1 text-[10px] text-gray-400">
              <span>Start:</span>
              <input
                type="number"
                value={startFrame}
                onChange={(e) => handleChangeStart(parseInt(e.target.value) || 1)}
                className="w-9 bg-[#1e1e1e] border border-[#3e3e3e] rounded px-1 py-0.5 text-center font-mono text-gray-300 focus:outline-none"
              />
              <span>End:</span>
              <input
                type="number"
                value={endFrame}
                onChange={(e) => handleChangeEnd(parseInt(e.target.value) || 250)}
                className="w-10 bg-[#1e1e1e] border border-[#3e3e3e] rounded px-1 py-0.5 text-center font-mono text-gray-300 focus:outline-none"
              />
            </div>

            <select
              value={fps}
              onChange={(e) => handleChangeFps(parseInt(e.target.value))}
              className="bg-[#1e1e1e] border border-[#3e3e3e] rounded px-1 py-0.5 text-[10px] text-gray-300 focus:outline-none cursor-pointer"
            >
              <option value={24}>24 fps</option>
              <option value={30}>30 fps</option>
              <option value={60}>60 fps</option>
            </select>
          </div>
        )}
      </div>

      {/* 2. Active Tab Viewport Area */}
      <div className="flex-1 overflow-hidden relative">
        {activeTab === 'timeline' && (
          <TimelineBar
            currentFrame={currentFrame}
            startFrame={startFrame}
            endFrame={endFrame}
            fps={fps}
            isPlaying={isPlaying}
            loop={loop}
            autoKeying={autoKeying}
            keyframeMarkers={keyframeMarkers}
            onSetFrame={handleSetFrame}
            onTogglePlay={handleTogglePlay}
            onStop={handleStop}
            onNextFrame={handleNextFrame}
            onPrevFrame={handlePrevFrame}
            onJumpStart={handleJumpStart}
            onJumpEnd={handleJumpEnd}
            onNextKeyframe={handleNextKeyframe}
            onPrevKeyframe={handlePrevKeyframe}
            onToggleLoop={handleToggleLoop}
            onToggleAutoKeying={handleToggleAutoKeying}
            onChangeStartFrame={handleChangeStart}
            onChangeEndFrame={handleChangeEnd}
            onChangeFps={handleChangeFps}
            selectedObjectName={selectedObjectName}
            selectedObjectType={selectedObjectType}
            totalVertices={totalVertices}
            totalFaces={totalFaces}
            totalObjects={totalObjects}
            viewportFps={viewportFps}
          />
        )}

        {activeTab === 'dopesheet' && (
          <DopeSheetView
            currentFrame={currentFrame}
            startFrame={startFrame}
            endFrame={endFrame}
            fps={fps}
            onSetFrame={handleSetFrame}
            selectedObjectName={selectedObjectName}
            channels={activeChannels}
          />
        )}

        {activeTab === 'grapheditor' && (
          <GraphEditorView
            currentFrame={currentFrame}
            startFrame={startFrame}
            endFrame={endFrame}
            fps={fps}
            onSetFrame={handleSetFrame}
            selectedObjectName={selectedObjectName}
            channels={activeChannels}
          />
        )}
      </div>
    </div>
  );
};
