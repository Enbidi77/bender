import React, { useState, useRef, useEffect, useMemo, useCallback } from 'react';
import {
  ChevronDown,
  ChevronRight,
  Eye,
  EyeOff,
  Lock,
  Unlock,
  Trash2,
  Home,
  ZoomIn,
  ZoomOut,
  Film,
  Box,
} from 'lucide-react';
import type { IKeyframe, IAnimationAction } from '@blender-elt/contracts';
import { timelineStore } from '@blender-elt/animation';
import { cn } from '../common/Button.js';

export interface DopeSheetChannel {
  id: string;
  name: string;
  targetNodeId: string;
  propertyPath: string;
  keyframes: IKeyframe[];
  color?: string;
  muted?: boolean;
  locked?: boolean;
}

export interface DopeSheetViewProps {
  currentFrame?: number;
  startFrame?: number;
  endFrame?: number;
  fps?: number;
  onSetFrame?: (frame: number) => void;
  selectedObjectName?: string;
  selectedObjectId?: string;
  action?: IAnimationAction | null;
  channels?: DopeSheetChannel[];
  selectedKeyframeIds?: Set<string>;
  onSelectKeyframe?: (keyframeId: string, multiSelect?: boolean) => void;
  onClearSelection?: () => void;
  onMoveKeyframes?: (
    moves: Array<{ channelId: string; oldFrame: number; newFrame: number }>,
  ) => void;
  onDeleteKeyframes?: (keyframeIds: string[]) => void;
  onToggleMuteChannel?: (channelId: string) => void;
  onToggleLockChannel?: (channelId: string) => void;
  className?: string;
}

/**
 * Returns Blender-style axis color
 */
export function getChannelColor(propertyPath: string, fallbackColor?: string): string {
  if (fallbackColor && fallbackColor !== '#4772b3') return fallbackColor;
  const lower = propertyPath.toLowerCase();
  if (lower.endsWith('.x') || lower.endsWith('.r') || lower.includes('position x'))
    return '#e53e3e';
  if (lower.endsWith('.y') || lower.endsWith('.g') || lower.includes('position y'))
    return '#38a169';
  if (lower.endsWith('.z') || lower.endsWith('.b') || lower.includes('position z'))
    return '#3182ce';
  if (lower.endsWith('.w')) return '#d69e2e';
  return fallbackColor || '#4772b3';
}

/**
 * Generates or normalizes unique keyframe ID
 */
export function getKeyframeId(channelId: string, kf: IKeyframe): string {
  return kf.id || `${channelId}_${kf.frame}`;
}

export const DopeSheetView: React.FC<DopeSheetViewProps> = ({
  currentFrame: propsCurrentFrame,
  startFrame: propsStartFrame,
  endFrame: propsEndFrame,
  onSetFrame,
  selectedObjectName = 'Selected Object',
  action: propsAction,
  channels: propsChannels,
  selectedKeyframeIds: propsSelectedKeyframeIds,
  onSelectKeyframe,
  onClearSelection,
  onMoveKeyframes,
  onDeleteKeyframes,
  onToggleMuteChannel,
  onToggleLockChannel,
  className = '',
}) => {
  // Local state for view navigation
  const [pixelsPerFrame, setPixelsPerFrame] = useState<number>(10);
  const [scrollOffsetFrames, setScrollOffsetFrames] = useState<number>(0);
  const [treeExpanded, setTreeExpanded] = useState<Record<string, boolean>>({
    object: true,
    action: true,
  });

  // Local selection state if not controlled
  const [localSelectedKeys, setLocalSelectedKeys] = useState<Set<string>>(new Set());

  // Retiming & drag states
  const [draggingKeys, setDraggingKeys] = useState<Array<{
    keyId: string;
    channelId: string;
    originalFrame: number;
    currentFrame: number;
  }> | null>(null);

  // Marquee box selection state
  const [boxSelectStart, setBoxSelectStart] = useState<{ x: number; y: number } | null>(null);
  const [boxSelectCurrent, setBoxSelectCurrent] = useState<{ x: number; y: number } | null>(null);

  const containerRef = useRef<HTMLDivElement>(null);
  const canvasAreaRef = useRef<HTMLDivElement>(null);

  // Subscribe to timelineStore when not controlled
  const [storeState, setStoreState] = useState(() => timelineStore.getState());

  useEffect(() => {
    const unsubscribe = timelineStore.subscribe((state) => {
      setStoreState(state);
    });
    return () => unsubscribe();
  }, []);

  const currentFrame = propsCurrentFrame ?? storeState.currentFrame;
  const startFrame = propsStartFrame ?? storeState.startFrame;
  const endFrame = propsEndFrame ?? storeState.endFrame;
  const effectiveSelectedKeys =
    propsSelectedKeyframeIds ??
    (storeState.selectedKeyframeIds.size > 0 ? storeState.selectedKeyframeIds : localSelectedKeys);

  // Derive channels from props or active action in store
  const activeChannels: DopeSheetChannel[] = useMemo(() => {
    if (propsChannels && propsChannels.length > 0) {
      return propsChannels;
    }
    if (propsAction && propsAction.channels.length > 0) {
      return propsAction.channels.map((c) => ({
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
    // Look into timelineStore
    const activeActId = storeState.activeActionId;
    if (activeActId && storeState.actions[activeActId]) {
      return storeState.actions[activeActId].channels.map((c) => ({
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
    // Fall back to legacy tracks
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
  }, [
    propsChannels,
    propsAction,
    storeState.actions,
    storeState.activeActionId,
    storeState.tracks,
  ]);

  const activeActionName =
    propsAction?.name ||
    (storeState.activeActionId ? storeState.actions[storeState.activeActionId]?.name : 'Action');

  // Summary row keyframes: aggregated unique frames across all channels
  const summaryFrames = useMemo(() => {
    const frameMap = new Map<number, Array<{ channelId: string; keyframe: IKeyframe }>>();
    for (const channel of activeChannels) {
      for (const kf of channel.keyframes) {
        const list = frameMap.get(kf.frame) || [];
        list.push({ channelId: channel.id, keyframe: kf });
        frameMap.set(kf.frame, list);
      }
    }
    return Array.from(frameMap.entries())
      .map(([frame, entries]) => ({ frame, entries }))
      .sort((a, b) => a.frame - b.frame);
  }, [activeChannels]);

  // Coordinate conversions
  const frameToPx = useCallback(
    (frame: number) => {
      return (frame - scrollOffsetFrames) * pixelsPerFrame;
    },
    [scrollOffsetFrames, pixelsPerFrame],
  );

  const pxToFrame = useCallback(
    (px: number) => {
      return Math.round(scrollOffsetFrames + px / pixelsPerFrame);
    },
    [scrollOffsetFrames, pixelsPerFrame],
  );

  // Frame All: Auto-fit viewport to keyframes
  const handleFrameAll = useCallback(() => {
    const allFrames = activeChannels.flatMap((c) => c.keyframes.map((k) => k.frame));
    if (allFrames.length === 0) {
      setScrollOffsetFrames(startFrame - 2);
      setPixelsPerFrame(12);
      return;
    }
    const minF = Math.min(...allFrames, startFrame);
    const maxF = Math.max(...allFrames, endFrame);
    const span = Math.max(10, maxF - minF + 10);
    const containerWidth = canvasAreaRef.current?.clientWidth || 800;
    const newPpf = Math.max(3, Math.min(40, (containerWidth - 60) / span));
    setPixelsPerFrame(newPpf);
    setScrollOffsetFrames(minF - 5);
  }, [activeChannels, startFrame, endFrame]);

  // Zoom controls
  const handleZoom = (delta: number) => {
    setPixelsPerFrame((prev) => Math.max(2, Math.min(50, prev * delta)));
  };

  // Selection dispatch
  const selectKey = useCallback(
    (keyId: string, multi: boolean = false) => {
      if (onSelectKeyframe) {
        onSelectKeyframe(keyId, multi);
      } else {
        timelineStore.getState().selectKeyframe(keyId, multi);
        setLocalSelectedKeys((prev) => {
          const next = multi ? new Set(prev) : new Set<string>();
          next.add(keyId);
          return next;
        });
      }
    },
    [onSelectKeyframe],
  );

  const clearSelection = useCallback(() => {
    if (onClearSelection) {
      onClearSelection();
    } else {
      timelineStore.getState().clearKeyframeSelection();
      setLocalSelectedKeys(new Set());
    }
  }, [onClearSelection]);

  // Delete selected keys
  const handleDeleteSelected = useCallback(() => {
    const idsToDelete = Array.from(effectiveSelectedKeys);
    if (idsToDelete.length === 0) return;

    if (onDeleteKeyframes) {
      onDeleteKeyframes(idsToDelete);
    } else {
      // Apply deletion in timelineStore
      for (const channel of activeChannels) {
        for (const kf of channel.keyframes) {
          const kid = getKeyframeId(channel.id, kf);
          if (effectiveSelectedKeys.has(kid)) {
            timelineStore.getState().removeKeyframe(channel.id, kf.frame);
          }
        }
      }
      timelineStore.getState().clearKeyframeSelection();
      setLocalSelectedKeys(new Set());
    }
  }, [effectiveSelectedKeys, onDeleteKeyframes, activeChannels]);

  // Keyboard shortcut listener: Delete / Backspace and Home
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Don't intercept when user is typing in an input
      if (['INPUT', 'TEXTAREA', 'SELECT'].includes((e.target as HTMLElement)?.tagName)) {
        return;
      }
      if (e.key === 'Delete' || e.key === 'Backspace') {
        handleDeleteSelected();
      } else if (e.key === 'Home') {
        handleFrameAll();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [handleDeleteSelected, handleFrameAll]);

  // Scrubber dragging
  const handleScrubberMouseDown = (e: React.MouseEvent) => {
    if (!canvasAreaRef.current) return;
    const rect = canvasAreaRef.current.getBoundingClientRect();
    const frame = pxToFrame(e.clientX - rect.left);
    const target = Math.max(startFrame, Math.min(endFrame, frame));
    if (onSetFrame) onSetFrame(target);
    else timelineStore.getState().setFrame(target);

    const onMouseMove = (me: MouseEvent) => {
      const f = pxToFrame(me.clientX - rect.left);
      const clamped = Math.max(startFrame, Math.min(endFrame, f));
      if (onSetFrame) onSetFrame(clamped);
      else timelineStore.getState().setFrame(clamped);
    };

    const onMouseUp = () => {
      window.removeEventListener('mousemove', onMouseMove);
      window.removeEventListener('mouseup', onMouseUp);
    };

    window.addEventListener('mousemove', onMouseMove);
    window.addEventListener('mouseup', onMouseUp);
  };

  // Diamond Drag Retiming
  const handleDiamondMouseDown = (e: React.MouseEvent, channelId: string, kf: IKeyframe) => {
    e.stopPropagation();
    const keyId = getKeyframeId(channelId, kf);
    const isShift = e.shiftKey;

    let targetKeys = new Set(effectiveSelectedKeys);
    if (!targetKeys.has(keyId) && !isShift) {
      targetKeys = new Set([keyId]);
      selectKey(keyId, false);
    } else if (isShift) {
      selectKey(keyId, true);
      targetKeys.add(keyId);
    }

    // Prepare dragging list
    const itemsToDrag: Array<{
      keyId: string;
      channelId: string;
      originalFrame: number;
      currentFrame: number;
    }> = [];

    for (const ch of activeChannels) {
      for (const k of ch.keyframes) {
        const id = getKeyframeId(ch.id, k);
        if (targetKeys.has(id)) {
          itemsToDrag.push({
            keyId: id,
            channelId: ch.id,
            originalFrame: k.frame,
            currentFrame: k.frame,
          });
        }
      }
    }

    setDraggingKeys(itemsToDrag);
    const startMouseX = e.clientX;

    const onMouseMove = (me: MouseEvent) => {
      const deltaPx = me.clientX - startMouseX;
      const deltaFrames = Math.round(deltaPx / pixelsPerFrame);
      setDraggingKeys(
        itemsToDrag.map((item) => ({
          ...item,
          currentFrame: Math.max(startFrame, item.originalFrame + deltaFrames),
        })),
      );
    };

    const onMouseUp = () => {
      window.removeEventListener('mousemove', onMouseMove);
      window.removeEventListener('mouseup', onMouseUp);

      setDraggingKeys((prev) => {
        if (!prev) return null;
        const moves: Array<{ channelId: string; oldFrame: number; newFrame: number }> = [];
        prev.forEach((item) => {
          if (item.currentFrame !== item.originalFrame) {
            moves.push({
              channelId: item.channelId,
              oldFrame: item.originalFrame,
              newFrame: item.currentFrame,
            });
          }
        });

        if (moves.length > 0) {
          if (onMoveKeyframes) {
            onMoveKeyframes(moves);
          } else {
            // Apply moves in timelineStore
            for (const move of moves) {
              const ch = timelineStore.getState().getChannel(move.channelId);
              if (ch) {
                const kfFound = ch.keyframes.find((k) => k.frame === move.oldFrame);
                if (kfFound) {
                  timelineStore.getState().removeKeyframe(move.channelId, move.oldFrame);
                  timelineStore.getState().insertKeyframe(move.channelId, {
                    ...kfFound,
                    frame: move.newFrame,
                  });
                }
              }
            }
          }
        }
        return null;
      });
    };

    window.addEventListener('mousemove', onMouseMove);
    window.addEventListener('mouseup', onMouseUp);
  };

  // Summary Diamond MouseDown (moves all channel keys at that frame)
  const handleSummaryDiamondMouseDown = (
    e: React.MouseEvent,
    _summaryFrame: number,
    entries: Array<{ channelId: string; keyframe: IKeyframe }>,
  ) => {
    e.stopPropagation();
    const isShift = e.shiftKey;
    const summaryKeyIds = entries.map((en) => getKeyframeId(en.channelId, en.keyframe));

    if (!isShift) {
      if (onClearSelection) onClearSelection();
      else timelineStore.getState().clearKeyframeSelection();
      summaryKeyIds.forEach((id) => selectKey(id, true));
    } else {
      summaryKeyIds.forEach((id) => selectKey(id, true));
    }

    const itemsToDrag = entries.map((en) => ({
      keyId: getKeyframeId(en.channelId, en.keyframe),
      channelId: en.channelId,
      originalFrame: en.keyframe.frame,
      currentFrame: en.keyframe.frame,
    }));

    setDraggingKeys(itemsToDrag);
    const startMouseX = e.clientX;

    const onMouseMove = (me: MouseEvent) => {
      const deltaPx = me.clientX - startMouseX;
      const deltaFrames = Math.round(deltaPx / pixelsPerFrame);
      setDraggingKeys(
        itemsToDrag.map((item) => ({
          ...item,
          currentFrame: Math.max(startFrame, item.originalFrame + deltaFrames),
        })),
      );
    };

    const onMouseUp = () => {
      window.removeEventListener('mousemove', onMouseMove);
      window.removeEventListener('mouseup', onMouseUp);

      setDraggingKeys((prev) => {
        if (!prev) return null;
        const moves: Array<{ channelId: string; oldFrame: number; newFrame: number }> = [];
        prev.forEach((item) => {
          if (item.currentFrame !== item.originalFrame) {
            moves.push({
              channelId: item.channelId,
              oldFrame: item.originalFrame,
              newFrame: item.currentFrame,
            });
          }
        });

        if (moves.length > 0) {
          if (onMoveKeyframes) {
            onMoveKeyframes(moves);
          } else {
            for (const move of moves) {
              const ch = timelineStore.getState().getChannel(move.channelId);
              if (ch) {
                const kfFound = ch.keyframes.find((k) => k.frame === move.oldFrame);
                if (kfFound) {
                  timelineStore.getState().removeKeyframe(move.channelId, move.oldFrame);
                  timelineStore.getState().insertKeyframe(move.channelId, {
                    ...kfFound,
                    frame: move.newFrame,
                  });
                }
              }
            }
          }
        }
        return null;
      });
    };

    window.addEventListener('mousemove', onMouseMove);
    window.addEventListener('mouseup', onMouseUp);
  };

  // Marquee Box Selection on Canvas Background
  const handleCanvasMouseDown = (e: React.MouseEvent) => {
    // Only left click initiates box select
    if (e.button !== 0 || !canvasAreaRef.current) return;
    const rect = canvasAreaRef.current.getBoundingClientRect();
    const startPoint = { x: e.clientX - rect.left, y: e.clientY - rect.top };
    setBoxSelectStart(startPoint);
    setBoxSelectCurrent(startPoint);

    const isShift = e.shiftKey;
    if (!isShift) {
      clearSelection();
    }

    const onMouseMove = (me: MouseEvent) => {
      setBoxSelectCurrent({
        x: me.clientX - rect.left,
        y: me.clientY - rect.top,
      });
    };

    const onMouseUp = (me: MouseEvent) => {
      window.removeEventListener('mousemove', onMouseMove);
      window.removeEventListener('mouseup', onMouseUp);

      const endX = me.clientX - rect.left;
      const endY = me.clientY - rect.top;

      const minX = Math.min(startPoint.x, endX);
      const maxX = Math.max(startPoint.x, endX);
      const minY = Math.min(startPoint.y, endY);
      const maxY = Math.max(startPoint.y, endY);

      // Only consider if dragged more than 4px
      if (Math.hypot(maxX - minX, maxY - minY) > 4) {
        const minFrame = pxToFrame(minX);
        const maxFrame = pxToFrame(maxX);

        // Find intersecting keyframes
        const selectedIds: string[] = [];
        activeChannels.forEach((ch, chIdx) => {
          const rowY = 28 + 24 + 24 + 24 + chIdx * 24 + 12;
          if (rowY >= minY && rowY <= maxY) {
            ch.keyframes.forEach((k) => {
              if (k.frame >= minFrame && k.frame <= maxFrame) {
                selectedIds.push(getKeyframeId(ch.id, k));
              }
            });
          }
        });

        // Check summary row intersection
        if (minY <= 52 && maxY >= 28) {
          activeChannels.forEach((ch) => {
            ch.keyframes.forEach((k) => {
              if (k.frame >= minFrame && k.frame <= maxFrame) {
                selectedIds.push(getKeyframeId(ch.id, k));
              }
            });
          });
        }

        selectedIds.forEach((id) => selectKey(id, true));
      }

      setBoxSelectStart(null);
      setBoxSelectCurrent(null);
    };

    window.addEventListener('mousemove', onMouseMove);
    window.addEventListener('mouseup', onMouseUp);
  };

  // Horizontal Panning
  const handleWheel = (e: React.WheelEvent) => {
    if (e.ctrlKey || e.metaKey) {
      e.preventDefault();
      // Zoom
      const zoomFactor = e.deltaY > 0 ? 0.9 : 1.1;
      setPixelsPerFrame((prev) => Math.max(2, Math.min(50, prev * zoomFactor)));
    } else {
      // Pan
      const deltaFrames = Math.round(e.deltaX / pixelsPerFrame || e.deltaY / (pixelsPerFrame * 2));
      setScrollOffsetFrames((prev) => prev + deltaFrames);
    }
  };

  // Mute & Lock handlers
  const handleToggleMute = (channelId: string) => {
    if (onToggleMuteChannel) {
      onToggleMuteChannel(channelId);
    } else {
      const ch = timelineStore.getState().getChannel(channelId);
      if (ch) {
        timelineStore.getState().muteTrack(channelId, !ch.muted);
      }
    }
  };

  const handleToggleLock = (channelId: string) => {
    if (onToggleLockChannel) {
      onToggleLockChannel(channelId);
    } else {
      const ch = timelineStore.getState().getChannel(channelId);
      if (ch) {
        timelineStore.getState().lockTrack(channelId, !ch.locked);
      }
    }
  };

  // Ticks for frame ruler
  const rulerTicks = useMemo(() => {
    const ticks: number[] = [];
    const step = pixelsPerFrame > 15 ? 5 : pixelsPerFrame > 6 ? 10 : 20;
    const startTick = Math.floor(scrollOffsetFrames / step) * step;
    for (let f = startTick; f <= startTick + 200; f += step) {
      ticks.push(f);
    }
    return ticks;
  }, [scrollOffsetFrames, pixelsPerFrame]);

  // Current playhead X in canvas
  const playheadX = frameToPx(currentFrame);

  return (
    <div
      ref={containerRef}
      onWheel={handleWheel}
      className={cn(
        'flex flex-col h-full w-full bg-[#1e1e1e] text-gray-200 select-none overflow-hidden font-sans border-t border-[#141414]',
        className,
      )}
    >
      {/* 1. Dope Sheet Top Toolbar */}
      <div className="flex items-center justify-between h-7 px-2.5 bg-[#252525] border-b border-[#181818] text-xs">
        <div className="flex items-center gap-2">
          <div className="flex items-center gap-1 text-gray-400 font-medium">
            <Film size={13} className="text-[#4772b3]" />
            <span className="text-gray-300 font-semibold">Dope Sheet</span>
          </div>

          <div className="h-3 w-[1px] bg-gray-600 mx-1" />

          {/* Action indicator */}
          <span className="text-[11px] text-gray-400">
            Action: <span className="text-emerald-400 font-mono">{activeActionName}</span>
          </span>
        </div>

        {/* View Controls & Action buttons */}
        <div className="flex items-center gap-1.5">
          <button
            onClick={handleFrameAll}
            title="Frame All (Home)"
            aria-label="Frame All"
            className="p-1 rounded text-gray-400 hover:text-white hover:bg-[#383838]"
          >
            <Home size={13} />
          </button>
          <button
            onClick={() => handleZoom(1.2)}
            title="Zoom In"
            aria-label="Zoom In"
            className="p-1 rounded text-gray-400 hover:text-white hover:bg-[#383838]"
          >
            <ZoomIn size={13} />
          </button>
          <button
            onClick={() => handleZoom(0.8)}
            title="Zoom Out"
            aria-label="Zoom Out"
            className="p-1 rounded text-gray-400 hover:text-white hover:bg-[#383838]"
          >
            <ZoomOut size={13} />
          </button>

          <div className="h-3 w-[1px] bg-gray-600 mx-1" />

          {/* Delete selected keyframes */}
          <button
            onClick={handleDeleteSelected}
            disabled={effectiveSelectedKeys.size === 0}
            title="Delete Selected Keyframes (Del)"
            aria-label="Delete Keyframes"
            className={cn(
              'flex items-center gap-1 px-1.5 py-0.5 rounded text-[11px] transition-colors',
              effectiveSelectedKeys.size > 0
                ? 'text-red-400 hover:text-red-300 hover:bg-red-500/20'
                : 'text-gray-600 cursor-not-allowed',
            )}
          >
            <Trash2 size={12} />
            <span>Delete</span>
            {effectiveSelectedKeys.size > 0 && (
              <span className="ml-0.5 text-[9px] px-1 bg-red-600/30 rounded">
                {effectiveSelectedKeys.size}
              </span>
            )}
          </button>
        </div>
      </div>

      {/* 2. Main Body: Left Hierarchy Tree + Right Scrubber Area */}
      <div className="flex flex-1 overflow-hidden relative">
        {/* Left Column: Channel Hierarchy Tree */}
        <div className="w-56 shrink-0 bg-[#222222] border-r border-[#181818] flex flex-col overflow-y-auto overflow-x-hidden text-[11px] select-none">
          {/* Header row (matches ruler height: 28px) */}
          <div className="h-7 px-2.5 flex items-center justify-between bg-[#282828] border-b border-[#181818] text-gray-400 font-semibold">
            <span>Channels</span>
            <span className="text-[10px] text-gray-500">{activeChannels.length} tracks</span>
          </div>

          {/* Top Summary Row (24px) */}
          <div className="h-6 px-2 flex items-center justify-between bg-[#2a2a2a] border-b border-[#1e1e1e] font-medium text-amber-400">
            <div className="flex items-center gap-1.5">
              <span className="w-2 h-2 rotate-45 bg-amber-400 rounded-xs" />
              <span>Summary</span>
            </div>
            <span className="text-[10px] text-gray-500 font-mono">{summaryFrames.length} keys</span>
          </div>

          {/* Level 1: Selected Object Row (24px) */}
          <div
            onClick={() => setTreeExpanded((prev) => ({ ...prev, object: !prev.object }))}
            className="h-6 px-2 flex items-center justify-between bg-[#242424] hover:bg-[#2c2c2c] cursor-pointer border-b border-[#1e1e1e]"
          >
            <div className="flex items-center gap-1.5 overflow-hidden">
              {treeExpanded.object ? <ChevronDown size={12} /> : <ChevronRight size={12} />}
              <Box size={12} className="text-emerald-400 shrink-0" />
              <span className="truncate font-medium text-gray-200">{selectedObjectName}</span>
            </div>
          </div>

          {/* Level 2: Action Row (24px) */}
          {treeExpanded.object && (
            <div
              onClick={() => setTreeExpanded((prev) => ({ ...prev, action: !prev.action }))}
              className="h-6 pl-5 pr-2 flex items-center justify-between bg-[#222222] hover:bg-[#282828] cursor-pointer border-b border-[#1e1e1e]"
            >
              <div className="flex items-center gap-1.5 overflow-hidden">
                {treeExpanded.action ? <ChevronDown size={11} /> : <ChevronRight size={11} />}
                <Film size={11} className="text-[#4772b3] shrink-0" />
                <span className="truncate text-gray-300">{activeActionName}</span>
              </div>
            </div>
          )}

          {/* Level 3: Individual Channels (24px each) */}
          {treeExpanded.object &&
            treeExpanded.action &&
            activeChannels.map((channel) => {
              const color = getChannelColor(channel.propertyPath, channel.color);
              return (
                <div
                  key={channel.id}
                  className="h-6 pl-8 pr-2 flex items-center justify-between bg-[#1e1e1e] hover:bg-[#262626] border-b border-[#181818] group"
                >
                  <div className="flex items-center gap-1.5 overflow-hidden">
                    <span
                      style={{ backgroundColor: color }}
                      className="w-2 h-2 rounded-full shrink-0 shadow-xs"
                    />
                    <span className="truncate text-gray-300 text-[11px]">{channel.name}</span>
                  </div>

                  {/* Channel controls: Mute & Lock */}
                  <div className="flex items-center gap-1 opacity-70 group-hover:opacity-100">
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        handleToggleMute(channel.id);
                      }}
                      title={channel.muted ? 'Unmute Channel' : 'Mute Channel'}
                      aria-label="Toggle Mute Channel"
                      className="p-0.5 rounded text-gray-400 hover:text-white"
                    >
                      {channel.muted ? (
                        <EyeOff size={11} className="text-red-400" />
                      ) : (
                        <Eye size={11} />
                      )}
                    </button>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        handleToggleLock(channel.id);
                      }}
                      title={channel.locked ? 'Unlock Channel' : 'Lock Channel'}
                      aria-label="Toggle Lock Channel"
                      className="p-0.5 rounded text-gray-400 hover:text-white"
                    >
                      {channel.locked ? (
                        <Lock size={11} className="text-amber-400" />
                      ) : (
                        <Unlock size={11} />
                      )}
                    </button>
                  </div>
                </div>
              );
            })}
        </div>

        {/* Right Column: Timeline Canvas / Keyframe Diamonds Area */}
        <div
          ref={canvasAreaRef}
          onMouseDown={handleCanvasMouseDown}
          className="flex-1 relative bg-[#1c1c1c] overflow-hidden flex flex-col cursor-crosshair"
        >
          {/* Top Ruler Row (28px) */}
          <div
            onMouseDown={handleScrubberMouseDown}
            className="h-7 bg-[#242424] border-b border-[#181818] relative cursor-pointer select-none"
          >
            {/* Ruler ticks and numbers */}
            {rulerTicks.map((f) => {
              const x = frameToPx(f);
              if (x < -40 || x > 2000) return null;
              return (
                <div
                  key={f}
                  style={{ left: `${x}px` }}
                  className="absolute top-0 bottom-0 pointer-events-none border-l border-gray-600/30 flex flex-col justify-between"
                >
                  <span className="text-[9px] font-mono text-gray-400 pl-1 select-none">{f}</span>
                  <div className="h-1.5 w-[1px] bg-gray-500" />
                </div>
              );
            })}

            {/* Playhead Marker on Ruler */}
            <div
              style={{ left: `${playheadX}px` }}
              className="absolute top-0 bottom-0 w-[1px] bg-red-500 pointer-events-none z-30"
            >
              <div className="w-2.5 h-3 bg-red-500 -translate-x-[4px] rounded-b-xs shadow-md" />
            </div>
          </div>

          {/* Grid Rows Area */}
          <div className="flex-1 relative overflow-hidden">
            {/* Vertical grid lines extending through rows */}
            {rulerTicks.map((f) => {
              const x = frameToPx(f);
              if (x < -40 || x > 2000) return null;
              return (
                <div
                  key={f}
                  style={{ left: `${x}px` }}
                  className="absolute top-0 bottom-0 w-[1px] bg-white/[0.03] pointer-events-none"
                />
              );
            })}

            {/* Row 1: Summary Row Diamonds (24px) */}
            <div className="h-6 bg-[#262626]/80 border-b border-[#1e1e1e] relative">
              {summaryFrames.map(({ frame, entries }) => {
                const x = frameToPx(frame);
                const hasSelected = entries.some((en) =>
                  effectiveSelectedKeys.has(getKeyframeId(en.channelId, en.keyframe)),
                );
                return (
                  <div
                    key={frame}
                    data-testid={`summary-diamond-${frame}`}
                    onMouseDown={(e) => handleSummaryDiamondMouseDown(e, frame, entries)}
                    title={`Summary keyframe at frame ${frame} (${entries.length} channels)`}
                    style={{ left: `${x}px` }}
                    className={cn(
                      'absolute top-1/2 -translate-y-1/2 -translate-x-1/2 w-3.5 h-3.5 rotate-45 cursor-grab active:cursor-grabbing z-20 transition-transform hover:scale-125',
                      hasSelected
                        ? 'bg-amber-300 border-2 border-white shadow-[0_0_6px_rgba(251,191,36,0.9)] scale-110'
                        : 'bg-amber-500 hover:bg-amber-400 border border-amber-600',
                    )}
                  />
                );
              })}
            </div>

            {/* Row 2: Selected Object Spacer Row (24px) */}
            <div className="h-6 bg-[#202020]/40 border-b border-[#1e1e1e]" />

            {/* Row 3: Action Spacer Row (24px) */}
            {treeExpanded.object && (
              <div className="h-6 bg-[#1e1e1e]/40 border-b border-[#1e1e1e]" />
            )}

            {/* Rows for each channel (24px each) */}
            {treeExpanded.object &&
              treeExpanded.action &&
              activeChannels.map((channel, idx) => {
                const isEven = idx % 2 === 0;

                return (
                  <div
                    key={channel.id}
                    className={cn(
                      'h-6 relative border-b border-[#181818]',
                      isEven ? 'bg-[#1b1b1b]' : 'bg-[#1e1e1e]',
                    )}
                  >
                    {/* Channel Keyframe Diamonds */}
                    {channel.keyframes.map((kf) => {
                      const keyId = getKeyframeId(channel.id, kf);
                      const isSelected = effectiveSelectedKeys.has(keyId);

                      // Check if currently being retimed/dragged
                      const dragInfo = draggingKeys?.find((d) => d.keyId === keyId);
                      const displayFrame = dragInfo ? dragInfo.currentFrame : kf.frame;
                      const x = frameToPx(displayFrame);

                      return (
                        <div
                          key={keyId}
                          data-testid={`channel-diamond-${channel.id}-${kf.frame}`}
                          onMouseDown={(e) => handleDiamondMouseDown(e, channel.id, kf)}
                          title={`${channel.name} @ Frame ${kf.frame} (Val: ${typeof kf.value === 'number' ? kf.value.toFixed(2) : kf.value})`}
                          style={{ left: `${x}px` }}
                          className={cn(
                            'absolute top-1/2 -translate-y-1/2 -translate-x-1/2 w-3 h-3 rotate-45 cursor-grab active:cursor-grabbing z-10 transition-transform hover:scale-125',
                            isSelected
                              ? 'bg-amber-300 border-2 border-white shadow-[0_0_6px_rgba(251,191,36,0.9)] scale-110'
                              : 'bg-amber-400 hover:bg-yellow-300 border border-amber-600',
                          )}
                        />
                      );
                    })}
                  </div>
                );
              })}

            {/* Draggable Playhead full vertical line across rows */}
            <div
              style={{ left: `${playheadX}px` }}
              className="absolute top-0 bottom-0 w-[1px] bg-red-500 pointer-events-none z-30 shadow-xs"
            />

            {/* Marquee Box Select overlay */}
            {boxSelectStart && boxSelectCurrent && (
              <div
                style={{
                  left: `${Math.min(boxSelectStart.x, boxSelectCurrent.x)}px`,
                  top: `${Math.min(boxSelectStart.y, boxSelectCurrent.y)}px`,
                  width: `${Math.abs(boxSelectCurrent.x - boxSelectStart.x)}px`,
                  height: `${Math.abs(boxSelectCurrent.y - boxSelectStart.y)}px`,
                }}
                className="absolute border border-blue-400 bg-blue-500/20 pointer-events-none z-40 rounded-xs"
              />
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
