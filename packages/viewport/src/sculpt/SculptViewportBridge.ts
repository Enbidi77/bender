import * as THREE from 'three';
import type { StoreApi } from 'zustand/vanilla';
import type { SceneGraphState } from '@blender-elt/scene-core';
import type { CommandManager } from '@blender-elt/commands';
import { SculptSession, globalSculptSession } from '@blender-elt/sculpting';
import { SurfaceRaycaster, type DetailedHitResult } from './SurfaceRaycaster.js';

export interface CursorHitState {
  hit: boolean;
  worldPoint: THREE.Vector3;
  worldNormal: THREE.Vector3;
  localPoint: THREE.Vector3;
  localNormal: THREE.Vector3;
  mesh: THREE.Mesh | null;
}

export type CursorStateListener = (state: CursorHitState) => void;

/**
 * SculptViewportBridge
 * Coordinates the headless SculptSession and sculptStore with active Three.js Meshes,
 * BufferGeometries, raycasting, and the CommandManager undo/redo history.
 */
export class SculptViewportBridge {
  private session: SculptSession;
  private sceneStore: StoreApi<SceneGraphState>;
  private commandManager: CommandManager | null;
  private sceneObjectsRef: React.MutableRefObject<Map<string, THREE.Object3D>>;
  private raycaster: SurfaceRaycaster;
  private activeMesh: THREE.Mesh | null = null;

  // Real-time cursor state updated on pointermove without React rerenders
  private cursorState: CursorHitState = {
    hit: false,
    worldPoint: new THREE.Vector3(),
    worldNormal: new THREE.Vector3(0, 1, 0),
    localPoint: new THREE.Vector3(),
    localNormal: new THREE.Vector3(0, 1, 0),
    mesh: null,
  };

  private cursorListeners: Set<CursorStateListener> = new Set();

  constructor(options: {
    sceneStore: StoreApi<SceneGraphState>;
    sceneObjectsRef: React.MutableRefObject<Map<string, THREE.Object3D>>;
    commandManager?: CommandManager | null;
    session?: SculptSession;
    raycaster?: SurfaceRaycaster;
  }) {
    this.sceneStore = options.sceneStore;
    this.sceneObjectsRef = options.sceneObjectsRef;
    this.commandManager = options.commandManager ?? null;
    this.session = options.session ?? globalSculptSession;
    this.raycaster = options.raycaster ?? new SurfaceRaycaster();
  }

  public getSession(): SculptSession {
    return this.session;
  }

  public getRaycaster(): SurfaceRaycaster {
    return this.raycaster;
  }

  public getCursorState(): Readonly<CursorHitState> {
    return this.cursorState;
  }

  public getActiveMesh(): THREE.Mesh | null {
    return this.activeMesh;
  }

  public subscribeCursor(listener: CursorStateListener): () => void {
    this.cursorListeners.add(listener);
    return () => {
      this.cursorListeners.delete(listener);
    };
  }

  /**
   * Synchronize the active sculpt target with the scene graph selection
   */
  public syncActiveMesh(targetNodeId?: string | null): THREE.Mesh | null {
    const nodeId = targetNodeId ?? this.sceneStore.getState().activeNodeId;
    if (!nodeId) {
      if (this.session.getNodeId() !== null) {
        this.session.detachMesh();
      }
      this.activeMesh = null;
      return null;
    }

    const obj = this.sceneObjectsRef.current.get(nodeId);
    if (!obj || !(obj instanceof THREE.Mesh)) {
      this.activeMesh = null;
      return null;
    }

    this.activeMesh = obj;

    if (this.session.getNodeId() !== nodeId && obj.geometry) {
      this.session.attachMesh(nodeId, obj.geometry);
    }

    return this.activeMesh;
  }

  /**
   * Update real-time cursor hit test against the active sculpt mesh
   */
  public updateCursor(ndcX: number, ndcY: number, camera: THREE.Camera): DetailedHitResult | null {
    const mesh = this.activeMesh || this.syncActiveMesh();
    if (!mesh || !mesh.visible) {
      this.cursorState.hit = false;
      this.cursorState.mesh = null;
      this.notifyCursorListeners();
      return null;
    }

    const hit = this.raycaster.raycastFromNDC(mesh, ndcX, ndcY, camera);
    if (hit && hit.hit) {
      this.cursorState.hit = true;
      this.cursorState.worldPoint.set(hit.point.x, hit.point.y, hit.point.z);
      this.cursorState.worldNormal.set(hit.normal.x, hit.normal.y, hit.normal.z);
      this.cursorState.localPoint.set(hit.localPoint.x, hit.localPoint.y, hit.localPoint.z);
      this.cursorState.localNormal.set(hit.localNormal.x, hit.localNormal.y, hit.localNormal.z);
      this.cursorState.mesh = mesh;
    } else {
      this.cursorState.hit = false;
      this.cursorState.mesh = null;
    }

    this.notifyCursorListeners();
    return hit;
  }

  /**
   * Set cursor invisible when pointer leaves the canvas or target
   */
  public clearCursor(): void {
    this.cursorState.hit = false;
    this.cursorState.mesh = null;
    this.notifyCursorListeners();
  }

  private notifyCursorListeners(): void {
    for (const listener of this.cursorListeners) {
      listener(this.cursorState);
    }
  }

  /**
   * Apply dirty buffer deltas in-place to the active Three.js mesh BufferGeometry
   */
  public flushBufferToMesh(): void {
    const mesh = this.activeMesh;
    const buffer = this.session.getBuffer();
    if (!mesh || !buffer || !buffer.hasDirty()) return;

    if (typeof mesh.userData?.updateSculptBuffers === 'function') {
      mesh.userData.updateSculptBuffers(
        buffer.positions,
        buffer.normals,
        buffer.dirtyMinIndex,
        buffer.dirtyMaxIndex,
        buffer.masks,
      );
    } else {
      // Fallback manual buffer update
      const posAttr = mesh.geometry.getAttribute('position') as THREE.BufferAttribute;
      if (posAttr) {
        posAttr.set(buffer.positions);
        posAttr.needsUpdate = true;
      }
      const normAttr = mesh.geometry.getAttribute('normal') as THREE.BufferAttribute;
      if (normAttr) {
        normAttr.set(buffer.normals);
        normAttr.needsUpdate = true;
      }
      mesh.geometry.computeBoundingSphere();
    }
  }

  /**
   * Finalize stroke, execute command in CommandManager, and persist node meshData
   */
  public async commitStroke(): Promise<void> {
    const command = this.session.endStroke();
    const nodeId = this.session.getNodeId();
    const buffer = this.session.getBuffer();

    if (command && this.commandManager) {
      await this.commandManager.execute(command, {
        state: this.sceneStore.getState(),
        dispatch: () => {},
      });
    }

    // Synchronize latest meshData to node metadata in sceneStore
    if (nodeId && buffer) {
      const node = this.sceneStore.getState().nodes[nodeId];
      if (node) {
        const meshData = buffer.toMeshData();
        this.sceneStore.getState().updateNode(nodeId, {
          metadata: {
            ...node.metadata,
            meshData,
            sculptMask: buffer.masks,
          },
        });
      }
    }

    // Final GPU sync
    this.flushBufferToMesh();
  }

  /**
   * Cancel in-progress stroke and restore GPU buffer to prior state
   */
  public cancelStroke(): void {
    this.session.cancelStroke();
    this.flushBufferToMesh();
  }
}
