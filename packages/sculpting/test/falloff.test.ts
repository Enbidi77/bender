import { describe, it, expect } from 'vitest';
import { computeFalloff, calculateEffectiveFactor } from '../src/brushes/brush-kernel.js';
import type { BrushFalloffType } from '@blender-elt/contracts';

describe('Brush Kernel Falloff Invariants', () => {
  const profiles: BrushFalloffType[] = ['smooth', 'sphere', 'constant', 'sharp', 'linear'];
  const radius = 2.0;

  it.each(profiles)('profile "%s" evaluates to 1.0 at center (dist=0)', (profile) => {
    const val = computeFalloff(0, radius, profile);
    expect(val).toBeCloseTo(1.0, 5);
  });

  it.each(profiles)('profile "%s" evaluates to 0.0 at perimeter (dist=radius)', (profile) => {
    const val = computeFalloff(radius, radius, profile);
    expect(val).toBeCloseTo(0.0, 5);
  });

  it.each(profiles)(
    'profile "%s" evaluates to 0.0 outside perimeter (dist > radius)',
    (profile) => {
      const val = computeFalloff(radius * 1.5, radius, profile);
      expect(val).toBe(0.0);
    },
  );

  it.each(profiles)('profile "%s" strictly stays within [0.0, 1.0] for all samples', (profile) => {
    for (let d = 0; d <= radius; d += 0.1) {
      const val = computeFalloff(d, radius, profile);
      expect(val).toBeGreaterThanOrEqual(0.0);
      expect(val).toBeLessThanOrEqual(1.0);
    }
  });

  it('smooth, sharp, linear, and sphere are monotonically decreasing', () => {
    const monotonicProfiles: BrushFalloffType[] = ['smooth', 'sphere', 'sharp', 'linear'];
    for (const profile of monotonicProfiles) {
      let prev = 1.0;
      for (let d = 0.1; d <= radius; d += 0.2) {
        const val = computeFalloff(d, radius, profile);
        expect(val).toBeLessThanOrEqual(prev);
        prev = val;
      }
    }
  });

  it('sharp profile drops faster than linear and smooth at mid-radius', () => {
    const dMid = radius * 0.5;
    const sharpVal = computeFalloff(dMid, radius, 'sharp');
    const linearVal = computeFalloff(dMid, radius, 'linear');
    const smoothVal = computeFalloff(dMid, radius, 'smooth');

    expect(sharpVal).toBeLessThan(linearVal);
    expect(sharpVal).toBeLessThan(smoothVal);
  });

  it('calculateEffectiveFactor obeys mask protection invariants', () => {
    const falloff = 0.8;
    const strength = 0.5;

    // Mask = 0.0 -> 100% deformation
    const unmasked = calculateEffectiveFactor(falloff, strength, 0.0);
    expect(unmasked).toBeCloseTo(0.4, 5);

    // Mask = 1.0 -> 0% deformation (locked)
    const fullyProtected = calculateEffectiveFactor(falloff, strength, 1.0);
    expect(fullyProtected).toBe(0.0);

    // Mask = 0.5 -> 50% deformation
    const halfProtected = calculateEffectiveFactor(falloff, strength, 0.5);
    expect(halfProtected).toBeCloseTo(0.2, 5);
  });
});
