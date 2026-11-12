import type { WorkspaceDefinition, DockAreaNode } from '@blender-elt/contracts';

/**
 * Creates standard dock split tree for standard Blender workspaces
 */
function createStandardDockLayout(timelineRatio = 0.85): DockAreaNode {
  return {
    id: 'root-split',
    type: 'split',
    direction: 'horizontal',
    ratio: 0.78,
    first: {
      id: 'left-split',
      type: 'split',
      direction: 'vertical',
      ratio: timelineRatio,
      first: {
        id: 'panel-viewport',
        type: 'panel',
        areaType: 'viewport-3d',
      },
      second: {
        id: 'panel-timeline',
        type: 'panel',
        areaType: 'timeline',
      },
    },
    second: {
      id: 'right-split',
      type: 'split',
      direction: 'vertical',
      ratio: 0.5,
      first: {
        id: 'panel-outliner',
        type: 'panel',
        areaType: 'outliner',
      },
      second: {
        id: 'panel-properties',
        type: 'panel',
        areaType: 'properties',
      },
    },
  };
}

/**
 * Default Blender-ELT workspaces replicating Blender's workflow tabs
 */
export const DEFAULT_WORKSPACES: WorkspaceDefinition[] = [
  {
    id: 'layout',
    name: 'Layout',
    icon: 'LayoutGrid',
    defaultMode: 'object',
    order: 0,
    viewportConfig: {
      mode: 'object',
      shadingMode: 'solid',
      gizmoType: 'translate',
      transformSpace: 'world',
    },
    layout: createStandardDockLayout(0.85),
  },
  {
    id: 'modeling',
    name: 'Modeling',
    icon: 'Box',
    defaultMode: 'edit',
    order: 1,
    viewportConfig: {
      mode: 'edit',
      shadingMode: 'solid',
      gizmoType: 'translate',
      transformSpace: 'local',
      showWireframeOverlay: true,
    },
    layout: createStandardDockLayout(0.88),
  },
  {
    id: 'sculpting',
    name: 'Sculpting',
    icon: 'Sphere',
    defaultMode: 'sculpt',
    order: 2,
    viewportConfig: {
      mode: 'sculpt',
      shadingMode: 'solid',
      gizmoType: 'none',
      showFloor: false,
    },
    layout: createStandardDockLayout(0.92),
  },
  {
    id: 'shading',
    name: 'Shading',
    icon: 'Palette',
    defaultMode: 'object',
    order: 3,
    viewportConfig: {
      mode: 'object',
      shadingMode: 'material',
      gizmoType: 'translate',
    },
    layout: createStandardDockLayout(0.85),
  },
  {
    id: 'animation',
    name: 'Animation',
    icon: 'Film',
    defaultMode: 'object',
    order: 4,
    viewportConfig: {
      mode: 'object',
      shadingMode: 'solid',
      gizmoType: 'translate',
    },
    layout: createStandardDockLayout(0.65), // Expanded timeline
  },
];

export function getDefaultWorkspaces(): WorkspaceDefinition[] {
  return [...DEFAULT_WORKSPACES];
}
