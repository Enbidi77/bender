import React, { useMemo, useEffect, useRef, useSyncExternalStore } from 'react';
import * as THREE from 'three';
import type { ArmatureNode, IBone } from '@blender-elt/contracts';
import { useViewportContext } from '../context/ViewportContext.js';

export interface ArmatureVisualizerProps {
  /**
   * Optional specific armature node to visualize.
   * If omitted, visualizes all armature nodes found in sceneStore.
   */
  node?: ArmatureNode;
  armature?: ArmatureNode;
}

interface SingleBoneMeshProps {
  bone: IBone;
  armatureId: string;
  selected?: boolean;
}

/**
 * Creates an octahedral bone BufferGeometry oriented along +Y from (0,0,0) to (0, length, 0).
 */
export function createOctahedralBoneGeometry(length: number): THREE.BufferGeometry {
  const geom = new THREE.BufferGeometry();
  const safeLength = Math.max(length, 0.001);
  const waistY = safeLength * 0.15;
  const waistR = Math.max(safeLength * 0.08, 0.03);

  // 6 vertices of the octahedron:
  // 0: Head (0, 0, 0)
  // 1: Waist +X (waistR, waistY, 0)
  // 2: Waist +Z (0, waistY, waistR)
  // 3: Waist -X (-waistR, waistY, 0)
  // 4: Waist -Z (0, waistY, -waistR)
  // 5: Tail (0, safeLength, 0)
  const positions = new Float32Array([
    // Bottom 4 faces (Head -> Waist)
    // Face 1: 0 -> 1 -> 2
    0,
    0,
    0,
    waistR,
    waistY,
    0,
    0,
    waistY,
    waistR,
    // Face 2: 0 -> 2 -> 3
    0,
    0,
    0,
    0,
    waistY,
    waistR,
    -waistR,
    waistY,
    0,
    // Face 3: 0 -> 3 -> 4
    0,
    0,
    0,
    -waistR,
    waistY,
    0,
    0,
    waistY,
    -waistR,
    // Face 4: 0 -> 4 -> 1
    0,
    0,
    0,
    0,
    waistY,
    -waistR,
    waistR,
    waistY,
    0,

    // Top 4 faces (Tail -> Waist)
    // Face 5: 5 -> 2 -> 1
    0,
    safeLength,
    0,
    0,
    waistY,
    waistR,
    waistR,
    waistY,
    0,
    // Face 6: 5 -> 3 -> 2
    0,
    safeLength,
    0,
    -waistR,
    waistY,
    0,
    0,
    waistY,
    waistR,
    // Face 7: 5 -> 4 -> 3
    0,
    safeLength,
    0,
    0,
    waistY,
    -waistR,
    -waistR,
    waistY,
    0,
    // Face 8: 5 -> 1 -> 4
    0,
    safeLength,
    0,
    waistR,
    waistY,
    0,
    0,
    waistY,
    -waistR,
  ]);

  geom.setAttribute('position', new THREE.BufferAttribute(positions, 3));
  geom.computeVertexNormals();
  return geom;
}

/**
 * Visualizes a single bone in 3D space with joints and octahedral body
 */
const SingleBoneMesh: React.FC<SingleBoneMeshProps> = ({ bone, armatureId, selected = false }) => {
  const { handleNodeSelect, sceneObjectsRef } = useViewportContext();
  const groupRef = useRef<THREE.Group>(null);

  // Compute bone vector, length, and orientation
  const { length, orientation, headPos } = useMemo(() => {
    const head = new THREE.Vector3(bone.head.x, bone.head.y, bone.head.z);
    const tail = new THREE.Vector3(bone.tail.x, bone.tail.y, bone.tail.z);
    const dir = new THREE.Vector3().subVectors(tail, head);
    const len = dir.length();
    const safeLen = len > 0.0001 ? len : bone.length || 1.0;

    const up = new THREE.Vector3(0, 1, 0);
    const quat = new THREE.Quaternion();
    if (len > 0.0001) {
      quat.setFromUnitVectors(up, dir.clone().normalize());
    }

    // Apply roll rotation around local bone axis (+Y)
    if (bone.roll) {
      const rollQuat = new THREE.Quaternion().setFromAxisAngle(up, bone.roll);
      quat.multiply(rollQuat);
    }

    return {
      length: safeLen,
      orientation: quat,
      headPos: head,
    };
  }, [bone.head, bone.tail, bone.length, bone.roll]);

  // Bone octahedral body geometry
  const boneGeometry = useMemo(() => {
    return createOctahedralBoneGeometry(length);
  }, [length]);

  // Joint spheres
  const headRadius = useMemo(() => Math.max(length * 0.06, 0.03), [length]);
  const tailRadius = useMemo(() => Math.max(length * 0.04, 0.02), [length]);

  const headJointGeo = useMemo(() => new THREE.SphereGeometry(headRadius, 12, 8), [headRadius]);
  const tailJointGeo = useMemo(() => new THREE.SphereGeometry(tailRadius, 12, 8), [tailRadius]);

  // Edges geometry for Blender-style bone contour lines
  const wireGeometry = useMemo(() => {
    return new THREE.EdgesGeometry(boneGeometry);
  }, [boneGeometry]);

  // Register in sceneObjectsRef
  useEffect(() => {
    if (groupRef.current && sceneObjectsRef?.current) {
      const boneKey = `${armatureId}_bone_${bone.id}`;
      sceneObjectsRef.current.set(boneKey, groupRef.current);
      return () => {
        sceneObjectsRef.current.delete(boneKey);
      };
    }
  }, [bone.id, armatureId, sceneObjectsRef]);

  // Clean up geometries
  useEffect(() => {
    return () => {
      boneGeometry.dispose();
      headJointGeo.dispose();
      tailJointGeo.dispose();
      wireGeometry.dispose();
    };
  }, [boneGeometry, headJointGeo, tailJointGeo, wireGeometry]);

  // Colors: Blender bone yellow `#e6d690`, selected `#4772b3`
  const bodyColor = selected ? '#5588ee' : '#ded198';
  const jointColor = selected ? '#6699ff' : '#cfb972';

  const handleClick = (e: any) => {
    e.stopPropagation?.();
    handleNodeSelect(armatureId, e.shiftKey);
  };

  return (
    <group
      ref={groupRef}
      position={[headPos.x, headPos.y, headPos.z]}
      quaternion={orientation}
      onClick={handleClick}
    >
      {/* Octahedral Bone Mesh */}
      <mesh geometry={boneGeometry}>
        <meshStandardMaterial
          color={bodyColor}
          roughness={0.4}
          metalness={0.1}
          polygonOffset
          polygonOffsetFactor={1}
          polygonOffsetUnits={1}
        />
      </mesh>

      {/* Wireframe Outline */}
      <lineSegments geometry={wireGeometry}>
        <lineBasicMaterial color={selected ? '#ffffff' : '#444433'} linewidth={1} />
      </lineSegments>

      {/* Joint at Head */}
      <mesh geometry={headJointGeo} position={[0, 0, 0]}>
        <meshStandardMaterial color={jointColor} roughness={0.3} metalness={0.2} />
      </mesh>

      {/* Joint at Tail */}
      <mesh geometry={tailJointGeo} position={[0, length, 0]}>
        <meshStandardMaterial color={jointColor} roughness={0.3} metalness={0.2} />
      </mesh>
    </group>
  );
};

/**
 * ArmatureVisualizer: Renders bone chains and joints for an ArmatureNode.
 */
export const ArmatureVisualizer: React.FC<ArmatureVisualizerProps> = ({ node, armature }) => {
  const { sceneStore } = useViewportContext();
  const targetArmature = node ?? armature;

  // If a specific armature is passed, use it; otherwise subscribe to all armature nodes in scene
  const allNodes = useSyncExternalStore(sceneStore.subscribe, () => sceneStore.getState().nodes);
  const selectedNodeIds = useSyncExternalStore(
    sceneStore.subscribe,
    () => sceneStore.getState().selectedNodeIds,
  );

  const armaturesToRender = useMemo(() => {
    if (targetArmature) return [targetArmature];
    return Object.values(allNodes).filter((n): n is ArmatureNode => n.type === 'armature');
  }, [targetArmature, allNodes]);

  if (armaturesToRender.length === 0) {
    return null;
  }

  return (
    <group name="armature-visualizer-root">
      {armaturesToRender.map((arm) => {
        if (!arm.visible) return null;
        const isArmSelected = selectedNodeIds.includes(arm.id);
        const { position, rotation, scale } = arm.transform;

        return (
          <group
            key={arm.id}
            name={`armature-${arm.id}`}
            position={[position.x, position.y, position.z]}
            rotation={[rotation.x, rotation.y, rotation.z, rotation.order ?? 'XYZ']}
            scale={[scale.x, scale.y, scale.z]}
          >
            {Object.values(arm.bones || {}).map((bone) => (
              <SingleBoneMesh
                key={bone.id}
                bone={bone}
                armatureId={arm.id}
                selected={isArmSelected}
              />
            ))}
          </group>
        );
      })}
    </group>
  );
};
