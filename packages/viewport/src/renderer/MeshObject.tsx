import React, { useMemo, useEffect, useRef } from 'react';
import * as THREE from 'three';
import type { MeshNode, PrimitiveType, IMeshData } from '@blender-elt/contracts';
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

/**
 * Helper to safely set buffer update range across Three.js versions
 */
function setBufferUpdateRange(attr: THREE.BufferAttribute, offset: number, count: number): void {
  if (typeof attr.clearUpdateRanges === 'function' && typeof attr.addUpdateRange === 'function') {
    attr.clearUpdateRanges();
    if (count > 0) {
      attr.addUpdateRange(offset, count);
    }
  } else if ('updateRange' in (attr as unknown as Record<string, unknown>)) {
    const range = (attr as unknown as { updateRange: { offset: number; count: number } })
      .updateRange;
    range.offset = offset;
    range.count = count;
  }
}

/**
 * Apply mask weights to BufferGeometry color and sculptMask attributes in-place
 */
function applyMaskToGeometry(geometry: THREE.BufferGeometry, masks: Float32Array): void {
  const posAttr = geometry.getAttribute('position') as THREE.BufferAttribute;
  if (!posAttr) return;
  const vertexCount = posAttr.count;

  // 1. Scalar sculptMask attribute
  let maskAttr = geometry.getAttribute('sculptMask') as THREE.BufferAttribute;
  if (!maskAttr || maskAttr.count !== vertexCount) {
    maskAttr = new THREE.Float32BufferAttribute(new Float32Array(masks), 1);
    geometry.setAttribute('sculptMask', maskAttr);
  } else {
    maskAttr.set(masks);
    maskAttr.needsUpdate = true;
  }

  // 2. Vertex color grayscale overlay attribute
  let colorAttr = geometry.getAttribute('color') as THREE.BufferAttribute;
  if (!colorAttr || colorAttr.count !== vertexCount) {
    const colors = new Float32Array(vertexCount * 3);
    colorAttr = new THREE.Float32BufferAttribute(colors, 3);
    geometry.setAttribute('color', colorAttr);
  }
  const colors = colorAttr.array as Float32Array;
  for (let i = 0; i < vertexCount; i++) {
    const m = Math.max(0.0, Math.min(1.0, masks[i] ?? 0.0));
    // Grayscale shading: 0.0 => 1.0 (unmasked/white), 1.0 => 0.35 (dark grey mask)
    const val = 1.0 - 0.65 * m;
    colors[i * 3] = val;
    colors[i * 3 + 1] = val;
    colors[i * 3 + 2] = val * (1.0 - 0.05 * m);
  }
  colorAttr.needsUpdate = true;
}

export const MeshObject: React.FC<MeshObjectProps> = ({ node }) => {
  const { config, sceneObjectsRef, hoveredNodeId, setHoveredNodeId, handleNodeSelect } =
    useViewportContext();

  const meshRef = useRef<THREE.Mesh>(null);
  const geometryRef = useRef<THREE.BufferGeometry | null>(null);
  const lastPrimTypeRef = useRef<string | undefined>(node.primitiveType);

  // 1. Generate or resolve geometry with in-place buffer updating for sculpt mode
  const geometry = useMemo(() => {
    const customData =
      node.metadata && 'meshData' in node.metadata ? (node.metadata.meshData as IMeshData) : null;
    const primType = (node.primitiveType as PrimitiveType) || 'cube';

    // If existing geometry exists and can be updated in-place (same vertex count)
    if (geometryRef.current && customData && customData.vertices) {
      const posAttr = geometryRef.current.getAttribute('position') as
        THREE.BufferAttribute | undefined;
      const targetCount = Math.floor(customData.vertices.length / 3);

      if (
        posAttr &&
        posAttr.count === targetCount &&
        lastPrimTypeRef.current === node.primitiveType
      ) {
        // In-place buffer update without disposing BufferGeometry
        posAttr.set(customData.vertices as ArrayLike<number>);
        posAttr.needsUpdate = true;

        if (customData.normals) {
          const normAttr = geometryRef.current.getAttribute('normal') as
            THREE.BufferAttribute | undefined;
          if (normAttr && normAttr.count === targetCount) {
            normAttr.set(customData.normals as ArrayLike<number>);
            normAttr.needsUpdate = true;
          }
        } else {
          geometryRef.current.computeVertexNormals();
        }

        // Apply masks if present
        const masks =
          node.metadata &&
          'sculptMask' in node.metadata &&
          (node.metadata as any).sculptMask instanceof Float32Array
            ? ((node.metadata as any).sculptMask as Float32Array)
            : null;
        if (masks) {
          applyMaskToGeometry(geometryRef.current, masks);
        }

        geometryRef.current.computeBoundingSphere();
        geometryRef.current.computeBoundingBox();
        return geometryRef.current;
      }
    }

    // Otherwise, dispose old geometry and allocate new geometry
    if (geometryRef.current) {
      geometryRef.current.dispose();
      geometryRef.current = null;
    }

    let newGeo: THREE.BufferGeometry;
    if (customData) {
      try {
        newGeo = meshDataToBufferGeometry(customData);
      } catch (err) {
        console.warn(`Failed to build geometry from meshData for ${node.id}`, err);
        newGeo = createPrimitiveGeometry(primType);
      }
    } else {
      newGeo = createPrimitiveGeometry(primType);
    }

    // Initialize base vertex colors (all 1.0 white) for vertexColors compatibility
    if (!newGeo.getAttribute('color')) {
      const posAttr = newGeo.getAttribute('position');
      if (posAttr) {
        const colors = new Float32Array(posAttr.count * 3);
        colors.fill(1.0);
        newGeo.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3));
      }
    }

    // Apply masks if already stored in metadata
    const initialMasks =
      node.metadata &&
      'sculptMask' in node.metadata &&
      (node.metadata as any).sculptMask instanceof Float32Array
        ? ((node.metadata as any).sculptMask as Float32Array)
        : null;
    if (initialMasks) {
      applyMaskToGeometry(newGeo, initialMasks);
    }

    geometryRef.current = newGeo;
    lastPrimTypeRef.current = node.primitiveType;
    return newGeo;
  }, [node.primitiveType, node.metadata, node.id]);

  // Clean up geometry on unmount
  useEffect(() => {
    return () => {
      if (geometryRef.current) {
        geometryRef.current.dispose();
        geometryRef.current = null;
      }
    };
  }, []);

  // 2. Attach imperative in-place update handlers on the mesh for high-frequency sculpt strokes
  useEffect(() => {
    const mesh = meshRef.current;
    if (!mesh) return;

    mesh.userData.updateSculptBuffers = (
      positions: Float32Array,
      normals?: Float32Array | null,
      dirtyMin?: number,
      dirtyMax?: number,
      masks?: Float32Array | null,
    ) => {
      const geom = mesh.geometry;
      if (!geom) return;

      const posAttr = geom.getAttribute('position') as THREE.BufferAttribute;
      if (!posAttr) return;

      // In-place position update
      posAttr.set(positions);
      posAttr.needsUpdate = true;
      if (dirtyMin !== undefined && dirtyMax !== undefined && dirtyMin <= dirtyMax) {
        setBufferUpdateRange(posAttr, dirtyMin * 3, (dirtyMax - dirtyMin + 1) * 3);
      } else {
        setBufferUpdateRange(posAttr, 0, -1);
      }

      // In-place normal update
      if (normals) {
        const normAttr = geom.getAttribute('normal') as THREE.BufferAttribute;
        if (normAttr) {
          normAttr.set(normals);
          normAttr.needsUpdate = true;
          if (dirtyMin !== undefined && dirtyMax !== undefined && dirtyMin <= dirtyMax) {
            setBufferUpdateRange(normAttr, dirtyMin * 3, (dirtyMax - dirtyMin + 1) * 3);
          } else {
            setBufferUpdateRange(normAttr, 0, -1);
          }
        }
      }

      // In-place mask update
      if (masks) {
        applyMaskToGeometry(geom, masks);
      }

      geom.computeBoundingSphere();
    };

    return () => {
      delete mesh.userData.updateSculptBuffers;
    };
  }, [geometry]);

  // 3. Resolve material based on shadingMode and node material config
  const material = useMemo(() => {
    const { shadingMode } = config;

    let pbrConfig: PBRMaterialConfig = MATERIAL_PRESETS['default-clay'];
    if (node.metadata && 'materialConfig' in node.metadata && node.metadata.materialConfig) {
      pbrConfig = node.metadata.materialConfig as PBRMaterialConfig;
    } else if (node.materialId && node.materialId in MATERIAL_PRESETS) {
      pbrConfig = MATERIAL_PRESETS[node.materialId as keyof typeof MATERIAL_PRESETS];
    }

    const mat = createThreeMaterial(pbrConfig, shadingMode);
    // Enable vertex colors for sculpt mask overlay
    if (mat instanceof THREE.Material) {
      mat.vertexColors = true;
    }
    return mat;
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

  // 4. Register with sceneObjectsRef for camera navigation & gizmo
  useEffect(() => {
    if (meshRef.current) {
      sceneObjectsRef.current.set(node.id, meshRef.current);
    }
    return () => {
      sceneObjectsRef.current.delete(node.id);
    };
  }, [node.id, sceneObjectsRef]);

  // 5. Transform attributes
  const { position, rotation, scale } = node.transform;
  const isHovered = hoveredNodeId === node.id;

  // 6. Wireframe overlay geometry if requested (suppressed during sculpt to preserve 60fps)
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
