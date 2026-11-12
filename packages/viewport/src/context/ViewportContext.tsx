import React, {
  createContext,
  useContext,
  useState,
  useEffect,
  useMemo,
  useRef,
  useCallback,
} from 'react';
import type { StoreApi } from 'zustand/vanilla';
import type { OrbitControls } from '@react-three/drei';
import * as THREE from 'three';
import type {
  ViewportConfig,
  SnapConfig,
  StandardViewpoint,
  CameraProjection,
  ViewportState,
  ViewportProps,
  Transform,
  GizmoType,
  TransformSpace,
  ShadingMode,
  ViewportMode,
  AxisLock,
} from '../types.js';
import { DEFAULT_VIEWPORT_CONFIG, DEFAULT_SNAP_CONFIG } from '../constants.js';
import {
  createSceneStore,
  createSelectionStore,
  type SceneGraphState,
  type SelectionStoreState,
} from '@blender-elt/scene-core';
import { CommandManager } from '@blender-elt/commands';
import { TransformObjectCommand } from '../commands/transform-command.js';

export type OrbitControlsInstance = React.ComponentRef<typeof OrbitControls>;

export interface ViewportContextValue extends ViewportState {
  sceneStore: StoreApi<SceneGraphState>;
  selectionStore: StoreApi<SelectionStoreState>;
  commandManager?: CommandManager;
  orbitControlsRef: React.MutableRefObject<OrbitControlsInstance | null>;
  cameraRef: React.MutableRefObject<THREE.Camera | null>;
  sceneObjectsRef: React.MutableRefObject<Map<string, THREE.Object3D>>;
  focusOnNode: (nodeId?: string | null) => void;
  focusOnBox: (box: THREE.Box3) => void;
  commitTransform: (nodeId: string, oldTransform: Transform, newTransform: Transform) => void;
  handleNodeSelect: (nodeId: string | null, multi?: boolean) => void;
}

const ViewportContext = createContext<ViewportContextValue | null>(null);

export interface ViewportProviderProps extends ViewportProps {
  children: React.ReactNode;
}

export const ViewportProvider: React.FC<ViewportProviderProps> = ({
  sceneStore: externalSceneStore,
  selectionStore: externalSelectionStore,
  commandManager: externalCommandManager,
  config: initialConfig,
  snapConfig: initialSnapConfig,
  cameraProjection: controlledProjection,
  showToolbar = true,
  showOverlays = true,
  showStats = false,
  show3DCursor: initialShow3DCursor = true,
  axisLock: initialAxisLock = null,
  onTransformCommit,
  onSelectNode,
  onConfigChange,
  onAxisLockChange,
  children,
}) => {
  // 1. Fallback scene store, selection store, and command manager if not provided
  const internalSceneStoreRef = useRef<StoreApi<SceneGraphState> | null>(null);
  if (!externalSceneStore && !internalSceneStoreRef.current) {
    internalSceneStoreRef.current = createSceneStore();
  }
  const sceneStore = externalSceneStore ?? internalSceneStoreRef.current!;

  const internalSelectionStoreRef = useRef<StoreApi<SelectionStoreState> | null>(null);
  if (!externalSelectionStore && !internalSelectionStoreRef.current) {
    internalSelectionStoreRef.current = createSelectionStore();
  }
  const selectionStore = externalSelectionStore ?? internalSelectionStoreRef.current!;

  const internalCommandManagerRef = useRef<CommandManager | null>(null);
  if (!externalCommandManager && !internalCommandManagerRef.current) {
    internalCommandManagerRef.current = new CommandManager();
  }
  const commandManager = externalCommandManager ?? internalCommandManagerRef.current!;

  // 2. Viewport Configuration State
  const [config, setConfigState] = useState<ViewportConfig>(() => ({
    ...DEFAULT_VIEWPORT_CONFIG,
    ...initialConfig,
    grid: {
      ...DEFAULT_VIEWPORT_CONFIG.grid,
      ...(initialConfig?.grid ?? {}),
    },
  }));

  const [snapConfig, setSnapConfigState] = useState<SnapConfig>(() => ({
    ...DEFAULT_SNAP_CONFIG,
    ...initialSnapConfig,
  }));

  const [cameraProjection, setCameraProjectionState] = useState<CameraProjection>(
    controlledProjection ?? 'perspective',
  );

  useEffect(() => {
    if (controlledProjection) {
      setCameraProjectionState(controlledProjection);
    }
  }, [controlledProjection]);

  const [activeViewpoint, setActiveViewpoint] = useState<StandardViewpoint>('perspective');
  const [isGizmoDragging, setIsGizmoDragging] = useState<boolean>(false);
  const [axisLock, setAxisLockState] = useState<AxisLock>(initialAxisLock ?? null);
  const [hoveredNodeId, setHoveredNodeId] = useState<string | null>(null);
  const [statsVisible, setShowStats] = useState<boolean>(showStats);
  const [toolbarVisible, setShowToolbar] = useState<boolean>(showToolbar);
  const [overlaysVisible, setShowOverlays] = useState<boolean>(showOverlays);
  const [cursorVisible, setShow3DCursor] = useState<boolean>(initialShow3DCursor);
  const [activeCameraId, setActiveCameraId] = useState<string | null>(null);

  const setAxisLock = useCallback(
    (axis: AxisLock) => {
      setAxisLockState(axis);
      onAxisLockChange?.(axis);
    },
    [onAxisLockChange],
  );

  const toggleAxisLock = useCallback(
    (axis: 'X' | 'Y' | 'Z') => {
      setAxisLockState((prev) => {
        const next = prev === axis ? null : axis;
        onAxisLockChange?.(next);
        return next;
      });
    },
    [onAxisLockChange],
  );

  // 3. Object refs for imperative camera navigation & focus
  const orbitControlsRef = useRef<OrbitControlsInstance | null>(null);
  const cameraRef = useRef<THREE.Camera | null>(null);
  const sceneObjectsRef = useRef<Map<string, THREE.Object3D>>(new Map());

  // 4. Action Dispatchers
  const setConfig = useCallback(
    (newConfig: Partial<ViewportConfig>) => {
      setConfigState((prev) => {
        const next = { ...prev, ...newConfig };
        onConfigChange?.(next);
        return next;
      });
    },
    [onConfigChange],
  );

  const setMode = useCallback(
    (mode: ViewportMode) => {
      setConfig({ mode });
    },
    [setConfig],
  );

  const setGizmoType = useCallback(
    (gizmoType: GizmoType) => {
      setConfig({ gizmoType });
    },
    [setConfig],
  );

  const setTransformSpace = useCallback(
    (transformSpace: TransformSpace) => {
      setConfig({ transformSpace });
    },
    [setConfig],
  );

  const setShadingMode = useCallback(
    (shadingMode: ShadingMode) => {
      setConfig({ shadingMode });
    },
    [setConfig],
  );

  const setSnapConfig = useCallback((updates: Partial<SnapConfig>) => {
    setSnapConfigState((prev) => ({ ...prev, ...updates }));
  }, []);

  const toggleSnapping = useCallback(() => {
    setSnapConfigState((prev) => ({ ...prev, enabled: !prev.enabled }));
  }, []);

  const setCameraProjection = useCallback((proj: CameraProjection) => {
    setCameraProjectionState(proj);
  }, []);

  const toggleCameraProjection = useCallback(() => {
    setCameraProjectionState((prev) => (prev === 'perspective' ? 'orthographic' : 'perspective'));
  }, []);

  // Node selection handler
  const handleNodeSelect = useCallback(
    (nodeId: string | null, multi = false) => {
      if (!nodeId) {
        sceneStore.getState().deselectAll();
      } else {
        sceneStore.getState().select(nodeId, multi);
      }
      onSelectNode?.(nodeId, multi);
    },
    [sceneStore, onSelectNode],
  );

  // 5. Commit Transform action (generates Command and notifies callbacks)
  const commitTransform = useCallback(
    (nodeId: string, oldTransform: Transform, newTransform: Transform) => {
      const node = sceneStore.getState().nodes[nodeId];
      const cmd = new TransformObjectCommand({
        nodeId,
        nodeName: node?.name,
        previousTransform: oldTransform,
        newTransform,
        sceneStore,
      });

      if (commandManager) {
        commandManager.execute(cmd, {
          state: sceneStore.getState(),
          dispatch: () => {},
        });
      } else {
        cmd.execute();
      }

      onTransformCommit?.(nodeId, oldTransform, newTransform);
    },
    [sceneStore, commandManager, onTransformCommit],
  );

  // 6. Camera Framing / Focus
  const focusOnBox = useCallback((box: THREE.Box3) => {
    if (!orbitControlsRef.current || !cameraRef.current) return;
    const controls = orbitControlsRef.current;
    const camera = cameraRef.current;

    const center = new THREE.Vector3();
    box.getCenter(center);

    const size = new THREE.Vector3();
    box.getSize(size);
    const maxDim = Math.max(size.x, size.y, size.z, 0.5);

    // Compute required distance based on FOV
    let distance = maxDim * 2.5;
    if (camera instanceof THREE.PerspectiveCamera) {
      const fovRad = (camera.fov * Math.PI) / 180;
      distance = (maxDim / 2 / Math.tan(fovRad / 2)) * 1.6;
    } else if (camera instanceof THREE.OrthographicCamera) {
      camera.zoom = THREE.MathUtils.clamp(400 / maxDim, 10, 200);
      camera.updateProjectionMatrix();
    }

    const direction = camera.position.clone().sub(controls.target).normalize();
    if (direction.lengthSq() < 0.001) {
      direction.set(1, 1, 1).normalize();
    }

    camera.position.copy(center).addScaledVector(direction, distance);
    controls.target.copy(center);
    controls.update();
  }, []);

  const focusOnNode = useCallback(
    (targetNodeId?: string | null) => {
      const nodeId = targetNodeId ?? sceneStore.getState().activeNodeId;
      if (!nodeId) return;

      const obj = sceneObjectsRef.current.get(nodeId);
      if (obj) {
        const box = new THREE.Box3().setFromObject(obj);
        if (!box.isEmpty()) {
          focusOnBox(box);
          return;
        }
      }

      // Fallback: focus on node transform position
      const node = sceneStore.getState().nodes[nodeId];
      if (node && orbitControlsRef.current && cameraRef.current) {
        const center = new THREE.Vector3(
          node.transform.position.x,
          node.transform.position.y,
          node.transform.position.z,
        );
        const box = new THREE.Box3().setFromCenterAndSize(center, new THREE.Vector3(2, 2, 2));
        focusOnBox(box);
      }
    },
    [sceneStore, focusOnBox],
  );

  const contextValue: ViewportContextValue = useMemo(
    () => ({
      config,
      snapConfig,
      cameraProjection,
      activeViewpoint,
      isGizmoDragging,
      axisLock,
      hoveredNodeId,
      showStats: statsVisible,
      showToolbar: toolbarVisible,
      showOverlays: overlaysVisible,
      show3DCursor: cursorVisible,
      activeCameraId,

      setConfig,
      setMode,
      setGizmoType,
      setTransformSpace,
      setShadingMode,
      setSnapConfig,
      toggleSnapping,
      setCameraProjection,
      toggleCameraProjection,
      setActiveViewpoint,
      setIsGizmoDragging,
      setAxisLock,
      toggleAxisLock,
      setHoveredNodeId,
      setShowStats,
      setShowToolbar,
      setShowOverlays,
      setShow3DCursor,
      setActiveCameraId,

      sceneStore,
      selectionStore,
      commandManager,
      orbitControlsRef,
      cameraRef,
      sceneObjectsRef,
      focusOnNode,
      focusOnBox,
      commitTransform,
      handleNodeSelect,
    }),
    [
      config,
      snapConfig,
      cameraProjection,
      activeViewpoint,
      isGizmoDragging,
      axisLock,
      hoveredNodeId,
      statsVisible,
      toolbarVisible,
      overlaysVisible,
      cursorVisible,
      activeCameraId,
      setConfig,
      setMode,
      setGizmoType,
      setTransformSpace,
      setShadingMode,
      setSnapConfig,
      toggleSnapping,
      setCameraProjection,
      toggleCameraProjection,
      setActiveViewpoint,
      setIsGizmoDragging,
      setAxisLock,
      toggleAxisLock,
      setHoveredNodeId,
      setShowStats,
      setShowToolbar,
      setShowOverlays,
      setActiveCameraId,
      sceneStore,
      selectionStore,
      commandManager,
      focusOnNode,
      focusOnBox,
      commitTransform,
      handleNodeSelect,
    ],
  );

  return <ViewportContext.Provider value={contextValue}>{children}</ViewportContext.Provider>;
};

export function useViewportContext(): ViewportContextValue {
  const ctx = useContext(ViewportContext);
  if (!ctx) {
    throw new Error(
      'useViewportContext must be used within a ViewportProvider or ViewportContainer',
    );
  }
  return ctx;
}
