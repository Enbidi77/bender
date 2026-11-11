import React, { useMemo, useEffect, useRef } from 'react';
import * as THREE from 'three';
import type { MeshNode, PrimitiveType } from '@blender-elt/contracts';
import { useViewportContext } from '../context/ViewportContext.js';
import { createPrimitiveGeometry, meshDataToBufferGeometry } from '@blender-elt/modeling';
import {
  createThreeMaterial,
  MATERIAL_PRESETS,
  type PBRMaterialConfig,
} from '@blender-elt/materials';

export interface MeshObjectProps {
  node: MeshNode;
}

export const MeshObject: React.FC<MeshObjectProps> = ({ node }) => {
  const { config, sceneObjectsRef, hoveredNodeId, setHoveredNodeId, handleNodeSelect } =
    useViewportContext();

  const meshRef = useRef<THREE.Mesh>(null);

  // 1. Generate or resolve geometry
  const geometry = useMemo(() => {
    // Check if custom mesh data is embedded in node metadata
    if (node.metadata && 'meshData' in node.metadata && node.metadata.meshData) {
      try {
        return meshDataToBufferGeometry(
          node.metadata.meshData as import('@blender-elt/contracts').IMeshData,
        );
      } catch (err) {
        console.warn(`Failed to build geometry from meshData for ${node.id}`, err);
      }
    }

    // Primitive geometry by type
    const primType = (node.primitiveType as PrimitiveType) || 'cube';
    return createPrimitiveGeometry(primType);
  }, [node.primitiveType, node.metadata]);

  // Clean up geometry on unmount or change
  useEffect(() => {
    return () => {
      geometry.dispose();
    };
  }, [geometry]);

  // 2. Resolve material based on shadingMode and node material config
  const material = useMemo(() => {
    const { shadingMode } = config;

    let pbrConfig: PBRMaterialConfig = MATERIAL_PRESETS['default-clay'];
    if (node.metadata && 'materialConfig' in node.metadata && node.metadata.materialConfig) {
      pbrConfig = node.metadata.materialConfig as PBRMaterialConfig;
    } else if (node.materialId && node.materialId in MATERIAL_PRESETS) {
      pbrConfig = MATERIAL_PRESETS[node.materialId as keyof typeof MATERIAL_PRESETS];
    }

    return createThreeMaterial(pbrConfig, shadingMode);
  }, [config.shadingMode, node.materialId, node.metadata]);

  // Clean up material on unmount or change
  useEffect(() => {
    return () => {
      if (Array.isArray(material)) {
        material.forEach((m) => m.dispose());
      } else {
        material.dispose();
      }
    };
  }, [material]);

  // 3. Register with sceneObjectsRef for camera navigation & gizmo
  useEffect(() => {
    if (meshRef.current) {
      sceneObjectsRef.current.set(node.id, meshRef.current);
    }
    return () => {
      sceneObjectsRef.current.delete(node.id);
    };
  }, [node.id, sceneObjectsRef]);

  // 4. Transform attributes
  const { position, rotation, scale } = node.transform;
  const isHovered = hoveredNodeId === node.id;

  // 5. Wireframe overlay geometry if requested
  const wireframeGeo = useMemo(() => {
    if (!config.showWireframeOverlay || config.shadingMode === 'wireframe') {
      return null;
    }
    return new THREE.WireframeGeometry(geometry);
  }, [geometry, config.showWireframeOverlay, config.shadingMode]);

  useEffect(() => {
    return () => {
      wireframeGeo?.dispose();
    };
  }, [wireframeGeo]);

  if (!node.visible) {
    return null;
  }

  return (
    <group
      name={`node-group-${node.id}`}
      position={[position.x, position.y, position.z]}
      rotation={[rotation.x, rotation.y, rotation.z, rotation.order ?? 'XYZ']}
      scale={[scale.x, scale.y, scale.z]}
    >
      <mesh
        ref={meshRef}
        name={node.id}
        geometry={geometry}
        material={material}
        castShadow={node.castShadow ?? true}
        receiveShadow={node.receiveShadow ?? true}
        onClick={(e) => {
          e.stopPropagation();
          handleNodeSelect(node.id, e.shiftKey);
        }}
        onPointerOver={(e) => {
          e.stopPropagation();
          setHoveredNodeId(node.id);
        }}
        onPointerOut={() => {
          if (hoveredNodeId === node.id) {
            setHoveredNodeId(null);
          }
        }}
      />

      {/* Wireframe overlay */}
      {wireframeGeo && (
        <lineSegments geometry={wireframeGeo}>
          <lineBasicMaterial color="#4fc3f7" opacity={0.35} transparent depthTest={true} />
        </lineSegments>
      )}

      {/* Hover outline hint */}
      {isHovered && (
        <lineSegments geometry={new THREE.WireframeGeometry(geometry)}>
          <lineBasicMaterial color="#ffffff" opacity={0.5} transparent />
        </lineSegments>
      )}
    </group>
  );
};
