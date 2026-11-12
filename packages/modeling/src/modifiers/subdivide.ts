import type { SubdivisionModifier } from '@blender-elt/contracts';
import { MeshTopology } from '../topology/mesh-topology.js';
import { evaluateSmoothModifier } from './smooth.js';

/**
 * Evaluates the Subdivision Surface Modifier on a MeshTopology
 */
export function evaluateSubdivideModifier(
  topology: MeshTopology,
  modifier: SubdivisionModifier,
): MeshTopology {
  let result = topology.clone();
  const levels = Math.min(Math.max(modifier.levels, 0), 4); // Clamp levels to reasonable budget

  if (levels === 0) {
    return result;
  }

  result.subdivide(levels);

  if (modifier.algorithm === 'catmull-clark') {
    // Catmull-Clark rounding smoothing pass
    result = evaluateSmoothModifier(result, {
      id: 'internal-subdiv-smooth',
      name: 'Catmull-Clark Smooth',
      type: 'smooth',
      enabled: true,
      showInViewport: true,
      showInRender: true,
      order: 0,
      factor: 0.35,
      repeat: levels,
    });
  }

  return result;
}
