import type { EditElementMode, EditModeTool } from '@blender-elt/contracts';

export type { EditElementMode, EditModeTool };

/**
 * Tool category grouping for Edit Mode toolbar
 */
export type EditToolCategory = 'selection' | 'transform' | 'mesh' | 'advanced';

/**
 * Edit Mode Tool Definition metadata
 */
export interface EditModeToolMetadata {
  id: EditModeTool;
  name: string;
  shortcut: string;
  category: EditToolCategory;
  description: string;
  iconName: string;
}

/**
 * All 13 professional Edit Mode interactive tools
 */
export const EDIT_MODE_TOOLS: EditModeToolMetadata[] = [
  // Selection
  {
    id: 'select',
    name: 'Select Box',
    shortcut: 'W',
    category: 'selection',
    description: 'Select mesh vertices, edges, or faces with a rectangular box or click',
    iconName: 'select',
  },
  {
    id: 'cursor',
    name: '3D Cursor',
    shortcut: 'Shift+RightClick',
    category: 'selection',
    description: 'Reposition the 3D Cursor pivot point in 3D mesh space',
    iconName: 'cursor',
  },

  // Transform
  {
    id: 'move',
    name: 'Move / Grab',
    shortcut: 'G',
    category: 'transform',
    description: 'Translate selected vertices, edges, or faces with axis locking (X, Y, Z)',
    iconName: 'move',
  },
  {
    id: 'rotate',
    name: 'Rotate',
    shortcut: 'R',
    category: 'transform',
    description: 'Rotate selected geometry around current pivot point or axis',
    iconName: 'rotate',
  },
  {
    id: 'scale',
    name: 'Scale',
    shortcut: 'S',
    category: 'transform',
    description: 'Resize selected geometry relative to the pivot point',
    iconName: 'scale',
  },

  // Mesh Modeling Core
  {
    id: 'extrude',
    name: 'Extrude Region',
    shortcut: 'E',
    category: 'mesh',
    description: 'Extrude selected vertices, edges, or faces outward generating new geometry',
    iconName: 'extrude',
  },
  {
    id: 'inset',
    name: 'Inset Faces',
    shortcut: 'I',
    category: 'mesh',
    description: 'Inset selected faces inward creating concentric quad perimeter borders',
    iconName: 'inset',
  },
  {
    id: 'bevel',
    name: 'Bevel',
    shortcut: 'Ctrl+B',
    category: 'mesh',
    description: 'Chamfer or round selected edges or vertices with configurable segments',
    iconName: 'bevel',
  },
  {
    id: 'loopcut',
    name: 'Loop Cut',
    shortcut: 'Ctrl+R',
    category: 'mesh',
    description: 'Insert an edge loop through adjacent quad faces with interactive slide',
    iconName: 'loopcut',
  },
  {
    id: 'knife',
    name: 'Knife',
    shortcut: 'K',
    category: 'mesh',
    description: 'Subdivide geometry by drawing custom cut lines across edges and faces',
    iconName: 'knife',
  },

  // Advanced Modeling Tools
  {
    id: 'polybuild',
    name: 'Poly Build',
    shortcut: '',
    category: 'advanced',
    description: 'Interactively build and retopologize meshes by extruding quad polygons',
    iconName: 'polybuild',
  },
  {
    id: 'spin',
    name: 'Spin',
    shortcut: '',
    category: 'advanced',
    description: 'Extrude selected elements in a circular arc revolve around 3D cursor',
    iconName: 'spin',
  },
  {
    id: 'smooth',
    name: 'Smooth',
    shortcut: '',
    category: 'advanced',
    description: 'Relax vertex positions using iterative Laplacian smoothing',
    iconName: 'smooth',
  },
];

/**
 * Fast lookup map for tool metadata by ID
 */
export const EDIT_TOOL_METADATA_MAP: Record<EditModeTool, EditModeToolMetadata> =
  EDIT_MODE_TOOLS.reduce(
    (acc, tool) => {
      acc[tool.id] = tool;
      return acc;
    },
    {} as Record<EditModeTool, EditModeToolMetadata>,
  );

/**
 * Tool specific parameters
 */
export interface ExtrudeToolConfig {
  distance: number;
  direction: 'normal' | 'x' | 'y' | 'z' | 'individual';
  flipNormals: boolean;
  dissolveOrthogonal: boolean;
}

export interface InsetToolConfig {
  thickness: number;
  depth: number;
  individual: boolean;
  selectOuter: boolean;
}

export interface BevelToolConfig {
  width: number;
  segments: number;
  target: 'edge' | 'vertex';
  clampOverlap: boolean;
  profile: number;
}

export interface LoopCutToolConfig {
  cuts: number;
  factor: number;
  smoothness: number;
}

export interface KnifeToolConfig {
  onlySelected: boolean;
  occlude: boolean;
}

export interface PolyBuildToolConfig {
  mode: 'quads' | 'triangles';
}

export interface SpinToolConfig {
  steps: number;
  angle: number;
  axis: 'x' | 'y' | 'z';
}

export interface SmoothToolConfig {
  factor: number;
  iterations: number;
}

export interface MergeToolConfig {
  type: 'center' | 'cursor' | 'collapse' | 'distance';
  distance: number;
  unselected: boolean;
}

export interface TransformToolConfig {
  orientation: 'global' | 'local' | 'normal';
  proportionalEditing: 'off' | 'smooth' | 'sphere' | 'linear';
  proportionalSize: number;
}

/**
 * Full Edit Mode tool parameters container
 */
export interface EditModeSettings {
  extrude: ExtrudeToolConfig;
  inset: InsetToolConfig;
  bevel: BevelToolConfig;
  loopcut: LoopCutToolConfig;
  knife: KnifeToolConfig;
  polybuild: PolyBuildToolConfig;
  spin: SpinToolConfig;
  smooth: SmoothToolConfig;
  merge: MergeToolConfig;
  transform: TransformToolConfig;
}

export const DEFAULT_EDIT_MODE_SETTINGS: EditModeSettings = {
  extrude: {
    distance: 1.0,
    direction: 'normal',
    flipNormals: false,
    dissolveOrthogonal: false,
  },
  inset: {
    thickness: 0.2,
    depth: 0.0,
    individual: false,
    selectOuter: false,
  },
  bevel: {
    width: 0.1,
    segments: 2,
    target: 'edge',
    clampOverlap: true,
    profile: 0.5,
  },
  loopcut: {
    cuts: 1,
    factor: 0.0,
    smoothness: 0.0,
  },
  knife: {
    onlySelected: false,
    occlude: true,
  },
  polybuild: {
    mode: 'quads',
  },
  spin: {
    steps: 9,
    angle: 90,
    axis: 'z',
  },
  smooth: {
    factor: 0.5,
    iterations: 1,
  },
  merge: {
    type: 'distance',
    distance: 0.001,
    unselected: false,
  },
  transform: {
    orientation: 'global',
    proportionalEditing: 'off',
    proportionalSize: 1.0,
  },
};

/**
 * Context Menu Action item definition
 */
export interface EditContextMenuItem {
  id: string;
  label: string;
  shortcut?: string;
  icon?: string;
  divider?: boolean;
  disabled?: boolean;
  children?: EditContextMenuItem[];
}

/**
 * Selection Polycount Summary for Edit Mode
 */
export interface EditSelectionStats {
  selectedVertices: number;
  totalVertices: number;
  selectedEdges: number;
  totalEdges: number;
  selectedFaces: number;
  totalFaces: number;
}
