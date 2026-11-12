import { describe, it, expect } from 'vitest';
import * as THREE from 'three';
import { SculptMeshBuffer } from '../src/geometry/sculpt-mesh-buffer.js';
import { SpatialIndex } from '../src/geometry/spatial-index.js';
import { MeshAdjacency } from '../src/geometry/adjacency.js';
import { DrawBrush } from '../src/brushes/draw.js';
import {
  invertMask,
  clearMask,
  fillMask,
  smoothMask,
  growMask,
  shrinkMask,
} from '../src/masking/mask-operations.js';
import type { SculptBrushConfig, SculptStrokePoint } from '@blender-elt/contracts';

describe('Mask Protection and Mask Operations', () => {
  function createTestPlane(): {
    buffer: SculptMeshBuffer;
    spatialIndex: SpatialIndex;
    adjacency: MeshAdjacency;
  } {
    // 3x3 grid on XY plane, Z=0, normal = +Z
    const positions = new Float32Array([
      -1, 1, 0, 0, 1, 0, 1, 1, 0, -1, 0, 0, 0, 0, 0, 1, 0, 0, -1, -1, 0, 0, -1, 0, 1, -1, 0,
    ]);
    const normals = new Float32Array(positions.length);
    for (let i = 0; i < 9; i++) {
      normals[i * 3 + 2] = 1.0;
    }
    const indices = new Uint32Array([
      0, 3, 1, 1, 3, 4, 1, 4, 2, 2, 4, 5, 3, 6, 4, 4, 6, 7, 4, 7, 5, 5, 7, 8,
    ]);

    const buffer = new SculptMeshBuffer(positions, normals, null, indices);
    const spatialIndex = new SpatialIndex(0.5);
    spatialIndex.build(buffer, false);
    const adjacency = new MeshAdjacency();
    adjacency.build(buffer);

    return { buffer, spatialIndex, adjacency };
  }

  it('guarantees 1.0 mask weight results in 0.0 vertex displacement', () => {
    const { buffer, spatialIndex, adjacency } = createTestPlane();

    // Mask center vertex (index 4) completely
    buffer.setMask(4, 1.0);
    const centerBefore = buffer.getVertex(4);

    const brush = new DrawBrush();
    const config: SculptBrushConfig = {
      type: 'draw',
      radius: 1.5,
      strength: 1.0,
      falloff: 'constant',
      spacing: 0.1,
      direction: 'add',
    };

    const strokePoint: SculptStrokePoint = {
      point: { x: 0, y: 0, z: 0 },
      normal: { x: 0, y: 0, z: 1 },
      pressure: 1.0,
      timestamp: Date.now(),
    };

    brush.apply({
      buffer,
      spatialIndex,
      adjacency,
      config,
      strokePoint,
    });

    const centerAfter = buffer.getVertex(4);
    expect(centerAfter.x).toBe(centerBefore.x);
    expect(centerAfter.y).toBe(centerBefore.y);
    expect(centerAfter.z).toBe(centerBefore.z);

    // Meanwhile, unmasked neighboring vertex (index 1) should be displaced
    const neighborAfter = buffer.getVertex(1);
    expect(neighborAfter.z).toBeGreaterThan(0.0);
  });

  it('proportional mask protection (mask=0.5 yields half displacement)', () => {
    const planeA = createTestPlane();
    const planeB = createTestPlane();

    // Plane A: unmasked
    planeA.buffer.setMask(4, 0.0);

    // Plane B: half masked
    planeB.buffer.setMask(4, 0.5);

    const brush = new DrawBrush();
    const config: SculptBrushConfig = {
      type: 'draw',
      radius: 1.0,
      strength: 1.0,
      falloff: 'constant',
      spacing: 0.1,
      direction: 'add',
    };
    const strokePoint: SculptStrokePoint = {
      point: { x: 0, y: 0, z: 0 },
      normal: { x: 0, y: 0, z: 1 },
      pressure: 1.0,
      timestamp: Date.now(),
    };

    brush.apply({
      buffer: planeA.buffer,
      spatialIndex: planeA.spatialIndex,
      adjacency: planeA.adjacency,
      config,
      strokePoint,
    });

    brush.apply({
      buffer: planeB.buffer,
      spatialIndex: planeB.spatialIndex,
      adjacency: planeB.adjacency,
      config,
      strokePoint,
    });

    const dispA = planeA.buffer.getVertex(4).z;
    const dispB = planeB.buffer.getVertex(4).z;

    expect(dispB).toBeCloseTo(dispA * 0.5, 4);
  });

  it('invertMask inverts scalar weights across entire buffer', () => {
    const { buffer } = createTestPlane();
    buffer.setMask(0, 0.2);
    buffer.setMask(1, 1.0);
    buffer.setMask(2, 0.0);

    invertMask(buffer);

    expect(buffer.getMask(0)).toBeCloseTo(0.8, 5);
    expect(buffer.getMask(1)).toBeCloseTo(0.0, 5);
    expect(buffer.getMask(2)).toBeCloseTo(1.0, 5);
  });

  it('clearMask and fillMask work properly', () => {
    const { buffer } = createTestPlane();
    fillMask(buffer, 0.75);
    for (let i = 0; i < buffer.vertexCount; i++) {
      expect(buffer.getMask(i)).toBeCloseTo(0.75, 5);
    }

    clearMask(buffer);
    for (let i = 0; i < buffer.vertexCount; i++) {
      expect(buffer.getMask(i)).toBe(0.0);
    }
  });

  it('smoothMask diffuses mask weights to neighbors', () => {
    const { buffer, adjacency } = createTestPlane();
    clearMask(buffer);
    buffer.setMask(4, 1.0); // Center vertex masked

    smoothMask(buffer, adjacency, 2);

    expect(buffer.getMask(4)).toBeLessThan(1.0);
    expect(buffer.getMask(1)).toBeGreaterThan(0.0);
    expect(buffer.getMask(3)).toBeGreaterThan(0.0);
  });

  it('growMask expands mask to 1-ring neighbors', () => {
    const { buffer, adjacency } = createTestPlane();
    clearMask(buffer);
    buffer.setMask(4, 0.8);

    growMask(buffer, adjacency);

    expect(buffer.getMask(1)).toBeCloseTo(0.8, 5);
    expect(buffer.getMask(3)).toBeCloseTo(0.8, 5);
  });

  it('shrinkMask erodes mask from unmasked borders', () => {
    const { buffer, adjacency } = createTestPlane();
    fillMask(buffer, 1.0);
    buffer.setMask(0, 0.0); // Corner unmasked

    shrinkMask(buffer, adjacency);

    expect(buffer.getMask(1)).toBe(0.0);
    expect(buffer.getMask(3)).toBe(0.0);
  });
});
