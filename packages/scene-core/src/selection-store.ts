import { createStore } from 'zustand/vanilla';
import type {
  Vector3,
  Euler,
  SelectionMode,
  PivotPoint,
  Cursor3D,
  EditMeshSelectionState,
  UnifiedSelectionModel,
  EditElementMode,
} from '@blender-elt/contracts';

export interface SelectionStoreState {
  // 1. Object selection
  activeNodeId: string | null;
  selectedNodeIds: string[];
  selectionOrder: string[];

  // 2. 3D Cursor
  cursor3D: Cursor3D;

  // 3. Transform pivot mode
  pivotPoint: PivotPoint;

  // 4. Edit Mode mesh selection mask & indices
  editSelection: EditMeshSelectionState;

  // Object selection actions
  selectObject: (id: string, mode?: SelectionMode) => void;
  selectMultipleObjects: (ids: string[], mode?: SelectionMode) => void;
  deselectAllObjects: () => void;
  setActiveObject: (id: string | null) => void;
  isObjectSelected: (id: string) => boolean;

  // 3D Cursor actions
  setCursorPosition: (pos: Partial<Vector3>) => void;
  setCursorRotation: (rot: Partial<Euler>) => void;
  resetCursor: () => void;

  // Pivot Point actions
  setPivotPoint: (pivot: PivotPoint) => void;

  // Edit Mode actions
  setEditElementModes: (modes: EditElementMode[]) => void;
  toggleEditElementMode: (mode: EditElementMode) => void;
  selectVertices: (indices: number[], mode?: SelectionMode) => void;
  selectEdges: (indices: number[], mode?: SelectionMode) => void;
  selectFaces: (indices: number[], mode?: SelectionMode) => void;
  setActiveVertex: (index: number | null) => void;
  setActiveEdge: (index: number | null) => void;
  setActiveFace: (index: number | null) => void;
  deselectAllEditElements: () => void;

  // Serialization & Snapshot
  getSnapshot: () => UnifiedSelectionModel;
  loadSnapshot: (snapshot: Partial<UnifiedSelectionModel>) => void;
  reset: () => void;
}

export function createDefaultCursor(): Cursor3D {
  return {
    position: { x: 0, y: 0, z: 0 },
    rotation: { x: 0, y: 0, z: 0, order: 'XYZ' },
  };
}

export function createDefaultEditSelection(): EditMeshSelectionState {
  return {
    elementModes: ['vertex'],
    selectedVertexIndices: [],
    selectedEdgeIndices: [],
    selectedFaceIndices: [],
    activeVertexIndex: null,
    activeEdgeIndex: null,
    activeFaceIndex: null,
  };
}

function applySelectionIndices(
  current: number[],
  incoming: number[],
  mode: SelectionMode,
): number[] {
  const currentSet = new Set(current);
  switch (mode) {
    case 'set':
      return Array.from(new Set(incoming)).sort((a, b) => a - b);
    case 'add':
      incoming.forEach((idx) => currentSet.add(idx));
      return Array.from(currentSet).sort((a, b) => a - b);
    case 'subtract':
      incoming.forEach((idx) => currentSet.delete(idx));
      return Array.from(currentSet).sort((a, b) => a - b);
    case 'invert':
      incoming.forEach((idx) => {
        if (currentSet.has(idx)) {
          currentSet.delete(idx);
        } else {
          currentSet.add(idx);
        }
      });
      return Array.from(currentSet).sort((a, b) => a - b);
    default:
      return current;
  }
}

export function createSelectionStore(initialState?: Partial<UnifiedSelectionModel>) {
  return createStore<SelectionStoreState>((set, get) => ({
    // Initial states
    activeNodeId: initialState?.object?.activeNodeId ?? null,
    selectedNodeIds: initialState?.object?.selectedNodeIds
      ? [...initialState.object.selectedNodeIds]
      : [],
    selectionOrder: initialState?.object?.selectionOrder
      ? [...initialState.object.selectionOrder]
      : [],

    cursor3D: initialState?.cursor3D
      ? {
          position: { ...initialState.cursor3D.position },
          rotation: { ...initialState.cursor3D.rotation },
        }
      : createDefaultCursor(),

    pivotPoint: initialState?.pivotPoint ?? 'median-point',

    editSelection: initialState?.edit
      ? {
          elementModes: [...initialState.edit.elementModes],
          selectedVertexIndices: [...initialState.edit.selectedVertexIndices],
          selectedEdgeIndices: [...initialState.edit.selectedEdgeIndices],
          selectedFaceIndices: [...initialState.edit.selectedFaceIndices],
          activeVertexIndex: initialState.edit.activeVertexIndex ?? null,
          activeEdgeIndex: initialState.edit.activeEdgeIndex ?? null,
          activeFaceIndex: initialState.edit.activeFaceIndex ?? null,
        }
      : createDefaultEditSelection(),

    // Object Selection Methods
    selectObject: (id: string, mode: SelectionMode = 'set') => {
      set((state) => {
        const currentSet = new Set(state.selectedNodeIds);
        let nextOrder = [...state.selectionOrder];
        let nextActive = state.activeNodeId;

        switch (mode) {
          case 'set':
            return {
              activeNodeId: id,
              selectedNodeIds: [id],
              selectionOrder: [id],
            };

          case 'add':
            currentSet.add(id);
            if (!nextOrder.includes(id)) {
              nextOrder.push(id);
            }
            return {
              activeNodeId: id,
              selectedNodeIds: Array.from(currentSet),
              selectionOrder: nextOrder,
            };

          case 'subtract':
            currentSet.delete(id);
            nextOrder = nextOrder.filter((n) => n !== id);
            if (nextActive === id) {
              nextActive = nextOrder[nextOrder.length - 1] ?? null;
            }
            return {
              activeNodeId: nextActive,
              selectedNodeIds: Array.from(currentSet),
              selectionOrder: nextOrder,
            };

          case 'invert':
            if (currentSet.has(id)) {
              currentSet.delete(id);
              nextOrder = nextOrder.filter((n) => n !== id);
              if (nextActive === id) {
                nextActive = nextOrder[nextOrder.length - 1] ?? null;
              }
            } else {
              currentSet.add(id);
              nextOrder.push(id);
              nextActive = id;
            }
            return {
              activeNodeId: nextActive,
              selectedNodeIds: Array.from(currentSet),
              selectionOrder: nextOrder,
            };

          default:
            return state;
        }
      });
    },

    selectMultipleObjects: (ids: string[], mode: SelectionMode = 'set') => {
      set((state) => {
        if (mode === 'set') {
          const uniqueIds = Array.from(new Set(ids));
          return {
            selectedNodeIds: uniqueIds,
            selectionOrder: [...uniqueIds],
            activeNodeId: uniqueIds[uniqueIds.length - 1] ?? null,
          };
        }

        const currentSet = new Set(state.selectedNodeIds);
        let nextOrder = [...state.selectionOrder];

        for (const id of ids) {
          if (mode === 'add') {
            currentSet.add(id);
            if (!nextOrder.includes(id)) nextOrder.push(id);
          } else if (mode === 'subtract') {
            currentSet.delete(id);
            nextOrder = nextOrder.filter((n) => n !== id);
          } else if (mode === 'invert') {
            if (currentSet.has(id)) {
              currentSet.delete(id);
              nextOrder = nextOrder.filter((n) => n !== id);
            } else {
              currentSet.add(id);
              nextOrder.push(id);
            }
          }
        }

        let nextActive = state.activeNodeId;
        if (nextActive && !currentSet.has(nextActive)) {
          nextActive = nextOrder[nextOrder.length - 1] ?? null;
        } else if (!nextActive && currentSet.size > 0) {
          nextActive = nextOrder[nextOrder.length - 1] ?? null;
        }

        return {
          selectedNodeIds: Array.from(currentSet),
          selectionOrder: nextOrder,
          activeNodeId: nextActive,
        };
      });
    },

    deselectAllObjects: () => {
      set({
        activeNodeId: null,
        selectedNodeIds: [],
        selectionOrder: [],
      });
    },

    setActiveObject: (id: string | null) => {
      set((state) => {
        if (!id) {
          return { activeNodeId: null };
        }
        const currentSet = new Set(state.selectedNodeIds);
        currentSet.add(id);
        const nextOrder = state.selectionOrder.filter((n) => n !== id);
        nextOrder.push(id);
        return {
          activeNodeId: id,
          selectedNodeIds: Array.from(currentSet),
          selectionOrder: nextOrder,
        };
      });
    },

    isObjectSelected: (id: string) => {
      return get().selectedNodeIds.includes(id);
    },

    // 3D Cursor Methods
    setCursorPosition: (pos: Partial<Vector3>) => {
      set((state) => ({
        cursor3D: {
          ...state.cursor3D,
          position: { ...state.cursor3D.position, ...pos },
        },
      }));
    },

    setCursorRotation: (rot: Partial<Euler>) => {
      set((state) => ({
        cursor3D: {
          ...state.cursor3D,
          rotation: { ...state.cursor3D.rotation, ...rot },
        },
      }));
    },

    resetCursor: () => {
      set({ cursor3D: createDefaultCursor() });
    },

    // Pivot Point
    setPivotPoint: (pivot: PivotPoint) => {
      set({ pivotPoint: pivot });
    },

    // Edit Mode Methods
    setEditElementModes: (modes: EditElementMode[]) => {
      if (modes.length === 0) return;
      set((state) => ({
        editSelection: {
          ...state.editSelection,
          elementModes: [...modes],
        },
      }));
    },

    toggleEditElementMode: (mode: EditElementMode) => {
      set((state) => {
        const current = new Set(state.editSelection.elementModes);
        if (current.has(mode)) {
          if (current.size > 1) {
            current.delete(mode);
          }
        } else {
          current.add(mode);
        }
        return {
          editSelection: {
            ...state.editSelection,
            elementModes: Array.from(current),
          },
        };
      });
    },

    selectVertices: (indices: number[], mode: SelectionMode = 'set') => {
      set((state) => {
        const updated = applySelectionIndices(
          state.editSelection.selectedVertexIndices,
          indices,
          mode,
        );
        const lastIdx = indices[indices.length - 1];
        const nextActive = updated.includes(lastIdx ?? -1)
          ? (lastIdx ?? null)
          : (updated[updated.length - 1] ?? null);
        return {
          editSelection: {
            ...state.editSelection,
            selectedVertexIndices: updated,
            activeVertexIndex: nextActive,
          },
        };
      });
    },

    selectEdges: (indices: number[], mode: SelectionMode = 'set') => {
      set((state) => {
        const updated = applySelectionIndices(
          state.editSelection.selectedEdgeIndices,
          indices,
          mode,
        );
        const lastIdx = indices[indices.length - 1];
        const nextActive = updated.includes(lastIdx ?? -1)
          ? (lastIdx ?? null)
          : (updated[updated.length - 1] ?? null);
        return {
          editSelection: {
            ...state.editSelection,
            selectedEdgeIndices: updated,
            activeEdgeIndex: nextActive,
          },
        };
      });
    },

    selectFaces: (indices: number[], mode: SelectionMode = 'set') => {
      set((state) => {
        const updated = applySelectionIndices(
          state.editSelection.selectedFaceIndices,
          indices,
          mode,
        );
        const lastIdx = indices[indices.length - 1];
        const nextActive = updated.includes(lastIdx ?? -1)
          ? (lastIdx ?? null)
          : (updated[updated.length - 1] ?? null);
        return {
          editSelection: {
            ...state.editSelection,
            selectedFaceIndices: updated,
            activeFaceIndex: nextActive,
          },
        };
      });
    },

    setActiveVertex: (index: number | null) => {
      set((state) => ({
        editSelection: { ...state.editSelection, activeVertexIndex: index },
      }));
    },

    setActiveEdge: (index: number | null) => {
      set((state) => ({
        editSelection: { ...state.editSelection, activeEdgeIndex: index },
      }));
    },

    setActiveFace: (index: number | null) => {
      set((state) => ({
        editSelection: { ...state.editSelection, activeFaceIndex: index },
      }));
    },

    deselectAllEditElements: () => {
      set((state) => ({
        editSelection: {
          ...state.editSelection,
          selectedVertexIndices: [],
          selectedEdgeIndices: [],
          selectedFaceIndices: [],
          activeVertexIndex: null,
          activeEdgeIndex: null,
          activeFaceIndex: null,
        },
      }));
    },

    // Snapshots
    getSnapshot: (): UnifiedSelectionModel => {
      const state = get();
      return {
        object: {
          activeNodeId: state.activeNodeId,
          selectedNodeIds: [...state.selectedNodeIds],
          selectionOrder: [...state.selectionOrder],
        },
        edit: {
          elementModes: [...state.editSelection.elementModes],
          selectedVertexIndices: [...state.editSelection.selectedVertexIndices],
          selectedEdgeIndices: [...state.editSelection.selectedEdgeIndices],
          selectedFaceIndices: [...state.editSelection.selectedFaceIndices],
          activeVertexIndex: state.editSelection.activeVertexIndex,
          activeEdgeIndex: state.editSelection.activeEdgeIndex,
          activeFaceIndex: state.editSelection.activeFaceIndex,
        },
        pivotPoint: state.pivotPoint,
        cursor3D: {
          position: { ...state.cursor3D.position },
          rotation: { ...state.cursor3D.rotation },
        },
      };
    },

    loadSnapshot: (snapshot: Partial<UnifiedSelectionModel>) => {
      set((state) => ({
        activeNodeId:
          snapshot.object?.activeNodeId !== undefined
            ? snapshot.object.activeNodeId
            : state.activeNodeId,
        selectedNodeIds: snapshot.object?.selectedNodeIds
          ? [...snapshot.object.selectedNodeIds]
          : state.selectedNodeIds,
        selectionOrder: snapshot.object?.selectionOrder
          ? [...snapshot.object.selectionOrder]
          : state.selectionOrder,
        pivotPoint: snapshot.pivotPoint ?? state.pivotPoint,
        cursor3D: snapshot.cursor3D
          ? {
              position: { ...snapshot.cursor3D.position },
              rotation: { ...snapshot.cursor3D.rotation },
            }
          : state.cursor3D,
        editSelection: snapshot.edit
          ? {
              elementModes: [...snapshot.edit.elementModes],
              selectedVertexIndices: [...snapshot.edit.selectedVertexIndices],
              selectedEdgeIndices: [...snapshot.edit.selectedEdgeIndices],
              selectedFaceIndices: [...snapshot.edit.selectedFaceIndices],
              activeVertexIndex: snapshot.edit.activeVertexIndex ?? null,
              activeEdgeIndex: snapshot.edit.activeEdgeIndex ?? null,
              activeFaceIndex: snapshot.edit.activeFaceIndex ?? null,
            }
          : state.editSelection,
      }));
    },

    reset: () => {
      set({
        activeNodeId: null,
        selectedNodeIds: [],
        selectionOrder: [],
        cursor3D: createDefaultCursor(),
        pivotPoint: 'median-point',
        editSelection: createDefaultEditSelection(),
      });
    },
  }));
}

export type SelectionStore = ReturnType<typeof createSelectionStore>;
