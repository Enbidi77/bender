import * as THREE from 'three';
import type { StoreApi } from 'zustand/vanilla';
import type { SceneGraphState, SelectionStoreState } from '@blender-elt/scene-core';
import type { CommandManager } from '@blender-elt/commands';
import type { IMeshData, MeshNode, Vector3, SelectionMode, ICommand } from '@blender-elt/contracts';
import { MeshTopology, applyMeshOperation } from '@blender-elt/modeling';
import { EditRaycaster, type DomRectLike } from './EditRaycaster.js';
import type { EditHoverState, EditRaycastHit } from './types.js';

export interface EditViewportBridgeOptions {
  sceneStore: StoreApi<SceneGraphState>;
  selectionStore: StoreApi<SelectionStoreState>;
  sceneObjectsRef: React.MutableRefObject<Map<string, THREE.Object3D>>;
  commandManager?: CommandManager | null;
  raycaster?: EditRaycaster;
}

/**
 * Converts a Three.js BufferGeometry to raw IMeshData
 */
export function bufferGeometryToMeshData(geometry: THREE.BufferGeometry): IMeshData {
  const posAttr = geometry.getAttribute('position') as THREE.BufferAttribute | undefined;
  const normAttr = geometry.getAttribute('normal') as THREE.BufferAttribute | undefined;
  const uvAttr = geometry.getAttribute('uv') as THREE.BufferAttribute | undefined;
  const indexAttr = geometry.getIndex();

  const vertices = posAttr ? new Float32Array(posAttr.array) : new Float32Array();
  const normals = normAttr ? new Float32Array(normAttr.array) : undefined;
  const uvs = uvAttr ? new Float32Array(uvAttr.array) : undefined;

  let indices: Uint32Array | Uint16Array | undefined = undefined;
  if (indexAttr) {
    if (indexAttr.array instanceof Uint32Array || indexAttr.array instanceof Uint16Array) {
      indices = indexAttr.array;
    } else {
      indices = new Uint32Array(indexAttr.array);
    }
  }

  return {
    vertices,
    normals,
    uvs,
    indices,
  };
}

/**
 * Basic Undoable Command for Edit Mode Topology mutations
 */
export class EditMeshTopologyCommand implements ICommand {
  public id: string;
  public name: string;
  public timestamp: number;
  private nodeId: string;
  private previousMeshData: IMeshData;
  private newMeshData: IMeshData;
  private bridge: EditViewportBridge;

  constructor(
    name: string,
    nodeId: string,
    previousMeshData: IMeshData,
    newMeshData: IMeshData,
    bridge: EditViewportBridge,
  ) {
    this.id = `edit-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
    this.name = name;
    this.timestamp = Date.now();
    this.nodeId = nodeId;
    this.previousMeshData = previousMeshData;
    this.newMeshData = newMeshData;
    this.bridge = bridge;
  }

  public execute(): void {
    this.applyData(this.newMeshData);
  }

  public undo(): void {
    this.applyData(this.previousMeshData);
  }

  public redo(): void {
    this.execute();
  }

  private applyData(data: IMeshData): void {
    const sceneStore = this.bridge.getSceneStore();
    const node = sceneStore.getState().getNodeById(this.nodeId);
    if (!node) return;

    sceneStore.getState().updateNode(this.nodeId, {
      metadata: {
        ...node.metadata,
        meshData: data,
      },
    });

    this.bridge.setTopology(MeshTopology.fromMeshData(data));
    this.bridge.flushTopologyToMesh();
  }
}

/**
 * EditViewportBridge
 * Coordinates active Three.js Mesh, MeshTopology, SelectionStore, SceneStore,
 * and CommandManager undo/redo history during Edit Mode.
 */
export class EditViewportBridge {
  private sceneStore: StoreApi<SceneGraphState>;
  private selectionStore: StoreApi<SelectionStoreState>;
  private sceneObjectsRef: React.MutableRefObject<Map<string, THREE.Object3D>>;
  private commandManager: CommandManager | null;
  private raycaster: EditRaycaster;

  private activeMesh: THREE.Mesh | null = null;
  private activeNodeId: string | null = null;
  private topology: MeshTopology | null = null;
  private preMutationSnapshot: IMeshData | null = null;

  private hoverState: EditHoverState = {
    hoveredVertexIndex: null,
    hoveredEdgeIndex: null,
    hoveredFaceIndex: null,
    hitPoint: null,
  };

  private listeners: Set<() => void> = new Set();
  private unsubscribeSelection: (() => void) | null = null;

  constructor(options: EditViewportBridgeOptions) {
    this.sceneStore = options.sceneStore;
    this.selectionStore = options.selectionStore;
    this.sceneObjectsRef = options.sceneObjectsRef;
    this.commandManager = options.commandManager ?? null;
    this.raycaster = options.raycaster ?? new EditRaycaster();

    // Subscribe to selection store to trigger reactive overlay updates
    this.unsubscribeSelection = this.selectionStore.subscribe(() => {
      this.syncSelectionToTopology();
      this.notifyListeners();
    });
  }

  public dispose(): void {
    if (this.unsubscribeSelection) {
      this.unsubscribeSelection();
      this.unsubscribeSelection = null;
    }
    this.listeners.clear();
  }

  public subscribe(listener: () => void): () => void {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  }

  public notifyListeners(): void {
    for (const listener of this.listeners) {
      listener();
    }
  }

  public getSceneStore(): StoreApi<SceneGraphState> {
    return this.sceneStore;
  }

  public getSelectionStore(): StoreApi<SelectionStoreState> {
    return this.selectionStore;
  }

  public getRaycaster(): EditRaycaster {
    return this.raycaster;
  }

  public getActiveMesh(): THREE.Mesh | null {
    return this.activeMesh;
  }

  public getActiveNodeId(): string | null {
    return this.activeNodeId;
  }

  public getTopology(): MeshTopology | null {
    return this.topology;
  }

  public setTopology(topology: MeshTopology | null): void {
    this.topology = topology;
    this.syncSelectionToTopology();
    this.notifyListeners();
  }

  public getHoverState(): Readonly<EditHoverState> {
    return this.hoverState;
  }

  /**
   * Synchronizes active mesh and loads/creates MeshTopology
   */
  public syncActiveMesh(targetNodeId?: string | null): THREE.Mesh | null {
    const nodeId = targetNodeId ?? this.sceneStore.getState().activeNodeId;
    if (!nodeId) {
      this.activeMesh = null;
      this.activeNodeId = null;
      this.topology = null;
      this.notifyListeners();
      return null;
    }

    const obj = this.sceneObjectsRef.current.get(nodeId);
    if (!obj || !(obj instanceof THREE.Mesh)) {
      this.activeMesh = null;
      this.activeNodeId = null;
      this.topology = null;
      this.notifyListeners();
      return null;
    }

    const meshChanged = this.activeMesh !== obj || this.activeNodeId !== nodeId;
    this.activeMesh = obj;
    this.activeNodeId = nodeId;

    if (meshChanged || !this.topology) {
      const node = this.sceneStore.getState().getNodeById(nodeId) as MeshNode | undefined;
      const meshData = node?.metadata?.meshData as IMeshData | undefined;

      if (meshData && meshData.vertices && meshData.vertices.length > 0) {
        this.topology = MeshTopology.fromMeshData(meshData);
      } else if (obj.geometry) {
        const extracted = bufferGeometryToMeshData(obj.geometry);
        this.topology = MeshTopology.fromMeshData(extracted);

        // Store meshData in node metadata
        if (node) {
          this.sceneStore.getState().updateNode(nodeId, {
            metadata: {
              ...node.metadata,
              meshData: extracted,
            },
          });
        }
      }

      this.syncSelectionToTopology();
      this.notifyListeners();
    }

    return this.activeMesh;
  }

  /**
   * Synchronizes selection state between selectionStore and MeshTopology elements
   */
  public syncSelectionToTopology(): void {
    if (!this.topology) return;

    const { selectedVertexIndices, selectedEdgeIndices, selectedFaceIndices } =
      this.selectionStore.getState().editSelection;

    const vertSet = new Set(selectedVertexIndices);
    for (let i = 0; i < this.topology.vertices.length; i++) {
      this.topology.vertices[i].selected = vertSet.has(i);
    }

    const edgeSet = new Set(selectedEdgeIndices);
    for (let i = 0; i < this.topology.edges.length; i++) {
      this.topology.edges[i].selected = edgeSet.has(i);
    }

    const faceSet = new Set(selectedFaceIndices);
    for (let i = 0; i < this.topology.faces.length; i++) {
      this.topology.faces[i].selected = faceSet.has(i);
    }
  }

  /**
   * Updates real-time cursor hover state across active element modes
   */
  public updateHover(
    clientX: number,
    clientY: number,
    rect: DomRectLike,
    camera: THREE.Camera,
  ): EditRaycastHit | null {
    const mesh = this.activeMesh || this.syncActiveMesh();
    if (!mesh || !this.topology || !mesh.visible) {
      this.clearHover();
      return null;
    }

    const activeModes = this.selectionStore.getState().editSelection.elementModes;
    const hit = this.raycaster.pickElement(
      mesh,
      this.topology,
      clientX,
      clientY,
      rect,
      camera,
      activeModes,
    );

    let changed = false;

    if (hit) {
      const vIdx = hit.type === 'vertex' ? hit.elementIndex : null;
      const eIdx = hit.type === 'edge' ? hit.elementIndex : null;
      const fIdx = hit.type === 'face' ? hit.elementIndex : null;

      if (
        this.hoverState.hoveredVertexIndex !== vIdx ||
        this.hoverState.hoveredEdgeIndex !== eIdx ||
        this.hoverState.hoveredFaceIndex !== fIdx
      ) {
        this.hoverState.hoveredVertexIndex = vIdx;
        this.hoverState.hoveredEdgeIndex = eIdx;
        this.hoverState.hoveredFaceIndex = fIdx;
        this.hoverState.hitPoint = hit.worldPoint;
        changed = true;
      }
    } else {
      if (
        this.hoverState.hoveredVertexIndex !== null ||
        this.hoverState.hoveredEdgeIndex !== null ||
        this.hoverState.hoveredFaceIndex !== null
      ) {
        this.hoverState.hoveredVertexIndex = null;
        this.hoverState.hoveredEdgeIndex = null;
        this.hoverState.hoveredFaceIndex = null;
        this.hoverState.hitPoint = null;
        changed = true;
      }
    }

    if (changed) {
      this.notifyListeners();
    }

    return hit;
  }

  public clearHover(): void {
    if (
      this.hoverState.hoveredVertexIndex !== null ||
      this.hoverState.hoveredEdgeIndex !== null ||
      this.hoverState.hoveredFaceIndex !== null
    ) {
      this.hoverState.hoveredVertexIndex = null;
      this.hoverState.hoveredEdgeIndex = null;
      this.hoverState.hoveredFaceIndex = null;
      this.hoverState.hitPoint = null;
      this.notifyListeners();
    }
  }

  /**
   * Element click selection (supports single-select and Shift+click multi-select)
   */
  public selectElementAt(
    clientX: number,
    clientY: number,
    rect: DomRectLike,
    camera: THREE.Camera,
    multi: boolean = false,
  ): EditRaycastHit | null {
    const mesh = this.activeMesh || this.syncActiveMesh();
    if (!mesh || !this.topology) return null;

    const activeModes = this.selectionStore.getState().editSelection.elementModes;
    const hit = this.raycaster.pickElement(
      mesh,
      this.topology,
      clientX,
      clientY,
      rect,
      camera,
      activeModes,
    );

    const mode: SelectionMode = multi ? 'invert' : 'set';

    if (!hit) {
      if (!multi) {
        this.selectionStore.getState().deselectAllEditElements();
      }
      return null;
    }

    if (hit.type === 'vertex') {
      this.selectionStore.getState().selectVertices([hit.elementIndex], mode);
      this.selectionStore.getState().setActiveVertex(hit.elementIndex);
    } else if (hit.type === 'edge') {
      this.selectionStore.getState().selectEdges([hit.elementIndex], mode);
      this.selectionStore.getState().setActiveEdge(hit.elementIndex);
    } else if (hit.type === 'face') {
      this.selectionStore.getState().selectFaces([hit.elementIndex], mode);
      this.selectionStore.getState().setActiveFace(hit.elementIndex);
    }

    this.notifyListeners();
    return hit;
  }

  /**
   * Box marquee selection
   */
  public boxSelect(
    box: { x1: number; y1: number; x2: number; y2: number },
    rect: DomRectLike,
    camera: THREE.Camera,
    mode: SelectionMode = 'set',
  ): void {
    const mesh = this.activeMesh || this.syncActiveMesh();
    if (!mesh || !this.topology) return;

    const activeModes = this.selectionStore.getState().editSelection.elementModes;
    const result = this.raycaster.boxSelectElements(
      mesh,
      this.topology,
      box,
      rect,
      camera,
      activeModes,
    );

    if (activeModes.includes('vertex')) {
      this.selectionStore.getState().selectVertices(result.vertexIndices, mode);
    }
    if (activeModes.includes('edge')) {
      this.selectionStore.getState().selectEdges(result.edgeIndices, mode);
    }
    if (activeModes.includes('face')) {
      this.selectionStore.getState().selectFaces(result.faceIndices, mode);
    }

    this.notifyListeners();
  }

  /**
   * Select All elements of active element modes ('A' hotkey)
   */
  public selectAll(): void {
    if (!this.topology) return;
    const activeModes = this.selectionStore.getState().editSelection.elementModes;

    if (activeModes.includes('vertex')) {
      const allVerts = this.topology.vertices.map((v) => v.index);
      this.selectionStore.getState().selectVertices(allVerts, 'set');
    }
    if (activeModes.includes('edge')) {
      const allEdges = this.topology.edges.map((e) => e.index);
      this.selectionStore.getState().selectEdges(allEdges, 'set');
    }
    if (activeModes.includes('face')) {
      const allFaces = this.topology.faces.map((f) => f.index);
      this.selectionStore.getState().selectFaces(allFaces, 'set');
    }

    this.notifyListeners();
  }

  /**
   * Deselect All elements ('Alt+A' hotkey)
   */
  public deselectAll(): void {
    this.selectionStore.getState().deselectAllEditElements();
    this.notifyListeners();
  }

  /**
   * Invert selection of active modes ('Ctrl+I' hotkey)
   */
  public invertSelection(): void {
    if (!this.topology) return;
    const { elementModes, selectedVertexIndices, selectedEdgeIndices, selectedFaceIndices } =
      this.selectionStore.getState().editSelection;

    if (elementModes.includes('vertex')) {
      const current = new Set(selectedVertexIndices);
      const inverted = this.topology.vertices
        .filter((v) => !current.has(v.index))
        .map((v) => v.index);
      this.selectionStore.getState().selectVertices(inverted, 'set');
    }
    if (elementModes.includes('edge')) {
      const current = new Set(selectedEdgeIndices);
      const inverted = this.topology.edges.filter((e) => !current.has(e.index)).map((e) => e.index);
      this.selectionStore.getState().selectEdges(inverted, 'set');
    }
    if (elementModes.includes('face')) {
      const current = new Set(selectedFaceIndices);
      const inverted = this.topology.faces.filter((f) => !current.has(f.index)).map((f) => f.index);
      this.selectionStore.getState().selectFaces(inverted, 'set');
    }

    this.notifyListeners();
  }

  /**
   * Updates Three.js BufferGeometry attributes in-place or rebuilds when topology changes.
   * Recalculates bounding box and sphere.
   */
  public flushTopologyToMesh(): void {
    const mesh = this.activeMesh;
    const topology = this.topology;
    if (!mesh || !topology) return;

    const meshData = topology.toMeshData();
    const geo = mesh.geometry;
    if (!geo) return;

    const posAttr = geo.getAttribute('position') as THREE.BufferAttribute | undefined;
    const targetCount = topology.vertices.length;

    // Check if we can perform an in-place buffer update
    if (posAttr && posAttr.count === targetCount && meshData.vertices instanceof Float32Array) {
      posAttr.set(meshData.vertices);
      posAttr.needsUpdate = true;

      if (meshData.normals) {
        const normAttr = geo.getAttribute('normal') as THREE.BufferAttribute | undefined;
        if (normAttr && normAttr.count === targetCount) {
          normAttr.set(meshData.normals);
          normAttr.needsUpdate = true;
        } else {
          geo.computeVertexNormals();
        }
      } else {
        geo.computeVertexNormals();
      }

      // Check index buffer
      if (meshData.indices) {
        const indexAttr = geo.getIndex();
        if (indexAttr && indexAttr.count === meshData.indices.length) {
          (indexAttr as any).set(meshData.indices);
          indexAttr.needsUpdate = true;
        } else {
          const newIndices =
            meshData.indices instanceof Uint32Array || meshData.indices instanceof Uint16Array
              ? meshData.indices
              : new Uint32Array(meshData.indices);
          geo.setIndex(new THREE.BufferAttribute(newIndices, 1));
        }
      }
    } else {
      // Rebuild geometry attributes when topology changed (e.g. vertices added or removed)
      const vArr =
        meshData.vertices instanceof Float32Array
          ? meshData.vertices
          : new Float32Array(meshData.vertices);
      geo.setAttribute('position', new THREE.BufferAttribute(vArr, 3));

      if (meshData.normals) {
        const nArr =
          meshData.normals instanceof Float32Array
            ? meshData.normals
            : new Float32Array(meshData.normals);
        geo.setAttribute('normal', new THREE.BufferAttribute(nArr, 3));
      } else {
        geo.computeVertexNormals();
      }

      if (meshData.uvs && meshData.uvs.length > 0) {
        const uvArr =
          meshData.uvs instanceof Float32Array ? meshData.uvs : new Float32Array(meshData.uvs);
        geo.setAttribute('uv', new THREE.BufferAttribute(uvArr, 2));
      }

      if (meshData.indices && meshData.indices.length > 0) {
        const newIndices =
          meshData.indices instanceof Uint32Array || meshData.indices instanceof Uint16Array
            ? meshData.indices
            : new Uint32Array(meshData.indices);
        geo.setIndex(new THREE.BufferAttribute(newIndices, 1));
      }
    }

    geo.computeBoundingSphere();
    geo.computeBoundingBox();

    this.notifyListeners();
  }

  /**
   * Pre-mutation snapshot before starting an interactive transform/extrude modal
   */
  public beginMutation(): void {
    if (this.topology) {
      this.preMutationSnapshot = this.topology.toMeshData();
    }
  }

  /**
   * Commit mutation, creating an undo/redo command and persisting to sceneStore
   */
  public async commitTopologyChange(commandName: string = 'Edit Mesh'): Promise<void> {
    if (!this.topology || !this.activeNodeId) return;

    const previousData = this.preMutationSnapshot ?? this.topology.toMeshData();
    const currentData = this.topology.toMeshData();
    this.preMutationSnapshot = null;

    const nodeId = this.activeNodeId;
    const node = this.sceneStore.getState().getNodeById(nodeId);
    if (node) {
      this.sceneStore.getState().updateNode(nodeId, {
        metadata: {
          ...node.metadata,
          meshData: currentData,
        },
      });
    }

    // Flush GPU geometry
    this.flushTopologyToMesh();

    if (this.commandManager) {
      const command = new EditMeshTopologyCommand(
        commandName,
        nodeId,
        previousData,
        currentData,
        this,
      );
      await this.commandManager.execute(command, {
        state: this.sceneStore.getState(),
        dispatch: () => {},
      });
    }

    this.notifyListeners();
  }

  /**
   * Cancel in-progress mutation and revert geometry
   */
  public cancelMutation(): void {
    if (this.preMutationSnapshot) {
      this.topology = MeshTopology.fromMeshData(this.preMutationSnapshot);
      this.preMutationSnapshot = null;
      this.flushTopologyToMesh();
      this.syncSelectionToTopology();
      this.notifyListeners();
    }
  }

  /**
   * Extrude selected faces/edges/vertices
   */
  public async extrudeSelected(distance: number = 1.0): Promise<void> {
    if (!this.topology) return;
    this.beginMutation();
    this.topology.extrudeSelectedFaces(distance);
    await this.commitTopologyChange('Extrude');
  }

  /**
   * Inset selected faces
   */
  public async insetSelected(thickness: number = 0.2): Promise<void> {
    if (!this.topology) return;
    this.beginMutation();
    const selectedFaces = this.selectionStore.getState().editSelection.selectedFaceIndices;
    applyMeshOperation(this.topology, {
      type: 'inset',
      targetIndices: selectedFaces,
      parameters: { thickness },
    });
    await this.commitTopologyChange('Inset');
  }

  /**
   * Bevel selected edges or vertices
   */
  public async bevelSelected(width: number = 0.1): Promise<void> {
    if (!this.topology) return;
    this.beginMutation();
    const { elementModes, selectedEdgeIndices, selectedVertexIndices } =
      this.selectionStore.getState().editSelection;
    const isVertex = elementModes.includes('vertex') && !elementModes.includes('edge');
    applyMeshOperation(this.topology, {
      type: 'bevel',
      targetIndices: isVertex ? selectedVertexIndices : selectedEdgeIndices,
      parameters: { width, mode: isVertex ? 'vertex' : 'edge' },
    });
    await this.commitTopologyChange('Bevel');
  }

  /**
   * Delete selected elements
   */
  public async deleteSelected(): Promise<void> {
    if (!this.topology) return;
    this.beginMutation();
    const { elementModes, selectedVertexIndices, selectedEdgeIndices, selectedFaceIndices } =
      this.selectionStore.getState().editSelection;

    if (elementModes.includes('face') && selectedFaceIndices.length > 0) {
      applyMeshOperation(this.topology, {
        type: 'delete',
        targetIndices: selectedFaceIndices,
        parameters: { target: 'faces' },
      });
      this.selectionStore.getState().selectFaces([], 'set');
    } else if (elementModes.includes('edge') && selectedEdgeIndices.length > 0) {
      applyMeshOperation(this.topology, {
        type: 'delete',
        targetIndices: selectedEdgeIndices,
        parameters: { target: 'edges' },
      });
      this.selectionStore.getState().selectEdges([], 'set');
    } else if (elementModes.includes('vertex') && selectedVertexIndices.length > 0) {
      applyMeshOperation(this.topology, {
        type: 'delete',
        targetIndices: selectedVertexIndices,
        parameters: { target: 'vertices' },
      });
      this.selectionStore.getState().selectVertices([], 'set');
    }

    await this.commitTopologyChange('Delete');
  }

  /**
   * Translate selected elements by delta vector
   */
  public translateSelected(delta: Vector3): void {
    if (!this.topology) return;
    const vertsToTranslate = this.getVerticesToTransform();
    if (vertsToTranslate.length === 0) return;

    this.topology.translateVertices(vertsToTranslate, delta);
    this.flushTopologyToMesh();
  }

  /**
   * Scale selected elements relative to their median center
   */
  public scaleSelected(factor: Vector3, origin?: Vector3): void {
    if (!this.topology) return;
    const vertsToTransform = this.getVerticesToTransform();
    if (vertsToTransform.length === 0) return;

    const center = origin ?? this.getSelectedCentroid();
    this.topology.scaleVertices(vertsToTransform, factor, center);
    this.flushTopologyToMesh();
  }

  /**
   * Rotate selected elements
   */
  public rotateSelected(euler: { x: number; y: number; z: number }, origin?: Vector3): void {
    if (!this.topology) return;
    const vertsToTransform = this.getVerticesToTransform();
    if (vertsToTransform.length === 0) return;

    const center = origin ?? this.getSelectedCentroid();
    this.topology.rotateVertices(vertsToTransform, euler, center);
    this.flushTopologyToMesh();
  }

  /**
   * Resolves list of vertex indices involved in the current selection
   */
  public getVerticesToTransform(): number[] {
    if (!this.topology) return [];
    const { elementModes, selectedVertexIndices, selectedEdgeIndices, selectedFaceIndices } =
      this.selectionStore.getState().editSelection;

    const vertSet = new Set<number>();

    if (elementModes.includes('vertex')) {
      selectedVertexIndices.forEach((idx) => vertSet.add(idx));
    }
    if (elementModes.includes('edge')) {
      for (const eIdx of selectedEdgeIndices) {
        const edge = this.topology.edges[eIdx];
        if (edge) {
          vertSet.add(edge.v1);
          vertSet.add(edge.v2);
        }
      }
    }
    if (elementModes.includes('face')) {
      for (const fIdx of selectedFaceIndices) {
        const face = this.topology.faces[fIdx];
        if (face) {
          face.vertexIndices.forEach((vIdx) => vertSet.add(vIdx));
        }
      }
    }

    return Array.from(vertSet);
  }

  /**
   * Computes median centroid of currently selected elements in local space
   */
  public getSelectedCentroid(): Vector3 {
    const verts = this.getVerticesToTransform();
    if (!this.topology || verts.length === 0) {
      return { x: 0, y: 0, z: 0 };
    }

    let sx = 0;
    let sy = 0;
    let sz = 0;
    for (const vIdx of verts) {
      const v = this.topology.vertices[vIdx];
      if (v) {
        sx += v.position.x;
        sy += v.position.y;
        sz += v.position.z;
      }
    }

    return {
      x: sx / verts.length,
      y: sy / verts.length,
      z: sz / verts.length,
    };
  }
}
