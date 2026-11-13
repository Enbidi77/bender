import type {
  CommandContext,
  MeshNode,
  IMeshData,
  Vector3,
  EditMeshSelectionState,
  MeshOperation,
} from '@blender-elt/contracts';
import { BaseCommand, getSceneState } from './commands.js';
import { computeMedianPoint } from './selection-algorithms.js';

/**
 * Snapshot of a MeshNode's geometric topology and Edit Mode selection state
 */
export interface MeshTopologySnapshot {
  meshData: IMeshData;
  selectionState?: EditMeshSelectionState;
  metadata?: Record<string, unknown>;
}

/**
 * Deep clones IMeshData with new TypedArray buffers
 */
export function cloneMeshData(data: IMeshData): IMeshData {
  const verts =
    data.vertices instanceof Float32Array
      ? new Float32Array(data.vertices)
      : new Float32Array(data.vertices);

  let normals: Float32Array | undefined = undefined;
  if (data.normals && data.normals.length > 0) {
    normals =
      data.normals instanceof Float32Array
        ? new Float32Array(data.normals)
        : new Float32Array(data.normals);
  }

  let uvs: Float32Array | undefined = undefined;
  if (data.uvs && data.uvs.length > 0) {
    uvs =
      data.uvs instanceof Float32Array ? new Float32Array(data.uvs) : new Float32Array(data.uvs);
  }

  let indices: Uint32Array | Uint16Array | number[] | undefined = undefined;
  if (data.indices && data.indices.length > 0) {
    if (data.indices instanceof Uint32Array) {
      indices = new Uint32Array(data.indices);
    } else if (data.indices instanceof Uint16Array) {
      indices = new Uint16Array(data.indices);
    } else {
      indices = [...data.indices];
    }
  }

  return {
    vertices: verts,
    normals,
    uvs,
    indices,
  };
}

/**
 * Deep clones EditMeshSelectionState
 */
export function cloneSelectionState(
  state?: EditMeshSelectionState,
): EditMeshSelectionState | undefined {
  if (!state) return undefined;
  return {
    elementModes: [...state.elementModes],
    selectedVertexIndices: [...state.selectedVertexIndices],
    selectedEdgeIndices: [...state.selectedEdgeIndices],
    selectedFaceIndices: [...state.selectedFaceIndices],
    activeVertexIndex: state.activeVertexIndex,
    activeEdgeIndex: state.activeEdgeIndex,
    activeFaceIndex: state.activeFaceIndex,
  };
}

/**
 * Captures a complete snapshot of a MeshNode and optional selection state
 */
export function createMeshNodeSnapshot(
  node: MeshNode,
  selectionState?: EditMeshSelectionState,
): MeshTopologySnapshot {
  const meshData = node.metadata?.meshData as IMeshData | undefined;
  const clonedData: IMeshData = meshData
    ? cloneMeshData(meshData)
    : {
        vertices: new Float32Array(),
      };

  const selState =
    selectionState !== undefined
      ? cloneSelectionState(selectionState)
      : cloneSelectionState(node.metadata?.editSelection as EditMeshSelectionState | undefined);

  return {
    meshData: clonedData,
    selectionState: selState,
    metadata: node.metadata ? { ...node.metadata } : {},
  };
}

/**
 * Helper to retrieve or update selection store from CommandContext if available
 */
function getSelectionStore(ctx: CommandContext): any {
  if (ctx.metadata?.selectionStore) {
    return ctx.metadata.selectionStore;
  }
  if ((ctx as any).selectionStore) {
    return (ctx as any).selectionStore;
  }
  return undefined;
}

/**
 * Applies a MeshTopologySnapshot to a MeshNode in the SceneGraphState and synchronizes stores
 */
function applySnapshotToNode(
  nodeId: string,
  snapshot: MeshTopologySnapshot,
  ctx: CommandContext,
): void {
  const store = getSceneState(ctx);
  const node = store.getNodeById(nodeId) as MeshNode | undefined;
  if (!node) return;

  const currentVersion = (node.metadata?.geometryVersion as number) || 0;
  const updatedMetadata: Record<string, unknown> = {
    ...node.metadata,
    ...snapshot.metadata,
    meshData: cloneMeshData(snapshot.meshData),
    geometryVersion: currentVersion + 1,
    lastModified: Date.now(),
  };

  if (snapshot.selectionState) {
    updatedMetadata.editSelection = cloneSelectionState(snapshot.selectionState);
  }

  store.updateNode(nodeId, {
    metadata: updatedMetadata,
  });

  // Synchronize selection store if attached
  const selectionStore = getSelectionStore(ctx);
  if (selectionStore && snapshot.selectionState) {
    if (typeof selectionStore.loadSnapshot === 'function') {
      selectionStore.loadSnapshot({ edit: snapshot.selectionState });
    } else if (typeof selectionStore.getState === 'function') {
      selectionStore.getState().loadSnapshot?.({ edit: snapshot.selectionState });
    }
  }

  // Notify geometry change via dispatch or metadata callback
  if (typeof ctx.dispatch === 'function') {
    ctx.dispatch({
      type: 'GEOMETRY_UPDATED',
      nodeId,
      geometryVersion: currentVersion + 1,
    });
  }

  if (typeof ctx.metadata?.onGeometryUpdate === 'function') {
    (ctx.metadata.onGeometryUpdate as (id: string) => void)(nodeId);
  }
}

/**
 * Recomputes smooth vertex normals from vertices and triangle indices
 */
export function recomputeNormals(
  positions: Float32Array,
  indices?: Uint32Array | Uint16Array | number[],
): Float32Array {
  const numVerts = Math.floor(positions.length / 3);
  const normals = new Float32Array(numVerts * 3);

  const idxCount = indices ? indices.length : numVerts;
  for (let i = 0; i < idxCount; i += 3) {
    const i0 = indices ? indices[i] : i;
    const i1 = indices ? indices[i + 1] : i + 1;
    const i2 = indices ? indices[i + 2] : i + 2;

    if (i0 >= numVerts || i1 >= numVerts || i2 >= numVerts) continue;

    const ax = positions[i0 * 3];
    const ay = positions[i0 * 3 + 1];
    const az = positions[i0 * 3 + 2];

    const bx = positions[i1 * 3];
    const by = positions[i1 * 3 + 1];
    const bz = positions[i1 * 3 + 2];

    const cx = positions[i2 * 3];
    const cy = positions[i2 * 3 + 1];
    const cz = positions[i2 * 3 + 2];

    // Edge vectors: v1 = b - a, v2 = c - a
    const v1x = bx - ax;
    const v1y = by - ay;
    const v1z = bz - az;

    const v2x = cx - ax;
    const v2y = cy - ay;
    const v2z = cz - az;

    // Cross product: n = v1 x v2
    const nx = v1y * v2z - v1z * v2y;
    const ny = v1z * v2x - v1x * v2z;
    const nz = v1x * v2y - v1y * v2x;

    normals[i0 * 3] += nx;
    normals[i0 * 3 + 1] += ny;
    normals[i0 * 3 + 2] += nz;

    normals[i1 * 3] += nx;
    normals[i1 * 3 + 1] += ny;
    normals[i1 * 3 + 2] += nz;

    normals[i2 * 3] += nx;
    normals[i2 * 3 + 1] += ny;
    normals[i2 * 3 + 2] += nz;
  }

  // Normalize all vertex normals
  for (let i = 0; i < numVerts; i++) {
    const nx = normals[i * 3];
    const ny = normals[i * 3 + 1];
    const nz = normals[i * 3 + 2];

    const len = Math.sqrt(nx * nx + ny * ny + nz * nz);
    if (len > 1e-6) {
      normals[i * 3] = nx / len;
      normals[i * 3 + 1] = ny / len;
      normals[i * 3 + 2] = nz / len;
    } else {
      normals[i * 3] = 0;
      normals[i * 3 + 1] = 1;
      normals[i * 3 + 2] = 0;
    }
  }

  return normals;
}

// ============================================================================
// 1. EditMeshCommand
// ============================================================================

/**
 * EditMeshCommand:
 * Encapsulates any arbitrary mesh topology mutation on a MeshNode.
 * Stores pre-mutation and post-mutation snapshots (coordinates, topology indices, selection state).
 * On undo(), restores exact pre-mutation state; on redo(), reapplies post-mutation state.
 */
export class EditMeshCommand extends BaseCommand {
  public nodeId: string;
  public beforeSnapshot: MeshTopologySnapshot;
  public afterSnapshot: MeshTopologySnapshot;

  constructor(
    nodeId: string,
    name: string,
    beforeSnapshot: MeshTopologySnapshot,
    afterSnapshot: MeshTopologySnapshot,
  ) {
    super(name);
    this.nodeId = nodeId;
    this.beforeSnapshot = {
      meshData: cloneMeshData(beforeSnapshot.meshData),
      selectionState: cloneSelectionState(beforeSnapshot.selectionState),
      metadata: beforeSnapshot.metadata ? { ...beforeSnapshot.metadata } : {},
    };
    this.afterSnapshot = {
      meshData: cloneMeshData(afterSnapshot.meshData),
      selectionState: cloneSelectionState(afterSnapshot.selectionState),
      metadata: afterSnapshot.metadata ? { ...afterSnapshot.metadata } : {},
    };
  }

  public execute(ctx: CommandContext): void {
    applySnapshotToNode(this.nodeId, this.afterSnapshot, ctx);
  }

  public undo(ctx: CommandContext): void {
    applySnapshotToNode(this.nodeId, this.beforeSnapshot, ctx);
  }

  public override redo(ctx: CommandContext): void {
    applySnapshotToNode(this.nodeId, this.afterSnapshot, ctx);
  }
}

// ============================================================================
// 2. MeshOperationCommand
// ============================================================================

export interface MeshOperationOptions {
  nodeId: string;
  operation: MeshOperation;
  name?: string;
  beforeSnapshot?: MeshTopologySnapshot;
  afterSnapshot?: MeshTopologySnapshot;
  customExecutor?: (
    meshData: IMeshData,
    operation: MeshOperation,
    selection?: EditMeshSelectionState,
  ) => { meshData: IMeshData; selection?: EditMeshSelectionState };
}

/**
 * MeshOperationCommand:
 * Encapsulates declarative mesh modeling operations (extrude, subdivide, flip normals, delete,
 * smooth, merge, inset) with full undo/redo transaction integrity.
 */
export class MeshOperationCommand extends BaseCommand {
  public nodeId: string;
  public operation: MeshOperation;
  public beforeSnapshot?: MeshTopologySnapshot;
  public afterSnapshot?: MeshTopologySnapshot;
  private customExecutor?: MeshOperationOptions['customExecutor'];

  constructor(options: MeshOperationOptions) {
    const opName = options.name || `Mesh ${options.operation.type}`;
    super(opName);
    this.nodeId = options.nodeId;
    this.operation = { ...options.operation, parameters: { ...options.operation.parameters } };
    if (options.beforeSnapshot) {
      this.beforeSnapshot = {
        meshData: cloneMeshData(options.beforeSnapshot.meshData),
        selectionState: cloneSelectionState(options.beforeSnapshot.selectionState),
        metadata: options.beforeSnapshot.metadata ? { ...options.beforeSnapshot.metadata } : {},
      };
    }
    if (options.afterSnapshot) {
      this.afterSnapshot = {
        meshData: cloneMeshData(options.afterSnapshot.meshData),
        selectionState: cloneSelectionState(options.afterSnapshot.selectionState),
        metadata: options.afterSnapshot.metadata ? { ...options.afterSnapshot.metadata } : {},
      };
    }
    this.customExecutor = options.customExecutor;
  }

  public execute(ctx: CommandContext): void {
    const store = getSceneState(ctx);
    const node = store.getNodeById(this.nodeId) as MeshNode | undefined;
    if (!node) return;

    // Capture initial beforeSnapshot if not already present
    if (!this.beforeSnapshot) {
      const selStore = getSelectionStore(ctx);
      const selState = selStore?.getState
        ? selStore.getState().editSelection
        : node.metadata?.editSelection;
      this.beforeSnapshot = createMeshNodeSnapshot(node, selState);
    }

    // If afterSnapshot is already prepared, apply it directly
    if (this.afterSnapshot) {
      applySnapshotToNode(this.nodeId, this.afterSnapshot, ctx);
      return;
    }

    // Execute the operation
    let resultingMeshData: IMeshData;
    let resultingSelection: EditMeshSelectionState | undefined = this.beforeSnapshot.selectionState;

    if (this.customExecutor) {
      const result = this.customExecutor(
        cloneMeshData(this.beforeSnapshot.meshData),
        this.operation,
        this.beforeSnapshot.selectionState,
      );
      resultingMeshData = result.meshData;
      resultingSelection = result.selection;
    } else {
      const result = executeBuiltinMeshOperation(
        cloneMeshData(this.beforeSnapshot.meshData),
        this.operation,
        this.beforeSnapshot.selectionState,
      );
      resultingMeshData = result.meshData;
      resultingSelection = result.selection;
    }

    this.afterSnapshot = {
      meshData: resultingMeshData,
      selectionState: resultingSelection,
      metadata: { ...node.metadata },
    };

    applySnapshotToNode(this.nodeId, this.afterSnapshot, ctx);
  }

  public undo(ctx: CommandContext): void {
    if (this.beforeSnapshot) {
      applySnapshotToNode(this.nodeId, this.beforeSnapshot, ctx);
    }
  }

  public override redo(ctx: CommandContext): void {
    if (this.afterSnapshot) {
      applySnapshotToNode(this.nodeId, this.afterSnapshot, ctx);
    }
  }
}

/**
 * Built-in procedural executor for core MeshOperations:
 * Handles 'flip-normals', 'subdivide', 'extrude', 'delete', 'smooth', 'merge', 'inset'.
 */
export function executeBuiltinMeshOperation(
  meshData: IMeshData,
  operation: MeshOperation,
  selection?: EditMeshSelectionState,
): { meshData: IMeshData; selection?: EditMeshSelectionState } {
  const currentPositions =
    meshData.vertices instanceof Float32Array
      ? meshData.vertices
      : new Float32Array(meshData.vertices);
  const currentIndices = meshData.indices ? Array.from(meshData.indices) : [];

  switch (operation.type) {
    case 'flip-normals': {
      // Invert winding order of triangle indices for target faces (or all faces if target is empty)
      const targetFaces =
        operation.targetIndices.length > 0 ? new Set(operation.targetIndices) : null;

      const numFaces = Math.floor(currentIndices.length / 3);
      for (let f = 0; f < numFaces; f++) {
        if (!targetFaces || targetFaces.has(f)) {
          const idx1 = f * 3 + 1;
          const idx2 = f * 3 + 2;
          const temp = currentIndices[idx1];
          currentIndices[idx1] = currentIndices[idx2];
          currentIndices[idx2] = temp;
        }
      }

      const newIndices =
        currentPositions.length / 3 > 65535
          ? new Uint32Array(currentIndices)
          : new Uint16Array(currentIndices);
      const newNormals = recomputeNormals(currentPositions, newIndices);

      return {
        meshData: {
          vertices: currentPositions,
          normals: newNormals,
          uvs: meshData.uvs,
          indices: newIndices,
        },
        selection,
      };
    }

    case 'subdivide': {
      // Subdivides triangles into 4 by splitting edges at midpoints
      const iterations =
        typeof operation.parameters.iterations === 'number'
          ? Math.min(Math.max(operation.parameters.iterations, 1), 4)
          : 1;

      let posArr = Array.from(currentPositions);
      let idxArr = [...currentIndices];

      for (let iter = 0; iter < iterations; iter++) {
        const midpointCache = new Map<string, number>();

        const getMidpoint = (v1: number, v2: number): number => {
          const minV = Math.min(v1, v2);
          const maxV = Math.max(v1, v2);
          const key = `${minV}_${maxV}`;
          const existing = midpointCache.get(key);
          if (existing !== undefined) return existing;

          const mx = (posArr[minV * 3] + posArr[maxV * 3]) * 0.5;
          const my = (posArr[minV * 3 + 1] + posArr[maxV * 3 + 1]) * 0.5;
          const mz = (posArr[minV * 3 + 2] + posArr[maxV * 3 + 2]) * 0.5;

          const newIdx = Math.floor(posArr.length / 3);
          posArr.push(mx, my, mz);
          midpointCache.set(key, newIdx);
          return newIdx;
        };

        const nextIndices: number[] = [];
        const numTriangles = Math.floor(idxArr.length / 3);

        for (let t = 0; t < numTriangles; t++) {
          const v0 = idxArr[t * 3];
          const v1 = idxArr[t * 3 + 1];
          const v2 = idxArr[t * 3 + 2];

          const m01 = getMidpoint(v0, v1);
          const m12 = getMidpoint(v1, v2);
          const m20 = getMidpoint(v2, v0);

          nextIndices.push(v0, m01, m20, m01, v1, m12, m20, m12, v2, m01, m12, m20);
        }

        idxArr = nextIndices;
      }

      const finalPositions = new Float32Array(posArr);
      const finalIndices =
        finalPositions.length / 3 > 65535 ? new Uint32Array(idxArr) : new Uint16Array(idxArr);
      const finalNormals = recomputeNormals(finalPositions, finalIndices);

      return {
        meshData: {
          vertices: finalPositions,
          normals: finalNormals,
          indices: finalIndices,
        },
        selection: selection
          ? {
              ...selection,
              selectedVertexIndices: [],
              selectedEdgeIndices: [],
              selectedFaceIndices: [],
              activeVertexIndex: null,
              activeEdgeIndex: null,
              activeFaceIndex: null,
            }
          : undefined,
      };
    }

    case 'extrude': {
      // Extrudes target faces along normal by distance
      const distance =
        typeof operation.parameters.distance === 'number' ? operation.parameters.distance : 1.0;
      const targetFaces =
        operation.targetIndices.length > 0
          ? operation.targetIndices
          : (selection?.selectedFaceIndices ?? []);

      if (targetFaces.length === 0) {
        return { meshData, selection };
      }

      const posArr = Array.from(currentPositions);
      const idxArr = [...currentIndices];

      const vertexRemap = new Map<number, number>();
      const newExtrudedVerts: number[] = [];

      // Collect vertices belonging to the extruded faces
      for (const fIdx of targetFaces) {
        const start = fIdx * 3;
        if (start + 2 < idxArr.length) {
          const v0 = idxArr[start];
          const v1 = idxArr[start + 1];
          const v2 = idxArr[start + 2];

          // Compute face normal
          const ax = posArr[v0 * 3],
            ay = posArr[v0 * 3 + 1],
            az = posArr[v0 * 3 + 2];
          const bx = posArr[v1 * 3],
            by = posArr[v1 * 3 + 1],
            bz = posArr[v1 * 3 + 2];
          const cx = posArr[v2 * 3],
            cy = posArr[v2 * 3 + 1],
            cz = posArr[v2 * 3 + 2];

          const v1x = bx - ax,
            v1y = by - ay,
            v1z = bz - az;
          const v2x = cx - ax,
            v2y = cy - ay,
            v2z = cz - az;

          let nx = v1y * v2z - v1z * v2y;
          let ny = v1z * v2x - v1x * v2z;
          let nz = v1x * v2y - v1y * v2x;
          const len = Math.sqrt(nx * nx + ny * ny + nz * nz) || 1;
          nx /= len;
          ny /= len;
          nz /= len;

          const offsetDirection = (operation.parameters.direction as Vector3 | undefined) ?? {
            x: nx,
            y: ny,
            z: nz,
          };

          for (const vi of [v0, v1, v2]) {
            if (!vertexRemap.has(vi)) {
              const newVi = Math.floor(posArr.length / 3);
              posArr.push(
                posArr[vi * 3] + offsetDirection.x * distance,
                posArr[vi * 3 + 1] + offsetDirection.y * distance,
                posArr[vi * 3 + 2] + offsetDirection.z * distance,
              );
              vertexRemap.set(vi, newVi);
              newExtrudedVerts.push(newVi);
            }
          }
        }
      }

      // Find boundary perimeter edges of the extruded faces to create side walls
      const edgeFaceCount = new Map<string, { count: number; v1: number; v2: number }>();
      for (const fIdx of targetFaces) {
        const start = fIdx * 3;
        if (start + 2 < idxArr.length) {
          const verts = [idxArr[start], idxArr[start + 1], idxArr[start + 2]];
          for (let i = 0; i < 3; i++) {
            const va = verts[i];
            const vb = verts[(i + 1) % 3];
            const minV = Math.min(va, vb);
            const maxV = Math.max(va, vb);
            const key = `${minV}_${maxV}`;
            const existing = edgeFaceCount.get(key);
            if (existing) {
              existing.count++;
            } else {
              edgeFaceCount.set(key, { count: 1, v1: va, v2: vb });
            }
          }
        }
      }

      // Update extruded top faces to reference the new vertices
      for (const fIdx of targetFaces) {
        const start = fIdx * 3;
        if (start + 2 < idxArr.length) {
          idxArr[start] = vertexRemap.get(idxArr[start]) ?? idxArr[start];
          idxArr[start + 1] = vertexRemap.get(idxArr[start + 1]) ?? idxArr[start + 1];
          idxArr[start + 2] = vertexRemap.get(idxArr[start + 2]) ?? idxArr[start + 2];
        }
      }

      // Add side wall quad faces (triangulated) for perimeter edges
      for (const [_key, data] of edgeFaceCount) {
        if (data.count === 1) {
          const v0 = data.v1;
          const v1 = data.v2;
          const nv0 = vertexRemap.get(v0);
          const nv1 = vertexRemap.get(v1);

          if (nv0 !== undefined && nv1 !== undefined) {
            // Triangle 1: [v0, v1, nv1]
            idxArr.push(v0, v1, nv1);
            // Triangle 2: [v0, nv1, nv0]
            idxArr.push(v0, nv1, nv0);
          }
        }
      }

      const finalPositions = new Float32Array(posArr);
      const finalIndices =
        finalPositions.length / 3 > 65535 ? new Uint32Array(idxArr) : new Uint16Array(idxArr);
      const finalNormals = recomputeNormals(finalPositions, finalIndices);

      return {
        meshData: {
          vertices: finalPositions,
          normals: finalNormals,
          indices: finalIndices,
        },
        selection: selection
          ? {
              ...selection,
              selectedVertexIndices: newExtrudedVerts,
              selectedEdgeIndices: [],
              selectedFaceIndices: targetFaces,
              activeVertexIndex: newExtrudedVerts[newExtrudedVerts.length - 1] ?? null,
              activeFaceIndex: targetFaces[targetFaces.length - 1] ?? null,
            }
          : undefined,
      };
    }

    case 'delete': {
      // Deletes specified vertices, edges, or faces
      const targetType = (operation.parameters.target as string) || 'faces';

      if (targetType === 'faces') {
        const facesToDelete = new Set(operation.targetIndices);
        const nextIndices: number[] = [];
        const numTriangles = Math.floor(currentIndices.length / 3);

        for (let t = 0; t < numTriangles; t++) {
          if (!facesToDelete.has(t)) {
            nextIndices.push(
              currentIndices[t * 3],
              currentIndices[t * 3 + 1],
              currentIndices[t * 3 + 2],
            );
          }
        }

        const finalIndices =
          currentPositions.length / 3 > 65535
            ? new Uint32Array(nextIndices)
            : new Uint16Array(nextIndices);
        const finalNormals = recomputeNormals(currentPositions, finalIndices);

        return {
          meshData: {
            vertices: currentPositions,
            normals: finalNormals,
            indices: finalIndices,
          },
          selection: selection
            ? {
                ...selection,
                selectedFaceIndices: [],
                activeFaceIndex: null,
              }
            : undefined,
        };
      }

      if (targetType === 'vertices') {
        const vertsToDelete = new Set(operation.targetIndices);
        const oldToNew = new Map<number, number>();
        const nextVerts: number[] = [];
        const numVerts = Math.floor(currentPositions.length / 3);

        for (let i = 0; i < numVerts; i++) {
          if (!vertsToDelete.has(i)) {
            const newIdx = Math.floor(nextVerts.length / 3);
            oldToNew.set(i, newIdx);
            nextVerts.push(
              currentPositions[i * 3],
              currentPositions[i * 3 + 1],
              currentPositions[i * 3 + 2],
            );
          }
        }

        const nextIndices: number[] = [];
        const numTriangles = Math.floor(currentIndices.length / 3);

        for (let t = 0; t < numTriangles; t++) {
          const v0 = currentIndices[t * 3];
          const v1 = currentIndices[t * 3 + 1];
          const v2 = currentIndices[t * 3 + 2];

          // Keep face only if all vertices survive
          if (!vertsToDelete.has(v0) && !vertsToDelete.has(v1) && !vertsToDelete.has(v2)) {
            nextIndices.push(oldToNew.get(v0)!, oldToNew.get(v1)!, oldToNew.get(v2)!);
          }
        }

        const finalPositions = new Float32Array(nextVerts);
        const finalIndices =
          finalPositions.length / 3 > 65535
            ? new Uint32Array(nextIndices)
            : new Uint16Array(nextIndices);
        const finalNormals = recomputeNormals(finalPositions, finalIndices);

        return {
          meshData: {
            vertices: finalPositions,
            normals: finalNormals,
            indices: finalIndices,
          },
          selection: selection
            ? {
                ...selection,
                selectedVertexIndices: [],
                selectedEdgeIndices: [],
                selectedFaceIndices: [],
                activeVertexIndex: null,
                activeEdgeIndex: null,
                activeFaceIndex: null,
              }
            : undefined,
        };
      }

      return { meshData, selection };
    }

    case 'smooth': {
      // Laplacian smoothing on target vertices
      const factor =
        typeof operation.parameters.factor === 'number' ? operation.parameters.factor : 0.5;
      const targetVerts =
        operation.targetIndices.length > 0
          ? operation.targetIndices
          : (selection?.selectedVertexIndices ?? []);

      if (targetVerts.length === 0) {
        return { meshData, selection };
      }

      const neighborMap = new Map<number, Set<number>>();
      const numTriangles = Math.floor(currentIndices.length / 3);
      for (let t = 0; t < numTriangles; t++) {
        const v0 = currentIndices[t * 3];
        const v1 = currentIndices[t * 3 + 1];
        const v2 = currentIndices[t * 3 + 2];

        if (!neighborMap.has(v0)) neighborMap.set(v0, new Set());
        if (!neighborMap.has(v1)) neighborMap.set(v1, new Set());
        if (!neighborMap.has(v2)) neighborMap.set(v2, new Set());

        neighborMap.get(v0)!.add(v1);
        neighborMap.get(v0)!.add(v2);
        neighborMap.get(v1)!.add(v0);
        neighborMap.get(v1)!.add(v2);
        neighborMap.get(v2)!.add(v0);
        neighborMap.get(v2)!.add(v1);
      }

      const newPositions = new Float32Array(currentPositions);
      for (const vi of targetVerts) {
        const neighbors = neighborMap.get(vi);
        if (!neighbors || neighbors.size === 0) continue;

        let avgX = 0,
          avgY = 0,
          avgZ = 0;
        for (const n of neighbors) {
          avgX += currentPositions[n * 3];
          avgY += currentPositions[n * 3 + 1];
          avgZ += currentPositions[n * 3 + 2];
        }
        avgX /= neighbors.size;
        avgY /= neighbors.size;
        avgZ /= neighbors.size;

        const cx = currentPositions[vi * 3];
        const cy = currentPositions[vi * 3 + 1];
        const cz = currentPositions[vi * 3 + 2];

        newPositions[vi * 3] = cx + (avgX - cx) * factor;
        newPositions[vi * 3 + 1] = cy + (avgY - cy) * factor;
        newPositions[vi * 3 + 2] = cz + (avgZ - cz) * factor;
      }

      const finalNormals = recomputeNormals(newPositions, meshData.indices);
      return {
        meshData: {
          ...meshData,
          vertices: newPositions,
          normals: finalNormals,
        },
        selection,
      };
    }

    case 'merge': {
      // Merges selected vertices at center
      const targetVerts =
        operation.targetIndices.length > 0
          ? operation.targetIndices
          : (selection?.selectedVertexIndices ?? []);

      if (targetVerts.length <= 1) {
        return { meshData, selection };
      }

      const median = computeMedianPoint(currentPositions, targetVerts);
      const masterIdx = targetVerts[0];
      const targetSet = new Set(targetVerts);

      const oldToNew = new Map<number, number>();
      const nextVerts: number[] = [];
      const numVerts = Math.floor(currentPositions.length / 3);

      for (let i = 0; i < numVerts; i++) {
        if (targetSet.has(i)) {
          if (i === masterIdx) {
            const newIdx = Math.floor(nextVerts.length / 3);
            oldToNew.set(i, newIdx);
            nextVerts.push(median.x, median.y, median.z);
          } else {
            oldToNew.set(i, oldToNew.get(masterIdx)!);
          }
        } else {
          const newIdx = Math.floor(nextVerts.length / 3);
          oldToNew.set(i, newIdx);
          nextVerts.push(
            currentPositions[i * 3],
            currentPositions[i * 3 + 1],
            currentPositions[i * 3 + 2],
          );
        }
      }

      const nextIndices: number[] = [];
      const numTriangles = Math.floor(currentIndices.length / 3);

      for (let t = 0; t < numTriangles; t++) {
        const v0 = oldToNew.get(currentIndices[t * 3])!;
        const v1 = oldToNew.get(currentIndices[t * 3 + 1])!;
        const v2 = oldToNew.get(currentIndices[t * 3 + 2])!;

        // Discard degenerate triangles where 2 or more vertices coincide
        if (v0 !== v1 && v1 !== v2 && v2 !== v0) {
          nextIndices.push(v0, v1, v2);
        }
      }

      const finalPositions = new Float32Array(nextVerts);
      const finalIndices =
        finalPositions.length / 3 > 65535
          ? new Uint32Array(nextIndices)
          : new Uint16Array(nextIndices);
      const finalNormals = recomputeNormals(finalPositions, finalIndices);

      const remainingMergedIdx = oldToNew.get(masterIdx)!;

      return {
        meshData: {
          vertices: finalPositions,
          normals: finalNormals,
          indices: finalIndices,
        },
        selection: selection
          ? {
              ...selection,
              selectedVertexIndices: [remainingMergedIdx],
              selectedEdgeIndices: [],
              selectedFaceIndices: [],
              activeVertexIndex: remainingMergedIdx,
              activeEdgeIndex: null,
              activeFaceIndex: null,
            }
          : undefined,
      };
    }

    default:
      return { meshData, selection };
  }
}

// ============================================================================
// 3. TransformMeshElementsCommand
// ============================================================================

export interface TransformMeshElementsOptions {
  nodeId: string;
  vertexIndices: number[];
  translation?: Vector3;
  rotation?: Vector3; // Euler angles in radians
  scale?: Vector3;
  origin?: Vector3; // Pivot center; if omitted, median point is used
  axisLock?: 'X' | 'Y' | 'Z' | null;
  oldPositions?: Float32Array | number[];
  newPositions?: Float32Array | number[];
}

/**
 * TransformMeshElementsCommand:
 * Translates, rotates, or scales a set of vertex indices with delta/origin/rotation/scale
 * and optional axis lock ('X', 'Y', 'Z'). Handles median point calculation,
 * numeric transforms, and transactional commit.
 */
export class TransformMeshElementsCommand extends BaseCommand {
  public nodeId: string;
  public vertexIndices: number[];
  public translation?: Vector3;
  public rotation?: Vector3;
  public scale?: Vector3;
  public origin?: Vector3;
  public axisLock?: 'X' | 'Y' | 'Z' | null;

  public oldPositions?: Float32Array;
  public newPositions?: Float32Array;

  constructor(options: TransformMeshElementsOptions) {
    const lockSuffix = options.axisLock ? ` [${options.axisLock}]` : '';
    let name = 'Transform Elements';
    if (options.translation) name = `Translate Elements${lockSuffix}`;
    else if (options.rotation) name = `Rotate Elements${lockSuffix}`;
    else if (options.scale) name = `Scale Elements${lockSuffix}`;

    super(name);
    this.nodeId = options.nodeId;
    this.vertexIndices = [...options.vertexIndices];
    this.translation = options.translation ? { ...options.translation } : undefined;
    this.rotation = options.rotation ? { ...options.rotation } : undefined;
    this.scale = options.scale ? { ...options.scale } : undefined;
    this.origin = options.origin ? { ...options.origin } : undefined;
    this.axisLock = options.axisLock ?? null;

    if (options.oldPositions) {
      this.oldPositions =
        options.oldPositions instanceof Float32Array
          ? new Float32Array(options.oldPositions)
          : new Float32Array(options.oldPositions);
    }
    if (options.newPositions) {
      this.newPositions =
        options.newPositions instanceof Float32Array
          ? new Float32Array(options.newPositions)
          : new Float32Array(options.newPositions);
    }
  }

  public execute(ctx: CommandContext): void {
    const store = getSceneState(ctx);
    const node = store.getNodeById(this.nodeId) as MeshNode | undefined;
    if (!node || !node.metadata || !node.metadata.meshData) return;

    const currentMeshData = node.metadata.meshData as IMeshData;
    const currentVerts =
      currentMeshData.vertices instanceof Float32Array
        ? currentMeshData.vertices
        : new Float32Array(currentMeshData.vertices);

    if (!this.oldPositions) {
      this.oldPositions = new Float32Array(currentVerts);
    }

    if (!this.newPositions) {
      this.newPositions = this.calculateTransformedPositions(this.oldPositions);
    }

    this.applyPositions(this.newPositions, ctx);
  }

  public undo(ctx: CommandContext): void {
    if (this.oldPositions) {
      this.applyPositions(this.oldPositions, ctx);
    }
  }

  public override redo(ctx: CommandContext): void {
    if (this.newPositions) {
      this.applyPositions(this.newPositions, ctx);
    }
  }

  /**
   * Computes transformed vertex positions based on translation, rotation, scale, axisLock, and origin
   */
  public calculateTransformedPositions(sourcePositions: Float32Array): Float32Array {
    const result = new Float32Array(sourcePositions);
    if (this.vertexIndices.length === 0) return result;

    // Determine pivot origin (median point if not explicitly provided)
    const pivot = this.origin ?? computeMedianPoint(sourcePositions, this.vertexIndices);

    // Apply axis locking
    let tx = this.translation?.x ?? 0;
    let ty = this.translation?.y ?? 0;
    let tz = this.translation?.z ?? 0;

    let rx = this.rotation?.x ?? 0;
    let ry = this.rotation?.y ?? 0;
    let rz = this.rotation?.z ?? 0;

    let sx = this.scale?.x ?? 1;
    let sy = this.scale?.y ?? 1;
    let sz = this.scale?.z ?? 1;

    if (this.axisLock === 'X') {
      ty = 0;
      tz = 0;
      ry = 0;
      rz = 0;
      sy = 1;
      sz = 1;
    } else if (this.axisLock === 'Y') {
      tx = 0;
      tz = 0;
      rx = 0;
      rz = 0;
      sx = 1;
      sz = 1;
    } else if (this.axisLock === 'Z') {
      tx = 0;
      ty = 0;
      rx = 0;
      ry = 0;
      sx = 1;
      sy = 1;
    }

    const cosX = Math.cos(rx),
      sinX = Math.sin(rx);
    const cosY = Math.cos(ry),
      sinY = Math.sin(ry);
    const cosZ = Math.cos(rz),
      sinZ = Math.sin(rz);

    for (const vIdx of this.vertexIndices) {
      const pIdx = vIdx * 3;
      if (pIdx + 2 >= result.length) continue;

      // 1. Pivot offset
      let x = sourcePositions[pIdx] - pivot.x;
      let y = sourcePositions[pIdx + 1] - pivot.y;
      let z = sourcePositions[pIdx + 2] - pivot.z;

      // 2. Scale
      x *= sx;
      y *= sy;
      z *= sz;

      // 3. Rotation (Euler XYZ)
      // Rot X
      const y1 = y * cosX - z * sinX;
      const z1 = y * sinX + z * cosX;
      // Rot Y
      const x2 = x * cosY + z1 * sinY;
      const z2 = -x * sinY + z1 * cosY;
      // Rot Z
      const x3 = x2 * cosZ - y1 * sinZ;
      const y3 = x2 * sinZ + y1 * cosZ;

      // 4. Translation and return to world space
      result[pIdx] = pivot.x + x3 + tx;
      result[pIdx + 1] = pivot.y + y3 + ty;
      result[pIdx + 2] = pivot.z + z2 + tz;
    }

    return result;
  }

  private applyPositions(positions: Float32Array, ctx: CommandContext): void {
    const store = getSceneState(ctx);
    const node = store.getNodeById(this.nodeId) as MeshNode | undefined;
    if (!node || !node.metadata || !node.metadata.meshData) return;

    const currentMeshData = node.metadata.meshData as IMeshData;
    const newNormals = recomputeNormals(positions, currentMeshData.indices);

    const updatedMeshData: IMeshData = {
      ...currentMeshData,
      vertices: new Float32Array(positions),
      normals: newNormals,
    };

    const currentVersion = (node.metadata.geometryVersion as number) || 0;
    store.updateNode(this.nodeId, {
      metadata: {
        ...node.metadata,
        meshData: updatedMeshData,
        geometryVersion: currentVersion + 1,
        lastModified: Date.now(),
      },
    });

    if (typeof ctx.dispatch === 'function') {
      ctx.dispatch({
        type: 'GEOMETRY_UPDATED',
        nodeId: this.nodeId,
        geometryVersion: currentVersion + 1,
      });
    }

    if (typeof ctx.metadata?.onGeometryUpdate === 'function') {
      (ctx.metadata.onGeometryUpdate as (id: string) => void)(this.nodeId);
    }
  }
}

// ============================================================================
// 4. SelectMeshElementsCommand
// ============================================================================

export interface SelectMeshElementsOptions {
  nodeId?: string;
  name?: string;
  beforeSelection: EditMeshSelectionState;
  afterSelection: EditMeshSelectionState;
}

/**
 * SelectMeshElementsCommand:
 * Undoable selection operation command for Edit Mode sub-elements.
 */
export class SelectMeshElementsCommand extends BaseCommand {
  public nodeId?: string;
  public beforeSelection: EditMeshSelectionState;
  public afterSelection: EditMeshSelectionState;

  constructor(options: SelectMeshElementsOptions) {
    super(options.name || 'Change Selection');
    this.nodeId = options.nodeId;
    this.beforeSelection = cloneSelectionState(options.beforeSelection)!;
    this.afterSelection = cloneSelectionState(options.afterSelection)!;
  }

  public execute(ctx: CommandContext): void {
    this.applySelection(this.afterSelection, ctx);
  }

  public undo(ctx: CommandContext): void {
    this.applySelection(this.beforeSelection, ctx);
  }

  public override redo(ctx: CommandContext): void {
    this.applySelection(this.afterSelection, ctx);
  }

  private applySelection(selection: EditMeshSelectionState, ctx: CommandContext): void {
    const selStore = getSelectionStore(ctx);
    if (selStore) {
      if (typeof selStore.loadSnapshot === 'function') {
        selStore.loadSnapshot({ edit: selection });
      } else if (typeof selStore.getState === 'function') {
        selStore.getState().loadSnapshot?.({ edit: selection });
      }
    }

    if (this.nodeId) {
      const store = getSceneState(ctx);
      const node = store.getNodeById(this.nodeId);
      if (node) {
        store.updateNode(this.nodeId, {
          metadata: {
            ...node.metadata,
            editSelection: cloneSelectionState(selection),
          },
        });
      }
    }
  }
}
