/**
 * Viewport shading modes
 */
export type ShadingMode = 'wireframe' | 'solid' | 'material' | 'rendered';

/**
 * Texture map configuration
 */
export interface TextureMapConfig {
  url: string;
  name?: string;
  wrapS?: 'repeat' | 'clamp' | 'mirrored';
  wrapT?: 'repeat' | 'clamp' | 'mirrored';
  repeat?: [number, number];
  offset?: [number, number];
  rotation?: number;
}

/**
 * PBR Material Configuration
 */
export interface PBRMaterialConfig {
  color: string;
  roughness: number;
  metalness: number;
  emission: string;
  emissionIntensity?: number;
  opacity: number;
  transparent: boolean;
  wireframe: boolean;
  clearcoat?: number;
  clearcoatRoughness?: number;
  transmission?: number;
  ior?: number;
  map?: TextureMapConfig;
  normalMap?: TextureMapConfig;
  roughnessMap?: TextureMapConfig;
  metalnessMap?: TextureMapConfig;
  aoMap?: TextureMapConfig;
  emissiveMap?: TextureMapConfig;
}

/**
 * Standard material preset identifiers
 */
export type MaterialPreset =
  | 'default-clay'
  | 'matte-clay'
  | 'glossy-plastic'
  | 'brushed-metal'
  | 'glass'
  | 'gold'
  | 'chrome'
  | 'rough-wood'
  | 'rubber'
  | 'copper'
  | 'car-paint';

export interface MaterialDefinition {
  id: string;
  name: string;
  type: 'pbr' | 'basic' | 'standard';
  config: PBRMaterialConfig;
  preset?: MaterialPreset;
}
