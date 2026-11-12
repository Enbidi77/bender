import { describe, it, expect, beforeEach, vi } from 'vitest';
import { webProjectStorage } from '../src/storage/webProjectStorage';
import {
  buildProjectDocument,
  saveProjectDocumentWeb,
  openProjectDocumentWeb,
  exportSceneFileWeb,
  importSceneFileWeb,
  downloadBlob,
} from '../src/utils/webFileOperations';
import {
  createSceneStore,
  createMeshNode,
  createLightNode,
  createCameraNode,
} from '@blender-elt/scene-core';
import {
  serializeProject,
  deserializeProject,
  validateProjectDocument,
} from '@blender-elt/persistence';

// Mock DOM APIs for headless Vitest environment
const storageMock: Record<string, string> = {};
const downloadedFiles: { filename: string; mimeType?: string }[] = [];

let mockFilePromptResult: File | 'cancel' = 'cancel';

const mockAnchor = {
  href: '',
  download: '',
  click: vi.fn(function (this: { download: string }) {
    downloadedFiles.push({ filename: this.download });
  }),
};

const mockDocument = {
  createElement: vi.fn((tag: string) => {
    if (tag === 'a') return mockAnchor;
    if (tag === 'input') {
      const inputEl = {
        type: 'file',
        accept: '',
        style: {},
        files: [] as File[],
        parentNode: null as any,
        onchange: null as (() => void) | null,
        oncancel: null as (() => void) | null,
        click: function () {
          if (mockFilePromptResult === 'cancel') {
            if (this.oncancel) this.oncancel();
          } else {
            this.files = [mockFilePromptResult];
            if (this.onchange) this.onchange();
          }
        },
      };
      return inputEl;
    }
    return {};
  }),
  body: {
    appendChild: vi.fn(),
    removeChild: vi.fn(),
  },
};

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
(globalThis as any).document = mockDocument;
(globalThis as any).URL = {
  createObjectURL: vi.fn(() => 'blob:mock-url-1234'),
  revokeObjectURL: vi.fn(),
};

describe('Web Persistence Adapters & WebProjectStorage', () => {
  beforeEach(() => {
    (globalThis as any).window.localStorage.clear();
    downloadedFiles.length = 0;
    mockFilePromptResult = 'cancel';
    vi.clearAllMocks();
  });

  describe('Starter Templates Generation', () => {
    it('builds Default Studio template with camera, lights, floor, and cube', () => {
      const doc = webProjectStorage.buildTemplateDocument('Default Scene', 'default');
      expect(doc.metadata.name).toBe('Default Scene');
      expect(doc.root.type).toBe('root');

      // Verify node types exist
      const nodeTypes = Object.values(doc.nodes).map((n) => n.type);
      expect(nodeTypes).toContain('camera');
      expect(nodeTypes).toContain('light');
      expect(nodeTypes).toContain('mesh');

      // Verify geometry was created and converted to normal arrays
      const cubeNode = Object.values(doc.nodes).find(
        (n) => n.name === 'Default Cube' || n.name === 'Cube',
      );
      expect(cubeNode).toBeDefined();
      if (cubeNode && 'geometryId' in cubeNode) {
        const geo = doc.geometries[cubeNode.geometryId || cubeNode.id];
        expect(geo).toBeDefined();
        expect(Array.isArray(geo.vertices)).toBe(true);
        expect(geo.vertices.length).toBeGreaterThan(0);
      }
    });

    it('builds Materials Showroom template with multiple shapes and PBR configs', () => {
      const doc = webProjectStorage.buildTemplateDocument('Showroom', 'materials');
      expect(doc.metadata.name).toBe('Showroom');
      const meshNodes = Object.values(doc.nodes).filter((n) => n.type === 'mesh');
      expect(meshNodes.length).toBeGreaterThanOrEqual(4);

      meshNodes.forEach((node) => {
        if ('geometryId' in node) {
          const geo = doc.geometries[node.geometryId || node.id];
          expect(geo).toBeDefined();
          expect(Array.isArray(geo.vertices)).toBe(true);
        }
      });
    });

    it('builds Architecture Pavilion template with pillars, roof, and floor', () => {
      const doc = webProjectStorage.buildTemplateDocument('Pavilion', 'architecture');
      expect(doc.metadata.name).toBe('Pavilion');
      const meshNodes = Object.values(doc.nodes).filter((n) => n.type === 'mesh');
      expect(meshNodes.length).toBeGreaterThanOrEqual(5);
    });

    it('builds Empty Minimal template with camera and light only', () => {
      const doc = webProjectStorage.buildTemplateDocument('Minimal Empty', 'empty');
      expect(doc.metadata.name).toBe('Minimal Empty');
      const meshNodes = Object.values(doc.nodes).filter((n) => n.type === 'mesh');
      expect(meshNodes.length).toBe(0);
      const lightNodes = Object.values(doc.nodes).filter((n) => n.type === 'light');
      expect(lightNodes.length).toBeGreaterThanOrEqual(1);
    });
  });

  describe('CRUD Lifecycle & Storage Management', () => {
    it('automatically seeds demo projects when storage is initially empty', async () => {
      const list = await webProjectStorage.listProjects();
      expect(list.length).toBeGreaterThanOrEqual(3);
      const names = list.map((p) => p.name);
      expect(names).toContain('Default Studio Scene');
      expect(names).toContain('PBR Materials Showroom');
      expect(names).toContain('Geometric Pavilion');
    });

    it('creates, saves, retrieves, updates, and deletes projects', async () => {
      const newId = await webProjectStorage.createNewProject('Integration Project', 'default');
      expect(typeof newId).toBe('string');

      // Retrieve project
      const doc = await webProjectStorage.getProject(newId);
      expect(doc).toBeDefined();
      expect(doc?.metadata.name).toBe('Integration Project');

      // Update project
      if (doc) {
        doc.metadata.name = 'Updated Integration Project';
        await webProjectStorage.saveProject(newId, 'Updated Integration Project', doc);

        const updated = await webProjectStorage.getProject(newId);
        expect(updated?.metadata.name).toBe('Updated Integration Project');
      }

      // Duplicate project
      const dupId = await webProjectStorage.duplicateProject(newId);
      expect(dupId).toBeDefined();
      expect(dupId).not.toBe(newId);

      const dupDoc = await webProjectStorage.getProject(dupId!);
      expect(dupDoc?.metadata.name).toBe('Updated Integration Project (Copy)');

      // Delete original project
      await webProjectStorage.deleteProject(newId);
      const deletedDoc = await webProjectStorage.getProject(newId);
      expect(deletedDoc).toBeNull();

      // Duplicate project still exists
      const remainingDoc = await webProjectStorage.getProject(dupId!);
      expect(remainingDoc).toBeDefined();
    });

    it('sorts project listings by updatedAt descending', async () => {
      const id1 = await webProjectStorage.createNewProject('First Project', 'empty');
      // Set an explicit earlier updatedAt in the raw stored record
      const raw1 = JSON.parse(storageMock[`blender_elt_proj_${id1}`]);
      raw1.updatedAt = '2026-01-01T00:00:00.000Z';
      raw1.document.metadata.updatedAt = '2026-01-01T00:00:00.000Z';
      storageMock[`blender_elt_proj_${id1}`] = JSON.stringify(raw1);

      const id2 = await webProjectStorage.createNewProject('Second Project', 'empty');
      const raw2 = JSON.parse(storageMock[`blender_elt_proj_${id2}`]);
      raw2.updatedAt = '2026-11-12T00:00:00.000Z';
      raw2.document.metadata.updatedAt = '2026-11-12T00:00:00.000Z';
      storageMock[`blender_elt_proj_${id2}`] = JSON.stringify(raw2);

      const list = await webProjectStorage.listProjects();
      const posOld = list.findIndex((p) => p.id === id1);
      const posNew = list.findIndex((p) => p.id === id2);
      expect(posNew).toBeLessThan(posOld);
    });
  });
});

describe('Project Serialization & .belt File Integrity', () => {
  it('serializes and deserializes project documents without data loss', () => {
    const doc = webProjectStorage.buildTemplateDocument('Serialization Test', 'materials');
    const jsonStr = webProjectStorage.exportProjectToJson(doc);

    expect(typeof jsonStr).toBe('string');
    expect(jsonStr).toContain('Serialization Test');

    const deserialized = deserializeProject(jsonStr);
    expect(deserialized.metadata.name).toBe('Serialization Test');
    expect(deserialized.version).toBe(doc.version);
    expect(Object.keys(deserialized.nodes)).toEqual(Object.keys(doc.nodes));
    expect(Object.keys(deserialized.geometries)).toEqual(Object.keys(doc.geometries));
  });

  it('validates project document conforms to schema', () => {
    const doc = webProjectStorage.buildTemplateDocument('Schema Test', 'default');
    const validation = validateProjectDocument(doc);
    expect(validation.success).toBe(true);
  });

  it('rejects malformed or invalid json during project import', async () => {
    await expect(
      webProjectStorage.importProjectFromJson('{ malformed json }', 'corrupt.belt'),
    ).rejects.toThrow();

    await expect(
      webProjectStorage.importProjectFromJson(
        JSON.stringify({ version: '1.0.0', root: { type: 'invalid' } }),
        'invalid.belt',
      ),
    ).rejects.toThrow();
  });

  it('imports valid JSON string into project storage with custom filename fallback', async () => {
    const doc = webProjectStorage.buildTemplateDocument('Original Project', 'default');
    const jsonStr = serializeProject(doc);

    const importedId = await webProjectStorage.importProjectFromJson(jsonStr, 'ImportedScene.belt');
    expect(importedId).toBeDefined();

    const loaded = await webProjectStorage.getProject(importedId);
    expect(loaded?.metadata.name).toBe('Original Project');
  });
});

describe('Web File Operations & 3D Format Import/Export', () => {
  beforeEach(() => {
    downloadedFiles.length = 0;
    mockFilePromptResult = 'cancel';
    vi.clearAllMocks();
  });

  it('triggers browser download for text, Blob, and Uint8Array via downloadBlob', () => {
    // String
    downloadBlob('test text', 'test.txt', 'text/plain');
    expect((globalThis as any).URL.createObjectURL).toHaveBeenCalled();
    expect(downloadedFiles.some((f) => f.filename === 'test.txt')).toBe(true);

    // Blob
    const blob = new Blob(['blob content'], { type: 'application/json' });
    downloadBlob(blob, 'test.json', 'application/json');
    expect(downloadedFiles.some((f) => f.filename === 'test.json')).toBe(true);

    // Uint8Array
    const uint8 = new Uint8Array([1, 2, 3, 4]);
    downloadBlob(uint8, 'test.bin', 'application/octet-stream');
    expect(downloadedFiles.some((f) => f.filename === 'test.bin')).toBe(true);
  });

  it('buildProjectDocument extracts mesh geometries as serializable arrays from SceneGraphState', () => {
    const store = createSceneStore();
    const cube = createMeshNode({ name: 'Box', primitiveType: 'cube' });
    const sphere = createMeshNode({ name: 'Ball', primitiveType: 'sphere' });
    const light = createLightNode({ name: 'PointLight', lightType: 'point' });
    const camera = createCameraNode({ name: 'MainCamera' });

    store.getState().addNode(cube, 'root');
    store.getState().addNode(sphere, 'root');
    store.getState().addNode(light, 'root');
    store.getState().addNode(camera, 'root');

    const state = store.getState();
    const doc = buildProjectDocument(state, 'Full Scene Test');

    expect(doc.metadata.name).toBe('Full Scene Test');
    expect(doc.nodes[cube.id]).toBeDefined();
    expect(doc.nodes[sphere.id]).toBeDefined();
    expect(doc.nodes[light.id]).toBeDefined();
    expect(doc.nodes[camera.id]).toBeDefined();

    // Geometry data array assertions
    const cubeGeo = doc.geometries[cube.geometryId || cube.id];
    expect(cubeGeo).toBeDefined();
    expect(Array.isArray(cubeGeo.vertices)).toBe(true);
    expect(Array.isArray(cubeGeo.normals)).toBe(true);
    expect(Array.isArray(cubeGeo.indices)).toBe(true);
  });

  it('exports active scene to OBJ format with vertices and faces (and companion MTL file)', async () => {
    const store = createSceneStore();
    const cube = createMeshNode({ name: 'ExportCube', primitiveType: 'cube' });
    store.getState().addNode(cube, 'root');

    const state = store.getState();
    const result = await exportSceneFileWeb(state, 'obj', 'cube-scene');

    expect(result.success).toBe(true);
    // OBJ export downloads cube-scene.obj, and also downloads companion materials.mtl
    const filenames = downloadedFiles.map((f) => f.filename);
    expect(filenames).toContain('cube-scene.obj');
    expect(filenames).toContain('materials.mtl');
  });

  it('exports active scene to STL format', async () => {
    const store = createSceneStore();
    const cylinder = createMeshNode({ name: 'ExportCylinder', primitiveType: 'cylinder' });
    store.getState().addNode(cylinder, 'root');

    const state = store.getState();
    const result = await exportSceneFileWeb(state, 'stl', 'cylinder-scene');

    expect(result.success).toBe(true);
    expect(downloadedFiles.some((f) => f.filename === 'cylinder-scene.stl')).toBe(true);
  });

  it('exports active scene to GLTF format', async () => {
    const store = createSceneStore();
    const sphere = createMeshNode({ name: 'ExportSphere', primitiveType: 'sphere' });
    store.getState().addNode(sphere, 'root');

    const state = store.getState();
    const result = await exportSceneFileWeb(state, 'gltf', 'sphere-scene');

    expect(result.success).toBe(true);
    expect(downloadedFiles.some((f) => f.filename === 'sphere-scene.gltf')).toBe(true);
  });

  it('exports active scene to GLB format', async () => {
    const store = createSceneStore();
    const torus = createMeshNode({ name: 'ExportTorus', primitiveType: 'torus' });
    store.getState().addNode(torus, 'root');

    const state = store.getState();
    const result = await exportSceneFileWeb(state, 'glb', 'torus-scene');

    expect(result.success).toBe(true);
    expect(downloadedFiles.some((f) => f.filename === 'torus-scene.glb')).toBe(true);
  });

  it('saveProjectDocumentWeb persists scene to web storage and optionally triggers .belt download', async () => {
    const store = createSceneStore();
    const mesh = createMeshNode({ name: 'SavedMesh', primitiveType: 'cube' });
    store.getState().addNode(mesh, 'root');

    const state = store.getState();
    const result = await saveProjectDocumentWeb(state, 'proj_save_test', 'Save Test Project', {
      downloadFile: true,
    });

    expect(result.success).toBe(true);
    expect(downloadedFiles.some((f) => f.filename === 'Save Test Project.belt')).toBe(true);

    const loaded = await webProjectStorage.getProject('proj_save_test');
    expect(loaded).toBeDefined();
    expect(loaded?.metadata.name).toBe('Save Test Project');
    expect(loaded?.nodes[mesh.id]).toBeDefined();
  });

  it('handles cancellation gracefully in openProjectDocumentWeb and importSceneFileWeb', async () => {
    const store = createSceneStore();
    const state = store.getState();

    // mockFilePromptResult is 'cancel'
    mockFilePromptResult = 'cancel';

    const openRes = await openProjectDocumentWeb(state);
    expect(openRes.success).toBe(false);
    expect(openRes.error).toBe('Cancelled');

    const importRes = await importSceneFileWeb(state, 'obj');
    expect(importRes.success).toBe(false);
    expect(importRes.error).toBe('Cancelled');
  });

  it('successfully opens and loads a project document from a .belt file', async () => {
    const store = createSceneStore();
    const state = store.getState();

    // Create a mock project document and file
    const doc = webProjectStorage.buildTemplateDocument('File Opened Scene', 'default');
    const jsonStr = serializeProject(doc);
    const mockFile = new File([jsonStr], 'FileOpenedScene.belt', { type: 'application/json' });

    mockFilePromptResult = mockFile;

    const openRes = await openProjectDocumentWeb(store.getState());
    expect(openRes.success).toBe(true);
    expect(openRes.projectName).toBe('File Opened Scene');
    expect(openRes.projectId).toBeDefined();

    // Verify scene store loaded nodes from updated state
    const loadedNodes = store.getState().nodes;
    expect(Object.keys(loadedNodes).length).toBe(Object.keys(doc.nodes).length);
  });

  it('successfully imports an OBJ file into the current scene graph', async () => {
    const store = createSceneStore();
    const initialNodeCount = Object.keys(store.getState().nodes).length;

    const simpleObj = `
# Simple OBJ cube
v 0.0 0.0 0.0
v 1.0 0.0 0.0
v 1.0 1.0 0.0
v 0.0 1.0 0.0
v 0.0 0.0 1.0
v 1.0 0.0 1.0
v 1.0 1.0 1.0
v 0.0 1.0 1.0
f 1 2 3 4
f 5 8 7 6
`;
    const mockObjFile = new File([simpleObj], 'test-mesh.obj', { type: 'text/plain' });
    mockFilePromptResult = mockObjFile;

    const importRes = await importSceneFileWeb(store.getState(), 'obj');
    expect(importRes.success).toBe(true);
    expect(Object.keys(store.getState().nodes).length).toBeGreaterThan(initialNodeCount);
  });
});
