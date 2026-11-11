import { describe, it, expect, beforeEach, vi } from 'vitest';
import * as THREE from 'three';
import { createSceneStore, createMeshNode, createLightNode, createCameraNode } from '@blender-elt/scene-core';
import { CommandManager } from '@blender-elt/commands';
import {
  DEFAULT_GRID_CONFIG,
  DEFAULT_SNAP_CONFIG,
  DEFAULT_VIEWPORT_CONFIG,
  VIEWPOINT_CONFIGS,
  VIEWPORT_COLORS,
  TransformObjectCommand,
  createTransformObjectCommand,
} from '../src/index.js';
import { createPrimitiveGeometry } from '@blender-elt/modeling';
import { createThreeMaterial, MATERIAL_PRESETS } from '@blender-elt/materials';

describe('packages/viewport', () => {
  describe('Constants & Configuration Defaults', () => {
    it('provides standard default viewport configuration', () => {
      expect(DEFAULT_VIEWPORT_CONFIG.mode).toBe('object');
      expect(DEFAULT_VIEWPORT_CONFIG.gizmoType).toBe('translate');
      expect(DEFAULT_VIEWPORT_CONFIG.transformSpace).toBe('world');
      expect(DEFAULT_VIEWPORT_CONFIG.shadingMode).toBe('solid');
      expect(DEFAULT_VIEWPORT_CONFIG.showFloor).toBe(true);
      expect(DEFAULT_VIEWPORT_CONFIG.grid.visible).toBe(true);
      expect(DEFAULT_VIEWPORT_CONFIG.grid.size).toBe(20);
      expect(DEFAULT_VIEWPORT_CONFIG.grid.divisions).toBe(20);
    });

    it('provides snapping configuration defaults', () => {
      expect(DEFAULT_SNAP_CONFIG.enabled).toBe(false);
      expect(DEFAULT_SNAP_CONFIG.translationSnap).toBe(0.5);
      expect(DEFAULT_SNAP_CONFIG.rotationSnap).toBeCloseTo((15 * Math.PI) / 180, 5);
      expect(DEFAULT_SNAP_CONFIG.scaleSnap).toBe(0.1);
    });

    it('provides standard Blender-style viewpoints and numpad mappings', () => {
      expect(VIEWPOINT_CONFIGS.front.name).toBe('Front View');
      expect(VIEWPOINT_CONFIGS.front.numpad).toBe('Numpad 1');
      expect(VIEWPOINT_CONFIGS.front.isOrtho).toBe(true);

      expect(VIEWPOINT_CONFIGS.right.name).toBe('Right View');
      expect(VIEWPOINT_CONFIGS.right.numpad).toBe('Numpad 3');

      expect(VIEWPOINT_CONFIGS.top.name).toBe('Top View');
      expect(VIEWPOINT_CONFIGS.top.numpad).toBe('Numpad 7');

      expect(VIEWPOINT_CONFIGS.perspective.isOrtho).toBe(false);
      expect(VIEWPOINT_CONFIGS.camera.numpad).toBe('Numpad 0');
    });

    it('defines Blender-inspired theme colors', () => {
      expect(VIEWPORT_COLORS.background).toBe('#1d1e22');
      expect(VIEWPORT_COLORS.selectionPrimary).toBe('#ff9800');
      expect(VIEWPORT_COLORS.axisX).toBe('#e74c3c');
      expect(VIEWPORT_COLORS.axisY).toBe('#2ecc71');
      expect(VIEWPORT_COLORS.axisZ).toBe('#3498db');
    });
  });

  describe('TransformObjectCommand & History', () => {
    let store: ReturnType<typeof createSceneStore>;
    let commandManager: CommandManager;

    beforeEach(() => {
      store = createSceneStore();
      commandManager = new CommandManager(20);
    });

    it('executes and updates node transform in scene store', () => {
      const node = createMeshNode({ id: 'test-mesh', name: 'Test Mesh' });
      store.getState().addNode(node);

      const oldTransform = {
        position: { x: 0, y: 0, z: 0 },
        rotation: { x: 0, y: 0, z: 0, order: 'XYZ' as const },
        scale: { x: 1, y: 1, z: 1 },
      };
      const newTransform = {
        position: { x: 3, y: 4, z: 5 },
        rotation: { x: 0, y: 1.57, z: 0, order: 'XYZ' as const },
        scale: { x: 2, y: 2, z: 2 },
      };

      const cmd = createTransformObjectCommand({
        nodeId: 'test-mesh',
        previousTransform: oldTransform,
        newTransform,
        sceneStore: store,
      });

      cmd.execute();
      const updated = store.getState().nodes['test-mesh'];
      expect(updated.transform.position).toEqual({ x: 3, y: 4, z: 5 });
      expect(updated.transform.scale).toEqual({ x: 2, y: 2, z: 2 });

      // Undo reverts to initial
      cmd.undo();
      const reverted = store.getState().nodes['test-mesh'];
      expect(reverted.transform.position).toEqual({ x: 0, y: 0, z: 0 });

      // Redo re-applies
      cmd.redo();
      const redone = store.getState().nodes['test-mesh'];
      expect(redone.transform.position).toEqual({ x: 3, y: 4, z: 5 });
    });

    it('integrates seamlessly with CommandManager history stack', async () => {
      const node = createMeshNode({ id: 'box-1', name: 'Box 1' });
      store.getState().addNode(node);

      const oldTransform = { ...node.transform };
      const newTransform = {
        position: { x: 10, y: 0, z: 0 },
        rotation: { x: 0, y: 0, z: 0, order: 'XYZ' as const },
        scale: { x: 1, y: 1, z: 1 },
      };

      const cmd = new TransformObjectCommand({
        nodeId: 'box-1',
        previousTransform: oldTransform,
        newTransform,
        sceneStore: store,
      });

      const context = { state: store.getState(), dispatch: vi.fn() };
      await commandManager.execute(cmd, context);

      expect(commandManager.canUndo).toBe(true);
      expect(store.getState().nodes['box-1'].transform.position.x).toBe(10);

      await commandManager.undo(context);
      expect(commandManager.canRedo).toBe(true);
      expect(store.getState().nodes['box-1'].transform.position.x).toBe(0);

      await commandManager.redo(context);
      expect(store.getState().nodes['box-1'].transform.position.x).toBe(10);
    });
  });

  describe('Scene Node Three.js Bridging', () => {
    it('generates primitive geometry for mesh primitives', () => {
      const cubeGeo = createPrimitiveGeometry('cube');
      expect(cubeGeo).toBeInstanceOf(THREE.BufferGeometry);
      expect(cubeGeo.getAttribute('position')).toBeDefined();
      cubeGeo.dispose();

      const sphereGeo = createPrimitiveGeometry('sphere');
      expect(sphereGeo.getAttribute('position').count).toBeGreaterThan(0);
      sphereGeo.dispose();

      const torusGeo = createPrimitiveGeometry('torus');
      expect(torusGeo).toBeDefined();
      torusGeo.dispose();
    });

    it('generates materials corresponding to shading modes', () => {
      const config = MATERIAL_PRESETS['gold'];

      // Wireframe mode
      const wireMat = createThreeMaterial(config, 'wireframe') as THREE.MeshBasicMaterial;
      expect(wireMat.wireframe).toBe(true);
      wireMat.dispose();

      // Solid mode (clay)
      const solidMat = createThreeMaterial(config, 'solid') as THREE.MeshLambertMaterial;
      expect(solidMat.wireframe).toBe(false);
      solidMat.dispose();

      // Rendered / Material mode (PBR)
      const pbrMat = createThreeMaterial(config, 'rendered') as THREE.MeshStandardMaterial;
      expect(pbrMat.metalness).toBe(1.0);
      pbrMat.dispose();
    });

    it('supports all LightNode types and parameters', () => {
      const pointLight = createLightNode({
        lightType: 'point',
        color: '#ffcc00',
        intensity: 500,
        distance: 50,
      });
      expect(pointLight.type).toBe('light');
      expect(pointLight.lightType).toBe('point');
      expect(pointLight.intensity).toBe(500);

      const dirLight = createLightNode({
        lightType: 'directional',
        color: '#ffffff',
        intensity: 1000,
        castShadow: true,
      });
      expect(dirLight.lightType).toBe('directional');
      expect(dirLight.castShadow).toBe(true);
    });

    it('supports CameraNode perspective and orthographic properties', () => {
      const perspCam = createCameraNode({
        projection: 'perspective',
        fov: 60,
        near: 0.1,
        far: 2000,
      });
      expect(perspCam.projection).toBe('perspective');
      expect(perspCam.fov).toBe(60);

      const orthoCam = createCameraNode({
        projection: 'orthographic',
        zoom: 50,
      });
      expect(orthoCam.projection).toBe('orthographic');
      expect(orthoCam.zoom).toBe(50);
    });
  });

  describe('Selection & Framing Calculations', () => {
    it('computes bounding box and center for camera framing', () => {
      const boxMesh = new THREE.Mesh(new THREE.BoxGeometry(2, 4, 6));
      boxMesh.position.set(5, 10, -5);
      boxMesh.updateMatrixWorld(true);

      const bbox = new THREE.Box3().setFromObject(boxMesh);
      const center = new THREE.Vector3();
      const size = new THREE.Vector3();
      bbox.getCenter(center);
      bbox.getSize(size);

      expect(center.x).toBeCloseTo(5);
      expect(center.y).toBeCloseTo(10);
      expect(center.z).toBeCloseTo(-5);
      expect(size.x).toBeCloseTo(2);
      expect(size.y).toBeCloseTo(4);
      expect(size.z).toBeCloseTo(6);

      boxMesh.geometry.dispose();
    });
  });
});
