import { describe, it, expect } from 'vitest';
import {
  DEFAULT_WORKSPACES,
  getDefaultWorkspaces,
  buildProjectDocument,
  calculateScenePolycounts,
  createMockPlatformBridge,
  EditorStudio,
} from '../src/index.js';
import { createSceneStore, createMeshNode } from '@blender-elt/scene-core';

describe('Editor Studio & Workspaces', () => {
  it('provides the 5 standard Blender workflow workspaces', () => {
    const workspaces = getDefaultWorkspaces();
    expect(workspaces).toHaveLength(5);

    const ids = workspaces.map((w) => w.id);
    expect(ids).toEqual(['layout', 'modeling', 'sculpting', 'shading', 'animation']);

    const layoutWs = workspaces.find((w) => w.id === 'layout')!;
    expect(layoutWs.defaultMode).toBe('object');
    expect(layoutWs.viewportConfig?.shadingMode).toBe('solid');
    expect(layoutWs.viewportConfig?.gizmoType).toBe('translate');

    const modelingWs = workspaces.find((w) => w.id === 'modeling')!;
    expect(modelingWs.defaultMode).toBe('edit');
    expect(modelingWs.viewportConfig?.mode).toBe('edit');

    const sculptWs = workspaces.find((w) => w.id === 'sculpting')!;
    expect(sculptWs.defaultMode).toBe('sculpt');

    const shadingWs = workspaces.find((w) => w.id === 'shading')!;
    expect(shadingWs.viewportConfig?.shadingMode).toBe('material');

    const animWs = workspaces.find((w) => w.id === 'animation')!;
    expect(animWs.layout.type).toBe('split');
  });

  it('serializes scene state to a ProjectDocument via buildProjectDocument', () => {
    const store = createSceneStore();
    const state = store.getState();

    const doc = buildProjectDocument(state, 'TestScene.belt');
    expect(doc.version).toBe('1.0.0');
    expect(doc.metadata.name).toBe('TestScene.belt');
    expect(doc.root).toBeDefined();
    expect(doc.nodes).toBeDefined();
    expect(Object.keys(doc.nodes).length).toBeGreaterThan(0);
    expect(
      doc.geometries['cube-default'] ||
        doc.geometries[doc.nodes['cube-default']?.geometryId || 'cube-default'],
    ).toBeDefined();
  });

  it('computes scene polycounts accurately', () => {
    const store = createSceneStore();
    const state = store.getState();

    // Default scene has 1 cube (8 verts, 6 faces)
    const initialStats = calculateScenePolycounts(state.nodes);
    expect(initialStats.totalObjects).toBe(3); // cube, light, camera
    expect(initialStats.totalVertices).toBe(8);
    expect(initialStats.totalFaces).toBe(6);

    // Add sphere
    const sphere = createMeshNode({ id: 'sphere-1', primitiveType: 'sphere' });
    store.getState().addNode(sphere);

    const updatedStats = calculateScenePolycounts(store.getState().nodes);
    expect(updatedStats.totalObjects).toBe(4);
    expect(updatedStats.totalVertices).toBe(8 + 482);
    expect(updatedStats.totalFaces).toBe(6 + 960);
  });

  it('creates mock platform bridge with in-memory persistence and operations', async () => {
    const bridge = createMockPlatformBridge();
    expect(bridge.platform).toBe('web');
    expect(bridge.capabilities.offlineStorage).toBe(true);

    const store = createSceneStore();
    const doc = buildProjectDocument(store.getState(), 'Sample.belt');

    // Save project
    const saveRes = await bridge.fileSystem.saveProject(doc, 'saved.belt');
    expect(saveRes.success).toBe(true);
    expect(saveRes.filePath).toBe('saved.belt');

    // Open project
    const openRes = await bridge.fileSystem.openProject();
    expect(openRes.success).toBe(true);
    expect(openRes.document?.metadata.name).toBe('Sample.belt');

    // Export scene
    const exportRes = await bridge.fileSystem.exportScene({
      filePath: 'test.gltf',
      format: 'gltf',
      data: '{"asset":{"version":"2.0"}}',
    });
    expect(exportRes.success).toBe(true);

    // Clipboard
    await bridge.clipboard.writeText('hello world');
    const clipText = await bridge.clipboard.readText();
    expect(clipText).toBe('hello world');
  });

  it('exports EditorStudio component', () => {
    expect(EditorStudio).toBeDefined();
    expect(typeof EditorStudio).toBe('function');
  });
});
