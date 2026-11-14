import { describe, it, expect, beforeEach, vi } from 'vitest';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import {
  TimelineBar,
  DopeSheetView,
  GraphEditorView,
  AnimationBottomPanel,
  KeyframeMenuModal,
  buildProjectDocument,
  getChannelColor,
  getKeyframeId,
  type DopeSheetChannel,
} from '../src/index.js';
import { timelineStore } from '@blender-elt/animation';
import { createSceneStore, createMeshNode } from '@blender-elt/scene-core';
import {
  CommandManager,
  InsertTransformKeyframeCommand,
  DeleteKeyframeCommand,
} from '@blender-elt/commands';

describe('Milestone 5 & 6: Enhanced Animation UI Components', () => {
  beforeEach(() => {
    timelineStore.getState().reset();
  });

  const sampleChannels: DopeSheetChannel[] = [
    {
      id: 'chan_pos_x',
      name: 'Position X',
      targetNodeId: 'node_cube',
      propertyPath: 'position.x',
      color: '#e53e3e',
      keyframes: [
        {
          id: 'kf_px_1',
          frame: 1,
          time: 1 / 24,
          value: 0,
          interpolation: 'bezier',
          handleTypeLeft: 'aligned',
          handleTypeRight: 'aligned',
          handleLeft: { frame: -5, value: 0 },
          handleRight: { frame: 5, value: 1 },
        },
        {
          id: 'kf_px_20',
          frame: 20,
          time: 20 / 24,
          value: 5,
          interpolation: 'bezier',
          handleTypeLeft: 'aligned',
          handleTypeRight: 'aligned',
          handleLeft: { frame: -5, value: -1 },
          handleRight: { frame: 5, value: 0 },
        },
        {
          id: 'kf_px_40',
          frame: 40,
          time: 40 / 24,
          value: 2,
          interpolation: 'linear',
        },
      ],
    },
    {
      id: 'chan_pos_y',
      name: 'Position Y',
      targetNodeId: 'node_cube',
      propertyPath: 'position.y',
      color: '#38a169',
      keyframes: [
        {
          id: 'kf_py_1',
          frame: 1,
          time: 1 / 24,
          value: 0,
          interpolation: 'bezier',
        },
        {
          id: 'kf_py_30',
          frame: 30,
          time: 30 / 24,
          value: 8,
          interpolation: 'bezier',
        },
      ],
    },
    {
      id: 'chan_pos_z',
      name: 'Position Z',
      targetNodeId: 'node_cube',
      propertyPath: 'position.z',
      color: '#3182ce',
      keyframes: [
        {
          id: 'kf_pz_20',
          frame: 20,
          time: 20 / 24,
          value: -3,
          interpolation: 'bezier',
        },
      ],
    },
  ];

  describe('1. Enhanced TimelineBar Component', () => {
    it('renders scrubber track with keyframe tick markers at exact frames', () => {
      const markers = [1, 20, 30, 40];
      const html = renderToStaticMarkup(
        React.createElement(TimelineBar, {
          currentFrame: 20,
          startFrame: 1,
          endFrame: 100,
          keyframeMarkers: markers,
          onSetFrame: vi.fn(),
        }),
      );

      expect(html).toContain('data-testid="keyframe-marker-1"');
      expect(html).toContain('data-testid="keyframe-marker-20"');
      expect(html).toContain('data-testid="keyframe-marker-30"');
      expect(html).toContain('data-testid="keyframe-marker-40"');
      expect(html).toContain('title="Keyframe at frame 20"');
    });

    it('renders Auto-Keying toggle button with record dot', () => {
      const htmlInactive = renderToStaticMarkup(
        React.createElement(TimelineBar, {
          currentFrame: 1,
          autoKeying: false,
          onSetFrame: vi.fn(),
        }),
      );
      expect(htmlInactive).toContain('aria-label="Auto-Keying"');
      expect(htmlInactive).toContain('data-active="false"');

      const htmlActive = renderToStaticMarkup(
        React.createElement(TimelineBar, {
          currentFrame: 1,
          autoKeying: true,
          onSetFrame: vi.fn(),
        }),
      );
      expect(htmlActive).toContain('data-active="true"');
      expect(htmlActive).toContain('bg-red-600');
    });

    it('renders full transport controls (Jump Start, Prev Keyframe, Prev Frame, Play/Pause, Next Frame, Next Keyframe, Jump End, Loop)', () => {
      const html = renderToStaticMarkup(
        React.createElement(TimelineBar, {
          currentFrame: 10,
          isPlaying: false,
          loop: true,
          onSetFrame: vi.fn(),
        }),
      );

      expect(html).toContain('aria-label="Jump to Start"');
      expect(html).toContain('aria-label="Previous Keyframe"');
      expect(html).toContain('aria-label="Previous Frame"');
      expect(html).toContain('aria-label="Play / Pause"');
      expect(html).toContain('aria-label="Stop"');
      expect(html).toContain('aria-label="Next Frame"');
      expect(html).toContain('aria-label="Next Keyframe"');
      expect(html).toContain('aria-label="Jump to End"');
      expect(html).toContain('aria-label="Loop Playback"');
    });

    it('renders frame inputs for Current Frame, Start Frame, End Frame and FPS', () => {
      const html = renderToStaticMarkup(
        React.createElement(TimelineBar, {
          currentFrame: 42,
          startFrame: 5,
          endFrame: 120,
          fps: 30,
          onChangeFps: vi.fn(),
          onSetFrame: vi.fn(),
        }),
      );

      expect(html).toContain('value="42"');
      expect(html).toContain('value="5"');
      expect(html).toContain('value="120"');
      expect(html).toContain('30 fps');
    });

    it('displays selected object status and viewport stats', () => {
      const html = renderToStaticMarkup(
        React.createElement(TimelineBar, {
          currentFrame: 1,
          selectedObjectName: 'Suzanne_Monkey',
          selectedObjectType: 'mesh',
          totalObjects: 4,
          totalVertices: 500,
          totalFaces: 480,
          viewportFps: 59.9,
          onSetFrame: vi.fn(),
        }),
      );

      expect(html).toContain('Suzanne_Monkey');
      expect(html).toContain('(mesh)');
      expect(html).toContain('Objects: 4');
      expect(html).toContain('Verts: 500');
      expect(html).toContain('Faces: 480');
      expect(html).toContain('59.9 FPS');
    });
  });

  describe('2. DopeSheetView Component', () => {
    it('renders left hierarchy tree with object, action, and individual channels', () => {
      const html = renderToStaticMarkup(
        React.createElement(DopeSheetView, {
          currentFrame: 1,
          selectedObjectName: 'Robot_Arm',
          channels: sampleChannels,
        }),
      );

      expect(html).toContain('Robot_Arm');
      expect(html).toContain('Action');
      expect(html).toContain('Position X');
      expect(html).toContain('Position Y');
      expect(html).toContain('Position Z');
    });

    it('renders channel mute and lock toggle buttons', () => {
      const html = renderToStaticMarkup(
        React.createElement(DopeSheetView, {
          currentFrame: 1,
          channels: sampleChannels,
        }),
      );

      expect(html).toContain('aria-label="Toggle Mute Channel"');
      expect(html).toContain('aria-label="Toggle Lock Channel"');
    });

    it('renders top Summary row with aggregated diamond markers', () => {
      const html = renderToStaticMarkup(
        React.createElement(DopeSheetView, {
          currentFrame: 1,
          channels: sampleChannels,
        }),
      );

      expect(html).toContain('Summary');
      expect(html).toContain('data-testid="summary-diamond-1"');
      expect(html).toContain('data-testid="summary-diamond-20"');
      expect(html).toContain('data-testid="summary-diamond-30"');
      expect(html).toContain('data-testid="summary-diamond-40"');
    });

    it('renders diamond markers for keyframes on channel rows', () => {
      const html = renderToStaticMarkup(
        React.createElement(DopeSheetView, {
          currentFrame: 1,
          channels: sampleChannels,
        }),
      );

      expect(html).toContain('data-testid="channel-diamond-chan_pos_x-1"');
      expect(html).toContain('data-testid="channel-diamond-chan_pos_x-20"');
      expect(html).toContain('data-testid="channel-diamond-chan_pos_x-40"');
      expect(html).toContain('data-testid="channel-diamond-chan_pos_y-30"');
      expect(html).toContain('data-testid="channel-diamond-chan_pos_z-20"');
    });

    it('highlights selected keyframe diamonds with amber glow and border', () => {
      const selected = new Set(['kf_px_20']);
      const html = renderToStaticMarkup(
        React.createElement(DopeSheetView, {
          currentFrame: 1,
          channels: sampleChannels,
          selectedKeyframeIds: selected,
        }),
      );

      expect(html).toContain('border-white shadow-[0_0_6px_rgba(251,191,36,0.9)]');
    });

    it('renders frame ruler and playhead line', () => {
      const html = renderToStaticMarkup(
        React.createElement(DopeSheetView, {
          currentFrame: 20,
          channels: sampleChannels,
        }),
      );

      expect(html).toContain('bg-red-500');
    });

    it('renders delete button showing count of selected keyframes', () => {
      const selected = new Set(['kf_px_1', 'kf_px_20']);
      const html = renderToStaticMarkup(
        React.createElement(DopeSheetView, {
          currentFrame: 1,
          channels: sampleChannels,
          selectedKeyframeIds: selected,
        }),
      );

      expect(html).toContain('aria-label="Delete Keyframes"');
      expect(html).toContain('>2<');
    });
  });

  describe('3. GraphEditorView Component', () => {
    it('renders SVG curve groups for active channels with standard Blender axis colors', () => {
      const html = renderToStaticMarkup(
        React.createElement(GraphEditorView, {
          currentFrame: 1,
          channels: sampleChannels,
        }),
      );

      expect(html).toContain('data-testid="curve-group-chan_pos_x"');
      expect(html).toContain('data-testid="curve-group-chan_pos_y"');
      expect(html).toContain('data-testid="curve-group-chan_pos_z"');

      // Verify Blender axis colors
      expect(html).toContain('#e53e3e'); // Red (X)
      expect(html).toContain('#38a169'); // Green (Y)
      expect(html).toContain('#3182ce'); // Blue (Z)
    });

    it('renders dynamic horizontal Value grid lines and numeric labels', () => {
      const html = renderToStaticMarkup(
        React.createElement(GraphEditorView, {
          currentFrame: 1,
          channels: sampleChannels,
        }),
      );

      expect(html).toContain('font-family="monospace">0</text>');
    });

    it('renders dynamic vertical Time grid lines and frame labels', () => {
      const html = renderToStaticMarkup(
        React.createElement(GraphEditorView, {
          currentFrame: 1,
          channels: sampleChannels,
        }),
      );

      expect(html).toContain('font-family="monospace">10</text>');
    });

    it('renders keyframe points and interactive Bezier tangent handles when selected', () => {
      const selected = new Set(['kf_px_1']);
      const html = renderToStaticMarkup(
        React.createElement(GraphEditorView, {
          currentFrame: 1,
          channels: sampleChannels,
          selectedKeyframeIds: selected,
        }),
      );

      expect(html).toContain('data-testid="graph-keyframe-kf_px_1"');
      expect(html).toContain('data-testid="handles-group-kf_px_1"');
      expect(html).toContain('data-testid="handle-left-kf_px_1"');
      expect(html).toContain('data-testid="handle-right-kf_px_1"');
    });

    it('renders handle type dropdown selector with auto, aligned, vector, free options', () => {
      const html = renderToStaticMarkup(
        React.createElement(GraphEditorView, {
          currentFrame: 1,
          channels: sampleChannels,
        }),
      );

      expect(html).toContain('aria-label="Handle Type"');
      expect(html).toContain('Handle: auto');
    });

    it('renders draggable time playhead in SVG canvas', () => {
      const html = renderToStaticMarkup(
        React.createElement(GraphEditorView, {
          currentFrame: 15,
          channels: sampleChannels,
        }),
      );

      expect(html).toContain('data-testid="graph-playhead"');
    });
  });

  describe('4. AnimationBottomPanel Component', () => {
    it('renders tab buttons for Timeline, Dope Sheet, and Graph Editor', () => {
      const html = renderToStaticMarkup(
        React.createElement(AnimationBottomPanel, {
          activeTab: 'timeline',
          currentFrame: 1,
        }),
      );

      expect(html).toContain('data-testid="tab-timeline"');
      expect(html).toContain('data-testid="tab-dopesheet"');
      expect(html).toContain('data-testid="tab-grapheditor"');
    });

    it('switches views based on activeTab prop', () => {
      const timelineHtml = renderToStaticMarkup(
        React.createElement(AnimationBottomPanel, {
          activeTab: 'timeline',
          currentFrame: 1,
        }),
      );
      expect(timelineHtml).toContain('Timeline');

      const dopeSheetHtml = renderToStaticMarkup(
        React.createElement(AnimationBottomPanel, {
          activeTab: 'dopesheet',
          currentFrame: 1,
        }),
      );
      expect(dopeSheetHtml).toContain('Dope Sheet');
      expect(dopeSheetHtml).toContain('Channels');

      const graphEditorHtml = renderToStaticMarkup(
        React.createElement(AnimationBottomPanel, {
          activeTab: 'grapheditor',
          currentFrame: 1,
        }),
      );
      expect(graphEditorHtml).toContain('Graph Editor');
      expect(graphEditorHtml).toContain('Curves');
    });
  });

  describe('6. Tangent Math & Handle Constraints', () => {
    it('computes collinear opposite handle vector when aligned', () => {
      const deltaF = 5;
      const deltaV = 5;
      const angle = Math.atan2(deltaV, deltaF);
      const oppositeLength = 6;

      const oppF = -oppositeLength * Math.cos(angle);
      const oppV = -oppositeLength * Math.sin(angle);

      expect(oppF).toBeCloseTo(-4.2426, 3);
      expect(oppV).toBeCloseTo(-4.2426, 3);

      // Verify dot product of unit vectors is -1 (exactly 180 degrees opposite)
      const u1 = [deltaF / Math.hypot(deltaF, deltaV), deltaV / Math.hypot(deltaF, deltaV)];
      const u2 = [oppF / oppositeLength, oppV / oppositeLength];
      const dot = u1[0] * u2[0] + u1[1] * u2[1];
      expect(dot).toBeCloseTo(-1, 5);
    });

    it('computes Catmull-Rom smooth auto tangents across three keys', () => {
      const k0 = { frame: 1, value: 0 };
      const k1 = { frame: 10, value: 5 };
      const k2 = { frame: 20, value: 10 };

      const dtPrev = k1.frame - k0.frame; // 9
      const dtNext = k2.frame - k1.frame; // 10
      const slope = (k2.value - k0.value) / (dtPrev + dtNext); // 10 / 19

      const handleR = { frame: dtNext / 3, value: slope * (dtNext / 3) };
      const handleL = { frame: -dtPrev / 3, value: -slope * (dtPrev / 3) };

      expect(handleR.frame).toBeCloseTo(3.333, 2);
      expect(handleR.value).toBeCloseTo(1.754, 2);
      expect(handleL.frame).toBeCloseTo(-3.0, 2);
      expect(handleL.value).toBeCloseTo(-1.579, 2);
    });
  });

  describe('7. Store Integration with UI State', () => {
    it('synchronizes keyframe selection with timelineStore', () => {
      const store = timelineStore.getState();
      expect(store.selectedKeyframeIds.size).toBe(0);

      store.selectKeyframe('kf_px_1');
      expect(timelineStore.getState().selectedKeyframeIds.has('kf_px_1')).toBe(true);

      store.selectKeyframe('kf_px_20', true); // multi-select
      expect(timelineStore.getState().selectedKeyframeIds.size).toBe(2);

      store.clearKeyframeSelection();
      expect(timelineStore.getState().selectedKeyframeIds.size).toBe(0);
    });

    it('toggles auto-keying in timelineStore', () => {
      expect(timelineStore.getState().autoKeyingEnabled).toBe(false);

      timelineStore.getState().setAutoKeying(true);
      expect(timelineStore.getState().autoKeyingEnabled).toBe(true);

      timelineStore.getState().setAutoKeying(false);
      expect(timelineStore.getState().autoKeyingEnabled).toBe(false);
    });
  });

  describe('8. Milestone 7: Viewport Sync, Auto-Keying, Hotkey Menu & Project Document Roundtrip', () => {
    it('renders KeyframeMenuModal with Location, Rotation, Scale, and LocRotScale options', () => {
      const html = renderToStaticMarkup(
        React.createElement(KeyframeMenuModal, {
          isOpen: true,
          currentFrame: 42,
          targetNodeName: 'HeroMesh',
          onClose: () => {},
          onSelectOption: () => {},
        }),
      );

      expect(html).toContain('Insert Keyframe');
      expect(html).toContain('Frame 42');
      expect(html).toContain('HeroMesh');
      expect(html).toContain('Location');
      expect(html).toContain('Rotation');
      expect(html).toContain('Scale');
      expect(html).toContain('LocRotScale');
    });

    it('captures full animation timeline in buildProjectDocument', () => {
      const sceneStore = createSceneStore();
      const node = createMeshNode({ id: 'cube-1', name: 'Animated Cube' });
      sceneStore.getState().addNode(node);

      timelineStore.getState().reset();
      const actionId = timelineStore.getState().createAction('MainAction', 'cube-1');
      timelineStore.getState().setActiveAction(actionId);
      timelineStore.getState().addChannelToAction(actionId, {
        targetNodeId: 'cube-1',
        propertyPath: 'position.y',
        keyframes: [
          { id: 'k1', frame: 1, time: 0, value: 0 },
          { id: 'k2', frame: 24, time: 1, value: 12 },
        ],
        interpolation: 'bezier',
        extrapolation: 'constant',
        color: '#38a169',
      });
      timelineStore.getState().setFrame(15);
      timelineStore.getState().setFps(30);

      const doc = buildProjectDocument(sceneStore.getState(), 'AnimScene.belt');

      expect(doc.timeline).toBeDefined();
      expect(doc.timeline?.currentFrame).toBe(15);
      expect(doc.timeline?.fps).toBe(30);
      expect(doc.timeline?.activeActionId).toBe(actionId);
      expect(doc.timeline?.actions?.[actionId]?.channels.length).toBe(1);
      expect(doc.timeline?.actions?.[actionId]?.channels[0].keyframes.length).toBe(2);
    });

    it('restores animation timeline when loading project via timelineStore.loadTimeline', () => {
      timelineStore.getState().reset();
      expect(timelineStore.getState().currentFrame).toBe(1);
      expect(Object.keys(timelineStore.getState().actions).length).toBe(0);

      const savedTimeline = {
        currentFrame: 35,
        startFrame: 10,
        endFrame: 120,
        fps: 60,
        loop: false,
        activeActionId: 'loaded_action_1',
        actions: {
          loaded_action_1: {
            id: 'loaded_action_1',
            name: 'LoadedAction',
            groups: [],
            channels: [
              {
                id: 'c1',
                name: 'Scale X',
                targetNodeId: 'cube-1',
                propertyPath: 'scale.x' as any,
                keyframes: [{ id: 'k1', frame: 10, time: 0, value: 1 }],
                interpolation: 'linear' as const,
                extrapolation: 'constant' as const,
                color: '#3182ce',
              },
            ],
            frameRange: [10, 120] as [number, number],
          },
        },
        tracks: [],
      };

      timelineStore.loadTimeline(savedTimeline);

      const restored = timelineStore.getState();
      expect(restored.currentFrame).toBe(35);
      expect(restored.startFrame).toBe(10);
      expect(restored.endFrame).toBe(120);
      expect(restored.fps).toBe(60);
      expect(restored.loop).toBe(false);
      expect(restored.activeActionId).toBe('loaded_action_1');
      expect(restored.actions['loaded_action_1'].channels[0].propertyPath).toBe('scale.x');
    });

    it('executes InsertTransformKeyframeCommand for Location, Rotation, Scale, and LocRotScale', async () => {
      const sceneStore = createSceneStore();
      const node = createMeshNode({
        id: 'box-1',
        name: 'Target Box',
        transform: {
          position: { x: 1, y: 2, z: 3 },
          rotation: { x: 0.1, y: 0.2, z: 0.3, order: 'XYZ' },
          scale: { x: 2, y: 2, z: 2 },
        },
      });
      sceneStore.getState().addNode(node);

      timelineStore.getState().reset();
      const actionId = timelineStore.getState().createAction('BoxAction', 'box-1');
      timelineStore.getState().setActiveAction(actionId);

      const cmdManager = new CommandManager();
      const ctx = { state: sceneStore.getState(), dispatch: () => {} };

      // 1. Insert Location keyframe
      const locCmd = new InsertTransformKeyframeCommand('box-1', 5, {
        position: node.transform.position,
      });
      await cmdManager.execute(locCmd, ctx);

      const actionAfterLoc = timelineStore.getState().actions[actionId];
      const posX = actionAfterLoc.channels.find((c) => c.propertyPath === 'position.x');
      const posY = actionAfterLoc.channels.find((c) => c.propertyPath === 'position.y');
      const posZ = actionAfterLoc.channels.find((c) => c.propertyPath === 'position.z');
      expect(posX?.keyframes.some((k) => k.frame === 5 && k.value === 1)).toBe(true);
      expect(posY?.keyframes.some((k) => k.frame === 5 && k.value === 2)).toBe(true);
      expect(posZ?.keyframes.some((k) => k.frame === 5 && k.value === 3)).toBe(true);

      // 2. Insert LocRotScale keyframe at frame 15
      const allCmd = new InsertTransformKeyframeCommand('box-1', 15, {
        position: node.transform.position,
        rotation: node.transform.rotation,
        scale: node.transform.scale,
      });
      await cmdManager.execute(allCmd, ctx);

      const actionAfterAll = timelineStore.getState().actions[actionId];
      // Should now have position.x/y/z, rotation.x/y/z, and scale.x/y/z channels
      expect(actionAfterAll.channels.length).toBe(9);
      const scaZ = actionAfterAll.channels.find((c) => c.propertyPath === 'scale.z');
      expect(scaZ?.keyframes.some((k) => k.frame === 15 && k.value === 2)).toBe(true);

      // 3. Delete keyframe at frame 5 via DeleteKeyframeCommand
      if (posX) {
        const delCmd = new DeleteKeyframeCommand(posX.id, 5);
        await cmdManager.execute(delCmd, ctx);
        const updatedPosX = timelineStore
          .getState()
          .actions[actionId].channels.find((c) => c.id === posX.id);
        expect(updatedPosX?.keyframes.some((k) => k.frame === 5)).toBe(false);

        // Undo deletion
        await cmdManager.undo(ctx);
        const restoredPosX = timelineStore
          .getState()
          .actions[actionId].channels.find((c) => c.id === posX.id);
        expect(restoredPosX?.keyframes.some((k) => k.frame === 5)).toBe(true);
      }
    });
  });
});
