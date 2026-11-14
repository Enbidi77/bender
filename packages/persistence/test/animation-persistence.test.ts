import { describe, it, expect } from 'vitest';
import {
  createDefaultProjectDocument,
  serializeProject,
  deserializeProject,
  validateProjectDocument,
  migrateProjectDocument,
  CURRENT_PROJECT_VERSION,
  LEGACY_PROJECT_VERSION,
  MemoryStorageAdapter,
  FileStorageAdapter,
  saveProject,
  loadProject,
  BezierHandleSchema,
  KeyframeInterpolationSchema,
  KeyframeHandleTypeSchema,
  KeyframeTypeSchema,
  KeyframeSchema,
  ExtrapolationModeSchema,
  FCurveModifierSchema,
  AnimationChannelSchema,
  AnimationActionSchema,
  AnimationTimelineSchema,
} from '../src/index.js';
import type {
  ProjectDocument,
  IKeyframe,
  IAnimationChannel,
  IAnimationAction,
  AnimationTimeline,
} from '@blender-elt/contracts';
import { tmpdir } from 'os';
import { join } from 'path';

describe('packages/persistence - Animation Persistence & Schemas (Milestone 4)', () => {
  describe('Zod Schema Unit Tests', () => {
    it('validates BezierHandleSchema with coordinates', () => {
      const validHandle = { frame: -5, value: 2.5 };
      expect(BezierHandleSchema.safeParse(validHandle).success).toBe(true);

      const invalidHandle = { frame: 'invalid', value: 2.5 };
      expect(BezierHandleSchema.safeParse(invalidHandle).success).toBe(false);
    });

    it('validates KeyframeInterpolationSchema', () => {
      const validModes = [
        'constant',
        'linear',
        'bezier',
        'step',
        'ease-in',
        'ease-out',
        'ease-in-out',
      ];
      validModes.forEach((mode) => {
        expect(KeyframeInterpolationSchema.safeParse(mode).success).toBe(true);
      });

      expect(KeyframeInterpolationSchema.safeParse('spline').success).toBe(false);
    });

    it('validates KeyframeHandleTypeSchema and KeyframeTypeSchema', () => {
      ['auto', 'aligned', 'vector', 'free'].forEach((type) => {
        expect(KeyframeHandleTypeSchema.safeParse(type).success).toBe(true);
      });
      expect(KeyframeHandleTypeSchema.safeParse('custom').success).toBe(false);

      ['keyframe', 'breakdown', 'extreme', 'jitter'].forEach((ktype) => {
        expect(KeyframeTypeSchema.safeParse(ktype).success).toBe(true);
      });
      expect(KeyframeTypeSchema.safeParse('normal').success).toBe(false);
    });

    it('validates KeyframeSchema with full Bezier handles and semantic tags', () => {
      const kf: IKeyframe = {
        id: 'kf_test_1',
        frame: 24,
        time: 1.0,
        value: 15.5,
        interpolation: 'bezier',
        handleTypeLeft: 'aligned',
        handleTypeRight: 'aligned',
        handleLeft: { frame: -4, value: -2.0 },
        handleRight: { frame: 4, value: 2.0 },
        keyframeType: 'extreme',
        selected: true,
      };

      const result = KeyframeSchema.safeParse(kf);
      expect(result.success).toBe(true);
    });

    it('validates ExtrapolationModeSchema', () => {
      ['constant', 'linear', 'cyclic', 'cyclic_offset'].forEach((mode) => {
        expect(ExtrapolationModeSchema.safeParse(mode).success).toBe(true);
      });
      expect(ExtrapolationModeSchema.safeParse('ping-pong').success).toBe(false);
    });

    it('validates FCurveModifierSchema discriminated union', () => {
      const noiseMod = {
        id: 'mod_1',
        type: 'noise',
        name: 'Noise Shake',
        enabled: true,
        influence: 0.8,
        scale: 2.0,
        strength: 0.5,
        phase: 1.0,
        depth: 2,
      };
      expect(FCurveModifierSchema.safeParse(noiseMod).success).toBe(true);

      const cyclesMod = {
        id: 'mod_2',
        type: 'cycles',
        name: 'Cycle Loop',
        enabled: true,
        influence: 1.0,
        modeBefore: 'repeat',
        countBefore: 0,
        modeAfter: 'repeat_offset',
        countAfter: 3,
      };
      expect(FCurveModifierSchema.safeParse(cyclesMod).success).toBe(true);

      const limitsMod = {
        id: 'mod_3',
        type: 'limits',
        name: 'Limit Clamp',
        enabled: true,
        influence: 1.0,
        minY: -10,
        maxY: 10,
      };
      expect(FCurveModifierSchema.safeParse(limitsMod).success).toBe(true);

      const steppedMod = {
        id: 'mod_4',
        type: 'stepped',
        name: 'Step Hold',
        enabled: true,
        influence: 1.0,
        stepSize: 2,
        offset: 0,
      };
      expect(FCurveModifierSchema.safeParse(steppedMod).success).toBe(true);

      const generatorMod = {
        id: 'mod_5',
        type: 'generator',
        name: 'Polynomial',
        enabled: true,
        influence: 1.0,
        coefficients: [1, 2, 3],
      };
      expect(FCurveModifierSchema.safeParse(generatorMod).success).toBe(true);

      // Unknown modifier type
      expect(FCurveModifierSchema.safeParse({ id: 'mod_x', type: 'unknown' }).success).toBe(false);
    });
  });

  describe('Full Animation Serialization & Deserialization (.belt / JSON)', () => {
    it('serializes and deserializes a project containing complete timeline, actions, channels, handles, and modifiers', () => {
      const doc = createDefaultProjectDocument('Animated Character Project');

      const positionXChannel: IAnimationChannel = {
        id: 'chan_pos_x',
        name: 'Position X',
        targetNodeId: 'cube-default',
        propertyPath: 'position.x',
        color: '#ff0000',
        interpolation: 'bezier',
        extrapolation: 'cyclic_offset',
        muted: false,
        locked: false,
        keyframes: [
          {
            id: 'kf_1',
            frame: 1,
            time: 0,
            value: 0,
            interpolation: 'bezier',
            handleTypeLeft: 'aligned',
            handleTypeRight: 'aligned',
            handleLeft: { frame: -5, value: -2 },
            handleRight: { frame: 5, value: 2 },
            keyframeType: 'keyframe',
            selected: false,
          },
          {
            id: 'kf_2',
            frame: 30,
            time: 1.0,
            value: 12.5,
            interpolation: 'bezier',
            handleTypeLeft: 'free',
            handleTypeRight: 'free',
            handleLeft: { frame: 25, value: 10 },
            handleRight: { frame: 35, value: 15 },
            keyframeType: 'extreme',
            selected: true,
          },
        ],
        modifiers: [
          {
            id: 'mod_noise_x',
            type: 'noise',
            name: 'Wobble',
            enabled: true,
            influence: 0.5,
            scale: 3.0,
            strength: 0.4,
            phase: 0.5,
            depth: 2,
          },
          {
            id: 'mod_limits_x',
            type: 'limits',
            name: 'Bounding',
            enabled: true,
            influence: 1.0,
            minY: 0,
            maxY: 20,
          },
        ],
      };

      const rotationYChannel: IAnimationChannel = {
        id: 'chan_rot_y',
        name: 'Rotation Y',
        targetNodeId: 'cube-default',
        propertyPath: 'rotation.y',
        color: '#00ff00',
        interpolation: 'linear',
        extrapolation: 'cyclic',
        muted: false,
        locked: false,
        keyframes: [
          { id: 'kf_rot_1', frame: 1, time: 0, value: 0 },
          { id: 'kf_rot_2', frame: 60, time: 2.0, value: 3.14159 },
        ],
      };

      const runAction: IAnimationAction = {
        id: 'action_run',
        name: 'RunCycle',
        targetNodeId: 'cube-default',
        frameRange: [1, 60],
        isLooping: true,
        groups: [
          {
            id: 'grp_transform',
            name: 'Transform',
            color: '#4772b3',
            channelIds: ['chan_pos_x', 'chan_rot_y'],
            isExpanded: true,
          },
        ],
        channels: [positionXChannel, rotationYChannel],
      };

      const timeline: AnimationTimeline = {
        currentFrame: 30,
        startFrame: 1,
        endFrame: 120,
        fps: 30,
        playbackState: 'playing',
        isPlaying: true,
        loop: true,
        activeActionId: 'action_run',
        actions: {
          action_run: runAction,
        },
        tracks: [],
        nlaTracks: [
          {
            id: 'nla_track_1',
            name: 'NLA Base',
            isMuted: false,
            isSolo: false,
            isLocked: false,
            strips: [
              {
                id: 'strip_run',
                name: 'Run Strip',
                actionId: 'action_run',
                startFrame: 1,
                endFrame: 60,
                actionStartFrame: 1,
                actionEndFrame: 60,
                playbackSpeed: 1.0,
                repeatCount: 2,
                blendMode: 'replace',
                isMuted: false,
              },
            ],
          },
        ],
      };

      doc.timeline = timeline;

      // Serialize
      const json = serializeProject(doc);
      expect(typeof json).toBe('string');
      expect(json).toContain('"action_run"');
      expect(json).toContain('"cyclic_offset"');
      expect(json).toContain('"Wobble"');

      // Deserialize
      const restored = deserializeProject(json);
      expect(restored.version).toBe(CURRENT_PROJECT_VERSION);
      expect(restored.timeline).toBeDefined();

      const restoredTl = restored.timeline!;
      expect(restoredTl.currentFrame).toBe(30);
      expect(restoredTl.startFrame).toBe(1);
      expect(restoredTl.endFrame).toBe(120);
      expect(restoredTl.fps).toBe(30);
      expect(restoredTl.isPlaying).toBe(true);
      expect(restoredTl.loop).toBe(true);
      expect(restoredTl.activeActionId).toBe('action_run');

      // Verify Actions & Channels
      const restoredAction = restoredTl.actions?.['action_run'];
      expect(restoredAction).toBeDefined();
      expect(restoredAction?.name).toBe('RunCycle');
      expect(restoredAction?.channels).toHaveLength(2);

      const chanX = restoredAction?.channels.find((c) => c.id === 'chan_pos_x');
      expect(chanX).toBeDefined();
      expect(chanX?.propertyPath).toBe('position.x');
      expect(chanX?.extrapolation).toBe('cyclic_offset');
      expect(chanX?.keyframes).toHaveLength(2);
      expect(chanX?.keyframes[0].handleLeft).toEqual({ frame: -5, value: -2 });
      expect(chanX?.keyframes[1].keyframeType).toBe('extreme');
      expect(chanX?.keyframes[1].selected).toBe(true);

      // Verify Modifiers
      expect(chanX?.modifiers).toHaveLength(2);
      expect(chanX?.modifiers?.[0].type).toBe('noise');
      expect((chanX?.modifiers?.[0] as any).strength).toBe(0.4);

      // Verify NLA Tracks
      expect(restoredTl.nlaTracks).toHaveLength(1);
      expect(restoredTl.nlaTracks?.[0].strips[0].repeatCount).toBe(2);
    });
  });

  describe('Backward Compatibility (v1.0.0 Documents)', () => {
    it('successfully loads a v1.0.0 document without timeline', () => {
      const v1Doc: any = {
        version: LEGACY_PROJECT_VERSION,
        metadata: {
          name: 'Legacy Project No Anim',
          version: LEGACY_PROJECT_VERSION,
          createdAt: '2026-01-01T00:00:00.000Z',
          updatedAt: '2026-01-01T00:00:00.000Z',
          appVersion: '0.1.0',
        },
        root: {
          id: 'root',
          name: 'Scene Root',
          type: 'root',
          childrenIds: ['cube-default'],
        },
        nodes: {
          'cube-default': {
            id: 'cube-default',
            name: 'Cube',
            type: 'mesh',
            geometryId: 'geo-cube-default',
            transform: {
              position: { x: 0, y: 0, z: 0 },
              rotation: { x: 0, y: 0, z: 0 },
              scale: { x: 1, y: 1, z: 1 },
            },
            visible: true,
            locked: false,
            parentId: 'root',
            childrenIds: [],
          },
        },
        geometries: {},
        materials: {},
      };

      const restored = deserializeProject(JSON.stringify(v1Doc));
      expect(restored.version).toBe(CURRENT_PROJECT_VERSION);
      expect(restored.metadata.name).toBe('Legacy Project No Anim');
      expect(restored.timeline).toBeUndefined();
    });

    it('successfully loads a v1.0.0 document with empty tracks and no actions', () => {
      const v1Doc: any = {
        version: LEGACY_PROJECT_VERSION,
        metadata: {
          name: 'Legacy Project Empty Anim',
          version: LEGACY_PROJECT_VERSION,
          createdAt: '2026-01-01T00:00:00.000Z',
          updatedAt: '2026-01-01T00:00:00.000Z',
          appVersion: '0.1.0',
        },
        root: {
          id: 'root',
          name: 'Scene Root',
          type: 'root',
          childrenIds: [],
        },
        nodes: {},
        geometries: {},
        materials: {},
        timeline: {
          currentFrame: 1,
          startFrame: 1,
          endFrame: 100,
          fps: 24,
          tracks: [],
        },
      };

      const restored = deserializeProject(JSON.stringify(v1Doc));
      expect(restored.version).toBe(CURRENT_PROJECT_VERSION);
      expect(restored.timeline?.currentFrame).toBe(1);
      expect(restored.timeline?.endFrame).toBe(100);
      expect(restored.timeline?.tracks).toEqual([]);
    });

    it('migrates legacy tracks from v1.0.0 into modern channels under default "Action"', () => {
      const v1Doc: any = {
        version: LEGACY_PROJECT_VERSION,
        metadata: {
          name: 'Legacy Keyframed Project',
          version: LEGACY_PROJECT_VERSION,
          createdAt: '2026-01-01T00:00:00.000Z',
          updatedAt: '2026-01-01T00:00:00.000Z',
          appVersion: '0.1.0',
        },
        root: {
          id: 'root',
          name: 'Scene Root',
          type: 'root',
          childrenIds: ['cube-default'],
        },
        nodes: {
          'cube-default': {
            id: 'cube-default',
            name: 'Cube',
            type: 'mesh',
            geometryId: 'geo-cube-default',
            transform: {
              position: { x: 0, y: 0, z: 0 },
              rotation: { x: 0, y: 0, z: 0 },
              scale: { x: 1, y: 1, z: 1 },
            },
            visible: true,
            locked: false,
            parentId: 'root',
            childrenIds: [],
          },
        },
        geometries: {},
        materials: {},
        timeline: {
          currentFrame: 15,
          startFrame: 1,
          endFrame: 200,
          fps: 24,
          tracks: [
            {
              id: 'legacy-track-1',
              name: 'Cube Translation X',
              targetNodeId: 'cube-default',
              property: 'position.x',
              color: '#4772b3',
              keyframes: [
                { frame: 1, value: 0 },
                { frame: 24, value: 5.5, interpolation: 'linear' },
              ],
            },
            {
              id: 'legacy-track-2',
              name: 'Cube Translation Y',
              targetNodeId: 'cube-default',
              property: 'position.y',
              color: '#38a169',
              keyframes: [
                { frame: 1, value: 0 },
                { frame: 48, value: 10.0, interpolation: 'bezier' },
              ],
            },
          ],
        },
      };

      const restored = deserializeProject(JSON.stringify(v1Doc));
      expect(restored.version).toBe(CURRENT_PROJECT_VERSION);
      expect(restored.timeline).toBeDefined();

      const tl = restored.timeline!;
      expect(tl.activeActionId).toBe('action_default');
      expect(tl.actions).toBeDefined();

      const defaultAction = tl.actions?.['action_default'];
      expect(defaultAction).toBeDefined();
      expect(defaultAction?.name).toBe('Action');
      expect(defaultAction?.channels).toHaveLength(2);

      const chanX = defaultAction?.channels[0];
      expect(chanX?.id).toBe('legacy-track-1');
      expect(chanX?.name).toBe('Cube Translation X');
      expect(chanX?.targetNodeId).toBe('cube-default');
      expect(chanX?.propertyPath).toBe('position.x');
      expect(chanX?.keyframes).toHaveLength(2);
      expect(chanX?.keyframes[0].frame).toBe(1);
      expect(chanX?.keyframes[0].value).toBe(0);
      expect(chanX?.keyframes[1].frame).toBe(24);
      expect(chanX?.keyframes[1].value).toBe(5.5);

      const chanY = defaultAction?.channels[1];
      expect(chanY?.id).toBe('legacy-track-2');
      expect(chanY?.propertyPath).toBe('position.y');
      expect(chanY?.keyframes[1].value).toBe(10.0);
    });

    it('does not overwrite existing actions during migration if actions with channels already exist', () => {
      const existingDoc = createDefaultProjectDocument('Existing Actions Project');
      existingDoc.timeline = {
        currentFrame: 1,
        startFrame: 1,
        endFrame: 250,
        fps: 24,
        playbackState: 'stopped',
        isPlaying: false,
        loop: true,
        tracks: [
          {
            id: 'track-dup',
            name: 'Duplicate Track',
            targetNodeId: 'cube-default',
            property: 'scale.x',
            keyframes: [],
          },
        ],
        activeActionId: 'custom-action',
        actions: {
          'custom-action': {
            id: 'custom-action',
            name: 'Custom Action',
            groups: [],
            channels: [
              {
                id: 'chan-keep',
                name: 'Keep Channel',
                targetNodeId: 'cube-default',
                propertyPath: 'scale.x',
                keyframes: [{ id: 'kf-k', frame: 1, time: 0, value: 1 }],
                interpolation: 'bezier',
                extrapolation: 'constant',
                color: '#4772b3',
              },
            ],
            frameRange: [1, 250],
          },
        },
      };

      const migrated = migrateProjectDocument(existingDoc);
      expect(migrated.timeline?.activeActionId).toBe('custom-action');
      expect(Object.keys(migrated.timeline?.actions || {})).toEqual(['custom-action']);
      expect(migrated.timeline?.actions?.['custom-action'].channels[0].id).toBe('chan-keep');
    });
  });

  describe('Validation & Error Handling', () => {
    it('fails safely when timeline contains invalid non-numeric frame numbers', () => {
      const invalidDoc = createDefaultProjectDocument('Invalid Frame Doc');
      (invalidDoc as any).timeline = {
        currentFrame: 'forty-eight', // Invalid: string instead of number
        startFrame: 1,
        endFrame: 100,
        fps: 24,
      };

      const validation = validateProjectDocument(invalidDoc);
      expect(validation.success).toBe(false);
      expect(validation.error).toContain('timeline.currentFrame');

      expect(() => deserializeProject(JSON.stringify(invalidDoc))).toThrowError(
        /Project schema validation failed: timeline\.currentFrame/,
      );
    });

    it('fails safely when keyframe contains invalid interpolation enum', () => {
      const invalidDoc = createDefaultProjectDocument('Invalid Interpolation Doc');
      (invalidDoc as any).timeline = {
        currentFrame: 1,
        startFrame: 1,
        endFrame: 100,
        fps: 24,
        tracks: [
          {
            id: 'trk-1',
            name: 'Test',
            targetNodeId: 'cube-default',
            propertyPath: 'position.x',
            keyframes: [
              {
                id: 'kf-bad',
                frame: 1,
                time: 0,
                value: 0,
                interpolation: 'unsupported-interpolation',
              },
            ],
          },
        ],
      };

      const validation = validateProjectDocument(invalidDoc);
      expect(validation.success).toBe(false);
      expect(validation.error).toContain('interpolation');
    });

    it('fails safely when modifier type is invalid', () => {
      const invalidDoc = createDefaultProjectDocument('Invalid Modifier Doc');
      (invalidDoc as any).timeline = {
        currentFrame: 1,
        startFrame: 1,
        endFrame: 100,
        fps: 24,
        actions: {
          act_1: {
            id: 'act_1',
            name: 'Act 1',
            frameRange: [1, 100],
            channels: [
              {
                id: 'ch-1',
                name: 'Ch 1',
                targetNodeId: 'cube-default',
                propertyPath: 'position.x',
                keyframes: [],
                modifiers: [
                  {
                    id: 'bad-mod',
                    type: 'nonexistent-modifier-type',
                    name: 'Bad Mod',
                  },
                ],
              },
            ],
          },
        },
      };

      const validation = validateProjectDocument(invalidDoc);
      expect(validation.success).toBe(false);
      expect(validation.error).toContain('modifiers');
    });
  });

  describe('Storage Adapter Integration with Animation', () => {
    it('roundtrips animated project through MemoryStorageAdapter', async () => {
      const memAdapter = new MemoryStorageAdapter();
      const doc = createDefaultProjectDocument('Memory Animated Project');

      doc.timeline = {
        currentFrame: 45,
        startFrame: 1,
        endFrame: 120,
        fps: 24,
        playbackState: 'stopped',
        isPlaying: false,
        loop: true,
        activeActionId: 'act-jump',
        actions: {
          'act-jump': {
            id: 'act-jump',
            name: 'Jump',
            targetNodeId: 'cube-default',
            frameRange: [1, 60],
            groups: [],
            channels: [
              {
                id: 'chan-jump-y',
                name: 'Jump Height',
                targetNodeId: 'cube-default',
                propertyPath: 'position.y',
                interpolation: 'bezier',
                extrapolation: 'constant',
                color: '#4772b3',
                keyframes: [
                  { id: 'k1', frame: 1, time: 0, value: 0 },
                  { id: 'k2', frame: 30, time: 1.25, value: 8 },
                  { id: 'k3', frame: 60, time: 2.5, value: 0 },
                ],
              },
            ],
          },
        },
        tracks: [],
      };

      await saveProject(memAdapter, 'projects/jump.belt', doc);
      expect(await memAdapter.exists('projects/jump.belt')).toBe(true);

      const loaded = await loadProject(memAdapter, 'projects/jump.belt');
      expect(loaded.version).toBe(CURRENT_PROJECT_VERSION);
      expect(loaded.timeline?.activeActionId).toBe('act-jump');
      expect(loaded.timeline?.actions?.['act-jump'].channels[0].keyframes).toHaveLength(3);
    });

    it('roundtrips animated project through FileStorageAdapter', async () => {
      const fileAdapter = new FileStorageAdapter();
      const tempPath = join(tmpdir(), `animated-belt-test-${Date.now()}.belt`);

      try {
        const doc = createDefaultProjectDocument('Disk Animated Project');
        doc.timeline = {
          currentFrame: 10,
          startFrame: 1,
          endFrame: 100,
          fps: 24,
          playbackState: 'stopped',
          isPlaying: false,
          loop: false,
          actions: {},
          tracks: [],
        };

        await saveProject(fileAdapter, tempPath, doc);
        expect(await fileAdapter.exists(tempPath)).toBe(true);

        const loaded = await loadProject(fileAdapter, tempPath);
        expect(loaded.metadata.name).toBe('Disk Animated Project');
        expect(loaded.timeline?.currentFrame).toBe(10);
      } finally {
        await fileAdapter.delete(tempPath);
        expect(await fileAdapter.exists(tempPath)).toBe(false);
      }
    });
  });
});
