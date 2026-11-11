import * as THREE from 'three';
import type { PBRMaterialConfig, ShadingMode } from '@blender-elt/contracts';

/**
 * Creates an appropriate Three.js Material from a PBRMaterialConfig
 * Uses MeshPhysicalMaterial when advanced physical parameters (transmission, clearcoat, ior) are present,
 * otherwise standard MeshStandardMaterial.
 */
export function createThreeMaterial(
  config: PBRMaterialConfig,
  shadingMode: ShadingMode = 'rendered',
): THREE.Material {
  const side = config.doubleSided ? THREE.DoubleSide : THREE.FrontSide;

  if (shadingMode === 'wireframe') {
    return new THREE.MeshBasicMaterial({
      color: 0x4fc3f7,
      wireframe: true,
      side,
    });
  }

  if (shadingMode === 'solid') {
    return new THREE.MeshLambertMaterial({
      color: 0xcccccc,
      side,
    });
  }

  const needsPhysical =
    (config.transmission !== undefined && config.transmission > 0) ||
    (config.clearcoat !== undefined && config.clearcoat > 0) ||
    (config.ior !== undefined && config.ior !== 1.5);

  const isTransparent = config.transparent || config.opacity < 1.0;

  if (needsPhysical) {
    const mat = new THREE.MeshPhysicalMaterial({
      color: new THREE.Color(config.color),
      roughness: config.roughness,
      metalness: config.metalness,
      emissive: new THREE.Color(config.emission),
      emissiveIntensity: config.emissionIntensity ?? 1.0,
      opacity: config.opacity,
      transparent: isTransparent,
      wireframe: config.wireframe,
      side,
      transmission: config.transmission ?? 0,
      ior: config.ior ?? 1.5,
      clearcoat: config.clearcoat ?? 0,
      clearcoatRoughness: config.clearcoatRoughness ?? 0,
    });
    return mat;
  }

  const mat = new THREE.MeshStandardMaterial({
    color: new THREE.Color(config.color),
    roughness: config.roughness,
    metalness: config.metalness,
    emissive: new THREE.Color(config.emission),
    emissiveIntensity: config.emissionIntensity ?? 1.0,
    opacity: config.opacity,
    transparent: isTransparent,
    wireframe: config.wireframe,
    side,
  });

  return mat;
}

/**
 * Updates an existing Three.js Material instance with new PBR configuration values in-place
 */
export function updateThreeMaterial(material: THREE.Material, config: PBRMaterialConfig): void {
  const side = config.doubleSided ? THREE.DoubleSide : THREE.FrontSide;
  material.side = side;

  if (
    material instanceof THREE.MeshStandardMaterial ||
    material instanceof THREE.MeshPhysicalMaterial
  ) {
    material.color.set(config.color);
    material.roughness = config.roughness;
    material.metalness = config.metalness;
    material.emissive.set(config.emission);
    material.emissiveIntensity = config.emissionIntensity ?? 1.0;
    material.opacity = config.opacity;
    material.transparent = config.transparent || config.opacity < 1.0;
    material.wireframe = config.wireframe;

    if (material instanceof THREE.MeshPhysicalMaterial) {
      if (config.transmission !== undefined) material.transmission = config.transmission;
      if (config.ior !== undefined) material.ior = config.ior;
      if (config.clearcoat !== undefined) material.clearcoat = config.clearcoat;
      if (config.clearcoatRoughness !== undefined)
        material.clearcoatRoughness = config.clearcoatRoughness;
    }

    material.needsUpdate = true;
  }
}

/**
 * Converts a Three.js material instance back to a PBRMaterialConfig
 */
export function threeMaterialToConfig(material: THREE.Material): PBRMaterialConfig {
  if (material instanceof THREE.MeshPhysicalMaterial) {
    return {
      color: '#' + material.color.getHexString(),
      roughness: material.roughness,
      metalness: material.metalness,
      emission: '#' + material.emissive.getHexString(),
      emissionIntensity: material.emissiveIntensity,
      opacity: material.opacity,
      transparent: material.transparent,
      wireframe: material.wireframe,
      doubleSided: material.side === THREE.DoubleSide,
      transmission: material.transmission,
      ior: material.ior,
      clearcoat: material.clearcoat,
      clearcoatRoughness: material.clearcoatRoughness,
    };
  }

  if (material instanceof THREE.MeshStandardMaterial) {
    return {
      color: '#' + material.color.getHexString(),
      roughness: material.roughness,
      metalness: material.metalness,
      emission: '#' + material.emissive.getHexString(),
      emissionIntensity: material.emissiveIntensity,
      opacity: material.opacity,
      transparent: material.transparent,
      wireframe: material.wireframe,
      doubleSided: material.side === THREE.DoubleSide,
    };
  }

  return {
    color: '#cccccc',
    roughness: 0.5,
    metalness: 0.0,
    emission: '#000000',
    emissionIntensity: 0.0,
    opacity: material.opacity ?? 1.0,
    transparent: material.transparent ?? false,
    wireframe: (material as unknown as { wireframe?: boolean }).wireframe ?? false,
    doubleSided: material.side === THREE.DoubleSide,
  };
}
