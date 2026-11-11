import React, { useSyncExternalStore, useMemo } from 'react';
import * as THREE from 'three';
import { useViewportContext } from '../context/ViewportContext.js';
import { VIEWPORT_COLORS } from '../constants.js';

interface HighlightBoxProps {
  nodeId: string;
  isActive: boolean;
}

const HighlightBox: React.FC<HighlightBoxProps> = ({ nodeId, isActive }) => {
  const { sceneObjectsRef } = useViewportContext();
  const obj = sceneObjectsRef.current.get(nodeId);

  const boxGeo = useMemo(() => {
    if (!obj) return null;
    const box = new THREE.Box3().setFromObject(obj);
    if (box.isEmpty()) return null;

    const size = new THREE.Vector3();
    const center = new THREE.Vector3();
    box.getSize(size);
    box.getCenter(center);

    // Expand slightly so it frames object cleanly
    const pad = Math.max(0.04, Math.min(size.x, size.y, size.z) * 0.05);
    const paddedSize = new THREE.Vector3(size.x + pad, size.y + pad, size.z + pad);

    const geo = new THREE.BoxGeometry(paddedSize.x, paddedSize.y, paddedSize.z);
    return {
      geo: new THREE.WireframeGeometry(geo),
      center,
    };
  }, [obj]);

  if (!boxGeo) return null;

  return (
    <group position={[boxGeo.center.x, boxGeo.center.y, boxGeo.center.z]}>
      <lineSegments geometry={boxGeo.geo}>
        <lineBasicMaterial
          color={isActive ? VIEWPORT_COLORS.selectionPrimary : VIEWPORT_COLORS.selectionSecondary}
          transparent
          opacity={isActive ? 0.9 : 0.65}
          depthTest={false}
        />
      </lineSegments>
    </group>
  );
};

export const SelectionHighlight: React.FC = () => {
  const { sceneStore } = useViewportContext();

  const selectedNodeIds = useSyncExternalStore(
    sceneStore.subscribe,
    () => sceneStore.getState().selectedNodeIds,
  );

  const activeNodeId = useSyncExternalStore(
    sceneStore.subscribe,
    () => sceneStore.getState().activeNodeId,
  );

  if (!selectedNodeIds || selectedNodeIds.length === 0) {
    return null;
  }

  return (
    <group name="selection-highlights">
      {selectedNodeIds.map((id) => (
        <HighlightBox key={id} nodeId={id} isActive={id === activeNodeId} />
      ))}
    </group>
  );
};
