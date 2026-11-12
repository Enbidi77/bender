/**
 * Stylus / Pen pressure normalization and response curves.
 */
export function normalizePressure(rawPressure: number, pointerType: string = 'mouse'): number {
  if (pointerType === 'mouse') {
    return 1.0;
  }
  if (rawPressure <= 0.0) {
    return 0.5; // fallback for pens reporting 0 pressure on touch
  }
  return Math.max(0.01, Math.min(1.0, rawPressure));
}

/**
 * Applies pressure dynamic modulation to radius and strength with smooth response curve.
 */
export function applyPressureDynamics(
  baseRadius: number,
  baseStrength: number,
  pressure: number,
  affectsRadius: boolean = true,
  affectsStrength: boolean = true,
): { radius: number; strength: number } {
  const p = Math.max(0.05, Math.min(1.0, pressure));
  // Smooth cubic response curve
  const response = p * p * (3.0 - 2.0 * p);

  return {
    radius: affectsRadius ? baseRadius * (0.2 + 0.8 * response) : baseRadius,
    strength: affectsStrength ? baseStrength * (0.1 + 0.9 * response) : baseStrength,
  };
}
