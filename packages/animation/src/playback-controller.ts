import type { TimelineStore } from './timeline-store.js';
import type { AnimationProperty, IKeyframe, KeyframeInterpolation } from '@blender-elt/contracts';

/**
 * Platform-independent high-resolution timing polyfill
 */
const safeRaf =
  typeof requestAnimationFrame === 'function'
    ? requestAnimationFrame
    : (cb: (t: number) => void) => setTimeout(() => cb(performance.now()), 16) as unknown as number;

const safeCaf =
  typeof cancelAnimationFrame === 'function'
    ? cancelAnimationFrame
    : (id: number) => clearTimeout(id as unknown as ReturnType<typeof setTimeout>);

/**
 * Dedicated high-resolution delta-time playback engine.
 * Employs requestAnimationFrame with delta-time accumulator to eliminate timer drift and tab lag.
 */
export class PlaybackEngine {
  private store: TimelineStore;
  private animFrameId: number | null = null;
  private lastTimeMs: number = 0;
  private accumulatorSec: number = 0;

  constructor(store: TimelineStore) {
    this.store = store;
  }

  /**
   * Starts high-resolution playback loop
   */
  public start(): void {
    if (this.animFrameId !== null) return;
    this.lastTimeMs = performance.now();
    this.accumulatorSec = 0;
    this.loop = this.loop.bind(this);
    this.animFrameId = safeRaf(this.loop);
  }

  /**
   * Stops playback loop
   */
  public stop(): void {
    if (this.animFrameId !== null) {
      safeCaf(this.animFrameId);
      this.animFrameId = null;
    }
  }

  /**
   * High-resolution frame step loop
   */
  private loop(currentTimeMs: number): void {
    // Clamp delta time to avoid huge frame jumps during background tab lag
    const deltaSec = Math.min((currentTimeMs - this.lastTimeMs) / 1000, 0.1);
    this.lastTimeMs = currentTimeMs;

    const state = this.store.getState();
    if (!state.isPlaying) {
      this.stop();
      return;
    }

    const frameDurationSec = 1 / state.fps;
    this.accumulatorSec += deltaSec;

    // Drain accumulated time by stepping frames
    while (this.accumulatorSec >= frameDurationSec) {
      this.store.getState().tick();
      this.accumulatorSec -= frameDurationSec;

      // If store stopped during tick (e.g. end reached without loop), exit loop
      if (!this.store.getState().isPlaying) {
        this.stop();
        return;
      }
    }

    this.animFrameId = safeRaf(this.loop);
  }

  /**
   * Check if playback loop is actively running
   */
  public isRunning(): boolean {
    return this.animFrameId !== null;
  }
}

/**
 * Controller managing timeline playback loops, timers, frame dispatch, and editing
 */
export class PlaybackController {
  private store: TimelineStore;
  private engine: PlaybackEngine;
  private unsubscribeStore: (() => void) | null = null;
  private frameListeners = new Set<(frame: number) => void>();

  constructor(store: TimelineStore) {
    this.store = store;
    this.engine = new PlaybackEngine(store);

    // Listen to frame changes in store and notify subscribers
    let lastFrame = this.store.getState().currentFrame;
    this.unsubscribeStore = this.store.subscribe((state) => {
      if (state.currentFrame !== lastFrame) {
        lastFrame = state.currentFrame;
        for (const cb of this.frameListeners) {
          cb(state.currentFrame);
        }
      }

      // If store isPlaying changed externally, sync our playback engine
      if (state.isPlaying && !this.engine.isRunning()) {
        this.engine.start();
      } else if (!state.isPlaying && this.engine.isRunning()) {
        this.engine.stop();
      }
    });
  }

  /**
   * Starts playback
   */
  public play(): void {
    this.store.getState().play();
    this.engine.start();
  }

  /**
   * Pauses playback
   */
  public pause(): void {
    this.store.getState().pause();
    this.engine.stop();
  }

  /**
   * Toggles playback between play and pause
   */
  public togglePlay(): void {
    if (this.isPlaying()) {
      this.pause();
    } else {
      this.play();
    }
  }

  /**
   * Steps to the next frame
   */
  public nextFrame(): void {
    this.store.getState().nextFrame();
  }

  /**
   * Steps to the previous frame
   */
  public prevFrame(): void {
    this.store.getState().prevFrame();
  }

  /**
   * Jumps to the timeline start frame
   */
  public jumpToStart(): void {
    this.store.getState().jumpToStart();
  }

  /**
   * Jumps to the timeline end frame
   */
  public jumpToEnd(): void {
    this.store.getState().jumpToEnd();
  }

  /**
   * Sets current frame directly
   */
  public setFrame(frame: number): void {
    this.store.getState().setFrame(frame);
  }

  /**
   * Inserts keyframe into a track
   */
  public insertKeyframe(
    trackId: string,
    keyframe: Omit<IKeyframe, 'time'> & { time?: number },
  ): void {
    this.store.getState().insertKeyframe(trackId, keyframe);
  }

  /**
   * Inserts keyframe directly for a node property
   */
  public insertNodeKeyframe(
    nodeId: string,
    property: AnimationProperty,
    frame: number,
    value: number | number[],
    interpolation?: KeyframeInterpolation,
  ): void {
    this.store.getState().insertNodeKeyframe(nodeId, property, frame, value, interpolation);
  }

  /**
   * Removes keyframe at frame from a track
   */
  public removeKeyframe(trackId: string, frame: number): void {
    this.store.getState().removeKeyframe(trackId, frame);
  }

  /**
   * Current frame getter
   */
  public getCurrentFrame(): number {
    return this.store.getState().currentFrame;
  }

  /**
   * Checks if playback is running
   */
  public isPlaying(): boolean {
    return this.store.getState().isPlaying;
  }

  /**
   * Subscribes to frame changes
   */
  public onFrameChange(callback: (frame: number) => void): () => void {
    this.frameListeners.add(callback);
    return () => {
      this.frameListeners.delete(callback);
    };
  }

  /**
   * Cleans up listeners and timers
   */
  public dispose(): void {
    this.engine.stop();
    if (this.unsubscribeStore) {
      this.unsubscribeStore();
      this.unsubscribeStore = null;
    }
    this.frameListeners.clear();
  }
}
