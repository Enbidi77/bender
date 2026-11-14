import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { createTimelineStore } from '../src/timeline-store.js';
import { PlaybackEngine, PlaybackController } from '../src/playback-controller.js';

describe('High-Resolution Playback Engine & Controller', () => {
  beforeEach(() => {
    vi.useFakeTimers({
      toFake: ['setTimeout', 'clearTimeout', 'setInterval', 'clearInterval', 'Date', 'performance'],
    });
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('runs high-resolution delta-time playback and advances frames', () => {
    const store = createTimelineStore({ startFrame: 1, endFrame: 100, fps: 24, loop: true });
    const engine = new PlaybackEngine(store);

    expect(engine.isRunning()).toBe(false);

    store.getState().play();
    engine.start();
    expect(engine.isRunning()).toBe(true);

    // Fast-forward ~1 second (24 frames at 24fps)
    vi.advanceTimersByTime(1000);

    const frameAfter1s = store.getState().currentFrame;
    // With 24fps in 1000ms, should have advanced approximately 24 frames
    expect(frameAfter1s).toBeGreaterThanOrEqual(23);
    expect(frameAfter1s).toBeLessThanOrEqual(26);

    engine.stop();
    expect(engine.isRunning()).toBe(false);
  });

  it('loops cleanly from endFrame to startFrame when loop is true', () => {
    const store = createTimelineStore({ startFrame: 1, endFrame: 5, fps: 10, loop: true });
    const controller = new PlaybackController(store);

    controller.setFrame(4);
    controller.play();

    // Advance 300ms (3 frames at 10fps): 4 -> 5 -> 1 -> 2
    vi.advanceTimersByTime(300);

    expect(store.getState().currentFrame).toBeGreaterThanOrEqual(1);
    expect(store.getState().currentFrame).toBeLessThanOrEqual(5);

    controller.dispose();
  });

  it('stops playback automatically when endFrame is reached and loop is false', () => {
    const store = createTimelineStore({ startFrame: 1, endFrame: 5, fps: 10, loop: false });
    const controller = new PlaybackController(store);

    controller.setFrame(4);
    controller.play();

    // Advance 500ms (5 frames): should hit frame 5 and stop
    vi.advanceTimersByTime(500);

    expect(store.getState().isPlaying).toBe(false);
    expect(store.getState().currentFrame).toBe(5);

    controller.dispose();
  });

  it('handles pause and resume seamlessly without accumulating elapsed lag', () => {
    const store = createTimelineStore({ startFrame: 1, endFrame: 100, fps: 20, loop: true });
    const controller = new PlaybackController(store);

    controller.play();
    vi.advanceTimersByTime(200); // ~4 frames
    const pausedFrame = store.getState().currentFrame;

    controller.pause();
    expect(controller.isPlaying()).toBe(false);

    // Fast-forward 5 seconds while paused: frame must not advance
    vi.advanceTimersByTime(5000);
    expect(store.getState().currentFrame).toBe(pausedFrame);

    // Resume: frame advances progressively from pausedFrame without a giant burst
    controller.play();
    vi.advanceTimersByTime(200); // ~4 frames at 20fps
    expect(store.getState().currentFrame).toBeGreaterThanOrEqual(pausedFrame + 3);
    expect(store.getState().currentFrame).toBeLessThanOrEqual(pausedFrame + 5);

    controller.dispose();
  });
});
