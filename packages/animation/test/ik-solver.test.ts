import { describe, it, expect } from 'vitest';
import { solveTwoBoneIK, solveFABRIK, vDist, vDot, vSub } from '../src/ik-solver.js';
import type { Vector3 } from '@blender-elt/contracts';

describe('Inverse Kinematics (IK) Solvers', () => {
  describe('2-Bone Analytical IK Solver (Law of Cosines)', () => {
    it('solves 2-bone joint angles reaching target with exact bone lengths preserved', () => {
      const root: Vector3 = { x: 0, y: 0, z: 0 };
      const joint: Vector3 = { x: 0, y: 5, z: 0 }; // length 5
      const end: Vector3 = { x: 0, y: 10, z: 0 }; // length 5
      const target: Vector3 = { x: 4, y: 6, z: 0 }; // distance = sqrt(16 + 36) = sqrt(52) ~ 7.21 < 10
      const poleTarget: Vector3 = { x: -5, y: 5, z: 0 }; // bend toward -X

      const result = solveTwoBoneIK({ root, joint, end, target, poleTarget });

      expect(result.reached).toBe(true);

      // End effector should match target exactly
      expect(result.end.x).toBeCloseTo(target.x, 3);
      expect(result.end.y).toBeCloseTo(target.y, 3);
      expect(result.end.z).toBeCloseTo(target.z, 3);

      // Bone lengths must be strictly preserved
      const len1 = vDist(result.root, result.joint);
      const len2 = vDist(result.joint, result.end);
      expect(len1).toBeCloseTo(5, 3);
      expect(len2).toBeCloseTo(5, 3);
    });

    it('handles unreachable targets by stretching fully toward target direction', () => {
      const root: Vector3 = { x: 0, y: 0, z: 0 };
      const joint: Vector3 = { x: 0, y: 5, z: 0 }; // L1 = 5
      const end: Vector3 = { x: 0, y: 10, z: 0 }; // L2 = 5
      const target: Vector3 = { x: 0, y: 20, z: 0 }; // Distance = 20 > 10 (unreachable)

      const result = solveTwoBoneIK({ root, joint, end, target });

      expect(result.reached).toBe(false);

      // Should be extended along direction to target (0, 1, 0)
      expect(result.joint.x).toBeCloseTo(0, 3);
      expect(result.joint.y).toBeCloseTo(5, 3);
      expect(result.end.y).toBeCloseTo(10, 3);

      // Total reach should be max length (10)
      expect(vDist(result.root, result.end)).toBeCloseTo(10, 3);
    });

    it('handles target closer than minimum fold distance', () => {
      const root: Vector3 = { x: 0, y: 0, z: 0 };
      const joint: Vector3 = { x: 0, y: 8, z: 0 }; // L1 = 8
      const end: Vector3 = { x: 0, y: 10, z: 0 }; // L2 = 2, min reach = |8 - 2| = 6
      const target: Vector3 = { x: 0, y: 2, z: 0 }; // Distance = 2 < 6 (too close)

      const result = solveTwoBoneIK({ root, joint, end, target });

      expect(result.reached).toBe(false);
      expect(vDist(result.root, result.end)).toBeCloseTo(6, 3);
    });

    it('orients joint bending plane toward pole target', () => {
      const root: Vector3 = { x: 0, y: 0, z: 0 };
      const joint: Vector3 = { x: 0, y: 5, z: 0 };
      const end: Vector3 = { x: 0, y: 10, z: 0 };
      const target: Vector3 = { x: 0, y: 7, z: 0 };

      // Pole target in +Z direction
      const poleZ: Vector3 = { x: 0, y: 5, z: 10 };
      const resultZ = solveTwoBoneIK({ root, joint, end, target, poleTarget: poleZ });

      // Joint should bend into +Z
      expect(resultZ.joint.z).toBeGreaterThan(0);

      // Pole target in -Z direction
      const poleNegZ: Vector3 = { x: 0, y: 5, z: -10 };
      const resultNegZ = solveTwoBoneIK({ root, joint, end, target, poleTarget: poleNegZ });

      // Joint should bend into -Z
      expect(resultNegZ.joint.z).toBeLessThan(0);
    });
  });

  describe('FABRIK Solver (N-Bone Chains)', () => {
    it('solves 3-bone chain reaching target position within tolerance', () => {
      const joints: Vector3[] = [
        { x: 0, y: 0, z: 0 },
        { x: 0, y: 4, z: 0 },
        { x: 0, y: 8, z: 0 },
        { x: 0, y: 12, z: 0 },
      ]; // 3 segments of length 4, total reach = 12
      const target: Vector3 = { x: 5, y: 7, z: 0 }; // Dist ~ 8.6 < 12

      const result = solveFABRIK({ joints, target, tolerance: 1e-3, maxIterations: 25 });

      expect(result.reached).toBe(true);

      const endJoint = result.joints[result.joints.length - 1];
      expect(vDist(endJoint, target)).toBeLessThanOrEqual(1e-3);

      // Root position must remain anchored at (0, 0, 0)
      expect(result.joints[0].x).toBeCloseTo(0, 3);
      expect(result.joints[0].y).toBeCloseTo(0, 3);
      expect(result.joints[0].z).toBeCloseTo(0, 3);

      // All segment lengths must remain equal to 4
      for (let i = 0; i < result.joints.length - 1; i++) {
        expect(vDist(result.joints[i], result.joints[i + 1])).toBeCloseTo(4, 2);
      }
    });

    it('stretches fully toward target when target is beyond total reach', () => {
      const joints: Vector3[] = [
        { x: 0, y: 0, z: 0 },
        { x: 0, y: 5, z: 0 },
        { x: 0, y: 10, z: 0 },
      ]; // total length = 10
      const target: Vector3 = { x: 30, y: 0, z: 0 }; // distance = 30 > 10

      const result = solveFABRIK({ joints, target });

      expect(result.reached).toBe(false);
      const endJoint = result.joints[result.joints.length - 1];
      expect(vDist(result.joints[0], endJoint)).toBeCloseTo(10, 3);
      // Direction should be pointing along +X
      expect(endJoint.x).toBeCloseTo(10, 3);
      expect(endJoint.y).toBeCloseTo(0, 3);
    });
  });
});
