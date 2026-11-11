import { describe, it, expect, vi } from 'vitest';
import {
  createTimelineStore,
  createTrack,
  evaluateTrack,
  evaluateNodeTransform,
  PlaybackController,
} from '../src/index.js';

describe('Animation Timeline, Keyframe Tracks & Playback Controller', () => {
  it('manages timeline state with Zustand store', () => {
    const store = createTimelineStore({ startFrame: 1, endFrame: 100, fps: 30 });
    const state = store.getState();

    expect(state.currentFrame).toBe(1);
    expect(state.fps).toBe(30);
    expect(state.startFrame).toBe(1);
    expect(state.endFrame).toBe(100);
    expect(state.isPlaying).toBe(false);
    expect(state.loop).toBe(true);

    store.getState().setFrame(50);
    expect(store.getState().currentFrame).toBe(50);

    // Frame bounds clamping
    store.getState().setFrame(150);
    expect(store.getState().currentFrame).toBe(100);

    store.getState().setFrame(-10);
    expect(store.getState().currentFrame).toBe(1);
  });

  it('manages keyframe tracks for position (x, y, z), rotation (x, y, z), scale (x, y, z)', () => {
    const store = createTimelineStore();
    const nodeId = 'cube_1';

    // Insert keyframes for position x, y, z
    store.getState().insertNodeKeyframe(nodeId, 'position.x', 1, 0);
    store.getState().insertNodeKeyframe(nodeId, 'position.x', 10, 100);

    store.getState().insertNodeKeyframe(nodeId, 'position.y', 1, 5);
    store.getState().insertNodeKeyframe(nodeId, 'position.y', 10, 25);

    store.getState().insertNodeKeyframe(nodeId, 'rotation.z', 1, 0);
    store.getState().insertNodeKeyframe(nodeId, 'rotation.z', 10, Math.PI);

    store.getState().insertNodeKeyframe(nodeId, 'scale.x', 1, 1);
    store.getState().insertNodeKeyframe(nodeId, 'scale.x', 10, 2);

    const tracks = store.getState().getTracksForNode(nodeId);
    expect(tracks.length).toBe(4);

    // Evaluate node transform at frame 5.5 (halfway between 1 and 10)
    const midTransform = evaluateNodeTransform(tracks, nodeId, 5.5);
    expect(midTransform.position?.x).toBeCloseTo(50, 2);
    expect(midTransform.position?.y).toBeCloseTo(15, 2);
    expect(midTransform.rotation?.z).toBeCloseTo(Math.PI / 2, 2);
    expect(midTransform.scale?.x).toBeCloseTo(1.5, 2);

    // Remove a keyframe
    const posXTrack = tracks.find((t) => t.property === 'position.x')!;
    store.getState().removeKeyframe(posXTrack.id, 10);
    expect(store.getState().getKeyframe(posXTrack.id, 10)).toBeUndefined();
  });

  it('evaluates tracks with various interpolation types', () => {
    const track = createTrack('light_1', 'position.x', 'PosX');
    track.keyframes = [
      { frame: 1, time: 0, value: 0, interpolation: 'step' },
      { frame: 10, time: 0.375, value: 100, interpolation: 'ease-in-out' },
      { frame: 20, time: 0.75, value: 200, interpolation: 'linear' },
    ];

    // Step from 1 to 10
    expect(evaluateTrack(track, 1)).toBe(0);
    expect(evaluateTrack(track, 5)).toBe(0); // Holds until frame 10
    expect(evaluateTrack(track, 10)).toBe(100);

    // Ease-in-out between 10 and 20
    const val15 = evaluateTrack(track, 15) as number;
    expect(val15).toBeCloseTo(150, 1);

    // Clamp before first / after last keyframe
    expect(evaluateTrack(track, 0)).toBe(0);
    expect(evaluateTrack(track, 50)).toBe(200);
  });

  it('controls playback (play, pause, nextFrame, prevFrame, jumpToStart, jumpToEnd)', () => {
    const store = createTimelineStore({ startFrame: 1, endFrame: 10, fps: 24, loop: true });
    const controller = new PlaybackController(store);

    expect(controller.getCurrentFrame()).toBe(1);

    controller.nextFrame();
    expect(controller.getCurrentFrame()).toBe(2);

    controller.prevFrame();
    expect(controller.getCurrentFrame()).toBe(1);

    // PrevFrame on start with loop goes to end
    controller.prevFrame();
    expect(controller.getCurrentFrame()).toBe(10);

    // NextFrame on end with loop goes to start
    controller.nextFrame();
    expect(controller.getCurrentFrame()).toBe(1);

    controller.jumpToEnd();
    expect(controller.getCurrentFrame()).toBe(10);

    controller.jumpToStart();
    expect(controller.getCurrentFrame()).toBe(1);

    // Play / Pause
    controller.play();
    expect(controller.isPlaying()).toBe(true);

    controller.pause();
    expect(controller.isPlaying()).toBe(false);

    // Frame change callback
    const listener = vi.fn();
    const unsub = controller.onFrameChange(listener);
    controller.setFrame(7);
    expect(listener).toHaveBeenCalledWith(7);

    unsub();
    controller.setFrame(8);
    expect(listener).toHaveBeenCalledTimes(1);

    controller.dispose();
  });
});
