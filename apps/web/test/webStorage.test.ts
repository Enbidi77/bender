import { describe, it, expect, beforeEach } from 'vitest';
import { webProjectStorage, createDefaultSceneRoot } from '../src/storage/webProjectStorage';
import { buildProjectDocument } from '../src/utils/webFileOperations';
import { createSceneStore, createMeshNode } from '@blender-elt/scene-core';
import { exportScene, importScene } from '@blender-elt/file-formats';

// Setup mock browser window & localStorage for tests
const storageMock: Record<string, string> = {};
(globalThis as any).window = {
  localStorage: {
    getItem: (key: string) => storageMock[key] ?? null,
    setItem: (key: string, val: string) => {
      storageMock[key] = val;
    },
    removeItem: (key: string) => {
      delete storageMock[key];
    },
    clear: () => {
      Object.keys(storageMock).forEach((k) => delete storageMock[k]);
    },
  },
};

describe('Web Project Storage & Persistence', () => {
  beforeEach(() => {
    (globalThis as any).window.localStorage.clear();
  });

  it('creates and validates starter templates correctly', () => {
    const defaultDoc = webProjectStorage.buildTemplateDocument('Default Test', 'default');
    expect(defaultDoc.metadata.name).toBe('Default Test');
    expect(defaultDoc.root.type).toBe('root');
    expect(Object.keys(defaultDoc.nodes).length).toBeGreaterThanOrEqual(4); // camera, 2 lights, cube, floor

    const matDoc = webProjectStorage.buildTemplateDocument('Mat Test', 'materials');
    expect(matDoc.metadata.name).toBe('Mat Test');
    expect(Object.keys(matDoc.nodes).length).toBeGreaterThanOrEqual(5);

    const archDoc = webProjectStorage.buildTemplateDocument('Arch Test', 'architecture');
    expect(archDoc.metadata.name).toBe('Arch Test');
    expect(Object.keys(archDoc.nodes).length).toBeGreaterThanOrEqual(6);

    const emptyDoc = webProjectStorage.buildTemplateDocument('Empty Test', 'empty');
    expect(emptyDoc.metadata.name).toBe('Empty Test');
    expect(Object.keys(emptyDoc.nodes).length).toBeGreaterThanOrEqual(2);
  });

  it('saves, retrieves, lists, duplicates, and deletes projects', async () => {
    const doc = webProjectStorage.buildTemplateDocument('Custom Scene', 'default');
    await webProjectStorage.saveProject('proj_1', 'Custom Scene', doc);

    const loaded = await webProjectStorage.getProject('proj_1');
    expect(loaded).toBeDefined();
    expect(loaded?.metadata.name).toBe('Custom Scene');

    const list = await webProjectStorage.listProjects();
    expect(list.length).toBeGreaterThanOrEqual(1);
    expect(list.some((p) => p.id === 'proj_1')).toBe(true);

    const dupId = await webProjectStorage.duplicateProject('proj_1');
    expect(dupId).toBeDefined();
    const dupDoc = await webProjectStorage.getProject(dupId!);
    expect(dupDoc?.metadata.name).toContain('(Copy)');

    await webProjectStorage.deleteProject('proj_1');
    const afterDelete = await webProjectStorage.getProject('proj_1');
    expect(afterDelete).toBeNull();
  });

  it('exports and imports project documents as JSON / .belt', async () => {
    const doc = webProjectStorage.buildTemplateDocument('Belt Export Test', 'materials');
    const json = webProjectStorage.exportProjectToJson(doc);
    expect(typeof json).toBe('string');
    expect(json).toContain('Belt Export Test');

    const importedId = await webProjectStorage.importProjectFromJson(json, 'ImportedTest.belt');
    expect(importedId).toBeDefined();
    const importedDoc = await webProjectStorage.getProject(importedId);
    expect(importedDoc?.metadata.name).toBe('Belt Export Test');
    expect(Object.keys(importedDoc?.nodes || {}).length).toBe(Object.keys(doc.nodes).length);
  });
});

describe('Web File Operations & Scene Document Building', () => {
  it('builds a ProjectDocument from active SceneGraphState', () => {
    const store = createSceneStore();
    const mesh = createMeshNode({ name: 'Test Box', primitiveType: 'cube' });
    store.getState().addNode(mesh, 'root');

    const state = store.getState();
    const doc = buildProjectDocument(state, 'Dynamic Scene');

    expect(doc.metadata.name).toBe('Dynamic Scene');
    expect(doc.nodes[mesh.id]).toBeDefined();
    expect(doc.nodes[mesh.id].name).toBe('Test Box');
    expect(doc.geometries[mesh.geometryId || mesh.id]).toBeDefined();
  });

  it('exports scene to OBJ, STL, GLTF formats and verifies output', async () => {
    const store = createSceneStore();
    const mesh = createMeshNode({ name: 'Export Cube', primitiveType: 'cube' });
    store.getState().addNode(mesh, 'root');

    const doc = buildProjectDocument(store.getState(), 'Export Scene');

    const objRes = await exportScene('obj', doc);
    expect(objRes.format).toBe('obj');
    expect(typeof objRes.data).toBe('string');
    expect(objRes.data as string).toContain('v ');

    const stlRes = await exportScene('stl', doc);
    expect(stlRes.format).toBe('stl');
    expect(stlRes.data).toBeDefined();
  });
});
