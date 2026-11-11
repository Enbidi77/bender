import type { MaterialPreset, PBRMaterialConfig } from '@blender-elt/contracts';

/**
 * Standard material preset definitions
 * Includes: Default Gray, Glossy Plastic, Brushed Metal, Pure Chrome, Gold, Glass, Matte Clay, Emissive Neon, Soft Rubber
 */
export const MATERIAL_PRESETS: Record<MaterialPreset, PBRMaterialConfig> = {
  'default-gray': {
    color: '#808080',
    roughness: 0.5,
    metalness: 0.0,
    emission: '#000000',
    emissionIntensity: 0.0,
    opacity: 1.0,
    transparent: false,
    wireframe: false,
    doubleSided: false,
  },
  'default-clay': {
    color: '#b0b0b0',
    roughness: 0.6,
    metalness: 0.0,
    emission: '#000000',
    emissionIntensity: 0.0,
    opacity: 1.0,
    transparent: false,
    wireframe: false,
    doubleSided: false,
  },
  'matte-clay': {
    color: '#8f9499',
    roughness: 0.9,
    metalness: 0.0,
    emission: '#000000',
    emissionIntensity: 0.0,
    opacity: 1.0,
    transparent: false,
    wireframe: false,
    doubleSided: false,
  },
  'glossy-plastic': {
    color: '#e74c3c',
    roughness: 0.1,
    metalness: 0.0,
    emission: '#000000',
    emissionIntensity: 0.0,
    opacity: 1.0,
    transparent: false,
    wireframe: false,
    clearcoat: 0.8,
    clearcoatRoughness: 0.1,
    doubleSided: false,
  },
  'brushed-metal': {
    color: '#d4d8dd',
    roughness: 0.35,
    metalness: 0.9,
    emission: '#000000',
    emissionIntensity: 0.0,
    opacity: 1.0,
    transparent: false,
    wireframe: false,
    doubleSided: false,
  },
  'pure-chrome': {
    color: '#ffffff',
    roughness: 0.02,
    metalness: 1.0,
    emission: '#000000',
    emissionIntensity: 0.0,
    opacity: 1.0,
    transparent: false,
    wireframe: false,
    doubleSided: false,
  },
  chrome: {
    color: '#ffffff',
    roughness: 0.05,
    metalness: 1.0,
    emission: '#000000',
    emissionIntensity: 0.0,
    opacity: 1.0,
    transparent: false,
    wireframe: false,
    doubleSided: false,
  },
  gold: {
    color: '#ffd700',
    roughness: 0.2,
    metalness: 1.0,
    emission: '#000000',
    emissionIntensity: 0.0,
    opacity: 1.0,
    transparent: false,
    wireframe: false,
    doubleSided: false,
  },
  glass: {
    color: '#ffffff',
    roughness: 0.05,
    metalness: 0.0,
    emission: '#000000',
    emissionIntensity: 0.0,
    opacity: 0.3,
    transparent: true,
    wireframe: false,
    transmission: 0.95,
    ior: 1.5,
    doubleSided: true,
  },
  'emissive-neon': {
    color: '#00ffff',
    roughness: 0.2,
    metalness: 0.1,
    emission: '#00ffff',
    emissionIntensity: 3.0,
    opacity: 1.0,
    transparent: false,
    wireframe: false,
    doubleSided: false,
  },
  'soft-rubber': {
    color: '#222222',
    roughness: 0.95,
    metalness: 0.0,
    emission: '#000000',
    emissionIntensity: 0.0,
    opacity: 1.0,
    transparent: false,
    wireframe: false,
    doubleSided: false,
  },
  rubber: {
    color: '#222222',
    roughness: 0.95,
    metalness: 0.0,
    emission: '#000000',
    emissionIntensity: 0.0,
    opacity: 1.0,
    transparent: false,
    wireframe: false,
    doubleSided: false,
  },
  copper: {
    color: '#b87333',
    roughness: 0.25,
    metalness: 0.95,
    emission: '#000000',
    emissionIntensity: 0.0,
    opacity: 1.0,
    transparent: false,
    wireframe: false,
    doubleSided: false,
  },
  'rough-wood': {
    color: '#8b5a2b',
    roughness: 0.8,
    metalness: 0.0,
    emission: '#000000',
    emissionIntensity: 0.0,
    opacity: 1.0,
    transparent: false,
    wireframe: false,
    doubleSided: false,
  },
  'car-paint': {
    color: '#1a5276',
    roughness: 0.15,
    metalness: 0.6,
    clearcoat: 1.0,
    clearcoatRoughness: 0.05,
    emission: '#000000',
    emissionIntensity: 0.0,
    opacity: 1.0,
    transparent: false,
    wireframe: false,
    doubleSided: false,
  },
};

/**
 * Returns a cloned configuration for a material preset
 */
export function getMaterialPreset(preset: MaterialPreset): PBRMaterialConfig {
  const config = MATERIAL_PRESETS[preset];
  if (!config) {
    return { ...MATERIAL_PRESETS['default-gray'] };
  }
  return { ...config };
}

export interface MaterialPresetItem {
  id: MaterialPreset;
  name: string;
  config: PBRMaterialConfig;
}

/**
 * Lists all available material presets with human-friendly names
 */
export function listMaterialPresets(): MaterialPresetItem[] {
  return [
    { id: 'default-gray', name: 'Default Gray', config: MATERIAL_PRESETS['default-gray'] },
    { id: 'glossy-plastic', name: 'Glossy Plastic', config: MATERIAL_PRESETS['glossy-plastic'] },
    { id: 'brushed-metal', name: 'Brushed Metal', config: MATERIAL_PRESETS['brushed-metal'] },
    { id: 'pure-chrome', name: 'Pure Chrome', config: MATERIAL_PRESETS['pure-chrome'] },
    { id: 'gold', name: 'Gold', config: MATERIAL_PRESETS['gold'] },
    { id: 'glass', name: 'Glass', config: MATERIAL_PRESETS['glass'] },
    { id: 'matte-clay', name: 'Matte Clay', config: MATERIAL_PRESETS['matte-clay'] },
    { id: 'emissive-neon', name: 'Emissive Neon', config: MATERIAL_PRESETS['emissive-neon'] },
    { id: 'soft-rubber', name: 'Soft Rubber', config: MATERIAL_PRESETS['soft-rubber'] },
    { id: 'copper', name: 'Copper', config: MATERIAL_PRESETS['copper'] },
    { id: 'car-paint', name: 'Car Paint', config: MATERIAL_PRESETS['car-paint'] },
    { id: 'rough-wood', name: 'Rough Wood', config: MATERIAL_PRESETS['rough-wood'] },
  ];
}
