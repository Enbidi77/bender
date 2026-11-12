import type { SculptBrushType } from '@blender-elt/contracts';
import type { ISculptBrush } from './brush-definition.js';
import { DrawBrush } from './draw.js';
import { DrawSharpBrush } from './draw-sharp.js';
import { ClayBrush } from './clay.js';
import { ClayStripsBrush } from './clay-strips.js';
import { InflateBrush } from './inflate.js';
import { BlobBrush } from './blob.js';
import { CreaseBrush } from './crease.js';
import { PinchBrush } from './pinch.js';
import { SmoothBrush } from './smooth.js';
import { FlattenBrush } from './flatten.js';
import { ScrapeBrush } from './scrape.js';
import { GrabBrush } from './grab.js';
import { ElasticDeformBrush } from './elastic-deform.js';
import { MaskBrush } from './mask.js';

export class BrushRegistry {
  private static instance: BrushRegistry | null = null;
  private brushes: Map<SculptBrushType, ISculptBrush> = new Map();

  constructor() {
    this.registerDefaults();
  }

  public static getInstance(): BrushRegistry {
    if (!BrushRegistry.instance) {
      BrushRegistry.instance = new BrushRegistry();
    }
    return BrushRegistry.instance;
  }

  private registerDefaults(): void {
    this.register(new DrawBrush());
    this.register(new DrawSharpBrush());
    this.register(new ClayBrush());
    this.register(new ClayStripsBrush());
    this.register(new InflateBrush());
    this.register(new BlobBrush());
    this.register(new CreaseBrush());
    this.register(new PinchBrush());
    this.register(new SmoothBrush());
    this.register(new FlattenBrush());
    this.register(new ScrapeBrush());
    this.register(new GrabBrush());
    this.register(new ElasticDeformBrush());
    this.register(new MaskBrush());
  }

  public register(brush: ISculptBrush): void {
    this.brushes.set(brush.type, brush);
  }

  public get(type: SculptBrushType): ISculptBrush {
    const brush = this.brushes.get(type);
    if (!brush) {
      throw new Error(`Sculpt brush '${type}' is not registered`);
    }
    return brush;
  }

  public has(type: SculptBrushType): boolean {
    return this.brushes.has(type);
  }

  public getAll(): ISculptBrush[] {
    return Array.from(this.brushes.values());
  }
}
