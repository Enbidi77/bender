import type {
  PBRMaterialConfig,
  MaterialPreset,
  MaterialDefinition,
  ShadingMode,
  TextureMapConfig,
} from '@blender-elt/contracts';

export type {
  PBRMaterialConfig,
  MaterialPreset,
  MaterialDefinition,
  ShadingMode,
  TextureMapConfig,
};

/**
 * Creates a default PBR material configuration
 */
export function createDefaultMaterialConfig(): PBRMaterialConfig {
  return {
    color: '#b0b0b0',
    roughness: 0.5,
    metalness: 0.0,
    emission: '#000000',
    emissionIntensity: 1.0,
    opacity: 1.0,
    transparent: false,
    wireframe: false,
    doubleSided: false,
  };
}

/**
 * Deep clones a PBR material configuration
 */
export function cloneMaterialConfig(config: PBRMaterialConfig): PBRMaterialConfig {
  return {
    ...config,
    map: config.map ? { ...config.map } : undefined,
    normalMap: config.normalMap ? { ...config.normalMap } : undefined,
    roughnessMap: config.roughnessMap ? { ...config.roughnessMap } : undefined,
    metalnessMap: config.metalnessMap ? { ...config.metalnessMap } : undefined,
    aoMap: config.aoMap ? { ...config.aoMap } : undefined,
    emissiveMap: config.emissiveMap ? { ...config.emissiveMap } : undefined,
  };
}
