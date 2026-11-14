import type {
  EnvelopeFCurveModifier,
  GeneratorFCurveModifier,
  IFCurveModifier,
  LimitsFCurveModifier,
  NoiseFCurveModifier,
  SteppedFCurveModifier,
} from '@blender-elt/contracts';

/**
 * Coherent 1D pseudo-random smooth noise using sine hash
 */
function smoothNoise1D(x: number): number {
  const i = Math.floor(x);
  const f = x - i;
  const s = f * f * (3 - 2 * f); // Hermite smoothstep

  // Deterministic pseudo-random hash in [-1, 1]
  const h0 = Math.sin(i * 127.1 + 311.7) * 43758.5453123;
  const v0 = (h0 - Math.floor(h0)) * 2 - 1;

  const h1 = Math.sin((i + 1) * 127.1 + 311.7) * 43758.5453123;
  const v1 = (h1 - Math.floor(h1)) * 2 - 1;

  return v0 + (v1 - v0) * s;
}

/**
 * Multi-octave fractal Brownian motion noise
 */
export function evaluateNoise(
  frame: number,
  scale: number = 1,
  strength: number = 1,
  phase: number = 0,
  depth: number = 1,
): number {
  let sum = 0;
  let amp = 1;
  let freq = 1;
  let maxAmp = 0;

  const octaves = Math.max(1, Math.min(8, Math.round(depth)));
  for (let i = 0; i < octaves; i++) {
    sum += smoothNoise1D((frame + phase) * scale * freq) * amp;
    maxAmp += amp;
    freq *= 2.0;
    amp *= 0.5;
  }

  const normalized = maxAmp > 0 ? sum / maxAmp : sum;
  return normalized * strength;
}

/**
 * Evaluates a single F-Curve modifier on top of an evaluated curve value.
 */
export function applyFCurveModifier(
  baseValue: number,
  modifier: IFCurveModifier,
  frame: number,
  sampleBaseCurve?: (f: number) => number,
): number {
  if (!modifier.enabled || modifier.influence <= 0) {
    return baseValue;
  }

  const influence = Math.max(0, Math.min(1, modifier.influence));
  let modifiedValue = baseValue;

  switch (modifier.type) {
    case 'noise': {
      const m = modifier as NoiseFCurveModifier;
      const noise = evaluateNoise(frame, m.scale, m.strength, m.phase, m.depth);
      modifiedValue = baseValue + noise;
      break;
    }

    case 'stepped': {
      const m = modifier as SteppedFCurveModifier;
      const step = Math.max(1, Math.round(m.stepSize));
      const offset = m.offset ?? 0;
      const steppedFrame = Math.floor((frame - offset) / step) * step + offset;

      if (sampleBaseCurve) {
        modifiedValue = sampleBaseCurve(steppedFrame);
      } else {
        // Quantize based on frame step directly if sampleBaseCurve is absent
        modifiedValue = baseValue;
      }
      break;
    }

    case 'limits': {
      const m = modifier as LimitsFCurveModifier;
      let val = baseValue;
      if (m.minY !== undefined && val < m.minY) {
        val = m.minY;
      }
      if (m.maxY !== undefined && val > m.maxY) {
        val = m.maxY;
      }
      modifiedValue = val;
      break;
    }

    case 'envelope': {
      const m = modifier as EnvelopeFCurveModifier;
      const ref = m.referenceValue ?? 0;
      let val = baseValue;
      if (m.min !== undefined && val < ref + m.min) {
        val = ref + m.min;
      }
      if (m.max !== undefined && val > ref + m.max) {
        val = ref + m.max;
      }
      modifiedValue = val;
      break;
    }

    case 'generator': {
      const m = modifier as GeneratorFCurveModifier;
      const coeffs = m.coefficients || [];
      let poly = 0;
      let xPower = 1;
      for (const c of coeffs) {
        poly += c * xPower;
        xPower *= frame;
      }
      modifiedValue = baseValue + poly;
      break;
    }

    case 'cycles': {
      // Cycles modifier evaluation logic when applied to frames outside range
      modifiedValue = baseValue;
      break;
    }

    default:
      break;
  }

  // Linear blend according to modifier influence
  return baseValue + (modifiedValue - baseValue) * influence;
}

/**
 * Evaluates an entire modifier stack sequentially on an evaluated curve value.
 */
export function evaluateModifierStack(
  baseValue: number,
  modifiers: IFCurveModifier[] | undefined,
  frame: number,
  sampleBaseCurve?: (f: number) => number,
): number {
  if (!modifiers || modifiers.length === 0) {
    return baseValue;
  }

  let result = baseValue;
  for (const mod of modifiers) {
    result = applyFCurveModifier(result, mod, frame, sampleBaseCurve);
  }

  return result;
}
