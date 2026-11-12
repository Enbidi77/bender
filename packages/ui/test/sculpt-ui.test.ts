import { describe, it, expect, vi } from 'vitest';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import {
  SCULPT_BRUSH_DEFINITIONS,
  BRUSH_METADATA_MAP,
  SculptToolbar,
  BrushPicker,
  BrushSettingsPanel,
  SymmetryPanel,
  MaskingPanel,
  RemeshPanel,
  SculptStatusBar,
  SculptTopBar,
  PropertiesPanel,
  getDefaultWorkspaces,
} from '../src/index.js';
import type {
  SculptBrushType,
  SculptBrushConfig,
  SymmetryConfig,
  VoxelRemeshConfig,
  SculptStrokeSettings,
} from '@blender-elt/contracts';

describe('Professional Sculpt Mode UI Components', () => {
  describe('Sculpt Brush Definitions & Metadata', () => {
    it('defines all 14 professional sculpt brushes', () => {
      expect(SCULPT_BRUSH_DEFINITIONS).toHaveLength(14);

      const brushIds = SCULPT_BRUSH_DEFINITIONS.map((b) => b.id);
      expect(brushIds).toEqual([
        'draw',
        'draw-sharp',
        'clay',
        'clay-strips',
        'inflate',
        'blob',
        'crease',
        'pinch',
        'smooth',
        'flatten',
        'scrape',
        'grab',
        'elastic-deform',
        'mask',
      ]);
    });

    it('assigns correct categories across brushes', () => {
      const volume = SCULPT_BRUSH_DEFINITIONS.filter((b) => b.category === 'volume');
      expect(volume.map((b) => b.id)).toEqual([
        'draw',
        'draw-sharp',
        'clay',
        'clay-strips',
        'inflate',
        'blob',
      ]);

      const polish = SCULPT_BRUSH_DEFINITIONS.filter((b) => b.category === 'polish');
      expect(polish.map((b) => b.id)).toEqual(['crease', 'pinch', 'smooth', 'flatten', 'scrape']);

      const deform = SCULPT_BRUSH_DEFINITIONS.filter((b) => b.category === 'deform');
      expect(deform.map((b) => b.id)).toEqual(['grab', 'elastic-deform']);

      const mask = SCULPT_BRUSH_DEFINITIONS.filter((b) => b.category === 'mask');
      expect(mask.map((b) => b.id)).toEqual(['mask']);
    });

    it('provides fast map lookup with valid shortcuts and descriptions', () => {
      expect(BRUSH_METADATA_MAP['draw'].shortcut).toBe('X');
      expect(BRUSH_METADATA_MAP['clay'].shortcut).toBe('C');
      expect(BRUSH_METADATA_MAP['grab'].shortcut).toBe('G');
      expect(BRUSH_METADATA_MAP['smooth'].shortcut).toBe('S');
      expect(BRUSH_METADATA_MAP['mask'].shortcut).toBe('M');

      for (const brush of SCULPT_BRUSH_DEFINITIONS) {
        expect(brush.name.length).toBeGreaterThan(0);
        expect(brush.shortcut.length).toBeGreaterThan(0);
        expect(brush.description.length).toBeGreaterThan(10);
        expect(brush.defaultRadius).toBeGreaterThan(0);
        expect(brush.defaultStrength).toBeGreaterThan(0);
      }
    });
  });

  describe('SculptToolbar Component', () => {
    it('renders all 14 brush buttons with tooltips and hotkeys', () => {
      const html = renderToStaticMarkup(
        React.createElement(SculptToolbar, {
          activeBrush: 'draw',
          onSelectBrush: vi.fn(),
        }),
      );

      // Check toolbar rendered
      expect(html).toContain('aria-label="Sculpt Tools"');

      // Check active brush highlight
      expect(html).toContain('bg-[#4772b3]');

      // Check all 14 tool buttons present in title tooltips
      expect(html).toContain('Draw (X)');
      expect(html).toContain('Draw Sharp (Shift+D)');
      expect(html).toContain('Clay (C)');
      expect(html).toContain('Clay Strips (Space+C)');
      expect(html).toContain('Inflate (I)');
      expect(html).toContain('Blob (B)');
      expect(html).toContain('Crease (Shift+C)');
      expect(html).toContain('Pinch (P)');
      expect(html).toContain('Smooth (S)');
      expect(html).toContain('Flatten (T)');
      expect(html).toContain('Scrape (Alt+S)');
      expect(html).toContain('Grab (G)');
      expect(html).toContain('Elastic Deform (K)');
      expect(html).toContain('Mask (M)');
    });

    it('renders expanded mode with label names', () => {
      const html = renderToStaticMarkup(
        React.createElement(SculptToolbar, {
          activeBrush: 'clay',
          onSelectBrush: vi.fn(),
          isExpanded: true,
        }),
      );

      expect(html).toContain('w-36');
      expect(html).toContain('truncate font-medium');
      expect(html).toContain('Clay Strips');
      expect(html).toContain('Elastic Deform');
    });
  });

  describe('BrushPicker Component', () => {
    it('renders category tabs, search input, recents and favorites', () => {
      const html = renderToStaticMarkup(
        React.createElement(BrushPicker, {
          activeBrush: 'draw',
          onSelectBrush: vi.fn(),
          recentBrushes: ['draw', 'clay', 'grab'],
          favoriteBrushes: ['draw', 'clay'],
        }),
      );

      expect(html).toContain('Sculpt Brush Gallery');
      expect(html).toContain('placeholder="Search brushes or shortcuts (X, G, C...)"');
      expect(html).toContain('Volume');
      expect(html).toContain('Polish');
      expect(html).toContain('Deform');
      expect(html).toContain('Mask');
      expect(html).toContain('Favorites');
      expect(html).toContain('Recent:');
    });
  });

  describe('BrushSettingsPanel Component', () => {
    it('renders active brush parameters: radius, strength, direction, falloffs', () => {
      const config: SculptBrushConfig = {
        type: 'clay',
        radius: 65,
        strength: 0.75,
        falloff: 'smooth',
        spacing: 12,
        direction: 'add',
        pressureAffectsSize: true,
        pressureAffectsStrength: true,
      };

      const strokeSettings: SculptStrokeSettings = {
        spacing: 12,
        smoothStroke: true,
        smoothStrokeFactor: 0.6,
        useAccumulate: true,
        frontFacesOnly: false,
      };

      const html = renderToStaticMarkup(
        React.createElement(BrushSettingsPanel, {
          brushConfig: config,
          onUpdateBrushConfig: vi.fn(),
          strokeSettings,
          onUpdateStrokeSettings: vi.fn(),
        }),
      );

      // Header card
      expect(html).toContain('Clay');
      expect(html).toContain('Volume Brush');
      expect(html).toContain('Add');
      expect(html).toContain('Sub');

      // Radius & strength
      expect(html).toContain('Radius');
      expect(html).toContain('value="65"');
      expect(html).toContain('Strength');
      expect(html).toContain('75%');

      // Falloff curve buttons
      expect(html).toContain('Smooth');
      expect(html).toContain('Sphere');
      expect(html).toContain('Sharp');
      expect(html).toContain('Linear');
      expect(html).toContain('Constant');

      // Stroke settings
      expect(html).toContain('Spacing (% of Radius)');
      expect(html).toContain('Smooth Stroke (Lazy Mouse)');
      expect(html).toContain('Front Faces Only');
    });
  });

  describe('SymmetryPanel Component', () => {
    it('renders X, Y, Z mirror toggles and radial symmetry count', () => {
      const symmetry: SymmetryConfig = {
        x: true,
        y: false,
        z: true,
        radial: { axis: 'z', count: 6 },
      };

      const html = renderToStaticMarkup(
        React.createElement(SymmetryPanel, {
          symmetry,
          onUpdateSymmetry: vi.fn(),
          coordinateSpace: 'object',
        }),
      );

      expect(html).toContain('Mirror Symmetry');
      expect(html).toContain('bg-[#e04b4b]'); // Active X pill
      expect(html).toContain('bg-[#4b7be0]'); // Active Z pill
      expect(html).toContain('Radial Symmetry');
      expect(html).toContain('6x');
      expect(html).toContain('object');
    });
  });

  describe('MaskingPanel Component', () => {
    it('renders invert, clear, smooth, sharpen, grow, shrink and gesture tools', () => {
      const html = renderToStaticMarkup(
        React.createElement(MaskingPanel, {
          maskEnabled: true,
          onMaskOperation: vi.fn(),
          maskCoveragePercent: 42,
        }),
      );

      expect(html).toContain('Sculpt Mask');
      expect(html).toContain('42%');
      expect(html).toContain('Paint');
      expect(html).toContain('Box');
      expect(html).toContain('Lasso');
      expect(html).toContain('Invert (Ctrl+I)');
      expect(html).toContain('Clear (Alt+M)');
      expect(html).toContain('Smooth');
      expect(html).toContain('Sharpen');
      expect(html).toContain('Grow Mask');
      expect(html).toContain('Shrink Mask');
      expect(html).toContain('Fill All (100% Mask)');
    });
  });

  describe('RemeshPanel Component', () => {
    it('calculates triangle estimation and triggers safety modal if density is high', () => {
      const config: VoxelRemeshConfig = {
        voxelSize: 0.01,
        adaptivity: 0.2,
        smoothNormals: true,
        preserveVolume: true,
      };

      const html = renderToStaticMarkup(
        React.createElement(RemeshPanel, {
          config,
          onUpdateConfig: vi.fn(),
          onExecuteRemesh: vi.fn(),
          meshBoundingBox: { x: 2, y: 2, z: 2 },
          currentVertexCount: 1000,
          currentTriangleCount: 2000,
        }),
      );

      expect(html).toContain('Voxel Remesher');
      expect(html).toContain('Voxel Size');
      expect(html).toContain('Adaptivity (Decimate Flat Areas)');
      expect(html).toContain('Estimated Result:');
      expect(html).toContain('triangles');
      expect(html).toContain('Voxel Remesh (Ctrl+R)');
    });
  });

  describe('SculptStatusBar Component', () => {
    it('displays active brush, direction, polycounts, stroke duration, and symmetry pills', () => {
      const html = renderToStaticMarkup(
        React.createElement(SculptStatusBar, {
          activeBrush: 'clay',
          brushDirection: 'add',
          vertexCount: 142500,
          faceCount: 285000,
          lastStrokeDurationMs: 14.8,
          strokeSamplesCount: 65,
          symmetry: { x: true, y: false, z: true },
          maskEnabled: true,
          maskCoveragePercent: 25,
        }),
      );

      expect(html).toContain('aria-label="Sculpt Status Bar"');
      expect(html).toContain('Clay');
      expect(html).toContain('+ADD');
      expect(html).toContain('14.8ms');
      expect(html).toContain('(65 pts)');
      expect(html).toContain('142,500');
      expect(html).toContain('285,000');
      expect(html).toContain('Mask: 25%');
    });
  });

  describe('SculptTopBar Component', () => {
    it('renders top-bar brush trigger, radius, strength, direction, and symmetry pills', () => {
      const config: SculptBrushConfig = {
        type: 'draw',
        radius: 45,
        strength: 0.6,
        falloff: 'smooth',
        spacing: 10,
        direction: 'add',
      };

      const symmetry: SymmetryConfig = {
        x: true,
        y: false,
        z: false,
      };

      const html = renderToStaticMarkup(
        React.createElement(SculptTopBar, {
          activeBrush: 'draw',
          brushConfig: config,
          onUpdateBrushConfig: vi.fn(),
          onSelectBrush: vi.fn(),
          symmetry,
          onUpdateSymmetry: vi.fn(),
        }),
      );

      expect(html).toContain('Draw');
      expect(html).toContain('Radius:');
      expect(html).toContain('45px');
      expect(html).toContain('Strength:');
      expect(html).toContain('60%');
      expect(html).toContain('Sym:');
      expect(html).toContain('bg-[#e04b4b]');
    });
  });

  describe('PropertiesPanel Sculpt Integration', () => {
    it('renders Tool tab by default in sculpt mode with all sculpt sub-panels', () => {
      const brushConfig: SculptBrushConfig = {
        type: 'draw',
        radius: 50,
        strength: 0.5,
        falloff: 'smooth',
        spacing: 10,
        direction: 'add',
      };

      const symmetry: SymmetryConfig = { x: true, y: false, z: false };
      const remeshConfig: VoxelRemeshConfig = { voxelSize: 0.05 };

      const html = renderToStaticMarkup(
        React.createElement(PropertiesPanel, {
          node: null,
          viewportMode: 'sculpt',
          sculptBrushConfig: brushConfig,
          onUpdateSculptBrushConfig: vi.fn(),
          sculptSymmetry: symmetry,
          onUpdateSculptSymmetry: vi.fn(),
          onMaskOperation: vi.fn(),
          remeshConfig,
          onUpdateRemeshConfig: vi.fn(),
          onExecuteRemesh: vi.fn(),
        }),
      );

      // Tool tab active
      expect(html).toContain('Tool');
      expect(html).toContain('Object');
      expect(html).toContain('Material');

      // Panels inside tool tab
      expect(html).toContain('Active Brush Settings');
      expect(html).toContain('Symmetry');
      expect(html).toContain('Masking');
      expect(html).toContain('Voxel Remesh');
    });
  });

  describe('Workspace Sculpt Mode Parity', () => {
    it('confirms the Sculpting workspace is preconfigured with sculpt mode', () => {
      const workspaces = getDefaultWorkspaces();
      const sculptWs = workspaces.find((w) => w.id === 'sculpting');

      expect(sculptWs).toBeDefined();
      expect(sculptWs?.defaultMode).toBe('sculpt');
      expect(sculptWs?.viewportConfig?.mode).toBe('sculpt');
      expect(sculptWs?.viewportConfig?.gizmoType).toBe('none');
    });
  });
});
