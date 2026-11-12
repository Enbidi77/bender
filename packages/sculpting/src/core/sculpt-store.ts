import { createStore, type StoreApi } from 'zustand/vanilla';
import type { SculptStoreState } from './sculpt-state.js';
import {
  DEFAULT_BRUSH_CONFIGS,
  DEFAULT_STROKE_SETTINGS,
  DEFAULT_SYMMETRY,
} from './sculpt-settings.js';

export function createSculptStore(
  initialOverrides?: Partial<SculptStoreState>,
): StoreApi<SculptStoreState> {
  return createStore<SculptStoreState>((set, get) => ({
    activeNodeId: null,
    activeBrush: 'draw',
    brushConfigs: { ...DEFAULT_BRUSH_CONFIGS },
    strokeSettings: { ...DEFAULT_STROKE_SETTINGS },
    symmetry: { ...DEFAULT_SYMMETRY },
    maskEnabled: true,
    isStroking: false,
    vertexCount: 0,
    trianglesCount: 0,
    lastStrokeDurationMs: 0,
    ...initialOverrides,

    setActiveNodeId: (id) => set({ activeNodeId: id }),

    setActiveBrush: (type) => set({ activeBrush: type }),

    updateBrushConfig: (type, updates) =>
      set((state) => ({
        brushConfigs: {
          ...state.brushConfigs,
          [type]: {
            ...state.brushConfigs[type],
            ...updates,
          },
        },
      })),

    updateActiveBrushConfig: (updates) => {
      const active = get().activeBrush;
      get().updateBrushConfig(active, updates);
    },

    setRadius: (radius) => {
      const active = get().activeBrush;
      get().updateBrushConfig(active, { radius: Math.max(0.001, radius) });
    },

    setStrength: (strength) => {
      const active = get().activeBrush;
      get().updateBrushConfig(active, { strength: Math.max(0.0, strength) });
    },

    setFalloff: (falloff) => {
      const active = get().activeBrush;
      get().updateBrushConfig(active, { falloff });
    },

    toggleDirection: () => {
      const active = get().activeBrush;
      const current = get().brushConfigs[active].direction;
      get().updateBrushConfig(active, {
        direction: current === 'add' ? 'subtract' : 'add',
      });
    },

    setDirection: (direction) => {
      const active = get().activeBrush;
      get().updateBrushConfig(active, { direction });
    },

    setSymmetry: (symmetry) =>
      set((state) => ({
        symmetry: {
          ...state.symmetry,
          ...symmetry,
        },
      })),

    toggleSymmetryAxis: (axis) =>
      set((state) => ({
        symmetry: {
          ...state.symmetry,
          [axis]: !state.symmetry[axis],
        },
      })),

    updateStrokeSettings: (settings) =>
      set((state) => ({
        strokeSettings: {
          ...state.strokeSettings,
          ...settings,
        },
      })),

    setMaskEnabled: (enabled) => set({ maskEnabled: enabled }),

    setIsStroking: (isStroking) => set({ isStroking }),

    setMeshMetrics: (vertexCount, trianglesCount) => set({ vertexCount, trianglesCount }),

    setLastStrokeDuration: (ms) => set({ lastStrokeDurationMs: ms }),

    reset: () =>
      set({
        activeNodeId: null,
        activeBrush: 'draw',
        brushConfigs: { ...DEFAULT_BRUSH_CONFIGS },
        strokeSettings: { ...DEFAULT_STROKE_SETTINGS },
        symmetry: { ...DEFAULT_SYMMETRY },
        maskEnabled: true,
        isStroking: false,
        vertexCount: 0,
        trianglesCount: 0,
        lastStrokeDurationMs: 0,
      }),
  }));
}

// Global default singleton store for convenient access
export const sculptStore = createSculptStore();
