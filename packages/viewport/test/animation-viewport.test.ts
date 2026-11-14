import { describe, it, expect, beforeEach } from 'vitest';
import * as THREE from 'three';
import { createSceneStore, createMeshNode } from '@blender-elt/scene-core';
import {
  createTimelineStore,
  insertKeyframeToTrack,
  createTrack,
  evaluateNodeTransform,
} from '@blender-elt/animation';
import type { ArmatureNode } from '@blender-elt/contracts';
import {
  getActiveChannelsForNode,
  getAnimatedNodeIds,
  createOctahedralBoneGeometry,
} from '../src/index.js';

describe('packages/viewport - Animation Viewport Integration', () => {
  let sceneStore: ReturnType<typeof createSceneStore>;
  let timelineStore: ReturnType<typeof createTimelineStore>;
  let sceneObjects: Map<string, THREE.Object3D>;

  beforeEach(() => {
    sceneStore = createSceneStore();
    timelineStore = createTimelineStore({
      startFrame: 1,
      endFrame: 100,
      fps: 24,
      loop: true,
    });
    sceneObjects = new Map<string, THREE.Object3D>();
  });

  describe('getActiveChannelsForNode and getAnimatedNodeIds', () => {
    it('discovers target node IDs and retrieves active channels from action and tracks', () => {
      const meshId = 'animated-mesh-1';
      const actionId = timelineStore.getState().createAction('Action.001', meshId);
      timelineStore.getState().setActiveAction(actionId);

      const chanId = timelineStore.getState().addChannelToAction(actionId, {
        targetNodeId: meshId,
        propertyPath: 'position.x',
        keyframes: [
          { id: 'k1', frame: 1, time: 0, value: 0 },
          { id: 'k2', frame: 10, time: 9 / 24, value: 10 },
        ],
        interpolation: 'linear',
        extrapolation: 'constant',
        color: '#e53e3e',
      });

      const animatedIds = getAnimatedNodeIds(timelineStore.getState());
      expect(animatedIds).toContain(meshId);

      const activeChannels = getActiveChannelsForNode(timelineStore.getState(), meshId);
      expect(activeChannels.length).toBe(1);
      expect(activeChannels[0].id).toBe(chanId);
      expect(activeChannels[0].propertyPath).toBe('position.x');
    });

    it('ignores muted channels and supports legacy tracks', () => {
      const nodeId = 'light-1';
      const track = createTrack(nodeId, 'position.y', 'PosY', [
        { id: 'k1', frame: 1, time: 0, value: 5 },
        { id: 'k2', frame: 20, time: 19 / 24, value: 15 },
      ]);
      timelineStore.getState().addTrack(track);

      let channels = getActiveChannelsForNode(timelineStore.getState(), nodeId);
      expect(channels.length).toBe(1);

      // Mute track
      timelineStore.getState().muteTrack(track.id, true);
      channels = getActiveChannelsForNode(timelineStore.getState(), nodeId);
      expect(channels.length).toBe(0);
    });
  });

  describe('Three.js and sceneStore synchronization', () => {
    it('evaluates animation and updates Three.js Object3D and sceneStore node', () => {
      const mesh = createMeshNode({
        id: 'test-cube',
        name: 'Animated Cube',
        transform: {
          position: { x: 0, y: 0, z: 0 },
          rotation: { x: 0, y: 0, z: 0, order: 'XYZ' },
          scale: { x: 1, y: 1, z: 1 },
        },
      });
      sceneStore.getState().addNode(mesh);

      const threeMesh = new THREE.Mesh(new THREE.BoxGeometry(), new THREE.MeshBasicMaterial());
      threeMesh.position.set(0, 0, 0);
      sceneObjects.set(mesh.id, threeMesh);

      // Add position.x and rotation.y tracks
      const actionId = timelineStore.getState().createAction('CubeAction', mesh.id);
      timelineStore.getState().setActiveAction(actionId);

      timelineStore.getState().addChannelToAction(actionId, {
        targetNodeId: mesh.id,
        propertyPath: 'position.x',
        keyframes: [
          { id: 'k1', frame: 1, time: 0, value: 0, interpolation: 'linear' },
          { id: 'k2', frame: 11, time: 10 / 24, value: 20, interpolation: 'linear' },
        ],
        interpolation: 'linear',
        extrapolation: 'constant',
        color: '#e53e3e',
      });

      timelineStore.getState().addChannelToAction(actionId, {
        targetNodeId: mesh.id,
        propertyPath: 'rotation.y',
        keyframes: [
          { id: 'k3', frame: 1, time: 0, value: 0, interpolation: 'linear' },
          { id: 'k4', frame: 11, time: 10 / 24, value: Math.PI, interpolation: 'linear' },
        ],
        interpolation: 'linear',
        extrapolation: 'constant',
        color: '#38a169',
      });

      // Frame 1 check
      const state1 = timelineStore.getState();
      const tracks = getActiveChannelsForNode(state1, mesh.id);
      const eval1 = evaluateNodeTransform(tracks, mesh.id, 1);
      expect(eval1.position?.x).toBe(0);
      expect(eval1.rotation?.y).toBe(0);

      // Frame 6 check (midpoint)
      const evalMid = evaluateNodeTransform(tracks, mesh.id, 6);
      expect(evalMid.position?.x).toBeCloseTo(10, 5);
      expect(evalMid.rotation?.y).toBeCloseTo(Math.PI / 2, 5);

      // Apply to Three.js Object3D and sceneStore
      if (evalMid.position?.x !== undefined) {
        threeMesh.position.x = evalMid.position.x;
        sceneStore.getState().updateNodeTransform(mesh.id, {
          position: { ...mesh.transform.position, x: evalMid.position.x },
        });
      }

      expect(threeMesh.position.x).toBeCloseTo(10, 5);
      expect(sceneStore.getState().nodes[mesh.id].transform.position.x).toBeCloseTo(10, 5);

      // Frame 11 check (endpoint)
      const evalEnd = evaluateNodeTransform(tracks, mesh.id, 11);
      expect(evalEnd.position?.x).toBe(20);
      expect(evalEnd.rotation?.y).toBeCloseTo(Math.PI, 5);
    });
  });

  describe('Armature & Bone Geometry', () => {
    it('creates standard Blender octahedral bone geometry with 8 faces and 24 position components', () => {
      const boneLength = 2.5;
      const geom = createOctahedralBoneGeometry(boneLength);

      expect(geom).toBeDefined();
      const posAttr = geom.getAttribute('position');
      expect(posAttr).toBeDefined();
      // 8 triangles * 3 vertices = 24 vertices
      expect(posAttr.count).toBe(24);

      const normAttr = geom.getAttribute('normal');
      expect(normAttr).toBeDefined();
      expect(normAttr.count).toBe(24);
    });

    it('handles zero or minimal bone length gracefully without NaN', () => {
      const zeroGeom = createOctahedralBoneGeometry(0);
      const posAttr = zeroGeom.getAttribute('position');
      expect(posAttr).toBeDefined();
      expect(posAttr.count).toBe(24);

      for (let i = 0; i < posAttr.array.length; i++) {
        expect(Number.isNaN(posAttr.array[i])).toBe(false);
      }
    });

    it('supports armature hierarchy representation with multiple connected bones', () => {
      const armatureNode: ArmatureNode = {
        id: 'armature-root',
        name: 'HumanoidArmature',
        type: 'armature',
        transform: {
          position: { x: 0, y: 0, z: 0 },
          rotation: { x: 0, y: 0, z: 0, order: 'XYZ' },
          scale: { x: 1, y: 1, z: 1 },
        },
        visible: true,
        locked: false,
        parentId: null,
        childrenIds: [],
        rootBoneIds: ['bone-root'],
        bones: {
          'bone-root': {
            id: 'bone-root',
            name: 'Root',
            parentId: null,
            childrenIds: ['bone-spine'],
            head: { x: 0, y: 0, z: 0 },
            tail: { x: 0, y: 1, z: 0 },
            roll: 0,
            length: 1.0,
            connected: false,
            deform: true,
          },
          'bone-spine': {
            id: 'bone-spine',
            name: 'Spine',
            parentId: 'bone-root',
            childrenIds: [],
            head: { x: 0, y: 1, z: 0 },
            tail: { x: 0, y: 2.2, z: 0 },
            roll: 0,
            length: 1.2,
            connected: true,
            deform: true,
          },
        },
      };

      sceneStore.getState().addNode(armatureNode);
      const retrieved = sceneStore.getState().getNodeById('armature-root') as ArmatureNode;
      expect(retrieved).toBeDefined();
      expect(retrieved.type).toBe('armature');
      expect(Object.keys(retrieved.bones).length).toBe(2);
      expect(retrieved.bones['bone-spine'].connected).toBe(true);
    });
  });
});
