import { describe, it, expect } from 'vitest';
import * as THREE from 'three';
import { SculptMeshBuffer } from '../src/geometry/sculpt-mesh-buffer.js';
import { SpatialIndex } from '../src/geometry/spatial-index.js';
import { MeshAdjacency } from '../src/geometry/adjacency.js';
import { BrushRegistry } from '../src/brushes/brush-registry.js';
import type { SculptBrushConfig, SculptBrushType, SculptStrokePoint } from '@blender-elt/contracts';
import { DEFAULT_BRUSH_CONFIGS } from '../src/core/sculpt-settings.js';

describe('14 Professional Sculpt Brushes & Registry', () => {
  const all14Brushes: SculptBrushType[] = [
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
  ];

  function createPlaneBuffer(): {
    buffer: SculptMeshBuffer;
    spatialIndex: SpatialIndex;
    adjacency: MeshAdjacency;
  } {
    const positions = new Float32Array([
      -1, 1, 0, 0, 1, 0, 1, 1, 0, -1, 0, 0, 0, 0, 0, 1, 0, 0, -1, -1, 0, 0, -1, 0, 1, -1, 0,
    ]);
    const indices = new Uint32Array([
      0, 3, 1, 1, 3, 4, 1, 4, 2, 2, 4, 5, 3, 6, 4, 4, 6, 7, 4, 7, 5, 5, 7, 8,
    ]);
    const buffer = new SculptMeshBuffer(positions, null, null, indices);
    buffer.computeVertexNormals();

    const spatialIndex = new SpatialIndex(0.5);
    spatialIndex.build(buffer, false);

    const adjacency = new MeshAdjacency();
    adjacency.build(buffer);

    return { buffer, spatialIndex, adjacency };
  }

  it('registers all 14 mandatory sculpt brushes in the registry', () => {
    const registry = BrushRegistry.getInstance();
    for (const brushType of all14Brushes) {
      expect(registry.has(brushType)).toBe(true);
      const brush = registry.get(brushType);
      expect(brush.type).toBe(brushType);
      expect(brush.name).toBeDefined();
    }
  });

  it('DrawBrush displaces along surface normal in add and subtract mode', () => {
    const registry = BrushRegistry.getInstance();
    const brush = registry.get('draw');

    // Add mode (+Z)
    const { buffer: bufAdd, spatialIndex: spAdd, adjacency: adjAdd } = createPlaneBuffer();
    const configAdd: SculptBrushConfig = {
      ...DEFAULT_BRUSH_CONFIGS['draw'],
      radius: 1.0,
      strength: 1.0,
      direction: 'add',
    };
    const strokePt: SculptStrokePoint = {
      point: { x: 0, y: 0, z: 0 },
      normal: { x: 0, y: 0, z: 1 },
      pressure: 1.0,
      timestamp: Date.now(),
    };

    brush.apply({
      buffer: bufAdd,
      spatialIndex: spAdd,
      adjacency: adjAdd,
      config: configAdd,
      strokePoint: strokePt,
    });
    expect(bufAdd.getVertex(4).z).toBeGreaterThan(0.0);

    // Subtract mode (-Z)
    const { buffer: bufSub, spatialIndex: spSub, adjacency: adjSub } = createPlaneBuffer();
    const configSub: SculptBrushConfig = {
      ...configAdd,
      direction: 'subtract',
    };
    brush.apply({
      buffer: bufSub,
      spatialIndex: spSub,
      adjacency: adjSub,
      config: configSub,
      strokePoint: strokePt,
    });
    expect(bufSub.getVertex(4).z).toBeLessThan(0.0);
  });

  it('InflateBrush expands along individual vertex normals', () => {
    const { buffer, spatialIndex, adjacency } = createPlaneBuffer();
    const brush = BrushRegistry.getInstance().get('inflate');
    const config = { ...DEFAULT_BRUSH_CONFIGS['inflate'], radius: 1.0, strength: 1.0 };
    const strokePt: SculptStrokePoint = {
      point: { x: 0, y: 0, z: 0 },
      normal: { x: 0, y: 0, z: 1 },
      pressure: 1.0,
      timestamp: Date.now(),
    };

    brush.apply({ buffer, spatialIndex, adjacency, config, strokePoint: strokePt });
    expect(buffer.getVertex(4).z).toBeGreaterThan(0.0);
  });

  it('PinchBrush draws vertices tangentially closer to center', () => {
    const { buffer, spatialIndex, adjacency } = createPlaneBuffer();
    const brush = BrushRegistry.getInstance().get('pinch');
    const config = {
      ...DEFAULT_BRUSH_CONFIGS['pinch'],
      radius: 1.5,
      strength: 1.0,
      direction: 'add' as const,
    };
    const strokePt: SculptStrokePoint = {
      point: { x: 0, y: 0, z: 0 },
      normal: { x: 0, y: 0, z: 1 },
      pressure: 1.0,
      timestamp: Date.now(),
    };

    // Vertex 5 is initially at (1, 0, 0)
    const initialPos = buffer.getVertex(5);
    expect(initialPos.x).toBe(1.0);

    brush.apply({ buffer, spatialIndex, adjacency, config, strokePoint: strokePt });

    const newPos = buffer.getVertex(5);
    expect(newPos.x).toBeLessThan(1.0);
    expect(newPos.x).toBeGreaterThan(0.0);
  });

  it('SmoothBrush performs Laplacian neighbor relaxation', () => {
    const { buffer, spatialIndex, adjacency } = createPlaneBuffer();
    // Perturb center vertex above its planar neighbors
    buffer.setVertex(4, 0, 0, 0.5);
    spatialIndex.build(buffer, false);

    const brush = BrushRegistry.getInstance().get('smooth');
    const config = { ...DEFAULT_BRUSH_CONFIGS['smooth'], radius: 1.5, strength: 1.0 };
    const strokePt: SculptStrokePoint = {
      point: { x: 0, y: 0, z: 0.5 },
      normal: { x: 0, y: 0, z: 1 },
      pressure: 1.0,
      timestamp: Date.now(),
    };

    brush.apply({ buffer, spatialIndex, adjacency, config, strokePoint: strokePt });

    // Center vertex height should have been pulled downward toward neighbor average (0)
    expect(buffer.getVertex(4).z).toBeLessThan(0.5);
    expect(buffer.getVertex(4).z).toBeGreaterThan(0.0);
  });

  it('GrabBrush moves vertices by mouse drag vector', () => {
    const { buffer, spatialIndex, adjacency } = createPlaneBuffer();
    const brush = BrushRegistry.getInstance().get('grab');
    const config = { ...DEFAULT_BRUSH_CONFIGS['grab'], radius: 1.5, strength: 1.0 };

    const startPt: SculptStrokePoint = {
      point: { x: 0, y: 0, z: 0 },
      normal: { x: 0, y: 0, z: 1 },
      pressure: 1.0,
      timestamp: 1000,
    };
    const movePt: SculptStrokePoint = {
      point: { x: 0.5, y: 0.2, z: 0.3 },
      normal: { x: 0, y: 0, z: 1 },
      pressure: 1.0,
      timestamp: 1016,
    };

    if (brush.onStrokeBegin) {
      brush.onStrokeBegin({ buffer, spatialIndex, adjacency, config, strokePoint: startPt });
    }

    brush.apply({
      buffer,
      spatialIndex,
      adjacency,
      config,
      strokePoint: movePt,
      strokeStartPoint: startPt,
    });

    const v4 = buffer.getVertex(4);
    expect(v4.x).toBeCloseTo(0.5, 2);
    expect(v4.y).toBeCloseTo(0.2, 2);
    expect(v4.z).toBeCloseTo(0.3, 2);

    if (brush.onStrokeEnd) {
      brush.onStrokeEnd({ buffer, spatialIndex, adjacency, config, strokePoint: movePt });
    }
  });

  it('MaskBrush paints scalar mask values onto vertices', () => {
    const { buffer, spatialIndex, adjacency } = createPlaneBuffer();
    const brush = BrushRegistry.getInstance().get('mask');
    const config = {
      ...DEFAULT_BRUSH_CONFIGS['mask'],
      radius: 1.0,
      strength: 0.8,
      direction: 'add' as const,
    };

    const strokePt: SculptStrokePoint = {
      point: { x: 0, y: 0, z: 0 },
      normal: { x: 0, y: 0, z: 1 },
      pressure: 1.0,
      timestamp: Date.now(),
    };

    expect(buffer.getMask(4)).toBe(0.0);
    brush.apply({ buffer, spatialIndex, adjacency, config, strokePoint: strokePt });
    expect(buffer.getMask(4)).toBeGreaterThan(0.0);
  });
});
