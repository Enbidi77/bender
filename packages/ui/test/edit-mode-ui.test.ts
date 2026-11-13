import { describe, it, expect, vi } from 'vitest';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import {
  EDIT_MODE_TOOLS,
  EDIT_TOOL_METADATA_MAP,
  DEFAULT_EDIT_MODE_SETTINGS,
  ElementModeSelector,
  EditModeToolbar,
  EditToolSettingsBar,
  EditToolSettingsPanel,
  EditContextMenu,
  DeleteDissolveMenu,
  EditModeStatusBar,
  Header,
  PropertiesPanel,
  EditorStudio,
  getDefaultWorkspaces,
  type EditModeTool,
  type EditElementMode,
  type EditModeSettings,
} from '../src/index.js';

describe('Professional Edit Mode UI Components', () => {
  describe('Edit Mode Tool Definitions & Metadata', () => {
    it('defines all 13 interactive edit mode tools', () => {
      expect(EDIT_MODE_TOOLS).toHaveLength(13);

      const toolIds = EDIT_MODE_TOOLS.map((t) => t.id);
      expect(toolIds).toEqual([
        'select',
        'cursor',
        'move',
        'rotate',
        'scale',
        'extrude',
        'inset',
        'bevel',
        'loopcut',
        'knife',
        'polybuild',
        'spin',
        'smooth',
      ]);
    });

    it('categorizes tools into selection, transform, mesh, and advanced', () => {
      const selection = EDIT_MODE_TOOLS.filter((t) => t.category === 'selection');
      expect(selection.map((t) => t.id)).toEqual(['select', 'cursor']);

      const transform = EDIT_MODE_TOOLS.filter((t) => t.category === 'transform');
      expect(transform.map((t) => t.id)).toEqual(['move', 'rotate', 'scale']);

      const mesh = EDIT_MODE_TOOLS.filter((t) => t.category === 'mesh');
      expect(mesh.map((t) => t.id)).toEqual(['extrude', 'inset', 'bevel', 'loopcut', 'knife']);

      const advanced = EDIT_MODE_TOOLS.filter((t) => t.category === 'advanced');
      expect(advanced.map((t) => t.id)).toEqual(['polybuild', 'spin', 'smooth']);
    });

    it('provides fast map lookup with shortcuts and descriptions', () => {
      expect(EDIT_TOOL_METADATA_MAP['select'].shortcut).toBe('W');
      expect(EDIT_TOOL_METADATA_MAP['move'].shortcut).toBe('G');
      expect(EDIT_TOOL_METADATA_MAP['rotate'].shortcut).toBe('R');
      expect(EDIT_TOOL_METADATA_MAP['scale'].shortcut).toBe('S');
      expect(EDIT_TOOL_METADATA_MAP['extrude'].shortcut).toBe('E');
      expect(EDIT_TOOL_METADATA_MAP['inset'].shortcut).toBe('I');
      expect(EDIT_TOOL_METADATA_MAP['bevel'].shortcut).toBe('Ctrl+B');
      expect(EDIT_TOOL_METADATA_MAP['loopcut'].shortcut).toBe('Ctrl+R');
      expect(EDIT_TOOL_METADATA_MAP['knife'].shortcut).toBe('K');

      for (const tool of EDIT_MODE_TOOLS) {
        expect(tool.name.length).toBeGreaterThan(0);
        expect(tool.description.length).toBeGreaterThan(10);
      }
    });

    it('provides complete default settings for all tools', () => {
      expect(DEFAULT_EDIT_MODE_SETTINGS.extrude.distance).toBe(1.0);
      expect(DEFAULT_EDIT_MODE_SETTINGS.extrude.direction).toBe('normal');
      expect(DEFAULT_EDIT_MODE_SETTINGS.inset.thickness).toBe(0.2);
      expect(DEFAULT_EDIT_MODE_SETTINGS.bevel.width).toBe(0.1);
      expect(DEFAULT_EDIT_MODE_SETTINGS.bevel.segments).toBe(2);
      expect(DEFAULT_EDIT_MODE_SETTINGS.loopcut.cuts).toBe(1);
      expect(DEFAULT_EDIT_MODE_SETTINGS.merge.distance).toBe(0.001);
      expect(DEFAULT_EDIT_MODE_SETTINGS.smooth.factor).toBe(0.5);
    });
  });

  describe('ElementModeSelector Component (Header Mode Buttons)', () => {
    it('renders vertex, edge, and face selection mode buttons with hotkeys 1, 2, 3', () => {
      const html = renderToStaticMarkup(
        React.createElement(ElementModeSelector, {
          activeModes: ['vertex'],
          onSelectMode: vi.fn(),
        }),
      );

      expect(html).toContain('aria-label="Element Selection Mode"');
      expect(html).toContain('Vertex Select (1)');
      expect(html).toContain('Edge Select (2)');
      expect(html).toContain('Face Select (3)');

      // Vertex active highlight
      expect(html).toContain('bg-[#4772b3]');
    });

    it('supports multiple active selection modes simultaneously', () => {
      const html = renderToStaticMarkup(
        React.createElement(ElementModeSelector, {
          activeModes: ['vertex', 'edge'],
          onSelectMode: vi.fn(),
        }),
      );

      // Both vertex and edge should have aria-pressed="true"
      expect(html).toContain('aria-pressed="true"');
      const matches = html.match(/aria-pressed="true"/g);
      expect(matches).toHaveLength(2);
    });
  });

  describe('EditModeToolbar Component', () => {
    it('renders all 13 edit mode tools with tooltips and hotkeys', () => {
      const html = renderToStaticMarkup(
        React.createElement(EditModeToolbar, {
          activeTool: 'extrude',
          onSelectTool: vi.fn(),
        }),
      );

      expect(html).toContain('aria-label="Edit Mode Tools"');

      // Active tool highlight
      expect(html).toContain('bg-[#4772b3]');
      expect(html).toContain('bg-[#80b4f0]'); // Active strip indicator

      // Check all 13 tools present in button titles
      expect(html).toContain('Select Box (W)');
      expect(html).toContain('3D Cursor (Shift+RightClick)');
      expect(html).toContain('Move / Grab (G)');
      expect(html).toContain('Rotate (R)');
      expect(html).toContain('Scale (S)');
      expect(html).toContain('Extrude Region (E)');
      expect(html).toContain('Inset Faces (I)');
      expect(html).toContain('Bevel (Ctrl+B)');
      expect(html).toContain('Loop Cut (Ctrl+R)');
      expect(html).toContain('Knife (K)');
      expect(html).toContain('Poly Build');
      expect(html).toContain('Spin');
      expect(html).toContain('Smooth');
    });

    it('renders expanded mode with tool labels', () => {
      const html = renderToStaticMarkup(
        React.createElement(EditModeToolbar, {
          activeTool: 'bevel',
          onSelectTool: vi.fn(),
          isExpanded: true,
        }),
      );

      expect(html).toContain('w-36');
      expect(html).toContain('truncate font-medium');
      expect(html).toContain('Extrude Region');
      expect(html).toContain('Loop Cut');
      expect(html).toContain('Poly Build');
    });
  });

  describe('EditToolSettingsBar Component', () => {
    it('renders extrude tool parameters: distance, direction, flip normals', () => {
      const html = renderToStaticMarkup(
        React.createElement(EditToolSettingsBar, {
          activeTool: 'extrude',
          settings: DEFAULT_EDIT_MODE_SETTINGS,
          onUpdateSettings: vi.fn(),
        }),
      );

      expect(html).toContain('aria-label="Edit Tool Settings Bar"');
      expect(html).toContain('Extrude Region');
      expect(html).toContain('Distance:');
      expect(html).toContain('value="1"');
      expect(html).toContain('Direction:');
      expect(html).toContain('Normal');
      expect(html).toContain('Flip Normals');
      expect(html).toContain('Dissolve Orthogonal');
    });

    it('renders inset tool parameters: thickness, depth, individual, select outer', () => {
      const html = renderToStaticMarkup(
        React.createElement(EditToolSettingsBar, {
          activeTool: 'inset',
          settings: DEFAULT_EDIT_MODE_SETTINGS,
          onUpdateSettings: vi.fn(),
        }),
      );

      expect(html).toContain('Thickness:');
      expect(html).toContain('value="0.2"');
      expect(html).toContain('Depth:');
      expect(html).toContain('Individual');
      expect(html).toContain('Select Outer');
    });

    it('renders bevel tool parameters: width, segments, edge/vertex mode', () => {
      const html = renderToStaticMarkup(
        React.createElement(EditToolSettingsBar, {
          activeTool: 'bevel',
          settings: DEFAULT_EDIT_MODE_SETTINGS,
          onUpdateSettings: vi.fn(),
        }),
      );

      expect(html).toContain('Width:');
      expect(html).toContain('Segments:');
      expect(html).toContain('value="2"');
      expect(html).toContain('Edges');
      expect(html).toContain('Vertices');
      expect(html).toContain('Clamp Overlap');
    });

    it('renders loop cut tool parameters: cuts, factor slider, smoothness', () => {
      const html = renderToStaticMarkup(
        React.createElement(EditToolSettingsBar, {
          activeTool: 'loopcut',
          settings: DEFAULT_EDIT_MODE_SETTINGS,
          onUpdateSettings: vi.fn(),
        }),
      );

      expect(html).toContain('Number of Cuts:');
      expect(html).toContain('Falloff / Factor:');
      expect(html).toContain('Smoothness:');
    });

    it('renders spin tool parameters: steps, angle, axis', () => {
      const html = renderToStaticMarkup(
        React.createElement(EditToolSettingsBar, {
          activeTool: 'spin',
          settings: DEFAULT_EDIT_MODE_SETTINGS,
          onUpdateSettings: vi.fn(),
        }),
      );

      expect(html).toContain('Steps:');
      expect(html).toContain('value="9"');
      expect(html).toContain('Angle:');
      expect(html).toContain('value="90"');
      expect(html).toContain('Axis:');
    });
  });

  describe('EditToolSettingsPanel Component', () => {
    it('renders active tool parameters and quick mesh operations in Inspector', () => {
      const html = renderToStaticMarkup(
        React.createElement(EditToolSettingsPanel, {
          activeTool: 'extrude',
          settings: DEFAULT_EDIT_MODE_SETTINGS,
          onUpdateSettings: vi.fn(),
          activeElementModes: ['face'],
          selectionStats: {
            selectedVertices: 4,
            totalVertices: 8,
            selectedEdges: 4,
            totalEdges: 12,
            selectedFaces: 1,
            totalFaces: 6,
          },
        }),
      );

      expect(html).toContain('aria-label="Edit Tool Settings Panel"');
      expect(html).toContain('Extrude Region');
      expect(html).toContain('Selection (face)');
      expect(html).toContain('Verts:');
      expect(html).toContain('4');
      expect(html).toContain('/8');
      expect(html).toContain('Edges:');
      expect(html).toContain('/12');
      expect(html).toContain('Faces:');
      expect(html).toContain('/6');

      // Actions in panel
      expect(html).toContain('Subdivide');
      expect(html).toContain('Extrude Region');
      expect(html).toContain('Inset Faces');
      expect(html).toContain('Bevel');
      expect(html).toContain('Smooth Mesh');
      expect(html).toContain('Flip Normals');
      expect(html).toContain('Triangulate');
      expect(html).toContain('Bridge Loops');

      // Merge vertices section
      expect(html).toContain('Merge Vertices');
      expect(html).toContain('By Distance');
      expect(html).toContain('At Center');
      expect(html).toContain('At Cursor');
      expect(html).toContain('Collapse');

      // Delete & Dissolve buttons
      expect(html).toContain('Del Verts');
      expect(html).toContain('Del Edges');
      expect(html).toContain('Del Faces');
      expect(html).toContain('Dissolve V');
      expect(html).toContain('Dissolve E');
      expect(html).toContain('Dissolve F');
    });
  });

  describe('EditContextMenu Component (Right-Click Context Menu)', () => {
    it('renders vertex context menu when in vertex element mode', () => {
      const html = renderToStaticMarkup(
        React.createElement(EditContextMenu, {
          isOpen: true,
          position: { x: 100, y: 150 },
          elementMode: 'vertex',
          onClose: vi.fn(),
          onSelectAction: vi.fn(),
        }),
      );

      expect(html).toContain('Vertex Specials');
      expect(html).toContain('Extrude Vertices');
      expect(html).toContain('Bevel Vertices');
      expect(html).toContain('Connect Vertex Path');
      expect(html).toContain('Slide Vertex');
      expect(html).toContain('Merge Vertices');
      expect(html).toContain('New Edge/Face from Vertices');
      expect(html).toContain('Dissolve Vertices');
      expect(html).toContain('Delete Vertices');
    });

    it('renders edge context menu when in edge element mode', () => {
      const html = renderToStaticMarkup(
        React.createElement(EditContextMenu, {
          isOpen: true,
          position: { x: 100, y: 150 },
          elementMode: 'edge',
          onClose: vi.fn(),
          onSelectAction: vi.fn(),
        }),
      );

      expect(html).toContain('Edge Specials');
      expect(html).toContain('Extrude Edges');
      expect(html).toContain('Subdivide');
      expect(html).toContain('Bevel Edges');
      expect(html).toContain('Edge Slide');
      expect(html).toContain('Edge Loops');
      expect(html).toContain('Edge Rings');
      expect(html).toContain('Bridge Edge Loops');
      expect(html).toContain('Mark Seam');
      expect(html).toContain('Dissolve Edges');
      expect(html).toContain('Delete Edges');
    });

    it('renders face context menu when in face element mode', () => {
      const html = renderToStaticMarkup(
        React.createElement(EditContextMenu, {
          isOpen: true,
          position: { x: 100, y: 150 },
          elementMode: 'face',
          onClose: vi.fn(),
          onSelectAction: vi.fn(),
        }),
      );

      expect(html).toContain('Face Specials');
      expect(html).toContain('Extrude Faces');
      expect(html).toContain('Extrude Faces Along Normals');
      expect(html).toContain('Extrude Individual Faces');
      expect(html).toContain('Inset Faces');
      expect(html).toContain('Bevel Faces');
      expect(html).toContain('Triangulate Faces');
      expect(html).toContain('Poke Faces');
      expect(html).toContain('Flip Normals');
      expect(html).toContain('Shade Smooth');
      expect(html).toContain('Shade Flat');
      expect(html).toContain('Dissolve Faces');
      expect(html).toContain('Delete Faces');
    });
  });

  describe('DeleteDissolveMenu Component (X / Delete Popup)', () => {
    it('renders delete options, dissolve options, and edge collapse with single-key shortcuts', () => {
      const html = renderToStaticMarkup(
        React.createElement(DeleteDissolveMenu, {
          isOpen: true,
          position: { x: 200, y: 250 },
          onClose: vi.fn(),
          onSelectOption: vi.fn(),
        }),
      );

      expect(html).toContain('aria-label="Delete / Dissolve Menu"');
      expect(html).toContain('Delete');

      // Delete items
      expect(html).toContain('Vertices');
      expect(html).toContain('Edges');
      expect(html).toContain('Faces');
      expect(html).toContain('Only Edges &amp; Faces');
      expect(html).toContain('Only Faces');

      // Dissolve items
      expect(html).toContain('Dissolve Vertices');
      expect(html).toContain('Dissolve Edges');
      expect(html).toContain('Dissolve Faces');

      // Collapse items
      expect(html).toContain('Edge Collapse');
      expect(html).toContain('Edge Loops');
    });
  });

  describe('EditModeStatusBar Component', () => {
    it('displays active tool, mode badges, selection counts, and hotkeys hint', () => {
      const html = renderToStaticMarkup(
        React.createElement(EditModeStatusBar, {
          activeTool: 'extrude',
          activeElementModes: ['vertex', 'edge'],
          selectionStats: {
            selectedVertices: 4,
            totalVertices: 8,
            selectedEdges: 4,
            totalEdges: 12,
            selectedFaces: 0,
            totalFaces: 6,
          },
        }),
      );

      expect(html).toContain('aria-label="Edit Mode Status Bar"');
      expect(html).toContain('Extrude Region');
      expect(html).toContain('Mode:');
      expect(html).toContain('vertex');
      expect(html).toContain('edge');
      expect(html).toContain('G: Move');
      expect(html).toContain('E: Extrude');
      expect(html).toContain('I: Inset');
      expect(html).toContain('Ctrl+B: Bevel');
      expect(html).toContain('X: Delete Menu');
      expect(html).toContain('Verts:');
      expect(html).toContain('4');
      expect(html).toContain('/8');
    });
  });

  describe('Header Component Edit Mode Integration', () => {
    it('integrates Edit Mode in dropdown and displays ElementModeSelector when active', () => {
      const html = renderToStaticMarkup(
        React.createElement(Header, {
          viewportMode: 'edit',
          onViewportModeChange: vi.fn(),
          editElementModes: ['vertex'],
          onSelectEditElementMode: vi.fn(),
        }),
      );

      // Edit Mode option in select
      expect(html).toContain('value="edit"');
      expect(html).toContain('Edit Mode');

      // Element mode buttons present
      expect(html).toContain('aria-label="Element Selection Mode"');
      expect(html).toContain('Vertex Select (1)');
      expect(html).toContain('Edge Select (2)');
      expect(html).toContain('Face Select (3)');
    });
  });

  describe('PropertiesPanel Edit Mode Integration', () => {
    it('renders Tool tab by default in edit mode with EditToolSettingsPanel', () => {
      const html = renderToStaticMarkup(
        React.createElement(PropertiesPanel, {
          node: null,
          viewportMode: 'edit',
          editModeTool: 'extrude',
          editModeSettings: DEFAULT_EDIT_MODE_SETTINGS,
          onUpdateEditModeSettings: vi.fn(),
          activeElementModes: ['face'],
          editSelectionStats: {
            selectedVertices: 4,
            totalVertices: 8,
            selectedEdges: 4,
            totalEdges: 12,
            selectedFaces: 1,
            totalFaces: 6,
          },
          onExecuteEditOperation: vi.fn(),
        }),
      );

      expect(html).toContain('Tool');
      expect(html).toContain('Object');
      expect(html).toContain('Material');
      expect(html).toContain('aria-label="Edit Tool Settings Panel"');
      expect(html).toContain('Extrude Region');
    });
  });

  describe('Modeling Workspace Pre-Configuration', () => {
    it('verifies that the Modeling workspace is preset with edit mode', () => {
      const workspaces = getDefaultWorkspaces();
      const modelingWs = workspaces.find((w) => w.id === 'modeling');

      expect(modelingWs).toBeDefined();
      expect(modelingWs?.defaultMode).toBe('edit');
      expect(modelingWs?.viewportConfig?.mode).toBe('edit');
    });
  });
});
