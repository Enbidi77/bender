import { describe, it, expect, beforeEach, vi } from 'vitest';
import type { CommandContext } from '@blender-elt/contracts';
import { createTimelineStore, createTrack, type TimelineStore } from '@blender-elt/animation';
import {
  CommandManager,
  CommandRegistry,
  createDefaultCommandRegistry,
  registerAnimationActions,
  ANIMATION_ACTIONS,
  InsertKeyframeCommand,
  DeleteKeyframeCommand,
  MoveKeyframeCommand,
  SetInterpolationCommand,
  SetKeyframeTangentsCommand,
  SetTrackMutedCommand,
  SetTrackLockedCommand,
  InsertTransformKeyframeCommand,
  getTimelineStore,
} from '../src/index.js';

describe('Undoable Animation Commands (@blender-elt/commands)', () => {
  let timeline: TimelineStore;
  let context: CommandContext;
  let manager: CommandManager;
  let trackId: string;

  beforeEach(() => {
    timeline = createTimelineStore({ startFrame: 1, endFrame: 100, fps: 24 });
    manager = new CommandManager();
    context = {
      state: timeline.getState(),
      dispatch: vi.fn(),
      metadata: { timelineStore: timeline },
    };
    trackId = timeline.getState().addTrack(createTrack('node_cube', 'position.x'));
  });

  describe('InsertKeyframeCommand', () => {
    it('inserts a new keyframe and undoes cleanly', async () => {
      const cmd = new InsertKeyframeCommand(trackId, {
        frame: 10,
        value: 42,
        interpolation: 'bezier',
      });

      await manager.execute(cmd, context);
      const inserted = timeline.getState().getKeyframe(trackId, 10);
      expect(inserted).toBeDefined();
      expect(inserted?.value).toBe(42);
      expect(inserted?.interpolation).toBe('bezier');
      expect(manager.canUndo).toBe(true);

      // Undo
      await manager.undo(context);
      expect(timeline.getState().getKeyframe(trackId, 10)).toBeUndefined();
      expect(manager.canRedo).toBe(true);

      // Redo
      await manager.redo(context);
      const redone = timeline.getState().getKeyframe(trackId, 10);
      expect(redone).toBeDefined();
      expect(redone?.value).toBe(42);
    });

    it('replaces an existing keyframe and restores previous keyframe on undo', async () => {
      // Setup initial keyframe at frame 20
      timeline.getState().insertKeyframe(trackId, {
        frame: 20,
        value: 100,
        interpolation: 'linear',
      });

      const cmd = new InsertKeyframeCommand(trackId, {
        frame: 20,
        value: 999,
        interpolation: 'constant',
      });

      await manager.execute(cmd, context);
      const updated = timeline.getState().getKeyframe(trackId, 20);
      expect(updated?.value).toBe(999);
      expect(updated?.interpolation).toBe('constant');

      // Undo restores the original value (100) and interpolation ('linear')
      await manager.undo(context);
      const reverted = timeline.getState().getKeyframe(trackId, 20);
      expect(reverted).toBeDefined();
      expect(reverted?.value).toBe(100);
      expect(reverted?.interpolation).toBe('linear');

      // Redo re-applies the replacement (999)
      await manager.redo(context);
      expect(timeline.getState().getKeyframe(trackId, 20)?.value).toBe(999);
    });
  });

  describe('DeleteKeyframeCommand', () => {
    it('deletes an existing keyframe and restores it on undo', async () => {
      timeline.getState().insertKeyframe(trackId, {
        frame: 15,
        value: 250,
        interpolation: 'bezier',
        handleTypeLeft: 'aligned',
        handleTypeRight: 'aligned',
      });

      const cmd = new DeleteKeyframeCommand(trackId, 15);
      await manager.execute(cmd, context);
      expect(timeline.getState().getKeyframe(trackId, 15)).toBeUndefined();

      // Undo restores the exact keyframe
      await manager.undo(context);
      const restored = timeline.getState().getKeyframe(trackId, 15);
      expect(restored).toBeDefined();
      expect(restored?.value).toBe(250);
      expect(restored?.interpolation).toBe('bezier');
      expect(restored?.handleTypeLeft).toBe('aligned');

      // Redo re-deletes it
      await manager.redo(context);
      expect(timeline.getState().getKeyframe(trackId, 15)).toBeUndefined();
    });

    it('handles delete on nonexistent keyframe gracefully', async () => {
      const cmd = new DeleteKeyframeCommand(trackId, 99);
      await manager.execute(cmd, context);
      expect(timeline.getState().getKeyframe(trackId, 99)).toBeUndefined();

      // Undo does nothing
      await manager.undo(context);
      expect(timeline.getState().getKeyframe(trackId, 99)).toBeUndefined();
    });
  });

  describe('MoveKeyframeCommand', () => {
    it('moves a keyframe to a new frame and undoes cleanly', async () => {
      timeline.getState().insertKeyframe(trackId, {
        frame: 10,
        value: 55,
      });

      const cmd = new MoveKeyframeCommand(trackId, 10, 30);
      await manager.execute(cmd, context);

      expect(timeline.getState().getKeyframe(trackId, 10)).toBeUndefined();
      const moved = timeline.getState().getKeyframe(trackId, 30);
      expect(moved).toBeDefined();
      expect(moved?.value).toBe(55);

      // Undo
      await manager.undo(context);
      expect(timeline.getState().getKeyframe(trackId, 30)).toBeUndefined();
      const reverted = timeline.getState().getKeyframe(trackId, 10);
      expect(reverted).toBeDefined();
      expect(reverted?.value).toBe(55);

      // Redo
      await manager.redo(context);
      expect(timeline.getState().getKeyframe(trackId, 10)).toBeUndefined();
      expect(timeline.getState().getKeyframe(trackId, 30)?.value).toBe(55);
    });

    it('handles collision by restoring overwritten keyframe on undo', async () => {
      // Keyframe 1 at frame 10 (value 10)
      timeline.getState().insertKeyframe(trackId, {
        frame: 10,
        value: 10,
      });
      // Keyframe 2 at frame 20 (value 20)
      timeline.getState().insertKeyframe(trackId, {
        frame: 20,
        value: 20,
      });

      // Move keyframe from 10 to 20, colliding with frame 20
      const cmd = new MoveKeyframeCommand(trackId, 10, 20);
      await manager.execute(cmd, context);

      expect(timeline.getState().getKeyframe(trackId, 10)).toBeUndefined();
      const at20 = timeline.getState().getKeyframe(trackId, 20);
      expect(at20?.value).toBe(10); // Overwritten with value from frame 10

      // Undo must restore BOTH original keyframes: 10 with value 10, 20 with value 20
      await manager.undo(context);

      const kf10 = timeline.getState().getKeyframe(trackId, 10);
      const kf20 = timeline.getState().getKeyframe(trackId, 20);
      expect(kf10).toBeDefined();
      expect(kf10?.value).toBe(10);
      expect(kf20).toBeDefined();
      expect(kf20?.value).toBe(20);

      // Redo re-executes collision move
      await manager.redo(context);
      expect(timeline.getState().getKeyframe(trackId, 10)).toBeUndefined();
      expect(timeline.getState().getKeyframe(trackId, 20)?.value).toBe(10);
    });

    it('ignores moving to the same frame (no-op)', async () => {
      timeline.getState().insertKeyframe(trackId, { frame: 10, value: 10 });
      const cmd = new MoveKeyframeCommand(trackId, 10, 10);
      await manager.execute(cmd, context);
      expect(timeline.getState().getKeyframe(trackId, 10)?.value).toBe(10);
    });
  });

  describe('SetInterpolationCommand', () => {
    it('changes keyframe interpolation and reverts on undo', async () => {
      timeline.getState().insertKeyframe(trackId, {
        frame: 5,
        value: 12,
        interpolation: 'linear',
      });

      const cmd = new SetInterpolationCommand(trackId, 5, 'bezier');
      await manager.execute(cmd, context);
      expect(timeline.getState().getKeyframe(trackId, 5)?.interpolation).toBe('bezier');

      await manager.undo(context);
      expect(timeline.getState().getKeyframe(trackId, 5)?.interpolation).toBe('linear');

      await manager.redo(context);
      expect(timeline.getState().getKeyframe(trackId, 5)?.interpolation).toBe('bezier');
    });
  });

  describe('SetKeyframeTangentsCommand', () => {
    it('updates control handles and handle types and reverts on undo', async () => {
      timeline.getState().insertKeyframe(trackId, {
        frame: 10,
        value: 50,
        interpolation: 'bezier',
        handleLeft: { frame: 8, value: 45 },
        handleRight: { frame: 12, value: 55 },
        handleTypeLeft: 'free',
        handleTypeRight: 'free',
      });

      const cmd = new SetKeyframeTangentsCommand(
        trackId,
        10,
        {
          handleLeft: { frame: 7, value: 40 },
          handleRight: { frame: 13, value: 60 },
        },
        {
          handleTypeLeft: 'aligned',
          handleTypeRight: 'aligned',
        },
      );

      await manager.execute(cmd, context);
      const updated = timeline.getState().getKeyframe(trackId, 10);
      expect(updated?.handleLeft?.frame).toBe(7);
      expect(updated?.handleLeft?.value).toBe(40);
      expect(updated?.handleRight?.frame).toBe(13);
      expect(updated?.handleRight?.value).toBe(60);
      expect(updated?.handleTypeLeft).toBe('aligned');
      expect(updated?.handleTypeRight).toBe('aligned');

      // Undo reverts to initial handles
      await manager.undo(context);
      const reverted = timeline.getState().getKeyframe(trackId, 10);
      expect(reverted?.handleLeft?.frame).toBe(8);
      expect(reverted?.handleLeft?.value).toBe(45);
      expect(reverted?.handleRight?.frame).toBe(12);
      expect(reverted?.handleRight?.value).toBe(55);
      expect(reverted?.handleTypeLeft).toBe('free');
      expect(reverted?.handleTypeRight).toBe('free');

      // Redo re-applies
      await manager.redo(context);
      expect(timeline.getState().getKeyframe(trackId, 10)?.handleLeft?.frame).toBe(7);
    });
  });

  describe('SetTrackMutedCommand & SetTrackLockedCommand', () => {
    it('mutes and unmutes track with undo/redo', async () => {
      expect(timeline.getState().getTrack(trackId)?.muted).toBeFalsy();

      const muteCmd = new SetTrackMutedCommand(trackId, true);
      await manager.execute(muteCmd, context);
      expect(timeline.getState().getTrack(trackId)?.muted).toBe(true);

      await manager.undo(context);
      expect(timeline.getState().getTrack(trackId)?.muted).toBe(false);

      await manager.redo(context);
      expect(timeline.getState().getTrack(trackId)?.muted).toBe(true);
    });

    it('locks and unlocks track with undo/redo', async () => {
      expect(timeline.getState().getTrack(trackId)?.locked).toBeFalsy();

      const lockCmd = new SetTrackLockedCommand(trackId, true);
      await manager.execute(lockCmd, context);
      expect(timeline.getState().getTrack(trackId)?.locked).toBe(true);

      await manager.undo(context);
      expect(timeline.getState().getTrack(trackId)?.locked).toBe(false);

      await manager.redo(context);
      expect(timeline.getState().getTrack(trackId)?.locked).toBe(true);
    });
  });

  describe('InsertTransformKeyframeCommand (Compound Macro)', () => {
    it('inserts transform keyframes across channels atomically and undoes cleanly', async () => {
      const nodeId = 'robot_arm';
      const cmd = new InsertTransformKeyframeCommand(
        nodeId,
        1,
        { x: 10, y: 20, z: 30 },
        { x: 0, y: Math.PI / 2, z: 0 },
        { x: 1, y: 1, z: 1 },
      );

      await manager.execute(cmd, context);

      // Verify all 9 transform channels were created and keyframed at frame 1
      const tracks = timeline.getState().getTracksForNode(nodeId);
      expect(tracks.length).toBe(9);

      const posX = tracks.find((t) => t.propertyPath === 'position.x');
      const rotY = tracks.find((t) => t.propertyPath === 'rotation.y');
      const scaZ = tracks.find((t) => t.propertyPath === 'scale.z');

      expect(posX?.keyframes.find((k) => k.frame === 1)?.value).toBe(10);
      expect(rotY?.keyframes.find((k) => k.frame === 1)?.value).toBeCloseTo(Math.PI / 2, 4);
      expect(scaZ?.keyframes.find((k) => k.frame === 1)?.value).toBe(1);

      // Undo removes all 9 keyframes atomically
      await manager.undo(context);
      for (const t of timeline.getState().getTracksForNode(nodeId)) {
        expect(t.keyframes.find((k) => k.frame === 1)).toBeUndefined();
      }

      // Redo re-inserts all 9 keyframes
      await manager.redo(context);
      const rePosX = timeline
        .getState()
        .getTracksForNode(nodeId)
        .find((t) => t.propertyPath === 'position.x');
      expect(rePosX?.keyframes.find((k) => k.frame === 1)?.value).toBe(10);
    });

    it('supports options object constructor and partial properties', async () => {
      const nodeId = 'light_spot';
      const cmd = new InsertTransformKeyframeCommand(nodeId, 5, {
        position: { x: 5, z: 15 }, // Partial position (no y)
        scale: [2, 2, 2], // Array format
        interpolation: 'linear',
      });

      await manager.execute(cmd, context);

      const tracks = timeline.getState().getTracksForNode(nodeId);
      // 2 for position (x, z) + 3 for scale = 5 tracks
      expect(tracks.length).toBe(5);

      const posX = tracks.find((t) => t.propertyPath === 'position.x');
      expect(posX?.keyframes.find((k) => k.frame === 5)?.value).toBe(5);
      expect(posX?.keyframes.find((k) => k.frame === 5)?.interpolation).toBe('linear');

      const scaY = tracks.find((t) => t.propertyPath === 'scale.y');
      expect(scaY?.keyframes.find((k) => k.frame === 5)?.value).toBe(2);

      await manager.undo(context);
      const reTracks = timeline.getState().getTracksForNode(nodeId);
      const rePosX = reTracks.find((t) => t.propertyPath === 'position.x');
      expect(rePosX?.keyframes.find((k) => k.frame === 5)).toBeUndefined();
    });

    it('works with action channels when actions exist in timelineStore', async () => {
      const actionId = timeline.getState().createAction('WalkAction', 'character_1');
      timeline.getState().setActiveAction(actionId);

      const cmd = new InsertTransformKeyframeCommand('character_1', 10, {
        position: { x: 100, y: 0, z: 50 },
      });

      await manager.execute(cmd, context);

      const action = timeline.getState().getAction(actionId);
      expect(action?.channels.length).toBe(3);
      const xChan = action?.channels.find((c) => c.propertyPath === 'position.x');
      expect(xChan?.keyframes.find((k) => k.frame === 10)?.value).toBe(100);

      await manager.undo(context);
      const undoneChan = timeline
        .getState()
        .getAction(actionId)
        ?.channels.find((c) => c.propertyPath === 'position.x');
      expect(undoneChan?.keyframes.find((k) => k.frame === 10)).toBeUndefined();
    });
  });

  describe('CommandRegistry Animation Action Bindings', () => {
    let registry: CommandRegistry;

    beforeEach(() => {
      registry = new CommandRegistry();
      registerAnimationActions(registry);
    });

    it('registers all 10 required animation actions', () => {
      const expectedActionIds = [
        'animation:insert-keyframe-menu',
        'animation:delete-keyframe',
        'animation:toggle-play',
        'animation:prev-frame',
        'animation:next-frame',
        'animation:jump-start',
        'animation:jump-end',
        'animation:prev-keyframe',
        'animation:next-keyframe',
        'animation:toggle-auto-key',
      ];

      for (const id of expectedActionIds) {
        expect(registry.get(id)).toBeDefined();
        expect(registry.get(id)?.category).toBe('animation');
      }

      const animActions = registry.getByCategory('animation');
      expect(animActions.length).toBe(10);
    });

    it('resolves shortcuts accurately for all actions', () => {
      // 'i' -> insert-keyframe-menu
      expect(registry.findActionByShortcut({ key: 'i' })?.id).toBe(
        'animation:insert-keyframe-menu',
      );

      // 'alt+i' -> delete-keyframe
      expect(registry.findActionByShortcut({ key: 'i', altKey: true })?.id).toBe(
        'animation:delete-keyframe',
      );

      // 'space' or ' ' -> toggle-play
      expect(registry.findActionByShortcut({ key: 'space' })?.id).toBe('animation:toggle-play');
      expect(registry.findActionByShortcut({ key: ' ' })?.id).toBe('animation:toggle-play');

      // 'arrowleft' -> prev-frame
      expect(registry.findActionByShortcut({ key: 'arrowleft' })?.id).toBe('animation:prev-frame');
      expect(registry.findActionByShortcut({ key: 'ArrowLeft' })?.id).toBe('animation:prev-frame');

      // 'arrowright' -> next-frame
      expect(registry.findActionByShortcut({ key: 'arrowright' })?.id).toBe('animation:next-frame');
      expect(registry.findActionByShortcut({ key: 'ArrowRight' })?.id).toBe('animation:next-frame');

      // 'shift+arrowleft' -> jump-start
      expect(registry.findActionByShortcut({ key: 'arrowleft', shiftKey: true })?.id).toBe(
        'animation:jump-start',
      );

      // 'shift+arrowright' -> jump-end
      expect(registry.findActionByShortcut({ key: 'arrowright', shiftKey: true })?.id).toBe(
        'animation:jump-end',
      );

      // 'arrowdown' -> prev-keyframe
      expect(registry.findActionByShortcut({ key: 'arrowdown' })?.id).toBe(
        'animation:prev-keyframe',
      );

      // 'arrowup' -> next-keyframe
      expect(registry.findActionByShortcut({ key: 'arrowup' })?.id).toBe('animation:next-keyframe');

      // 'shift+alt+k' -> toggle-auto-key
      expect(registry.findActionByShortcut({ key: 'k', shiftKey: true, altKey: true })?.id).toBe(
        'animation:toggle-auto-key',
      );
    });

    it('executes transport actions: toggle-play, next-frame, prev-frame, jump-start, jump-end', async () => {
      timeline.getState().setFrame(10);

      // Next frame
      await registry.executeCommand('animation:next-frame', context);
      expect(timeline.getState().currentFrame).toBe(11);

      // Prev frame
      await registry.executeCommand('animation:prev-frame', context);
      expect(timeline.getState().currentFrame).toBe(10);

      // Jump to end
      await registry.executeCommand('animation:jump-end', context);
      expect(timeline.getState().currentFrame).toBe(100);

      // Jump to start
      await registry.executeCommand('animation:jump-start', context);
      expect(timeline.getState().currentFrame).toBe(1);

      // Toggle play
      expect(timeline.getState().isPlaying).toBe(false);
      await registry.executeCommand('animation:toggle-play', context);
      expect(timeline.getState().isPlaying).toBe(true);
      await registry.executeCommand('animation:toggle-play', context);
      expect(timeline.getState().isPlaying).toBe(false);
    });

    it('executes keyframe navigation actions: prev-keyframe, next-keyframe', async () => {
      // Setup keyframes at 10, 25, 60
      timeline.getState().insertKeyframe(trackId, { frame: 10, value: 0 });
      timeline.getState().insertKeyframe(trackId, { frame: 25, value: 10 });
      timeline.getState().insertKeyframe(trackId, { frame: 60, value: 20 });

      timeline.getState().setFrame(1);

      // Next keyframe from 1 should jump to 10
      await registry.executeCommand('animation:next-keyframe', context);
      expect(timeline.getState().currentFrame).toBe(10);

      // Next keyframe from 10 should jump to 25
      await registry.executeCommand('animation:next-keyframe', context);
      expect(timeline.getState().currentFrame).toBe(25);

      // Next keyframe from 25 should jump to 60
      await registry.executeCommand('animation:next-keyframe', context);
      expect(timeline.getState().currentFrame).toBe(60);

      // Prev keyframe from 60 should jump to 25
      await registry.executeCommand('animation:prev-keyframe', context);
      expect(timeline.getState().currentFrame).toBe(25);

      // Prev keyframe from 25 should jump to 10
      await registry.executeCommand('animation:prev-keyframe', context);
      expect(timeline.getState().currentFrame).toBe(10);
    });

    it('executes toggle-auto-key', async () => {
      expect(timeline.getState().autoKeyingEnabled).toBe(false);
      await registry.executeCommand('animation:toggle-auto-key', context);
      expect(timeline.getState().autoKeyingEnabled).toBe(true);
      await registry.executeCommand('animation:toggle-auto-key', context);
      expect(timeline.getState().autoKeyingEnabled).toBe(false);
    });

    it('creates default registry singleton with animation actions pre-registered', () => {
      const defaultReg = createDefaultCommandRegistry();
      expect(defaultReg.getByCategory('animation')).toHaveLength(10);
      expect(ANIMATION_ACTIONS).toHaveLength(10);
    });
  });
});
