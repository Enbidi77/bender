import type { ViewportMode, ViewportConfig } from './viewport.js';

/**
 * Supported editor panel types mimicking Blender's area editors
 */
export type EditorAreaType =
  | 'viewport-3d'
  | 'outliner'
  | 'properties'
  | 'timeline'
  | 'shader-editor'
  | 'uv-editor'
  | 'graph-editor'
  | 'asset-browser'
  | 'console';

/**
 * Split directions for docking tree
 */
export type SplitDirection = 'horizontal' | 'vertical';

/**
 * Binary split node in the dock tree
 */
export interface DockSplitNode {
  id: string;
  type: 'split';
  direction: SplitDirection;
  ratio: number; // 0.05 to 0.95, default 0.5
  first: DockAreaNode;
  second: DockAreaNode;
}

/**
 * Leaf panel node in the dock tree
 */
export interface DockPanelNode {
  id: string;
  type: 'panel';
  areaType: EditorAreaType;
  activeTabId?: string;
  tabs?: EditorAreaType[];
  collapsed?: boolean;
  minWidth?: number;
  minHeight?: number;
}

/**
 * Recursive dock layout node
 */
export type DockAreaNode = DockSplitNode | DockPanelNode;

/**
 * Workspace configuration defining a specialized workflow layout
 */
export interface WorkspaceDefinition {
  id: string;
  name: string; // 'Layout', 'Modeling', 'Sculpting', 'Shading', 'Animation'
  icon?: string;
  defaultMode: ViewportMode;
  layout: DockAreaNode;
  viewportConfig?: Partial<ViewportConfig>;
  order: number;
}

/**
 * Complete Workspace Layout configuration state
 */
export interface WorkspaceLayoutConfig {
  activeWorkspaceId: string;
  workspaces: Record<string, WorkspaceDefinition>;
  customWorkspaces?: Record<string, WorkspaceDefinition>;
}
