import * as THREE from 'three';
import type {
  PBRMaterialConfig,
  MaterialPreset,
  MaterialDefinition,
  ShadingMode,
} from '@blender-elt/contracts';

export type { PBRMaterialConfig, MaterialPreset, MaterialDefinition, ShadingMode };

/**
 * Standard material preset definitions
 */
export const MATERIAL_PRESETS: Record<MaterialPreset, PBRMaterialConfig> = {
  'default-clay': {
    color: '#b0b0b0',
    roughness: 0.6,
    metalness: 0.0,
    emission: '#000000',
    opacity: 1.0,
    transparent: false,
    wireframe: false,
  },
  'matte-clay': {
    color: '#8f9499',
    roughness: 0.9,
    metalness: 0.0,
    emission: '#000000',
    opacity: 1.0,
    transparent: false,
    wireframe: false,
  },
  'glossy-plastic': {
    color: '#e74c3c',
    roughness: 0.1,
    metalness: 0.0,
    emission: '#000000',
    opacity: 1.0,
    transparent: false,
    wireframe: false,
  },
  'brushed-metal': {
    color: '#d4d8dd',
    roughness: 0.35,
    metalness: 0.9,
    emission: '#000000',
    opacity: 1.0,
    transparent: false,
    wireframe: false,
  },
  gold: {
    color: '#ffd700',
    roughness: 0.2,
    metalness: 1.0,
    emission: '#000000',
    opacity: 1.0,
    transparent: false,
    wireframe: false,
  },
  chrome: {
    color: '#ffffff',
    roughness: 0.05,
    metalness: 1.0,
    emission: '#000000',
    opacity: 1.0,
    transparent: false,
    wireframe: false,
  },
  copper: {
    color: '#b87333',
    roughness: 0.25,
    metalness: 0.95,
    emission: '#000000',
    opacity: 1.0,
    transparent: false,
    wireframe: false,
  },
  glass: {
    color: '#ffffff',
    roughness: 0.05,
    metalness: 0.0,
    emission: '#000000',
    opacity: 0.3,
    transparent: true,
    wireframe: false,
    transmission: 0.95,
    ior: 1.5,
  },
  'rough-wood': {
    color: '#8b5a2b',
    roughness: 0.8,
    metalness: 0.0,
    emission: '#000000',
    opacity: 1.0,
    transparent: false,
    wireframe: false,
  },
  rubber: {
    color: '#222222',
    roughness: 0.95,
    metalness: 0.0,
    emission: '#000000',
    opacity: 1.0,
    transparent: false,
    wireframe: false,
  },
  'car-paint': {
    color: '#1a5276',
    roughness: 0.15,
    metalness: 0.6,
    clearcoat: 1.0,
    clearcoatRoughness: 0.05,
    emission: '#000000',
    opacity: 1.0,
    transparent: false,
    wireframe: false,
  },
};

/**
 * Creates a Three.js standard material from PBRMaterialConfig
 */
export function createThreeMaterial(
  config: PBRMaterialConfig,
  shadingMode: ShadingMode = 'rendered',
): THREE.Material {
  if (shadingMode === 'wireframe') {
    return new THREE.MeshBasicMaterial({
      color: 0x4fc3f7,
      wireframe: true,
    });
  }

  if (shadingMode === 'solid') {
    return new THREE.MeshLambertMaterial({
      color: 0xcccccc,
    });
  }

  return new THREE.MeshStandardMaterial({
    color: new THREE.Color(config.color),
    roughness: config.roughness,
    metalness: config.metalness,
    emissive: new THREE.Color(config.emission),
    emissiveIntensity: config.emissionIntensity ?? 1.0,
    opacity: config.opacity,
    transparent: config.transparent,
    wireframe: config.wireframe,
  });
}
