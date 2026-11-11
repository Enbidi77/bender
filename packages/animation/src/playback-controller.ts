import type { TimelineStore } from './timeline-store.js';
import type { AnimationProperty, IKeyframe, KeyframeInterpolation } from '@blender-elt/contracts';

/**
 * Controller managing timeline playback loops, timers, and frame dispatch
 */
export class PlaybackController {
  private store: TimelineStore;
  private timerId: ReturnType<typeof setInterval> | null = null;
  private unsubscribeStore: (() => void) | null = null;
  private frameListeners = new Set<(frame: number) => void>();

  constructor(store: TimelineStore) {
    this.store = store;

    // Listen to frame changes in store and notify subscribers
    let lastFrame = this.store.getState().currentFrame;
    this.unsubscribeStore = this.store.subscribe((state) => {
      if (state.currentFrame !== lastFrame) {
        lastFrame = state.currentFrame;
        for (const cb of this.frameListeners) {
          cb(state.currentFrame);
        }
      }

      // If store isPlaying changed externally, sync our timer
      if (state.isPlaying && !this.timerId) {
        this.startTimer();
      } else if (!state.isPlaying && this.timerId) {
        this.stopTimer();
      }
    });
  }

  /**
   * Starts playback
   */
  public play(): void {
    this.store.getState().play();
    this.startTimer();
  }

  /**
   * Pauses playback
   */
  public pause(): void {
    this.store.getState().pause();
    this.stopTimer();
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
   * Timer management
   */
  private startTimer(): void {
    this.stopTimer();
    const fps = this.store.getState().fps;
    const intervalMs = Math.max(1, Math.round(1000 / fps));

    this.timerId = setInterval(() => {
      this.store.getState().tick();
      if (!this.store.getState().isPlaying) {
        this.stopTimer();
      }
    }, intervalMs);
  }

  private stopTimer(): void {
    if (this.timerId !== null) {
      clearInterval(this.timerId);
      this.timerId = null;
    }
  }

  /**
   * Cleans up listeners and timers
   */
  public dispose(): void {
    this.stopTimer();
    if (this.unsubscribeStore) {
      this.unsubscribeStore();
      this.unsubscribeStore = null;
    }
    this.frameListeners.clear();
  }
}
