import { createStore, type StoreApi } from 'zustand/vanilla';
import type {
  AnimationTrack,
  AnimationProperty,
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

  // Keyframe management
  insertKeyframe: (trackId: string, keyframe: Omit<IKeyframe, 'time'> & { time?: number }) => void;
  removeKeyframe: (trackId: string, frame: number) => void;
  getKeyframe: (trackId: string, frame: number) => IKeyframe | undefined;
  clearKeyframes: (trackId: string) => void;

  // Node keyframe convenience helper
  insertNodeKeyframe: (
    targetNodeId: string,
    property: AnimationProperty,
    frame: number,
    value: number | number[],
    interpolation?: KeyframeInterpolation,
  ) => void;

  // Frame advance tick
  tick: () => void;

  // Reset
  reset: () => void;
}

export type TimelineStore = StoreApi<TimelineState>;

export interface CreateTimelineOptions {
  currentFrame?: number;
  startFrame?: number;
  endFrame?: number;
  fps?: number;
  loop?: boolean;
  tracks?: AnimationTrack[];
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

  return createStore<TimelineState>((set, get) => ({
    currentFrame: initialCurrent,
    startFrame: initialStart,
    endFrame: initialEnd,
    fps: initialFps,
    isPlaying: false,
    loop: initialLoop,
    tracks: initialTracks,

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
      set((state) => ({
        tracks: state.tracks.map((t) => (t.id === trackId ? { ...t, muted } : t)),
      }));
    },

    insertKeyframe: (trackId, keyframe) => {
      const { fps } = get();
      set((state) => {
        const targetTrack = state.tracks.find((t) => t.id === trackId);
        if (!targetTrack) return state;

        const updatedTrack = {
          ...targetTrack,
          keyframes: [...targetTrack.keyframes],
        };
        insertKeyframeToTrack(updatedTrack, keyframe, fps);

        return {
          tracks: state.tracks.map((t) => (t.id === trackId ? updatedTrack : t)),
        };
      });
    },

    removeKeyframe: (trackId: string, frame: number) => {
      set((state) => {
        const targetTrack = state.tracks.find((t) => t.id === trackId);
        if (!targetTrack) return state;

        const updatedTrack = {
          ...targetTrack,
          keyframes: [...targetTrack.keyframes],
        };
        removeKeyframeFromTrack(updatedTrack, frame);

        return {
          tracks: state.tracks.map((t) => (t.id === trackId ? updatedTrack : t)),
        };
      });
    },

    getKeyframe: (trackId: string, frame: number) => {
      const track = get().getTrack(trackId);
      return track?.keyframes.find((k) => k.frame === frame);
    },

    clearKeyframes: (trackId: string) => {
      set((state) => ({
        tracks: state.tracks.map((t) => (t.id === trackId ? { ...t, keyframes: [] } : t)),
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

    reset: () => {
      set({
        currentFrame: initialStart,
        startFrame: initialStart,
        endFrame: initialEnd,
        fps: initialFps,
        isPlaying: false,
        loop: initialLoop,
        tracks: [],
      });
    },
  }));
}

/**
 * Default global timeline store singleton
 */
export const timelineStore = createTimelineStore();
