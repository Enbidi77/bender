import * as THREE from 'three';
import type {
  SculptBrushConfig,
  SculptStrokePoint,
  SculptStrokeSettings,
  SymmetryConfig,
} from '@blender-elt/contracts';
import type { SculptMeshBuffer } from '../geometry/sculpt-mesh-buffer.js';
import type { SpatialIndex } from '../geometry/spatial-index.js';
import type { MeshAdjacency } from '../geometry/adjacency.js';
import type { ISculptBrush, SculptBrushContext } from '../brushes/brush-definition.js';
import { interpolateStrokePoints, applyStrokeStabilizer } from './interpolation.js';
import { getSymmetricPoints } from './symmetry.js';

export interface StrokeSessionOptions {
  buffer: SculptMeshBuffer;
  spatialIndex: SpatialIndex;
  adjacency: MeshAdjacency;
  brush: ISculptBrush;
  config: SculptBrushConfig;
  strokeSettings: SculptStrokeSettings;
  symmetry: SymmetryConfig;
}

export class StrokeSession {
  private buffer: SculptMeshBuffer;
  private spatialIndex: SpatialIndex;
  private adjacency: MeshAdjacency;
  private brush: ISculptBrush;
  private config: SculptBrushConfig;
  private strokeSettings: SculptStrokeSettings;
  private symmetry: SymmetryConfig;

  private points: SculptStrokePoint[] = [];
  private lastSampledPoint: SculptStrokePoint | null = null;
  private strokeStartPoint: SculptStrokePoint | null = null;
  private startTime: number = 0;

  constructor(options: StrokeSessionOptions) {
    this.buffer = options.buffer;
    this.spatialIndex = options.spatialIndex;
    this.adjacency = options.adjacency;
    this.brush = options.brush;
    this.config = options.config;
    this.strokeSettings = options.strokeSettings;
    this.symmetry = options.symmetry;
  }

  public begin(point: SculptStrokePoint): void {
    this.startTime = Date.now();
    this.points = [point];
    this.lastSampledPoint = point;
    this.strokeStartPoint = point;

    const ctx = this.createContext(point);
    if (this.brush.onStrokeBegin) {
      this.brush.onStrokeBegin(ctx);
    }

    this.dispatchBrush(ctx);
  }

  public update(point: SculptStrokePoint): void {
    if (!this.lastSampledPoint || !this.strokeStartPoint) {
      this.begin(point);
      return;
    }

    let targetPoint = point;
    if (this.strokeSettings.smoothStroke) {
      const prevPos = new THREE.Vector3(
        this.lastSampledPoint.point.x,
        this.lastSampledPoint.point.y,
        this.lastSampledPoint.point.z,
      );
      const currPos = new THREE.Vector3(point.point.x, point.point.y, point.point.z);
      const stabilized = applyStrokeStabilizer(
        currPos,
        prevPos,
        this.strokeSettings.smoothStrokeFactor,
      );
      targetPoint = {
        point: { x: stabilized.x, y: stabilized.y, z: stabilized.z },
        normal: point.normal,
        pressure: point.pressure,
        timestamp: point.timestamp,
      };
    }

    // Evaluate stroke spacing
    const spacingStep = Math.max(1e-3, this.config.radius * this.config.spacing);
    const interpolated = interpolateStrokePoints(this.lastSampledPoint, targetPoint, spacingStep);

    for (const pt of interpolated) {
      const ctx = this.createContext(pt, this.lastSampledPoint);
      this.dispatchBrush(ctx);
      this.lastSampledPoint = pt;
      this.points.push(pt);
    }
  }

  public end(): number {
    if (this.lastSampledPoint && this.brush.onStrokeEnd) {
      const ctx = this.createContext(this.lastSampledPoint);
      this.brush.onStrokeEnd(ctx);
    }
    const duration = Date.now() - this.startTime;
    return duration;
  }

  private createContext(current: SculptStrokePoint, last?: SculptStrokePoint): SculptBrushContext {
    let strokeDir: THREE.Vector3 | undefined;
    if (last) {
      strokeDir = new THREE.Vector3(
        current.point.x - last.point.x,
        current.point.y - last.point.y,
        current.point.z - last.point.z,
      );
    }

    return {
      buffer: this.buffer,
      spatialIndex: this.spatialIndex,
      adjacency: this.adjacency,
      config: this.config,
      strokePoint: current,
      lastPoint: last,
      strokeStartPoint: this.strokeStartPoint || current,
      strokeDirection: strokeDir,
    };
  }

  private dispatchBrush(ctx: SculptBrushContext): void {
    // 1. Primary stroke point application
    this.brush.apply(ctx);

    // 2. Symmetric echo points application
    const echoes = getSymmetricPoints(ctx.strokePoint, this.symmetry);
    for (const echoPoint of echoes) {
      const echoCtx: SculptBrushContext = {
        ...ctx,
        strokePoint: echoPoint,
      };
      this.brush.apply(echoCtx);
    }
  }
}
