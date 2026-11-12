import type {
  ProjectDocument,
  SceneNode,
  MeshNode,
  LightNode,
  CameraNode,
  PrimitiveType,
  PBRMaterialConfig,
  SceneRoot,
} from '@blender-elt/contracts';
import { createMeshNode, createLightNode, createCameraNode } from '@blender-elt/scene-core';
import {
  serializeProject,
  deserializeProject,
  createProjectMetadata,
} from '@blender-elt/persistence';
import { createPrimitiveGeometry, bufferGeometryToMeshData } from '@blender-elt/modeling';

export function createDefaultSceneRoot(): SceneRoot {
  return {
    id: 'root',
    name: 'Scene Collection',
    type: 'root',
    childrenIds: [],
  };
}

export interface ProjectSummary {
  id: string;
  name: string;
  createdAt: string;
  updatedAt: string;
  nodeCount: number;
  previewType?: string;
}

export interface ProjectRecord {
  id: string;
  name: string;
  createdAt: string;
  updatedAt: string;
  nodeCount: number;
  document: ProjectDocument;
}

const DB_NAME = 'blender_elt_web_db';
const DB_VERSION = 1;
const STORE_NAME = 'projects';
const LS_PREFIX = 'blender_elt_proj_';
const LS_INDEX_KEY = 'blender_elt_proj_index';

class WebProjectStorage {
  private dbPromise: Promise<IDBDatabase | null> | null = null;

  private isBrowser(): boolean {
    return typeof window !== 'undefined';
  }

  private isIndexedDBAvailable(): boolean {
    return this.isBrowser() && typeof window.indexedDB !== 'undefined';
  }

  private isLocalStorageAvailable(): boolean {
    try {
      return this.isBrowser() && typeof window.localStorage !== 'undefined';
    } catch {
      return false;
    }
  }

  private getDB(): Promise<IDBDatabase | null> {
    if (!this.isIndexedDBAvailable()) {
      return Promise.resolve(null);
    }
    if (this.dbPromise) {
      return this.dbPromise;
    }

    this.dbPromise = new Promise((resolve) => {
      try {
        const req = window.indexedDB.open(DB_NAME, DB_VERSION);

        req.onupgradeneeded = (event) => {
          const db = (event.target as IDBOpenDBRequest).result;
          if (!db.objectStoreNames.contains(STORE_NAME)) {
            const store = db.createObjectStore(STORE_NAME, { keyPath: 'id' });
            store.createIndex('updatedAt', 'updatedAt', { unique: false });
          }
        };

        req.onsuccess = () => resolve(req.result);
        req.onerror = () => {
          console.warn('Failed to open IndexedDB, falling back to localStorage');
          resolve(null);
        };
      } catch (err) {
        console.warn('IndexedDB initialization failed:', err);
        resolve(null);
      }
    });

    return this.dbPromise;
  }

  // --- IndexedDB Operations ---

  private async idbGetAll(): Promise<ProjectRecord[]> {
    const db = await this.getDB();
    if (!db) return [];

    return new Promise((resolve, reject) => {
      try {
        const tx = db.transaction(STORE_NAME, 'readonly');
        const store = tx.objectStore(STORE_NAME);
        const req = store.getAll();

        req.onsuccess = () => resolve((req.result as ProjectRecord[]) || []);
        req.onerror = () => reject(req.error);
      } catch (err) {
        reject(err);
      }
    });
  }

  private async idbGet(id: string): Promise<ProjectRecord | null> {
    const db = await this.getDB();
    if (!db) return null;

    return new Promise((resolve, reject) => {
      try {
        const tx = db.transaction(STORE_NAME, 'readonly');
        const store = tx.objectStore(STORE_NAME);
        const req = store.get(id);

        req.onsuccess = () => resolve((req.result as ProjectRecord) || null);
        req.onerror = () => reject(req.error);
      } catch (err) {
        reject(err);
      }
    });
  }

  private async idbPut(record: ProjectRecord): Promise<void> {
    const db = await this.getDB();
    if (!db) throw new Error('IndexedDB unavailable');

    return new Promise((resolve, reject) => {
      try {
        const tx = db.transaction(STORE_NAME, 'readwrite');
        const store = tx.objectStore(STORE_NAME);
        const req = store.put(record);

        req.onsuccess = () => resolve();
        req.onerror = () => reject(req.error);
      } catch (err) {
        reject(err);
      }
    });
  }

  private async idbDelete(id: string): Promise<void> {
    const db = await this.getDB();
    if (!db) return;

    return new Promise((resolve, reject) => {
      try {
        const tx = db.transaction(STORE_NAME, 'readwrite');
        const store = tx.objectStore(STORE_NAME);
        const req = store.delete(id);

        req.onsuccess = () => resolve();
        req.onerror = () => reject(req.error);
      } catch (err) {
        reject(err);
      }
    });
  }

  // --- LocalStorage Fallback Operations ---

  private lsGetIndex(): string[] {
    if (!this.isLocalStorageAvailable()) return [];
    try {
      const raw = window.localStorage.getItem(LS_INDEX_KEY);
      return raw ? JSON.parse(raw) : [];
    } catch {
      return [];
    }
  }

  private lsSetIndex(index: string[]): void {
    if (!this.isLocalStorageAvailable()) return;
    try {
      window.localStorage.setItem(LS_INDEX_KEY, JSON.stringify(index));
    } catch (e) {
      console.warn('localStorage setIndex error:', e);
    }
  }

  private lsGetAll(): ProjectRecord[] {
    if (!this.isLocalStorageAvailable()) return [];
    const index = this.lsGetIndex();
    const results: ProjectRecord[] = [];
    for (const id of index) {
      try {
        const raw = window.localStorage.getItem(`${LS_PREFIX}${id}`);
        if (raw) results.push(JSON.parse(raw));
      } catch {
        // skip malformed entries
      }
    }
    return results;
  }

  private lsGet(id: string): ProjectRecord | null {
    if (!this.isLocalStorageAvailable()) return null;
    try {
      const raw = window.localStorage.getItem(`${LS_PREFIX}${id}`);
      return raw ? JSON.parse(raw) : null;
    } catch {
      return null;
    }
  }

  private lsPut(record: ProjectRecord): void {
    if (!this.isLocalStorageAvailable()) return;
    try {
      window.localStorage.setItem(`${LS_PREFIX}${record.id}`, JSON.stringify(record));
      const index = this.lsGetIndex();
      if (!index.includes(record.id)) {
        index.push(record.id);
        this.lsSetIndex(index);
      }
    } catch (e) {
      console.warn('localStorage quota exceeded or failed:', e);
    }
  }

  private lsDelete(id: string): void {
    if (!this.isLocalStorageAvailable()) return;
    try {
      window.localStorage.removeItem(`${LS_PREFIX}${id}`);
      const index = this.lsGetIndex().filter((i) => i !== id);
      this.lsSetIndex(index);
    } catch (e) {
      console.warn('localStorage delete failed:', e);
    }
  }

  // --- Public API ---

  async listProjects(): Promise<ProjectSummary[]> {
    let records: ProjectRecord[] = [];
    if (this.isIndexedDBAvailable()) {
      try {
        records = await this.idbGetAll();
      } catch {
        records = this.lsGetAll();
      }
    } else {
      records = this.lsGetAll();
    }

    // If completely empty on first launch, auto-seed starter projects!
    if (records.length === 0) {
      await this.seedInitialProjects();
      return this.listProjects();
    }

    return records
      .map((r) => ({
        id: r.id,
        name: r.name,
        createdAt: r.createdAt,
        updatedAt: r.updatedAt,
        nodeCount: r.nodeCount || (r.document?.nodes ? Object.keys(r.document.nodes).length : 0),
      }))
      .sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime());
  }

  async getProject(id: string): Promise<ProjectDocument | null> {
    if (this.isIndexedDBAvailable()) {
      try {
        const r = await this.idbGet(id);
        if (r) return r.document;
      } catch {
        // fallback
      }
    }
    const r = this.lsGet(id);
    return r ? r.document : null;
  }

  async saveProject(id: string, name: string, doc: ProjectDocument): Promise<void> {
    const now = new Date().toISOString();
    const nodeCount = doc.nodes ? Object.keys(doc.nodes).length : 0;
    const record: ProjectRecord = {
      id,
      name,
      createdAt: doc.metadata?.createdAt || now,
      updatedAt: now,
      nodeCount,
      document: {
        ...doc,
        metadata: {
          ...doc.metadata,
          name,
          updatedAt: now,
        },
      },
    };

    if (this.isIndexedDBAvailable()) {
      try {
        await this.idbPut(record);
        return;
      } catch (err) {
        console.warn('Failed saving to IndexedDB, fallback to localStorage:', err);
      }
    }
    this.lsPut(record);
  }

  async deleteProject(id: string): Promise<void> {
    if (this.isIndexedDBAvailable()) {
      try {
        await this.idbDelete(id);
      } catch {
        // fallback
      }
    }
    this.lsDelete(id);
  }

  async duplicateProject(id: string): Promise<string | null> {
    const original = await this.getProject(id);
    if (!original) return null;

    const newId = `proj_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
    const newName = `${original.metadata?.name || 'Project'} (Copy)`;
    const now = new Date().toISOString();

    const clonedDoc: ProjectDocument = JSON.parse(JSON.stringify(original));
    clonedDoc.metadata = {
      ...clonedDoc.metadata,
      name: newName,
      createdAt: now,
      updatedAt: now,
    };

    await this.saveProject(newId, newName, clonedDoc);
    return newId;
  }

  async createNewProject(
    name: string = 'Untitled Scene',
    template: 'default' | 'materials' | 'architecture' | 'empty' = 'default',
  ): Promise<string> {
    const id = `proj_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
    const doc = this.buildTemplateDocument(name, template);
    await this.saveProject(id, name, doc);
    return id;
  }

  async importProjectFromJson(jsonString: string, filename?: string): Promise<string> {
    const doc = deserializeProject(jsonString);
    const id = `proj_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
    const name =
      doc.metadata?.name ||
      (filename ? filename.replace(/\.(belt|json)$/i, '') : 'Imported Project');
    await this.saveProject(id, name, doc);
    return id;
  }

  exportProjectToJson(doc: ProjectDocument): string {
    return serializeProject(doc);
  }

  // --- Seed Starter Projects ---

  private async seedInitialProjects(): Promise<void> {
    const demo1Id = 'proj_default_studio';
    const demo1Doc = this.buildTemplateDocument('Default Studio Scene', 'default');
    await this.saveProject(demo1Id, 'Default Studio Scene', demo1Doc);

    const demo2Id = 'proj_materials_showroom';
    const demo2Doc = this.buildTemplateDocument('PBR Materials Showroom', 'materials');
    await this.saveProject(demo2Id, 'PBR Materials Showroom', demo2Doc);

    const demo3Id = 'proj_architecture_pavilion';
    const demo3Doc = this.buildTemplateDocument('Geometric Pavilion', 'architecture');
    await this.saveProject(demo3Id, 'Geometric Pavilion', demo3Doc);
  }

  // --- Template Generators ---

  public buildTemplateDocument(
    name: string,
    template: 'default' | 'materials' | 'architecture' | 'empty',
  ): ProjectDocument {
    const root = createDefaultSceneRoot();
    const nodes: Record<string, SceneNode> = {};
    const geometries: Record<string, any> = {};
    const materials: Record<string, any> = {};

    const addMesh = (
      prim: PrimitiveType,
      nodeName: string,
      pos: { x: number; y: number; z: number },
      rot: { x: number; y: number; z: number } = { x: 0, y: 0, z: 0 },
      scale: { x: number; y: number; z: number } = { x: 1, y: 1, z: 1 },
      matConfig?: Partial<PBRMaterialConfig>,
    ) => {
      const node = createMeshNode({
        name: nodeName,
        primitiveType: prim,
        transform: {
          position: pos,
          rotation: rot,
          scale,
        },
      });
      node.metadata = {
        materialConfig: {
          color: '#cccccc',
          roughness: 0.5,
          metalness: 0.0,
          emission: '#000000',
          opacity: 1.0,
          transparent: false,
          wireframe: false,
          ...matConfig,
        },
      };
      nodes[node.id] = node;
      root.childrenIds.push(node.id);

      const geo = createPrimitiveGeometry(prim);
      const rawMesh = bufferGeometryToMeshData(geo);
      geometries[node.geometryId || node.id] = {
        vertices: Array.from(rawMesh.vertices as any),
        normals: rawMesh.normals ? Array.from(rawMesh.normals as any) : undefined,
        uvs: rawMesh.uvs ? Array.from(rawMesh.uvs as any) : undefined,
        indices: rawMesh.indices ? Array.from(rawMesh.indices as any) : undefined,
      };
      return node;
    };

    const addLight = (
      lightName: string,
      pos: { x: number; y: number; z: number },
      color = '#ffffff',
      intensity = 1.0,
    ) => {
      const light = createLightNode({
        name: lightName,
        lightType: 'point',
        color,
        intensity,
        transform: {
          position: pos,
          rotation: { x: 0, y: 0, z: 0 },
          scale: { x: 1, y: 1, z: 1 },
        },
      });
      nodes[light.id] = light;
      root.childrenIds.push(light.id);
      return light;
    };

    const addCamera = (
      cameraName: string,
      pos: { x: number; y: number; z: number } = { x: 0, y: 5, z: 10 },
    ) => {
      const cam = createCameraNode({
        name: cameraName,
        transform: {
          position: pos,
          rotation: { x: -0.35, y: 0, z: 0 },
          scale: { x: 1, y: 1, z: 1 },
        },
      });
      nodes[cam.id] = cam;
      root.childrenIds.push(cam.id);
      return cam;
    };

    // Always provide default Camera and Lights
    addCamera('Camera', { x: 0, y: 4, z: 9 });
    addLight('Key Light', { x: 4, y: 6, z: 4 }, '#fffbf0', 1.2);
    addLight('Fill Light', { x: -4, y: 3, z: -3 }, '#d0e5ff', 0.6);

    if (template === 'default') {
      addMesh(
        'cube',
        'Cube',
        { x: 0, y: 1, z: 0 },
        { x: 0, y: 0, z: 0 },
        { x: 1, y: 1, z: 1 },
        {
          color: '#d48a37',
          roughness: 0.35,
          metalness: 0.1,
        },
      );
      addMesh(
        'plane',
        'Floor',
        { x: 0, y: 0, z: 0 },
        { x: -Math.PI / 2, y: 0, z: 0 },
        { x: 10, y: 10, z: 1 },
        {
          color: '#2a2b30',
          roughness: 0.8,
          metalness: 0.05,
        },
      );
    } else if (template === 'materials') {
      // 4 material preview spheres and pedestal
      addMesh(
        'sphere',
        'Gold Sphere',
        { x: -3, y: 1, z: 0 },
        { x: 0, y: 0, z: 0 },
        { x: 1, y: 1, z: 1 },
        {
          color: '#ffd700',
          roughness: 0.15,
          metalness: 0.95,
        },
      );
      addMesh(
        'cylinder',
        'Chrome Cylinder',
        { x: -1, y: 1, z: 0 },
        { x: 0, y: 0, z: 0 },
        { x: 0.8, y: 1, z: 0.8 },
        {
          color: '#e8e8e8',
          roughness: 0.08,
          metalness: 1.0,
        },
      );
      addMesh(
        'torus',
        'Ruby Torus',
        { x: 1, y: 1, z: 0 },
        { x: 0.8, y: 0, z: 0 },
        { x: 0.8, y: 0.8, z: 0.8 },
        {
          color: '#e62445',
          roughness: 0.25,
          metalness: 0.2,
        },
      );
      addMesh(
        'cone',
        'Emerald Cone',
        { x: 3, y: 1, z: 0 },
        { x: 0, y: 0, z: 0 },
        { x: 0.9, y: 1.2, z: 0.9 },
        {
          color: '#00d084',
          roughness: 0.4,
          metalness: 0.3,
        },
      );
      addMesh(
        'plane',
        'Studio Floor',
        { x: 0, y: 0, z: 0 },
        { x: -Math.PI / 2, y: 0, z: 0 },
        { x: 16, y: 12, z: 1 },
        {
          color: '#222328',
          roughness: 0.7,
          metalness: 0.1,
        },
      );
    } else if (template === 'architecture') {
      // Minimal geometric pavilion
      addMesh(
        'plane',
        'Ground',
        { x: 0, y: 0, z: 0 },
        { x: -Math.PI / 2, y: 0, z: 0 },
        { x: 14, y: 14, z: 1 },
        {
          color: '#383a42',
          roughness: 0.85,
          metalness: 0.0,
        },
      );
      // Columns
      addMesh(
        'cylinder',
        'Pillar NW',
        { x: -2.5, y: 1.5, z: -2.5 },
        { x: 0, y: 0, z: 0 },
        { x: 0.25, y: 1.5, z: 0.25 },
        { color: '#e0e0e0', roughness: 0.3 },
      );
      addMesh(
        'cylinder',
        'Pillar NE',
        { x: 2.5, y: 1.5, z: -2.5 },
        { x: 0, y: 0, z: 0 },
        { x: 0.25, y: 1.5, z: 0.25 },
        { color: '#e0e0e0', roughness: 0.3 },
      );
      addMesh(
        'cylinder',
        'Pillar SW',
        { x: -2.5, y: 1.5, z: 2.5 },
        { x: 0, y: 0, z: 0 },
        { x: 0.25, y: 1.5, z: 0.25 },
        { color: '#e0e0e0', roughness: 0.3 },
      );
      addMesh(
        'cylinder',
        'Pillar SE',
        { x: 2.5, y: 1.5, z: 2.5 },
        { x: 0, y: 0, z: 0 },
        { x: 0.25, y: 1.5, z: 0.25 },
        { color: '#e0e0e0', roughness: 0.3 },
      );
      // Roof slab
      addMesh(
        'cube',
        'Roof Slab',
        { x: 0, y: 3.1, z: 0 },
        { x: 0, y: 0, z: 0 },
        { x: 3.2, y: 0.15, z: 3.2 },
        { color: '#25262b', roughness: 0.4, metalness: 0.6 },
      );
      // Sculpture centerpiece
      addMesh(
        'torus',
        'Centerpiece',
        { x: 0, y: 1.2, z: 0 },
        { x: 0.6, y: 0.4, z: 0 },
        { x: 0.7, y: 0.7, z: 0.7 },
        { color: '#f39c12', roughness: 0.2, metalness: 0.85 },
      );
    }

    return {
      version: '1.0.0',
      metadata: createProjectMetadata(name),
      root,
      nodes,
      collections: {},
      geometries,
      materials,
    };
  }
}

export const webProjectStorage = new WebProjectStorage();
