import { createStore, type StoreApi } from 'zustand/vanilla';
import type {
  AnimationProperty,
  AnimationTimeline,
  AnimationTrack,
  IAnimationAction,
  IAnimationChannel,
  IKeyframe,
  KeyframeInterpolation,
} from '@blender-elt/contracts';
import { createTrack, insertKeyframeToTrack, removeKeyframeFromTrack } from './tracks.js';

export interface TimelineState {
  currentFrame: number;
  startFrame: number;
  endFrame: number;
  fps: number;
  isPlaying: boolean;
  loop: boolean;
  tracks: AnimationTrack[];

  // Actions & Channels
  actions: Record<string, IAnimationAction>;
  activeActionId: string | null;

  // Keyframe Selection
  selectedKeyframeIds: Set<string>;

  // Auto-Keying
  autoKeyingEnabled: boolean;
  autoKeyMode: 'loc' | 'rot' | 'scale' | 'locRotScale';

  // Frame control
  setFrame: (frame: number) => void;
  nextFrame: () => void;
  prevFrame: () => void;
  jumpToStart: () => void;
  jumpToEnd: () => void;
  setFps: (fps: number) => void;
  setFrameRange: (start: number, end: number) => void;
  setLoop: (loop: boolean) => void;

  // Playback control
  play: () => void;
  pause: () => void;
  togglePlay: () => void;
  stop: () => void;

  // Track management
  addTrack: (track: Omit<AnimationTrack, 'id'> & { id?: string }) => string;
  removeTrack: (trackId: string) => void;
  getTrack: (trackId: string) => AnimationTrack | undefined;
  getTracksForNode: (targetNodeId: string) => AnimationTrack[];
  setTracks: (tracks: AnimationTrack[]) => void;
  muteTrack: (trackId: string, muted?: boolean) => void;
  lockTrack: (trackId: string, locked?: boolean) => void;

  // Keyframe management
  insertKeyframe: (
    trackOrChannelId: string,
    keyframe: Omit<IKeyframe, 'time'> & { time?: number },
  ) => void;
  removeKeyframe: (trackOrChannelId: string, frame: number) => void;
  getKeyframe: (trackOrChannelId: string, frame: number) => IKeyframe | undefined;
  clearKeyframes: (trackOrChannelId: string) => void;

  // Node keyframe convenience helper
  insertNodeKeyframe: (
    targetNodeId: string,
    property: AnimationProperty,
    frame: number,
    value: number | number[],
    interpolation?: KeyframeInterpolation,
  ) => void;

  // Action & Channel management
  createAction: (name: string, targetNodeId?: string) => string;
  setActiveAction: (actionId: string | null) => void;
  getAction: (actionId: string) => IAnimationAction | undefined;
  updateAction: (actionId: string, updates: Partial<IAnimationAction>) => void;
  deleteAction: (actionId: string) => void;
  addChannelToAction: (
    actionId: string,
    channel: Omit<IAnimationChannel, 'id'> & { id?: string },
  ) => string;
  removeChannelFromAction: (actionId: string, channelId: string) => void;
  getChannel: (channelId: string) => IAnimationChannel | AnimationTrack | undefined;

  // Selection
  selectKeyframe: (keyframeId: string, multiSelect?: boolean) => void;
  deselectKeyframe: (keyframeId: string) => void;
  clearKeyframeSelection: () => void;
  setSelectedKeyframeIds: (ids: string[]) => void;

  // Auto-Keying
  setAutoKeying: (enabled: boolean) => void;
  setAutoKeyMode: (mode: 'loc' | 'rot' | 'scale' | 'locRotScale') => void;

  // Frame advance tick
  tick: () => void;

  // Serialization & export
  getTimeline: () => AnimationTimeline;
  loadTimeline: (timeline: Partial<AnimationTimeline>) => void;

  // Reset
  reset: () => void;
}

export type TimelineStore = StoreApi<TimelineState> & {
  getTimeline: () => AnimationTimeline;
  loadTimeline: (timeline: Partial<AnimationTimeline>) => void;
  reset: () => void;
};

export interface CreateTimelineOptions {
  currentFrame?: number;
  startFrame?: number;
  endFrame?: number;
  fps?: number;
  loop?: boolean;
  tracks?: AnimationTrack[];
  actions?: Record<string, IAnimationAction>;
  activeActionId?: string | null;
  autoKeyingEnabled?: boolean;
  autoKeyMode?: 'loc' | 'rot' | 'scale' | 'locRotScale';
}

/**
 * Creates a standalone Zustand Timeline store instance
 */
export function createTimelineStore(options?: CreateTimelineOptions): TimelineStore {
  const initialStart = options?.startFrame ?? 1;
  const initialEnd = options?.endFrame ?? 250;
  const initialCurrent = options?.currentFrame ?? initialStart;
  const initialFps = options?.fps ?? 24;
  const initialLoop = options?.loop ?? true;
  const initialTracks = options?.tracks ?? [];
  const initialActions = options?.actions ?? {};
  const initialActiveAction = options?.activeActionId ?? null;
  const initialAutoKeying = options?.autoKeyingEnabled ?? false;
  const initialAutoKeyMode = options?.autoKeyMode ?? 'locRotScale';

  const store = createStore<TimelineState>((set, get) => ({
    currentFrame: initialCurrent,
    startFrame: initialStart,
    endFrame: initialEnd,
    fps: initialFps,
    isPlaying: false,
    loop: initialLoop,
    tracks: initialTracks,
    actions: initialActions,
    activeActionId: initialActiveAction,
    selectedKeyframeIds: new Set<string>(),
    autoKeyingEnabled: initialAutoKeying,
    autoKeyMode: initialAutoKeyMode,

    setFrame: (frame: number) => {
      const { startFrame, endFrame } = get();
      const clamped = Math.max(startFrame, Math.min(endFrame, Math.round(frame)));
      set({ currentFrame: clamped });
    },

    nextFrame: () => {
      const { currentFrame, startFrame, endFrame, loop } = get();
      if (currentFrame < endFrame) {
        set({ currentFrame: currentFrame + 1 });
      } else if (loop) {
        set({ currentFrame: startFrame });
      }
    },

    prevFrame: () => {
      const { currentFrame, startFrame, endFrame, loop } = get();
      if (currentFrame > startFrame) {
        set({ currentFrame: currentFrame - 1 });
      } else if (loop) {
        set({ currentFrame: endFrame });
      }
    },

    jumpToStart: () => {
      set({ currentFrame: get().startFrame });
    },

    jumpToEnd: () => {
      set({ currentFrame: get().endFrame });
    },

    setFps: (fps: number) => {
      set({ fps: Math.max(1, fps) });
    },

    setFrameRange: (start: number, end: number) => {
      const validStart = Math.min(start, end);
      const validEnd = Math.max(start, end);
      const current = get().currentFrame;
      set({
        startFrame: validStart,
        endFrame: validEnd,
        currentFrame: Math.max(validStart, Math.min(validEnd, current)),
      });
    },

    setLoop: (loop: boolean) => {
      set({ loop });
    },

    play: () => {
      const { currentFrame, endFrame, startFrame, loop } = get();
      if (currentFrame >= endFrame && loop) {
        set({ currentFrame: startFrame, isPlaying: true });
      } else {
        set({ isPlaying: true });
      }
    },

    pause: () => {
      set({ isPlaying: false });
    },

    togglePlay: () => {
      if (get().isPlaying) {
        get().pause();
      } else {
        get().play();
      }
    },

    stop: () => {
      set({ isPlaying: false, currentFrame: get().startFrame });
    },

    addTrack: (trackData) => {
      const id =
        trackData.id ?? `track_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
      const newTrack: AnimationTrack = {
        ...trackData,
        id,
        keyframes: [...trackData.keyframes].sort((a, b) => a.frame - b.frame),
      };
      set((state) => ({ tracks: [...state.tracks, newTrack] }));
      return id;
    },

    removeTrack: (trackId: string) => {
      set((state) => ({
        tracks: state.tracks.filter((t) => t.id !== trackId),
      }));
    },

    getTrack: (trackId: string) => {
      return get().tracks.find((t) => t.id === trackId);
    },

    getTracksForNode: (targetNodeId: string) => {
      return get().tracks.filter((t) => t.targetNodeId === targetNodeId);
    },

    setTracks: (tracks: AnimationTrack[]) => {
      set({ tracks: [...tracks] });
    },

    muteTrack: (trackId: string, muted: boolean = true) => {
      set((state) => {
        const inTracks = state.tracks.some((t) => t.id === trackId);
        const updatedTracks = inTracks
          ? state.tracks.map((t) => (t.id === trackId ? { ...t, muted } : t))
          : state.tracks;

        let actionFound = false;
        const updatedActions: Record<string, IAnimationAction> = {};
        for (const [aId, action] of Object.entries(state.actions)) {
          const chanIdx = action.channels.findIndex((c) => c.id === trackId);
          if (chanIdx >= 0) {
            actionFound = true;
            const updatedChans = [...action.channels];
            updatedChans[chanIdx] = { ...updatedChans[chanIdx], muted };
            updatedActions[aId] = { ...action, channels: updatedChans };
          } else {
            updatedActions[aId] = action;
          }
        }

        return {
          tracks: updatedTracks,
          actions: actionFound ? updatedActions : state.actions,
        };
      });
    },

    lockTrack: (trackId: string, locked: boolean = true) => {
      set((state) => {
        const inTracks = state.tracks.some((t) => t.id === trackId);
        const updatedTracks = inTracks
          ? state.tracks.map((t) => (t.id === trackId ? { ...t, locked } : t))
          : state.tracks;

        let actionFound = false;
        const updatedActions: Record<string, IAnimationAction> = {};
        for (const [aId, action] of Object.entries(state.actions)) {
          const chanIdx = action.channels.findIndex((c) => c.id === trackId);
          if (chanIdx >= 0) {
            actionFound = true;
            const updatedChans = [...action.channels];
            updatedChans[chanIdx] = { ...updatedChans[chanIdx], locked };
            updatedActions[aId] = { ...action, channels: updatedChans };
          } else {
            updatedActions[aId] = action;
          }
        }

        return {
          tracks: updatedTracks,
          actions: actionFound ? updatedActions : state.actions,
        };
      });
    },

    insertKeyframe: (trackOrChannelId, keyframe) => {
      const { fps } = get();
      set((state) => {
        // Look in legacy tracks
        const targetTrack = state.tracks.find((t) => t.id === trackOrChannelId);
        if (targetTrack) {
          const updatedTrack = {
            ...targetTrack,
            keyframes: [...targetTrack.keyframes],
          };
          insertKeyframeToTrack(updatedTrack, keyframe, fps);
          return {
            tracks: state.tracks.map((t) => (t.id === trackOrChannelId ? updatedTrack : t)),
          };
        }

        // Look in actions channels
        let channelFound = false;
        const updatedActions: Record<string, IAnimationAction> = {};
        for (const [aId, action] of Object.entries(state.actions)) {
          const chanIdx = action.channels.findIndex((c) => c.id === trackOrChannelId);
          if (chanIdx >= 0) {
            channelFound = true;
            const updatedChans = [...action.channels];
            const chanCopy = {
              ...updatedChans[chanIdx],
              keyframes: [...updatedChans[chanIdx].keyframes],
            };
            insertKeyframeToTrack(chanCopy as unknown as AnimationTrack, keyframe, fps);
            updatedChans[chanIdx] = chanCopy;
            updatedActions[aId] = { ...action, channels: updatedChans };
          } else {
            updatedActions[aId] = action;
          }
        }

        if (channelFound) {
          return { actions: updatedActions };
        }

        return state;
      });
    },

    removeKeyframe: (trackOrChannelId: string, frame: number) => {
      set((state) => {
        const targetTrack = state.tracks.find((t) => t.id === trackOrChannelId);
        if (targetTrack) {
          const updatedTrack = {
            ...targetTrack,
            keyframes: [...targetTrack.keyframes],
          };
          removeKeyframeFromTrack(updatedTrack, frame);
          return {
            tracks: state.tracks.map((t) => (t.id === trackOrChannelId ? updatedTrack : t)),
          };
        }

        const updatedActions: Record<string, IAnimationAction> = {};
        let found = false;
        for (const [aId, action] of Object.entries(state.actions)) {
          const chanIdx = action.channels.findIndex((c) => c.id === trackOrChannelId);
          if (chanIdx >= 0) {
            found = true;
            const updatedChans = [...action.channels];
            const chanCopy = {
              ...updatedChans[chanIdx],
              keyframes: [...updatedChans[chanIdx].keyframes],
            };
            removeKeyframeFromTrack(chanCopy as unknown as AnimationTrack, frame);
            updatedChans[chanIdx] = chanCopy;
            updatedActions[aId] = { ...action, channels: updatedChans };
          } else {
            updatedActions[aId] = action;
          }
        }

        if (found) {
          return { actions: updatedActions };
        }

        return state;
      });
    },

    getKeyframe: (trackOrChannelId: string, frame: number) => {
      const channel = get().getChannel(trackOrChannelId);
      return channel?.keyframes.find((k) => k.frame === frame);
    },

    clearKeyframes: (trackOrChannelId: string) => {
      set((state) => ({
        tracks: state.tracks.map((t) => (t.id === trackOrChannelId ? { ...t, keyframes: [] } : t)),
      }));
    },

    insertNodeKeyframe: (
      targetNodeId: string,
      property: AnimationProperty,
      frame: number,
      value: number | number[],
      interpolation: KeyframeInterpolation = 'linear',
    ) => {
      const tracks = get().tracks;
      let targetTrack = tracks.find(
        (t) => t.targetNodeId === targetNodeId && t.property === property,
      );

      let trackId: string;
      if (!targetTrack) {
        trackId = get().addTrack(createTrack(targetNodeId, property));
      } else {
        trackId = targetTrack.id;
      }

      get().insertKeyframe(trackId, {
        frame,
        value,
        interpolation,
      });
    },

    // Action & Channel methods
    createAction: (name: string, targetNodeId?: string) => {
      const id = `action_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
      const { startFrame, endFrame } = get();
      const newAction: IAnimationAction = {
        id,
        name,
        targetNodeId,
        groups: [],
        channels: [],
        frameRange: [startFrame, endFrame],
      };
      set((state) => ({
        actions: { ...state.actions, [id]: newAction },
        activeActionId: state.activeActionId ?? id,
      }));
      return id;
    },

    setActiveAction: (actionId: string | null) => {
      set({ activeActionId: actionId });
    },

    getAction: (actionId: string) => {
      return get().actions[actionId];
    },

    updateAction: (actionId: string, updates: Partial<IAnimationAction>) => {
      set((state) => {
        const existing = state.actions[actionId];
        if (!existing) return state;
        return {
          actions: {
            ...state.actions,
            [actionId]: { ...existing, ...updates },
          },
        };
      });
    },

    deleteAction: (actionId: string) => {
      set((state) => {
        const { [actionId]: _, ...remaining } = state.actions;
        return {
          actions: remaining,
          activeActionId: state.activeActionId === actionId ? null : state.activeActionId,
        };
      });
    },

    addChannelToAction: (actionId, channelData) => {
      const channelId =
        channelData.id ?? `chan_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
      const newChannel: IAnimationChannel = {
        ...channelData,
        id: channelId,
        keyframes: [...channelData.keyframes].sort((a, b) => a.frame - b.frame),
      };

      set((state) => {
        const action = state.actions[actionId];
        if (!action) return state;
        return {
          actions: {
            ...state.actions,
            [actionId]: {
              ...action,
              channels: [...action.channels, newChannel],
            },
          },
        };
      });

      return channelId;
    },

    removeChannelFromAction: (actionId: string, channelId: string) => {
      set((state) => {
        const action = state.actions[actionId];
        if (!action) return state;
        return {
          actions: {
            ...state.actions,
            [actionId]: {
              ...action,
              channels: action.channels.filter((c) => c.id !== channelId),
            },
          },
        };
      });
    },

    getChannel: (channelId: string) => {
      // Check legacy tracks first
      const track = get().tracks.find((t) => t.id === channelId);
      if (track) return track;

      // Check actions
      for (const action of Object.values(get().actions)) {
        const chan = action.channels.find((c) => c.id === channelId);
        if (chan) return chan;
      }

      return undefined;
    },

    // Keyframe selection
    selectKeyframe: (keyframeId: string, multiSelect: boolean = false) => {
      set((state) => {
        const next = multiSelect ? new Set(state.selectedKeyframeIds) : new Set<string>();
        next.add(keyframeId);
        return { selectedKeyframeIds: next };
      });
    },

    deselectKeyframe: (keyframeId: string) => {
      set((state) => {
        const next = new Set(state.selectedKeyframeIds);
        next.delete(keyframeId);
        return { selectedKeyframeIds: next };
      });
    },

    clearKeyframeSelection: () => {
      set({ selectedKeyframeIds: new Set<string>() });
    },

    setSelectedKeyframeIds: (ids: string[]) => {
      set({ selectedKeyframeIds: new Set(ids) });
    },

    // Auto-Keying
    setAutoKeying: (enabled: boolean) => {
      set({ autoKeyingEnabled: enabled });
    },

    setAutoKeyMode: (mode) => {
      set({ autoKeyMode: mode });
    },

    tick: () => {
      const { isPlaying, currentFrame, endFrame, startFrame, loop } = get();
      if (!isPlaying) return;

      if (currentFrame < endFrame) {
        set({ currentFrame: currentFrame + 1 });
      } else if (loop) {
        set({ currentFrame: startFrame });
      } else {
        set({ isPlaying: false });
      }
    },

    getTimeline: () => {
      const state = get();
      return {
        currentFrame: state.currentFrame,
        startFrame: state.startFrame,
        endFrame: state.endFrame,
        fps: state.fps,
        playbackState: state.isPlaying ? (state.loop ? 'looping' : 'playing') : 'paused',
        isPlaying: state.isPlaying,
        loop: state.loop,
        tracks: state.tracks,
        actions: state.actions,
        activeActionId: state.activeActionId ?? undefined,
      };
    },

    loadTimeline: (timeline) => {
      set((state) => ({
        currentFrame: timeline.currentFrame ?? state.currentFrame,
        startFrame: timeline.startFrame ?? state.startFrame,
        endFrame: timeline.endFrame ?? state.endFrame,
        fps: timeline.fps ?? state.fps,
        loop: timeline.loop ?? state.loop,
        tracks: timeline.tracks ? [...timeline.tracks] : state.tracks,
        actions: timeline.actions ? { ...timeline.actions } : state.actions,
        activeActionId:
          timeline.activeActionId !== undefined ? timeline.activeActionId : state.activeActionId,
      }));
    },

    reset: () => {
      set({
        currentFrame: initialStart,
        startFrame: initialStart,
        endFrame: initialEnd,
        fps: initialFps,
        isPlaying: false,
        loop: initialLoop,
        tracks: [],
        actions: {},
        activeActionId: null,
        selectedKeyframeIds: new Set<string>(),
        autoKeyingEnabled: false,
      });
    },
  }));

  const extendedStore = store as TimelineStore;
  extendedStore.getTimeline = () => store.getState().getTimeline();
  extendedStore.loadTimeline = (timeline) => store.getState().loadTimeline(timeline);
  extendedStore.reset = () => store.getState().reset();

  return extendedStore;
}

/**
 * Default global timeline store singleton
 */
export const timelineStore = createTimelineStore();
