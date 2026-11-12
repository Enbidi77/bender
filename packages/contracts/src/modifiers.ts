import type { Vector3 } from './scene.js';
import type { IMeshData } from './modeling.js';

/**
 * Modifier Type Discriminated Union
 */
export type ModifierType =
  | 'subdivision'
  | 'mirror'
  | 'array'
  | 'bevel'
  | 'solidify'
  | 'boolean'
  | 'displace'
  | 'decimate'
  | 'wireframe'
  | 'smooth';

/**
 * Base modifier properties common to all modifier configurations
 */
export interface BaseModifier {
  id: string;
  name: string;
  type: ModifierType;
  enabled: boolean;
  showInViewport: boolean;
  showInRender: boolean;
  showInEditMode?: boolean;
  order: number;
}

/**
 * 1. Subdivision Surface Modifier (Catmull-Clark / Simple)
 */
export interface SubdivisionModifier extends BaseModifier {
  type: 'subdivision';
  levels: number;
  renderLevels: number;
  algorithm: 'catmull-clark' | 'simple';
  uvSmooth?: 'none' | 'preserve-corners' | 'all';
}

/**
 * 2. Mirror Modifier
 */
export interface MirrorModifier extends BaseModifier {
  type: 'mirror';
  axis: {
    x: boolean;
    y: boolean;
    z: boolean;
  };
  mirrorObjectId?: string | null;
  clip: boolean;
  merge: boolean;
  mergeThreshold: number;
}

/**
 * 3. Array Modifier
 */
export interface ArrayModifier extends BaseModifier {
  type: 'array';
  count: number;
  useRelativeOffset: boolean;
  relativeOffset: Vector3;
  useConstantOffset?: boolean;
  constantOffset?: Vector3;
  offsetObjectId?: string | null;
}

/**
 * 4. Bevel Modifier
 */
export interface BevelModifier extends BaseModifier {
  type: 'bevel';
  width: number;
  segments: number;
  profile: number;
  affect: 'edges' | 'vertices';
  limitMethod?: 'none' | 'angle' | 'weight';
  angleLimit?: number;
}

/**
 * 5. Solidify Modifier
 */
export interface SolidifyModifier extends BaseModifier {
  type: 'solidify';
  thickness: number;
  offset: number;
  rim: boolean;
  evenThickness?: boolean;
}

/**
 * 6. Boolean Modifier (CSG)
 */
export type BooleanOperation = 'union' | 'difference' | 'intersect';

export interface BooleanModifier extends BaseModifier {
  type: 'boolean';
  operation: BooleanOperation;
  targetNodeId: string;
  solver?: 'fast' | 'exact';
}

/**
 * 7. Displace Modifier
 */
export interface DisplaceModifier extends BaseModifier {
  type: 'displace';
  strength: number;
  midlevel: number;
  direction: 'normal' | 'x' | 'y' | 'z';
  textureId?: string | null;
}

/**
 * 8. Decimate Modifier
 */
export interface DecimateModifier extends BaseModifier {
  type: 'decimate';
  ratio: number;
  method: 'collapse' | 'unsubdivide' | 'planar';
  angleLimit?: number;
}

/**
 * 9. Wireframe Modifier
 */
export interface WireframeModifier extends BaseModifier {
  type: 'wireframe';
  thickness: number;
  offset?: number;
  replaceOriginal: boolean;
}

/**
 * 10. Smooth Modifier
 */
export interface SmoothModifier extends BaseModifier {
  type: 'smooth';
  factor: number;
  repeat: number;
  axes?: {
    x: boolean;
    y: boolean;
    z: boolean;
  };
}

/**
 * Discriminated union of all supported modifier configurations
 */
export type ModifierConfig =
  | SubdivisionModifier
  | MirrorModifier
  | ArrayModifier
  | BevelModifier
  | SolidifyModifier
  | BooleanModifier
  | DisplaceModifier
  | DecimateModifier
  | WireframeModifier
  | SmoothModifier;

/**
 * Result of evaluating a modifier pipeline on raw mesh geometry
 */
export interface ModifierEvaluationResult {
  geometry: IMeshData;
  appliedModifierIds: string[];
  durationMs: number;
}

/**
 * Evaluator interface for modifier execution
 */
export interface IModifierEvaluator {
  evaluate(
    sourceGeometry: IMeshData,
    modifiers: ModifierConfig[],
  ): Promise<ModifierEvaluationResult> | ModifierEvaluationResult;
}
