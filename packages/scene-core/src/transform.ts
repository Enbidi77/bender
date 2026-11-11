import * as THREE from 'three';
import type {
  Transform,
  Vector3,
  Euler,
  Quaternion,
  SceneNode,
} from '@blender-elt/contracts';

export type { Vector3, Euler, Quaternion, Transform };

export function createDefaultTransform(): Transform {
  return {
    position: { x: 0, y: 0, z: 0 },
    rotation: { x: 0, y: 0, z: 0, order: 'XYZ' },
    scale: { x: 1, y: 1, z: 1 },
  };
}

export function eulerToQuaternion(euler: Euler): Quaternion {
  const threeEuler = new THREE.Euler(
    euler.x,
    euler.y,
    euler.z,
    euler.order || 'XYZ',
  );
  const q = new THREE.Quaternion().setFromEuler(threeEuler);
  return { x: q.x, y: q.y, z: q.z, w: q.w };
}

export function quaternionToEuler(q: Quaternion, order: Euler['order'] = 'XYZ'): Euler {
  const threeQ = new THREE.Quaternion(q.x, q.y, q.z, q.w);
  const euler = new THREE.Euler().setFromQuaternion(threeQ, order);
  return { x: euler.x, y: euler.y, z: euler.z, order };
}

export function composeMatrix(transform: Transform): THREE.Matrix4 {
  const pos = new THREE.Vector3(
    transform.position.x,
    transform.position.y,
    transform.position.z,
  );
  const euler = new THREE.Euler(
    transform.rotation.x,
    transform.rotation.y,
    transform.rotation.z,
    transform.rotation.order || 'XYZ',
  );
  const rot = new THREE.Quaternion().setFromEuler(euler);
  const scale = new THREE.Vector3(
    transform.scale.x,
    transform.scale.y,
    transform.scale.z,
  );

  return new THREE.Matrix4().compose(pos, rot, scale);
}

export function decomposeMatrix(matrix: THREE.Matrix4, order: Euler['order'] = 'XYZ'): Transform {
  const pos = new THREE.Vector3();
  const rot = new THREE.Quaternion();
  const scale = new THREE.Vector3();

  matrix.decompose(pos, rot, scale);
  const euler = new THREE.Euler().setFromQuaternion(rot, order);

  return {
    position: { x: pos.x, y: pos.y, z: pos.z },
    rotation: { x: euler.x, y: euler.y, z: euler.z, order },
    scale: { x: scale.x, y: scale.y, z: scale.z },
  };
}

export function computeWorldMatrix(
  nodeId: string,
  nodes: Record<string, SceneNode>,
): THREE.Matrix4 {
  const node = nodes[nodeId];
  if (!node) {
    return new THREE.Matrix4().identity();
  }

  const localMatrix = composeMatrix(node.transform);

  if (node.parentId && node.parentId !== 'root' && nodes[node.parentId]) {
    const parentMatrix = computeWorldMatrix(node.parentId, nodes);
    return new THREE.Matrix4().multiplyMatrices(parentMatrix, localMatrix);
  }

  return localMatrix;
}

export function computeWorldTransform(
  nodeId: string,
  nodes: Record<string, SceneNode>,
): Transform {
  const worldMatrix = computeWorldMatrix(nodeId, nodes);
  const node = nodes[nodeId];
  const order = node?.transform.rotation.order || 'XYZ';
  return decomposeMatrix(worldMatrix, order);
}
