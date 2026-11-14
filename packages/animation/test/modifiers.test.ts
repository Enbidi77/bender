import { describe, it, expect } from 'vitest';
import { evaluateNoise, applyFCurveModifier, evaluateModifierStack } from '../src/modifiers.js';
import type {
  LimitsFCurveModifier,
  NoiseFCurveModifier,
  SteppedFCurveModifier,
  GeneratorFCurveModifier,
} from '@blender-elt/contracts';

describe('F-Curve Modifier Stack Engine', () => {
  it('generates coherent, bounded noise with configurable parameters', () => {
    const n1 = evaluateNoise(10, 0.5, 5, 0, 2);
    const n2 = evaluateNoise(10, 0.5, 5, 0, 2);
    // Deterministic: same inputs give identical noise
    expect(n1).toBe(n2);

    // Amplitude is bounded by strength
    for (let f = 0; f < 30; f++) {
      const n = evaluateNoise(f, 0.2, 10, 0, 3);
      expect(Math.abs(n)).toBeLessThanOrEqual(10.1);
    }
  });

  it('applies noise modifier on top of base curve values with influence', () => {
    const mod: NoiseFCurveModifier = {
      id: 'm1',
      type: 'noise',
      name: 'Turbulence',
      enabled: true,
      influence: 1.0,
      scale: 0.1,
      strength: 5,
      phase: 0,
      depth: 1,
    };

    const baseVal = 100;
    const modified = applyFCurveModifier(baseVal, mod, 15);
    expect(modified).not.toBe(baseVal);
    expect(Math.abs(modified - baseVal)).toBeLessThanOrEqual(5.1);

    // 0 influence leaves base value untouched
    const noInfMod = { ...mod, influence: 0.0 };
    expect(applyFCurveModifier(baseVal, noInfMod, 15)).toBe(baseVal);

    // Disabled modifier leaves base value untouched
    const disabledMod = { ...mod, enabled: false };
    expect(applyFCurveModifier(baseVal, disabledMod, 15)).toBe(baseVal);
  });

  it('applies stepped modifier to quantize frames (anime 2s / 3s stop motion)', () => {
    const sampleLinear = (f: number) => f * 10;

    const mod: SteppedFCurveModifier = {
      id: 'm_step',
      type: 'stepped',
      name: 'Anime 3s',
      enabled: true,
      influence: 1.0,
      stepSize: 3,
      offset: 0,
    };

    // For frame 0, 1, 2, stepped frame is 0 -> value 0
    expect(applyFCurveModifier(sampleLinear(0), mod, 0, sampleLinear)).toBe(0);
    expect(applyFCurveModifier(sampleLinear(1), mod, 1, sampleLinear)).toBe(0);
    expect(applyFCurveModifier(sampleLinear(2), mod, 2, sampleLinear)).toBe(0);

    // For frame 3, 4, 5, stepped frame is 3 -> value 30
    expect(applyFCurveModifier(sampleLinear(3), mod, 3, sampleLinear)).toBe(30);
    expect(applyFCurveModifier(sampleLinear(4), mod, 4, sampleLinear)).toBe(30);
    expect(applyFCurveModifier(sampleLinear(5), mod, 5, sampleLinear)).toBe(30);
  });

  it('applies limits modifier to clamp curve values', () => {
    const mod: LimitsFCurveModifier = {
      id: 'm_limits',
      type: 'limits',
      name: 'Range Limits',
      enabled: true,
      influence: 1.0,
      minY: 0,
      maxY: 100,
    };

    // Below minY clamps to minY
    expect(applyFCurveModifier(-25, mod, 1)).toBe(0);

    // Above maxY clamps to maxY
    expect(applyFCurveModifier(150, mod, 1)).toBe(100);

    // Inside range remains untouched
    expect(applyFCurveModifier(42, mod, 1)).toBe(42);

    // 50% influence blends halfway between original and clamped
    const halfInf = { ...mod, influence: 0.5 };
    // original: 200, clamped: 100, blended: 200 + (100 - 200) * 0.5 = 150
    expect(applyFCurveModifier(200, halfInf, 1)).toBe(150);
  });

  it('applies generator polynomial modifier', () => {
    const mod: GeneratorFCurveModifier = {
      id: 'm_gen',
      type: 'generator',
      name: 'Linear Drift',
      enabled: true,
      influence: 1.0,
      coefficients: [10, 2], // 10 + 2 * frame
    };

    // For base value 50 at frame 5: 50 + (10 + 2 * 5) = 70
    expect(applyFCurveModifier(50, mod, 5)).toBe(70);
  });

  it('evaluates entire modifier stack sequentially', () => {
    const limitsMod: LimitsFCurveModifier = {
      id: 'l1',
      type: 'limits',
      name: 'Limits',
      enabled: true,
      influence: 1.0,
      minY: 0,
      maxY: 50,
    };
    const genMod: GeneratorFCurveModifier = {
      id: 'g1',
      type: 'generator',
      name: 'Offset',
      enabled: true,
      influence: 1.0,
      coefficients: [10], // +10 offset
    };

    // Base value 60 -> clamped to 50 by limitsMod -> +10 by genMod -> 60
    const result = evaluateModifierStack(60, [limitsMod, genMod], 1);
    expect(result).toBe(60);
  });
});
