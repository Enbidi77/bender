import type {
  BrushFalloffType,
  SculptBrushConfig,
  SculptBrushType,
  SculptStrokeSettings,
  SymmetryConfig,
} from '@blender-elt/contracts';

export interface SculptStoreState {
  activeNodeId: string | null;
  activeBrush: SculptBrushType;
  brushConfigs: Record<SculptBrushType, SculptBrushConfig>;
  strokeSettings: SculptStrokeSettings;
  symmetry: SymmetryConfig;
  maskEnabled: boolean;
  isStroking: boolean;
  vertexCount: number;
  trianglesCount: number;
  lastStrokeDurationMs: number;

  // Actions
  setActiveNodeId: (id: string | null) => void;
  setActiveBrush: (type: SculptBrushType) => void;
  updateBrushConfig: (type: SculptBrushType, updates: Partial<SculptBrushConfig>) => void;
  updateActiveBrushConfig: (updates: Partial<SculptBrushConfig>) => void;
  setRadius: (radius: number) => void;
  setStrength: (strength: number) => void;
  setFalloff: (falloff: BrushFalloffType) => void;
  toggleDirection: () => void;
  setDirection: (direction: 'add' | 'subtract') => void;
  setSymmetry: (symmetry: Partial<SymmetryConfig>) => void;
  toggleSymmetryAxis: (axis: 'x' | 'y' | 'z') => void;
  updateStrokeSettings: (settings: Partial<SculptStrokeSettings>) => void;
  setMaskEnabled: (enabled: boolean) => void;
  setIsStroking: (isStroking: boolean) => void;
  setMeshMetrics: (vertexCount: number, trianglesCount: number) => void;
  setLastStrokeDuration: (ms: number) => void;
  reset: () => void;
}
