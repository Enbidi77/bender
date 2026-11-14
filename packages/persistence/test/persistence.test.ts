import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import {
  createDefaultProjectDocument,
  serializeProject,
  deserializeProject,
  validateProjectDocument,
  createProjectMetadata,
  MemoryStorageAdapter,
  FileStorageAdapter,
  saveProject,
  loadProject,
} from '../src/index.js';
import { tmpdir } from 'os';
import { join } from 'path';
import { promises as fs } from 'fs';

describe('packages/persistence', () => {
  describe('Project Document Metadata & Creation', () => {
    it('creates well-formed project metadata', () => {
      const meta = createProjectMetadata('My Project', 'Artist');
      expect(meta.name).toBe('My Project');
      expect(meta.author).toBe('Artist');
      expect(meta.version).toBe('1.1.0');
      expect(meta.createdAt).toBeDefined();
      expect(meta.updatedAt).toBeDefined();
    });

    it('creates default project document valid against schema', () => {
      const doc = createDefaultProjectDocument('Test Project');
      const validation = validateProjectDocument(doc);
      expect(validation.success).toBe(true);
      expect(validation.data?.root.type).toBe('root');
      expect(validation.data?.nodes['cube-default']).toBeDefined();
    });
  });

  describe('Serialization and Deserialization (.belt / JSON)', () => {
    it('serializes and deserializes a project with complete data integrity', () => {
      const doc = createDefaultProjectDocument('Roundtrip Project');
      const json = serializeProject(doc);

      expect(typeof json).toBe('string');
      expect(json).toContain('"name": "Roundtrip Project"');

      const restored = deserializeProject(json);
      expect(restored.metadata.name).toBe('Roundtrip Project');
      expect(restored.nodes['cube-default'].name).toBe('Cube');
      expect(restored.nodes['cube-default'].transform.scale).toEqual({ x: 1, y: 1, z: 1 });
    });

    it('rejects invalid JSON string', () => {
      expect(() => deserializeProject('{ invalid json ...')).toThrowError(/Failed to parse JSON/);
    });

    it('rejects schema-violating document structures', () => {
      const invalidDoc = {
        version: '1.0.0',
        metadata: {
          name: 'Missing fields',
          // missing createdAt, etc.
        },
        root: {
          type: 'not-root',
        },
        nodes: {},
      };

      const validation = validateProjectDocument(invalidDoc);
      expect(validation.success).toBe(false);
      expect(validation.error).toBeDefined();

      expect(() => deserializeProject(JSON.stringify(invalidDoc))).toThrowError(
        /Project schema validation failed/,
      );
    });
  });

  describe('Storage Adapters', () => {
    it('MemoryStorageAdapter writes, reads, checks existence, and deletes', async () => {
      const mem = new MemoryStorageAdapter();
      const path = 'projects/project1.belt';

      expect(await mem.exists(path)).toBe(false);

      await mem.write(path, '{"test": 123}');
      expect(await mem.exists(path)).toBe(true);
      expect(await mem.read(path)).toBe('{"test": 123}');

      await mem.delete(path);
      expect(await mem.exists(path)).toBe(false);
      await expect(mem.read(path)).rejects.toThrowError(/not found/);
    });

    it('FileStorageAdapter roundtrips project file on disk', async () => {
      const fileAdapter = new FileStorageAdapter();
      const testFilePath = join(tmpdir(), `belt-test-${Date.now()}.belt`);

      try {
        const doc = createDefaultProjectDocument('Disk Project');
        await saveProject(fileAdapter, testFilePath, doc);

        expect(await fileAdapter.exists(testFilePath)).toBe(true);

        const loaded = await loadProject(fileAdapter, testFilePath);
        expect(loaded.metadata.name).toBe('Disk Project');
        expect(loaded.nodes['cube-default']).toBeDefined();
      } finally {
        await fileAdapter.delete(testFilePath);
        expect(await fileAdapter.exists(testFilePath)).toBe(false);
      }
    });

    it('saveProject and loadProject work seamlessly with memory adapter', async () => {
      const mem = new MemoryStorageAdapter();
      const doc = createDefaultProjectDocument('In-Memory Project');

      await saveProject(mem, 'slot-1', doc);
      const loaded = await loadProject(mem, 'slot-1');

      expect(loaded.metadata.name).toBe('In-Memory Project');
    });

    it('FileStorageAdapter supports custom dependency injection for fs and path', async () => {
      const mockStorage = new Map<string, string>();
      const customFs = {
        readFile: async (p: string) => {
          const val = mockStorage.get(p);
          if (val === undefined) throw new Error('Not found');
          return val;
        },
        writeFile: async (p: string, data: string) => {
          mockStorage.set(p, data);
        },
        mkdir: async () => {},
        access: async (p: string) => {
          if (!mockStorage.has(p)) throw new Error('Not found');
        },
        unlink: async (p: string) => {
          mockStorage.delete(p);
        },
      };
      const customPath = {
        dirname: (p: string) => p.substring(0, p.lastIndexOf('/')) || '.',
      };

      const adapter = new FileStorageAdapter({ fs: customFs as any, path: customPath });
      await adapter.write('/app/test.belt', '{"custom": true}');
      expect(await adapter.exists('/app/test.belt')).toBe(true);
      expect(await adapter.read('/app/test.belt')).toBe('{"custom": true}');
      await adapter.delete('/app/test.belt');
      expect(await adapter.exists('/app/test.belt')).toBe(false);
    });

    it('serializes and deserializes modifiers, selection model, and workspace layout schemas', () => {
      const doc = createDefaultProjectDocument('Extended Schema Project');

      // 1. Add modifiers to cube node
      const subModifier = {
        id: 'subdiv-1',
        name: 'Subdivision',
        type: 'subdivision' as const,
        enabled: true,
        showInViewport: true,
        showInRender: true,
        order: 0,
        levels: 2,
        renderLevels: 3,
        algorithm: 'catmull-clark' as const,
      };

      const mirrorModifier = {
        id: 'mirror-1',
        name: 'Mirror',
        type: 'mirror' as const,
        enabled: true,
        showInViewport: true,
        showInRender: true,
        order: 1,
        axis: { x: true, y: false, z: false },
        clip: true,
        merge: true,
        mergeThreshold: 0.001,
      };

      (doc.nodes['cube-default'] as any).modifiers = [subModifier, mirrorModifier];

      // 2. Add UnifiedSelectionModel
      doc.selection = {
        object: {
          activeNodeId: 'cube-default',
          selectedNodeIds: ['cube-default'],
          selectionOrder: ['cube-default'],
        },
        edit: {
          elementModes: ['vertex'],
          selectedVertexIndices: [0, 1, 2],
          selectedEdgeIndices: [],
          selectedFaceIndices: [],
          activeVertexIndex: 0,
          activeEdgeIndex: null,
          activeFaceIndex: null,
        },
        pivotPoint: 'median-point',
        cursor3D: {
          position: { x: 0, y: 0, z: 0 },
          rotation: { x: 0, y: 0, z: 0 },
        },
      };

      // 3. Add WorkspaceLayoutConfig
      doc.workspace = {
        activeWorkspaceId: 'modeling',
        workspaces: {
          modeling: {
            id: 'modeling',
            name: 'Modeling',
            defaultMode: 'edit',
            order: 1,
            layout: {
              id: 'split-root',
              type: 'split',
              direction: 'horizontal',
              ratio: 0.8,
              first: {
                id: 'panel-viewport',
                type: 'panel',
                areaType: 'viewport-3d',
              },
              second: {
                id: 'panel-outliner',
                type: 'panel',
                areaType: 'outliner',
              },
            },
          },
        },
      };

      // Serialize to .belt JSON
      const json = serializeProject(doc);
      expect(typeof json).toBe('string');
      expect(json).toContain('"subdivision"');
      expect(json).toContain('"median-point"');
      expect(json).toContain('"viewport-3d"');

      // Deserialize and verify integrity
      const restored = deserializeProject(json);
      const restoredMesh = restored.nodes['cube-default'] as any;
      expect(restoredMesh.modifiers).toHaveLength(2);
      expect(restoredMesh.modifiers?.[0].type).toBe('subdivision');
      expect(restoredMesh.modifiers?.[0].levels).toBe(2);
      expect(restoredMesh.modifiers?.[1].type).toBe('mirror');

      expect(restored.selection?.object.activeNodeId).toBe('cube-default');
      expect(restored.selection?.pivotPoint).toBe('median-point');
      expect(restored.selection?.edit.selectedVertexIndices).toEqual([0, 1, 2]);

      expect(restored.workspace?.activeWorkspaceId).toBe('modeling');
      expect(restored.workspace?.workspaces.modeling.defaultMode).toBe('edit');
    });
  });
});
