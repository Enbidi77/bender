import React, { useMemo, useEffect } from 'react';
import * as THREE from 'three';
import { useViewportContext } from '../context/ViewportContext.js';
import { VIEWPORT_COLORS } from '../constants.js';

export const CoordinateAxes: React.FC = () => {
  const { config } = useViewportContext();
  const { grid } = config;

  const { xLine, zLine, yLine } = useMemo(() => {
    const extent = 100;
    const xPoints = [new THREE.Vector3(-extent, 0, 0), new THREE.Vector3(extent, 0, 0)];
    const zPoints = [new THREE.Vector3(0, 0, -extent), new THREE.Vector3(0, 0, extent)];
    const yPoints = [new THREE.Vector3(0, 0, 0), new THREE.Vector3(0, 2, 0)];

    const xGeo = new THREE.BufferGeometry().setFromPoints(xPoints);
    const zGeo = new THREE.BufferGeometry().setFromPoints(zPoints);
    const yGeo = new THREE.BufferGeometry().setFromPoints(yPoints);

    const xMat = new THREE.LineBasicMaterial({
      color: VIEWPORT_COLORS.axisX,
      opacity: 0.65,
      transparent: true,
      depthTest: false,
    });
    const zMat = new THREE.LineBasicMaterial({
      color: VIEWPORT_COLORS.axisZ,
      opacity: 0.65,
      transparent: true,
      depthTest: false,
    });
    const yMat = new THREE.LineBasicMaterial({
      color: VIEWPORT_COLORS.axisY,
      opacity: 0.65,
      transparent: true,
      depthTest: false,
    });

    return {
      xLine: new THREE.Line(xGeo, xMat),
      zLine: new THREE.Line(zGeo, zMat),
      yLine: new THREE.Line(yGeo, yMat),
    };
  }, []);

  useEffect(() => {
    return () => {
      xLine.geometry.dispose();
      (xLine.material as THREE.Material).dispose();
      zLine.geometry.dispose();
      (zLine.material as THREE.Material).dispose();
      yLine.geometry.dispose();
      (yLine.material as THREE.Material).dispose();
    };
  }, [xLine, zLine, yLine]);

  if (!grid.showAxes || !config.showFloor) {
    return null;
  }

  return (
    <group name="coordinate-axes">
      <primitive object={xLine} />
      <primitive object={zLine} />
      <primitive object={yLine} />
    </group>
  );
};
