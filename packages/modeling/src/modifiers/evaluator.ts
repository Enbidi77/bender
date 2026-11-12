import type {
  IMeshData,
  ModifierConfig,
  IModifierEvaluator,
  ModifierEvaluationResult,
} from '@blender-elt/contracts';
import { MeshTopology } from '../topology/mesh-topology.js';
import { evaluateArrayModifier } from './array.js';
import { evaluateMirrorModifier } from './mirror.js';
import { evaluateSolidifyModifier } from './solidify.js';
import { evaluateWireframeModifier } from './wireframe.js';
import { evaluateSubdivideModifier } from './subdivide.js';
import { evaluateSmoothModifier } from './smooth.js';

/**
 * ModifierStackEvaluator executes an ordered stack of procedural modifiers on mesh geometry
 */
export class ModifierStackEvaluator implements IModifierEvaluator {
  public evaluate(
    sourceGeometry: IMeshData,
    modifiers: ModifierConfig[],
  ): ModifierEvaluationResult {
    const startTime = performance.now();

    // Filter enabled viewport modifiers and sort by order
    const activeModifiers = modifiers
      .filter((m) => m.enabled && m.showInViewport)
      .sort((a, b) => a.order - b.order);

    if (activeModifiers.length === 0) {
      return {
        geometry: sourceGeometry,
        appliedModifierIds: [],
        durationMs: performance.now() - startTime,
      };
    }

    let topology = MeshTopology.fromMeshData(sourceGeometry);
    const appliedModifierIds: string[] = [];

    for (const mod of activeModifiers) {
      switch (mod.type) {
        case 'array':
          topology = evaluateArrayModifier(topology, mod);
          appliedModifierIds.push(mod.id);
          break;

        case 'mirror':
          topology = evaluateMirrorModifier(topology, mod);
          appliedModifierIds.push(mod.id);
          break;

        case 'solidify':
          topology = evaluateSolidifyModifier(topology, mod);
          appliedModifierIds.push(mod.id);
          break;

        case 'wireframe':
          topology = evaluateWireframeModifier(topology, mod);
          appliedModifierIds.push(mod.id);
          break;

        case 'subdivision':
          topology = evaluateSubdivideModifier(topology, mod);
          appliedModifierIds.push(mod.id);
          break;

        case 'smooth':
          topology = evaluateSmoothModifier(topology, mod);
          appliedModifierIds.push(mod.id);
          break;

        default:
          // Other modifier types pass through safely until implemented
          break;
      }
    }

    const outputGeometry = topology.toMeshData();
    const durationMs = performance.now() - startTime;

    return {
      geometry: outputGeometry,
      appliedModifierIds,
      durationMs,
    };
  }
}
