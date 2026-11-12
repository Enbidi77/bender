import { describe, it, expect } from 'vitest';
import { getSymmetricPoints } from '../src/strokes/symmetry.js';
import { StrokeSession } from '../src/strokes/stroke-session.js';
import { SculptMeshBuffer } from '../src/geometry/sculpt-mesh-buffer.js';
import { SpatialIndex } from '../src/geometry/spatial-index.js';
import { MeshAdjacency } from '../src/geometry/adjacency.js';
import { DrawBrush } from '../src/brushes/draw.js';
import { DEFAULT_BRUSH_CONFIGS, DEFAULT_STROKE_SETTINGS } from '../src/core/sculpt-settings.js';
import type { SculptStrokePoint, SymmetryConfig } from '@blender-elt/contracts';

describe('Symmetry Reflection & Radial Evaluation', () => {
  const primaryPt: SculptStrokePoint = {
    point: { x: 2, y: 3, z: 4 },
    normal: { x: 0.5, y: 0.5, z: 0.7 },
    pressure: 0.8,
    timestamp: 1000,
  };

  it('mirrors point and normal across X axis', () => {
    const sym: SymmetryConfig = { x: true, y: false, z: false };
    const echoes = getSymmetricPoints(primaryPt, sym);

    expect(echoes.length).toBe(1);
    expect(echoes[0].point).toEqual({ x: -2, y: 3, z: 4 });
    expect(echoes[0].normal).toEqual({ x: -0.5, y: 0.5, z: 0.7 });
    expect(echoes[0].pressure).toBe(0.8);
  });

  it('mirrors across all 3 axes (X, Y, Z) simultaneously producing 7 echo points', () => {
    const sym: SymmetryConfig = { x: true, y: true, z: true };
    const echoes = getSymmetricPoints(primaryPt, sym);

    expect(echoes.length).toBe(7);
    // Verifies full Cartesian reflection combinations: (-x, y, z), (x, -y, z), (-x, -y, z), etc.
    const allNeg = echoes.find((e) => e.point.x === -2 && e.point.y === -3 && e.point.z === -4);
    expect(allNeg).toBeDefined();
    expect(allNeg?.normal).toEqual({ x: -0.5, y: -0.5, z: -0.7 });
  });

  it('evaluates radial symmetry around an axis', () => {
    const sym: SymmetryConfig = {
      x: false,
      y: false,
      z: false,
      radial: { axis: 'z', count: 4 },
    };
    const echoes = getSymmetricPoints(primaryPt, sym);

    // 4-fold radial produces 3 echo points (90, 180, 270 degrees)
    expect(echoes.length).toBe(3);
    for (const echo of echoes) {
      expect(echo.point.z).toBeCloseTo(4.0, 5); // Z remains constant for rotation around Z
    }
  });

  it('applies symmetric stroke deformations to mesh vertices across mirror plane', () => {
    // Symmetrical mesh: two vertices at x = +1 and x = -1
    const positions = new Float32Array([1.0, 0.0, 0.0, -1.0, 0.0, 0.0]);
    const normals = new Float32Array([0, 0, 1, 0, 0, 1]);
    const buffer = new SculptMeshBuffer(positions, normals);
    const spatialIndex = new SpatialIndex(0.5);
    spatialIndex.build(buffer, false);
    const adjacency = new MeshAdjacency();
    adjacency.build(buffer);

    const brush = new DrawBrush();
    const config = {
      ...DEFAULT_BRUSH_CONFIGS['draw'],
      radius: 0.5,
      strength: 1.0,
      direction: 'add' as const,
    };
    const strokeSettings = { ...DEFAULT_STROKE_SETTINGS };
    const symmetry: SymmetryConfig = { x: true, y: false, z: false };

    const session = new StrokeSession({
      buffer,
      spatialIndex,
      adjacency,
      brush,
      config,
      strokeSettings,
      symmetry,
    });

    // Primary stroke hits vertex 0 at (+1, 0, 0)
    session.begin({
      point: { x: 1.0, y: 0.0, z: 0.0 },
      normal: { x: 0, y: 0, z: 1 },
      pressure: 1.0,
      timestamp: 1000,
    });
    session.end();

    const v0 = buffer.getVertex(0);
    const v1 = buffer.getVertex(1);

    // Both vertices (+1 and -1) should receive equal displacement along normal (+Z)
    expect(v0.z).toBeGreaterThan(0.0);
    expect(v1.z).toBeGreaterThan(0.0);
    expect(v0.z).toBeCloseTo(v1.z, 5);
  });
});
