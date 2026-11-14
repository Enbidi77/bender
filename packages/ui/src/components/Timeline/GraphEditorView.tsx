import React, { useState, useRef, useEffect, useMemo, useCallback } from 'react';
import {
  Eye,
  EyeOff,
  Lock,
  Unlock,
  Home,
  ZoomIn,
  ZoomOut,
  Activity,
  ChevronDown,
} from 'lucide-react';
import type { IKeyframe, KeyframeHandleType, IAnimationAction } from '@blender-elt/contracts';
import { timelineStore } from '@blender-elt/animation';
import { cn } from '../common/Button.js';
import { getChannelColor, getKeyframeId, type DopeSheetChannel } from './DopeSheetView.js';

export interface GraphEditorViewProps {
  currentFrame?: number;
  startFrame?: number;
  endFrame?: number;
  fps?: number;
  onSetFrame?: (frame: number) => void;
  selectedObjectName?: string;
  action?: IAnimationAction | null;
  channels?: DopeSheetChannel[];
  selectedKeyframeIds?: Set<string>;
  onSelectKeyframe?: (keyframeId: string, multiSelect?: boolean) => void;
  onClearSelection?: () => void;
  onUpdateKeyframeTangents?: (
    channelId: string,
    frame: number,
    handles: {
      handleLeft?: { frame: number; value: number };
      handleRight?: { frame: number; value: number };
    },
    handleTypes?: { handleTypeLeft?: KeyframeHandleType; handleTypeRight?: KeyframeHandleType },
  ) => void;
  onSetHandleType?: (type: KeyframeHandleType) => void;
  onToggleMuteChannel?: (channelId: string) => void;
  onToggleLockChannel?: (channelId: string) => void;
  className?: string;
}

export const GraphEditorView: React.FC<GraphEditorViewProps> = ({
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
  onUpdateKeyframeTangents,
  onSetHandleType,
  onToggleMuteChannel,
  onToggleLockChannel,
  className = '',
}) => {
  // View transform state
  const [scaleX, setScaleX] = useState<number>(10); // pixels per frame
  const [scaleY, setScaleY] = useState<number>(40); // pixels per value unit
  const [viewOffsetFrame, setViewOffsetFrame] = useState<number>(0); // frame at left
  const [viewOffsetValue, setViewOffsetValue] = useState<number>(0); // value at center

  // Visibility toggles per channel ID
  const [channelVisibility, setChannelVisibility] = useState<Record<string, boolean>>({});

  // Active handle type dropdown
  const [isHandleMenuOpen, setIsHandleMenuOpen] = useState<boolean>(false);
  const [selectedHandleType, setSelectedHandleType] = useState<KeyframeHandleType>('auto');

  // Local selection if not controlled
  const [localSelectedKeys, setLocalSelectedKeys] = useState<Set<string>>(new Set());

  // Interactive dragging states for handles
  const [draggingHandle, setDraggingHandle] = useState<{
    channelId: string;
    keyframeId: string;
    frame: number;
    side: 'left' | 'right';
    initialMouseX: number;
    initialMouseY: number;
    currentHandle: { frame: number; value: number };
    oppositeHandle?: { frame: number; value: number };
    handleType: KeyframeHandleType;
  } | null>(null);

  const containerRef = useRef<HTMLDivElement>(null);
  const svgRef = useRef<SVGSVGElement>(null);

  // Subscribe to timelineStore
  const [storeState, setStoreState] = useState(() => timelineStore.getState());
  useEffect(() => {
    const unsub = timelineStore.subscribe((state) => setStoreState(state));
    return () => unsub();
  }, []);

  const currentFrame = propsCurrentFrame ?? storeState.currentFrame;
  const startFrame = propsStartFrame ?? storeState.startFrame;
  const endFrame = propsEndFrame ?? storeState.endFrame;
  const effectiveSelectedKeys =
    propsSelectedKeyframeIds ??
    (storeState.selectedKeyframeIds.size > 0 ? storeState.selectedKeyframeIds : localSelectedKeys);

  // Derive channels
  const activeChannels: DopeSheetChannel[] = useMemo(() => {
    if (propsChannels && propsChannels.length > 0) return propsChannels;
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
  }, [
    propsChannels,
    propsAction,
    storeState.actions,
    storeState.activeActionId,
    storeState.tracks,
  ]);

  // Dimensions of SVG canvas
  const [viewportDims, setViewportDims] = useState<{ width: number; height: number }>({
    width: 800,
    height: 400,
  });

  useEffect(() => {
    const updateSize = () => {
      if (svgRef.current) {
        const rect = svgRef.current.getBoundingClientRect();
        setViewportDims({ width: rect.width || 800, height: rect.height || 400 });
      }
    };
    updateSize();
    window.addEventListener('resize', updateSize);
    return () => window.removeEventListener('resize', updateSize);
  }, []);

  // Coordinate transforms
  const frameToX = useCallback(
    (frame: number) => {
      return (frame - viewOffsetFrame) * scaleX;
    },
    [viewOffsetFrame, scaleX],
  );

  const xToFrame = useCallback(
    (x: number) => {
      return viewOffsetFrame + x / scaleX;
    },
    [viewOffsetFrame, scaleX],
  );

  const valueToY = useCallback(
    (value: number) => {
      const centerY = viewportDims.height / 2;
      return centerY - (value - viewOffsetValue) * scaleY;
    },
    [viewportDims.height, viewOffsetValue, scaleY],
  );

  const yToValue = useCallback(
    (y: number) => {
      const centerY = viewportDims.height / 2;
      return viewOffsetValue + (centerY - y) / scaleY;
    },
    [viewportDims.height, viewOffsetValue, scaleY],
  );

  // Playhead scrubber
  const handleScrubberMouseDown = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (!svgRef.current) return;
    const rect = svgRef.current.getBoundingClientRect();
    const frame = Math.round(xToFrame(e.clientX - rect.left));
    const target = Math.max(startFrame, Math.min(endFrame, frame));
    if (onSetFrame) onSetFrame(target);
    else timelineStore.getState().setFrame(target);

    const onMouseMove = (me: MouseEvent) => {
      const f = Math.round(xToFrame(me.clientX - rect.left));
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

  // Frame All: Auto-fit viewport to all keyframe times and values
  const handleFrameAll = useCallback(() => {
    const allKeyframes = activeChannels
      .filter((c) => channelVisibility[c.id] !== false)
      .flatMap((c) => c.keyframes);

    if (allKeyframes.length === 0) {
      setViewOffsetFrame(startFrame - 5);
      setViewOffsetValue(0);
      setScaleX(12);
      setScaleY(40);
      return;
    }

    const frames = allKeyframes.map((k) => k.frame);
    const values = allKeyframes.map((k) => (typeof k.value === 'number' ? k.value : 0));

    const minF = Math.min(...frames, startFrame);
    const maxF = Math.max(...frames, endFrame);
    const minV = Math.min(...values);
    const maxV = Math.max(...values);

    const spanF = Math.max(10, maxF - minF + 10);
    const spanV = Math.max(1, maxV - minV + 2);

    const newScaleX = Math.max(2, Math.min(50, (viewportDims.width - 80) / spanF));
    const newScaleY = Math.max(5, Math.min(200, (viewportDims.height - 80) / spanV));

    setScaleX(newScaleX);
    setScaleY(newScaleY);
    setViewOffsetFrame(minF - 5);
    setViewOffsetValue((minV + maxV) / 2);
  }, [activeChannels, channelVisibility, startFrame, endFrame, viewportDims]);

  // Zoom controls
  const handleZoom = (factor: number) => {
    setScaleX((prev) => Math.max(2, Math.min(60, prev * factor)));
    setScaleY((prev) => Math.max(5, Math.min(300, prev * factor)));
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

  // Set Handle Type for selected keys
  const applyHandleType = useCallback(
    (type: KeyframeHandleType) => {
      setSelectedHandleType(type);
      setIsHandleMenuOpen(false);

      if (onSetHandleType) {
        onSetHandleType(type);
      }

      // Apply to all selected keyframes
      activeChannels.forEach((ch) => {
        ch.keyframes.forEach((kf, idx) => {
          const kid = getKeyframeId(ch.id, kf);
          if (effectiveSelectedKeys.has(kid)) {
            const prevKf = ch.keyframes[idx - 1];
            const nextKf = ch.keyframes[idx + 1];

            const val = typeof kf.value === 'number' ? kf.value : 0;
            const prevVal = prevKf && typeof prevKf.value === 'number' ? prevKf.value : val;
            const nextVal = nextKf && typeof nextKf.value === 'number' ? nextKf.value : val;

            const dtPrev = prevKf ? Math.max(1, kf.frame - prevKf.frame) : 5;
            const dtNext = nextKf ? Math.max(1, nextKf.frame - kf.frame) : 5;

            let handleL = kf.handleLeft || { frame: -dtPrev / 3, value: 0 };
            let handleR = kf.handleRight || { frame: dtNext / 3, value: 0 };

            if (type === 'auto') {
              // Smooth Catmull-Rom tangent
              const slope = (nextVal - prevVal) / (dtPrev + dtNext);
              handleR = { frame: dtNext / 3, value: slope * (dtNext / 3) };
              handleL = { frame: -dtPrev / 3, value: -slope * (dtPrev / 3) };
            } else if (type === 'vector') {
              // Point directly toward neighbor
              const slopeR = (nextVal - val) / dtNext;
              const slopeL = (val - prevVal) / dtPrev;
              handleR = { frame: dtNext / 3, value: slopeR * (dtNext / 3) };
              handleL = { frame: -dtPrev / 3, value: -slopeL * (dtPrev / 3) };
            } else if (type === 'aligned') {
              // Align opposite handles
              const angle = Math.atan2(handleR.value, handleR.frame);
              const magL = Math.hypot(handleL.frame, handleL.value) || 3;
              handleL = {
                frame: -magL * Math.cos(angle),
                value: -magL * Math.sin(angle),
              };
            }

            if (onUpdateKeyframeTangents) {
              onUpdateKeyframeTangents(
                ch.id,
                kf.frame,
                { handleLeft: handleL, handleRight: handleR },
                { handleTypeLeft: type, handleTypeRight: type },
              );
            } else {
              timelineStore.getState().insertKeyframe(ch.id, {
                ...kf,
                handleTypeLeft: type,
                handleTypeRight: type,
                handleLeft: handleL,
                handleRight: handleR,
              });
            }
          }
        });
      });
    },
    [activeChannels, effectiveSelectedKeys, onSetHandleType, onUpdateKeyframeTangents],
  );

  // Hotkey listener: V for Handle Type Menu, Home for Frame All
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (['INPUT', 'TEXTAREA', 'SELECT'].includes((e.target as HTMLElement)?.tagName)) {
        return;
      }
      if (e.key === 'v' || e.key === 'V') {
        setIsHandleMenuOpen((prev) => !prev);
      } else if (e.key === 'Home') {
        handleFrameAll();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [handleFrameAll]);

  // Handle Dragging Tangent Knob
  const handleKnobMouseDown = (
    e: React.MouseEvent,
    channelId: string,
    kf: IKeyframe,
    side: 'left' | 'right',
  ) => {
    e.stopPropagation();
    const keyId = getKeyframeId(channelId, kf);
    selectKey(keyId, false);

    const val = typeof kf.value === 'number' ? kf.value : 0;
    const defaultHandleDist = 5;
    const currentHandle =
      side === 'left'
        ? kf.handleLeft || { frame: -defaultHandleDist, value: 0 }
        : kf.handleRight || { frame: defaultHandleDist, value: 0 };

    const oppositeHandle =
      side === 'left'
        ? kf.handleRight || { frame: defaultHandleDist, value: 0 }
        : kf.handleLeft || { frame: -defaultHandleDist, value: 0 };

    const handleType =
      side === 'left' ? kf.handleTypeLeft || 'aligned' : kf.handleTypeRight || 'aligned';

    setDraggingHandle({
      channelId,
      keyframeId: keyId,
      frame: kf.frame,
      side,
      initialMouseX: e.clientX,
      initialMouseY: e.clientY,
      currentHandle,
      oppositeHandle,
      handleType,
    });

    const startKf = { ...kf };

    const onMouseMove = (me: MouseEvent) => {
      if (!svgRef.current) return;
      const rect = svgRef.current.getBoundingClientRect();
      const mouseX = me.clientX - rect.left;
      const mouseY = me.clientY - rect.top;

      const targetFrame = xToFrame(mouseX);
      const targetVal = yToValue(mouseY);

      let deltaF = targetFrame - startKf.frame;
      let deltaV = targetVal - val;

      // Constraint: left handle should stay left (frame <= 0), right handle right (frame >= 0)
      if (side === 'left' && deltaF > -0.1) deltaF = -0.1;
      if (side === 'right' && deltaF < 0.1) deltaF = 0.1;

      const updatedHandle = { frame: deltaF, value: deltaV };
      let updatedOpposite = oppositeHandle ? { ...oppositeHandle } : undefined;

      // Handle aligned constraint: keep opposite handle collinear (180 deg opposite)
      if (handleType === 'aligned' || handleType === 'auto') {
        const angle = Math.atan2(deltaV, deltaF);
        const oppMag = oppositeHandle
          ? Math.hypot(oppositeHandle.frame, oppositeHandle.value)
          : defaultHandleDist;

        // Opposite handle is at angle + PI
        updatedOpposite = {
          frame: -oppMag * Math.cos(angle),
          value: -oppMag * Math.sin(angle),
        };
      }

      setDraggingHandle((prev) =>
        prev
          ? {
              ...prev,
              currentHandle: updatedHandle,
              oppositeHandle: updatedOpposite,
            }
          : null,
      );
    };

    const onMouseUp = () => {
      window.removeEventListener('mousemove', onMouseMove);
      window.removeEventListener('mouseup', onMouseUp);

      setDraggingHandle((finalDrag) => {
        if (!finalDrag) return null;

        const newLeft = side === 'left' ? finalDrag.currentHandle : finalDrag.oppositeHandle;
        const newRight = side === 'right' ? finalDrag.currentHandle : finalDrag.oppositeHandle;

        if (onUpdateKeyframeTangents) {
          onUpdateKeyframeTangents(
            channelId,
            finalDrag.frame,
            { handleLeft: newLeft, handleRight: newRight },
            {
              handleTypeLeft: finalDrag.handleType,
              handleTypeRight: finalDrag.handleType,
            },
          );
        } else {
          timelineStore.getState().insertKeyframe(channelId, {
            ...startKf,
            handleLeft: newLeft,
            handleRight: newRight,
          });
        }
        return null;
      });
    };

    window.addEventListener('mousemove', onMouseMove);
    window.addEventListener('mouseup', onMouseUp);
  };

  // Wheel Zoom & Pan
  const handleWheel = (e: React.WheelEvent) => {
    if (e.ctrlKey || e.metaKey) {
      e.preventDefault();
      const zoomFactor = e.deltaY > 0 ? 0.9 : 1.1;
      setScaleX((prev) => Math.max(2, Math.min(60, prev * zoomFactor)));
      setScaleY((prev) => Math.max(5, Math.min(300, prev * zoomFactor)));
    } else {
      // Pan
      const deltaFrames = e.deltaX / scaleX || 0;
      const deltaVal = e.deltaY / scaleY || 0;
      setViewOffsetFrame((prev) => prev + deltaFrames);
      setViewOffsetValue((prev) => prev - deltaVal * 0.5);
    }
  };

  // Time ruler ticks (Vertical grid lines)
  const timeGridTicks = useMemo(() => {
    const ticks: number[] = [];
    const step = scaleX > 20 ? 5 : scaleX > 8 ? 10 : 25;
    const startTick = Math.floor(viewOffsetFrame / step) * step;
    for (let f = startTick; f <= startTick + 250; f += step) {
      ticks.push(f);
    }
    return ticks;
  }, [viewOffsetFrame, scaleX]);

  // Value grid ticks (Horizontal grid lines)
  const valueGridTicks = useMemo(() => {
    const ticks: number[] = [];
    const step = scaleY > 80 ? 0.5 : scaleY > 30 ? 1 : scaleY > 10 ? 2 : 5;
    const minVal = viewOffsetValue - viewportDims.height / 2 / scaleY;
    const maxVal = viewOffsetValue + viewportDims.height / 2 / scaleY;
    const startVal = Math.floor(minVal / step) * step;
    for (let v = startVal; v <= maxVal + step; v += step) {
      ticks.push(parseFloat(v.toFixed(2)));
    }
    return ticks;
  }, [viewOffsetValue, scaleY, viewportDims.height]);

  // SVG Curve Path Generator
  const generateCurvePath = useCallback(
    (channel: DopeSheetChannel) => {
      if (channel.keyframes.length === 0) return '';
      const sorted = [...channel.keyframes].sort((a, b) => a.frame - b.frame);

      let d = '';
      sorted.forEach((kf, i) => {
        const val = typeof kf.value === 'number' ? kf.value : 0;
        const x = frameToX(kf.frame);
        const y = valueToY(val);

        if (i === 0) {
          // Constant extrapolation to the left
          const leftExtrapX = frameToX(Math.min(startFrame - 10, kf.frame - 20));
          d += `M ${leftExtrapX},${y} L ${x},${y} `;
        } else {
          const prevKf = sorted[i - 1];
          const prevVal = typeof prevKf.value === 'number' ? prevKf.value : 0;
          const interp = kf.interpolation || 'bezier';

          if (interp === 'constant') {
            d += `H ${x} V ${y} `;
          } else if (interp === 'linear') {
            d += `L ${x},${y} `;
          } else {
            // Bezier curve
            let hR = prevKf.handleRight;
            if (draggingHandle && draggingHandle.keyframeId === getKeyframeId(channel.id, prevKf)) {
              hR =
                draggingHandle.side === 'right'
                  ? draggingHandle.currentHandle
                  : draggingHandle.oppositeHandle;
            }
            if (!hR) {
              const dt = (kf.frame - prevKf.frame) / 3;
              hR = { frame: dt, value: 0 };
            }

            let hL = kf.handleLeft;
            if (draggingHandle && draggingHandle.keyframeId === getKeyframeId(channel.id, kf)) {
              hL =
                draggingHandle.side === 'left'
                  ? draggingHandle.currentHandle
                  : draggingHandle.oppositeHandle;
            }
            if (!hL) {
              const dt = (kf.frame - prevKf.frame) / 3;
              hL = { frame: -dt, value: 0 };
            }

            const cp1X = frameToX(prevKf.frame + hR.frame);
            const cp1Y = valueToY(prevVal + hR.value);
            const cp2X = frameToX(kf.frame + hL.frame);
            const cp2Y = valueToY(val + hL.value);

            d += `C ${cp1X.toFixed(1)},${cp1Y.toFixed(1)} ${cp2X.toFixed(1)},${cp2Y.toFixed(1)} ${x.toFixed(1)},${y.toFixed(1)} `;
          }
        }

        // Extrapolate past the last keyframe
        if (i === sorted.length - 1) {
          const rightExtrapX = frameToX(Math.max(endFrame + 10, kf.frame + 20));
          d += `L ${rightExtrapX},${y} `;
        }
      });

      return d;
    },
    [frameToX, valueToY, startFrame, endFrame, draggingHandle],
  );

  // Playhead scrubber X
  const playheadX = frameToX(currentFrame);

  return (
    <div
      ref={containerRef}
      onWheel={handleWheel}
      className={cn(
        'flex flex-col h-full w-full bg-[#1b1b1b] text-gray-200 select-none overflow-hidden font-sans border-t border-[#141414]',
        className,
      )}
    >
      {/* 1. Graph Editor Top Toolbar */}
      <div className="flex items-center justify-between h-7 px-2.5 bg-[#252525] border-b border-[#181818] text-xs">
        <div className="flex items-center gap-2">
          <div className="flex items-center gap-1 text-gray-400 font-medium">
            <Activity size={13} className="text-[#38a169]" />
            <span className="text-gray-300 font-semibold">Graph Editor</span>
          </div>

          <div className="h-3 w-[1px] bg-gray-600 mx-1" />

          {/* Handle Type selector menu (Hotkey: V) */}
          <div className="relative">
            <button
              onClick={() => setIsHandleMenuOpen((p) => !p)}
              title="Set Tangent Handle Type (V)"
              aria-label="Handle Type"
              className="flex items-center gap-1 px-1.5 py-0.5 rounded bg-[#2c2c2c] border border-[#3e3e3e] hover:bg-[#383838] text-[11px] text-gray-300 capitalize"
            >
              <span>Handle: {selectedHandleType}</span>
              <ChevronDown size={11} />
            </button>

            {isHandleMenuOpen && (
              <div className="absolute top-full left-0 mt-1 w-28 bg-[#282828] border border-[#3e3e3e] rounded shadow-lg py-1 z-50 text-[11px]">
                {(['auto', 'aligned', 'vector', 'free'] as KeyframeHandleType[]).map((type) => (
                  <button
                    key={type}
                    onClick={() => applyHandleType(type)}
                    className={cn(
                      'w-full text-left px-2.5 py-1 capitalize hover:bg-[#4772b3] hover:text-white',
                      selectedHandleType === type && 'text-amber-400 font-medium',
                    )}
                  >
                    {type}
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* View Controls: Zoom & Frame All */}
        <div className="flex items-center gap-1.5">
          <button
            onClick={handleFrameAll}
            title="Frame All Curves (Home)"
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
        </div>
      </div>

      {/* 2. Main Body: Left Channels Sidebar + Right Curve Viewport */}
      <div className="flex flex-1 overflow-hidden relative">
        {/* Left Column: Channels & Visibility */}
        <div className="w-52 shrink-0 bg-[#222222] border-r border-[#181818] flex flex-col overflow-y-auto text-[11px]">
          <div className="h-6 px-2.5 flex items-center justify-between bg-[#282828] border-b border-[#181818] text-gray-400 font-semibold">
            <span>Curves</span>
            <span className="text-[10px] text-gray-500 font-mono">{activeChannels.length}</span>
          </div>

          <div className="px-2 py-1 bg-[#202020] text-gray-400 text-[10px] font-medium border-b border-[#181818]">
            {selectedObjectName}
          </div>

          {activeChannels.map((channel) => {
            const isVisible = channelVisibility[channel.id] !== false;
            const color = getChannelColor(channel.propertyPath, channel.color);

            return (
              <div
                key={channel.id}
                className={cn(
                  'h-6 px-2 flex items-center justify-between border-b border-[#181818] hover:bg-[#282828] transition-colors',
                  isVisible ? 'opacity-100' : 'opacity-40',
                )}
              >
                <div className="flex items-center gap-1.5 overflow-hidden">
                  <span
                    style={{ backgroundColor: color }}
                    className="w-2.5 h-2.5 rounded-full shrink-0 shadow-xs"
                  />
                  <span className="truncate text-gray-300 font-medium text-[11px]">
                    {channel.name}
                  </span>
                </div>

                {/* Toggles: Visibility, Mute, Lock */}
                <div className="flex items-center gap-1">
                  <button
                    onClick={() =>
                      setChannelVisibility((p) => ({ ...p, [channel.id]: !isVisible }))
                    }
                    title={isVisible ? 'Hide Curve' : 'Show Curve'}
                    aria-label="Toggle Curve Visibility"
                    className="p-0.5 rounded text-gray-400 hover:text-white"
                  >
                    {isVisible ? <Eye size={11} /> : <EyeOff size={11} className="text-gray-600" />}
                  </button>

                  <button
                    onClick={() => {
                      if (onToggleMuteChannel) onToggleMuteChannel(channel.id);
                      else timelineStore.getState().muteTrack(channel.id, !channel.muted);
                    }}
                    title={channel.muted ? 'Unmute' : 'Mute'}
                    aria-label="Toggle Mute"
                    className="p-0.5 rounded text-gray-400 hover:text-white"
                  >
                    {channel.muted ? (
                      <EyeOff size={11} className="text-red-400" />
                    ) : (
                      <Eye size={11} />
                    )}
                  </button>

                  <button
                    onClick={() => {
                      if (onToggleLockChannel) onToggleLockChannel(channel.id);
                      else timelineStore.getState().lockTrack(channel.id, !channel.locked);
                    }}
                    title={channel.locked ? 'Unlock' : 'Lock'}
                    aria-label="Toggle Lock"
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

        {/* Right Area: Interactive SVG Curve Viewport */}
        <div className="flex-1 relative bg-[#181818] overflow-hidden flex flex-col">
          <svg
            ref={svgRef}
            onClick={() => clearSelection()}
            className="w-full h-full cursor-crosshair"
          >
            <defs>
              <filter id="glow" x="-20%" y="-20%" width="140%" height="140%">
                <feGaussianBlur stdDeviation="2" result="blur" />
                <feComposite in="SourceGraphic" in2="blur" operator="over" />
              </filter>
            </defs>

            {/* 1. Value Horizontal Grid Lines & Numeric Labels */}
            {valueGridTicks.map((v) => {
              const y = valueToY(v);
              if (y < -20 || y > viewportDims.height + 20) return null;
              const isZero = Math.abs(v) < 0.001;
              return (
                <g key={`val-${v}`}>
                  <line
                    x1={0}
                    y1={y}
                    x2={viewportDims.width}
                    y2={y}
                    stroke={isZero ? '#555555' : '#282828'}
                    strokeWidth={isZero ? 1.5 : 1}
                  />
                  <text
                    x={8}
                    y={y - 3}
                    fill={isZero ? '#aaaaaa' : '#555555'}
                    fontSize={9}
                    fontFamily="monospace"
                  >
                    {v}
                  </text>
                </g>
              );
            })}

            {/* 2. Time Vertical Grid Lines & Frame Labels */}
            {timeGridTicks.map((f) => {
              const x = frameToX(f);
              if (x < -20 || x > viewportDims.width + 20) return null;
              return (
                <g key={`time-${f}`}>
                  <line
                    x1={x}
                    y1={0}
                    x2={x}
                    y2={viewportDims.height}
                    stroke="#242424"
                    strokeWidth={1}
                  />
                  <text
                    x={x + 3}
                    y={viewportDims.height - 6}
                    fill="#555555"
                    fontSize={9}
                    fontFamily="monospace"
                  >
                    {f}
                  </text>
                </g>
              );
            })}

            {/* 3. F-Curves for Each Visible Channel */}
            {activeChannels.map((channel) => {
              if (channelVisibility[channel.id] === false) return null;
              const color = getChannelColor(channel.propertyPath, channel.color);
              const pathD = generateCurvePath(channel);

              return (
                <g key={`curve-${channel.id}`} data-testid={`curve-group-${channel.id}`}>
                  {/* Glow outline behind curve */}
                  <path d={pathD} fill="none" stroke={color} strokeWidth={4} opacity={0.15} />
                  {/* Primary F-Curve line */}
                  <path
                    d={pathD}
                    fill="none"
                    stroke={color}
                    strokeWidth={2}
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                </g>
              );
            })}

            {/* 4. Tangent Handle Control Bars & Knobs for Selected Keyframes */}
            {activeChannels.map((channel) => {
              if (channelVisibility[channel.id] === false) return null;

              return channel.keyframes.map((kf) => {
                const keyId = getKeyframeId(channel.id, kf);
                const isSelected = effectiveSelectedKeys.has(keyId);
                if (!isSelected) return null;

                const val = typeof kf.value === 'number' ? kf.value : 0;
                const kfX = frameToX(kf.frame);
                const kfY = valueToY(val);

                // Tangent handles
                let hL = kf.handleLeft;
                let hR = kf.handleRight;

                // If currently being dragged, use live preview coordinates
                if (draggingHandle && draggingHandle.keyframeId === keyId) {
                  hL =
                    draggingHandle.side === 'left'
                      ? draggingHandle.currentHandle
                      : draggingHandle.oppositeHandle;
                  hR =
                    draggingHandle.side === 'right'
                      ? draggingHandle.currentHandle
                      : draggingHandle.oppositeHandle;
                }

                const defaultDist = 5;
                if (!hL) hL = { frame: -defaultDist, value: 0 };
                if (!hR) hR = { frame: defaultDist, value: 0 };

                const hLx = frameToX(kf.frame + hL.frame);
                const hLy = valueToY(val + hL.value);

                const hRx = frameToX(kf.frame + hR.frame);
                const hRy = valueToY(val + hR.value);

                return (
                  <g key={`handles-${keyId}`} data-testid={`handles-group-${keyId}`}>
                    {/* Left Handle Bar */}
                    <line
                      x1={kfX}
                      y1={kfY}
                      x2={hLx}
                      y2={hLy}
                      stroke="#f59e0b"
                      strokeWidth={1.5}
                      strokeDasharray="2,2"
                    />
                    {/* Left Knob */}
                    <circle
                      cx={hLx}
                      cy={hLy}
                      r={4}
                      fill="#f59e0b"
                      stroke="#ffffff"
                      strokeWidth={1.5}
                      data-testid={`handle-left-${keyId}`}
                      onMouseDown={(e) => handleKnobMouseDown(e, channel.id, kf, 'left')}
                      className="cursor-pointer hover:scale-125 transition-transform"
                    />

                    {/* Right Handle Bar */}
                    <line
                      x1={kfX}
                      y1={kfY}
                      x2={hRx}
                      y2={hRy}
                      stroke="#f59e0b"
                      strokeWidth={1.5}
                      strokeDasharray="2,2"
                    />
                    {/* Right Knob */}
                    <circle
                      cx={hRx}
                      cy={hRy}
                      r={4}
                      fill="#f59e0b"
                      stroke="#ffffff"
                      strokeWidth={1.5}
                      data-testid={`handle-right-${keyId}`}
                      onMouseDown={(e) => handleKnobMouseDown(e, channel.id, kf, 'right')}
                      className="cursor-pointer hover:scale-125 transition-transform"
                    />
                  </g>
                );
              });
            })}

            {/* 5. Keyframe Points (Diamonds or Nodes) */}
            {activeChannels.map((channel) => {
              if (channelVisibility[channel.id] === false) return null;
              const color = getChannelColor(channel.propertyPath, channel.color);

              return channel.keyframes.map((kf) => {
                const keyId = getKeyframeId(channel.id, kf);
                const isSelected = effectiveSelectedKeys.has(keyId);
                const val = typeof kf.value === 'number' ? kf.value : 0;
                const kfX = frameToX(kf.frame);
                const kfY = valueToY(val);

                return (
                  <rect
                    key={`point-${keyId}`}
                    x={kfX - 3.5}
                    y={kfY - 3.5}
                    width={7}
                    height={7}
                    transform={`rotate(45 ${kfX} ${kfY})`}
                    fill={isSelected ? '#ffcc00' : color}
                    stroke={isSelected ? '#ffffff' : '#222222'}
                    strokeWidth={isSelected ? 1.5 : 1}
                    data-testid={`graph-keyframe-${keyId}`}
                    onClick={(e) => {
                      e.stopPropagation();
                      selectKey(keyId, e.shiftKey);
                    }}
                    className="cursor-pointer hover:scale-125 transition-transform"
                  />
                );
              });
            })}

            {/* 6. Draggable Playhead Scrubber */}
            <g
              data-testid="graph-playhead"
              onMouseDown={handleScrubberMouseDown}
              className="cursor-ew-resize"
            >
              <line
                x1={playheadX}
                y1={0}
                x2={playheadX}
                y2={viewportDims.height}
                stroke="#e53e3e"
                strokeWidth={1.5}
              />
              <polygon
                points={`${playheadX - 6},0 ${playheadX + 6},0 ${playheadX},10`}
                fill="#e53e3e"
              />
            </g>
          </svg>
        </div>
      </div>
    </div>
  );
};
