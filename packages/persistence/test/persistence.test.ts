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
      expect(meta.version).toBe('1.0.0');
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
  });
});
