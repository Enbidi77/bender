import * as THREE from 'three';
import type { SculptBrushConfig, SculptBrushType, SculptStrokePoint } from '@blender-elt/contracts';
import type { SculptMeshBuffer } from '../geometry/sculpt-mesh-buffer.js';
import type { SpatialIndex } from '../geometry/spatial-index.js';
import type { MeshAdjacency } from '../geometry/adjacency.js';

export interface SculptBrushContext {
  buffer: SculptMeshBuffer;
  spatialIndex: SpatialIndex;
  adjacency: MeshAdjacency;
  config: SculptBrushConfig;
  strokePoint: SculptStrokePoint;
  lastPoint?: SculptStrokePoint;
  strokeStartPoint?: SculptStrokePoint;
  strokeDirection?: THREE.Vector3;
}

export interface ISculptBrush {
  readonly type: SculptBrushType;
  readonly name: string;
  readonly description?: string;

  onStrokeBegin?(ctx: SculptBrushContext): void;
  apply(ctx: SculptBrushContext): void;
  onStrokeEnd?(ctx: SculptBrushContext): void;
}
