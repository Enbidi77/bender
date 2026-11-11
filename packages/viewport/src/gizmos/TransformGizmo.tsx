import React, { useRef, useEffect, useSyncExternalStore } from 'react';
import { TransformControls } from '@react-three/drei';
import * as THREE from 'three';
import { useViewportContext } from '../context/ViewportContext.js';
import type { Transform } from '@blender-elt/contracts';

export const TransformGizmo: React.FC = () => {
  const { config, snapConfig, sceneStore, sceneObjectsRef, setIsGizmoDragging, commitTransform } =
    useViewportContext();

  const activeNodeId = useSyncExternalStore(
    sceneStore.subscribe,
    () => sceneStore.getState().activeNodeId,
  );

  const initialTransformRef = useRef<Transform | null>(null);
  const controlsRef = useRef<React.ComponentRef<typeof TransformControls> | null>(null);

  const targetObject = activeNodeId ? sceneObjectsRef.current.get(activeNodeId) : null;
  const activeNode = activeNodeId ? sceneStore.getState().nodes[activeNodeId] : null;

  // Listen to dragging-changed events from TransformControls
  useEffect(() => {
    const controls = controlsRef.current;
    if (!controls) return;

    interface DraggingEvent {
      value: boolean;
    }

    const handleDraggingChanged = (event: unknown) => {
      const isDragging = (event as DraggingEvent).value;
      setIsGizmoDragging(isDragging);

      if (!activeNodeId) return;

      if (isDragging) {
        // Drag start: cache starting transform
        const current = sceneStore.getState().nodes[activeNodeId]?.transform;
        if (current) {
          initialTransformRef.current = JSON.parse(JSON.stringify(current));
        } else if (targetObject) {
          initialTransformRef.current = {
            position: {
              x: targetObject.position.x,
              y: targetObject.position.y,
              z: targetObject.position.z,
            },
            rotation: {
              x: targetObject.rotation.x,
              y: targetObject.rotation.y,
              z: targetObject.rotation.z,
              order: 'XYZ',
            },
            scale: { x: targetObject.scale.x, y: targetObject.scale.y, z: targetObject.scale.z },
          };
        }
      } else {
        // Drag end: extract final transform and issue undoable command
        if (initialTransformRef.current && targetObject) {
          const rot = new THREE.Euler().setFromQuaternion(targetObject.quaternion, 'XYZ');
          const newTransform: Transform = {
            position: {
              x: Number(targetObject.position.x.toFixed(4)),
              y: Number(targetObject.position.y.toFixed(4)),
              z: Number(targetObject.position.z.toFixed(4)),
            },
            rotation: {
              x: Number(rot.x.toFixed(4)),
              y: Number(rot.y.toFixed(4)),
              z: Number(rot.z.toFixed(4)),
              order: 'XYZ',
            },
            scale: {
              x: Number(targetObject.scale.x.toFixed(4)),
              y: Number(targetObject.scale.y.toFixed(4)),
              z: Number(targetObject.scale.z.toFixed(4)),
            },
          };

          commitTransform(activeNodeId, initialTransformRef.current, newTransform);
          initialTransformRef.current = null;
        }
      }
    };

    (controls as any).addEventListener('dragging-changed', handleDraggingChanged);
    return () => {
      (controls as any).removeEventListener('dragging-changed', handleDraggingChanged);
    };
  }, [activeNodeId, targetObject, sceneStore, setIsGizmoDragging, commitTransform]);

  // If gizmo is set to 'none' or no active node, don't show gizmo
  if (config.gizmoType === 'none' || !activeNodeId || !targetObject) {
    return null;
  }

  if (!activeNode || activeNode.locked || !activeNode.visible) {
    return null;
  }

  return (
    <TransformControls
      ref={controlsRef}
      object={targetObject}
      mode={config.gizmoType}
      space={config.transformSpace}
      size={0.8}
      translationSnap={snapConfig.enabled ? snapConfig.translationSnap : undefined}
      rotationSnap={snapConfig.enabled ? snapConfig.rotationSnap : undefined}
      scaleSnap={snapConfig.enabled ? snapConfig.scaleSnap : undefined}
    />
  );
};
