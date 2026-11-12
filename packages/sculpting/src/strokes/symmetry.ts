import * as THREE from 'three';
import type { SculptStrokePoint, SymmetryConfig } from '@blender-elt/contracts';

/**
 * Computes all symmetric echo points for a given primary stroke point.
 * Supports arbitrary combinations of X, Y, Z reflection and radial replication.
 */
export function getSymmetricPoints(
  primary: SculptStrokePoint,
  symmetry: SymmetryConfig,
): SculptStrokePoint[] {
  const echoes: SculptStrokePoint[] = [];

  const xFlags = symmetry.x ? [false, true] : [false];
  const yFlags = symmetry.y ? [false, true] : [false];
  const zFlags = symmetry.z ? [false, true] : [false];

  for (const flipX of xFlags) {
    for (const flipY of yFlags) {
      for (const flipZ of zFlags) {
        if (!flipX && !flipY && !flipZ) continue; // skip primary identity

        const echoPoint: SculptStrokePoint = {
          point: {
            x: flipX ? -primary.point.x : primary.point.x,
            y: flipY ? -primary.point.y : primary.point.y,
            z: flipZ ? -primary.point.z : primary.point.z,
          },
          normal: {
            x: flipX ? -primary.normal.x : primary.normal.x,
            y: flipY ? -primary.normal.y : primary.normal.y,
            z: flipZ ? -primary.normal.z : primary.normal.z,
          },
          pressure: primary.pressure,
          timestamp: primary.timestamp,
        };

        echoes.push(echoPoint);
      }
    }
  }

  // Radial symmetry evaluation
  if (symmetry.radial && symmetry.radial.count > 1) {
    const count = Math.min(64, Math.max(2, symmetry.radial.count));
    const axisVec = new THREE.Vector3(
      symmetry.radial.axis === 'x' ? 1 : 0,
      symmetry.radial.axis === 'y' ? 1 : 0,
      symmetry.radial.axis === 'z' ? 1 : 0,
    );

    const basePos = new THREE.Vector3(primary.point.x, primary.point.y, primary.point.z);
    const baseNorm = new THREE.Vector3(primary.normal.x, primary.normal.y, primary.normal.z);

    for (let i = 1; i < count; i++) {
      const angle = (2 * Math.PI * i) / count;
      const rotPos = basePos.clone().applyAxisAngle(axisVec, angle);
      const rotNorm = baseNorm.clone().applyAxisAngle(axisVec, angle);

      echoes.push({
        point: { x: rotPos.x, y: rotPos.y, z: rotPos.z },
        normal: { x: rotNorm.x, y: rotNorm.y, z: rotNorm.z },
        pressure: primary.pressure,
        timestamp: primary.timestamp,
      });
    }
  }

  return echoes;
}
