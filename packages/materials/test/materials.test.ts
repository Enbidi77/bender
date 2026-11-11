import { describe, it, expect } from 'vitest';
import * as THREE from 'three';
import {
  MATERIAL_PRESETS,
  getMaterialPreset,
  listMaterialPresets,
  createDefaultMaterialConfig,
  cloneMaterialConfig,
  createThreeMaterial,
  updateThreeMaterial,
  threeMaterialToConfig,
  MaterialManager,
  type MaterialPreset,
} from '../src/index.js';

describe('PBR Materials and Preset Library', () => {
  const requiredPresets: MaterialPreset[] = [
    'default-gray',
    'glossy-plastic',
    'brushed-metal',
    'pure-chrome',
    'gold',
    'glass',
    'matte-clay',
    'emissive-neon',
    'soft-rubber',
  ];

  it('contains all required material presets with valid PBR properties', () => {
    for (const presetKey of requiredPresets) {
      const preset = MATERIAL_PRESETS[presetKey];
      expect(preset, `Preset ${presetKey} should exist`).toBeDefined();
      expect(typeof preset.color).toBe('string');
      expect(typeof preset.roughness).toBe('number');
      expect(typeof preset.metalness).toBe('number');
      expect(typeof preset.emission).toBe('string');
      expect(typeof preset.opacity).toBe('number');
      expect(typeof preset.transparent).toBe('boolean');
      expect(typeof preset.wireframe).toBe('boolean');
      expect(typeof preset.doubleSided).toBe('boolean');
    }
  });

  it('provides getMaterialPreset and listMaterialPresets', () => {
    const gold = getMaterialPreset('gold');
    expect(gold.metalness).toBe(1.0);
    expect(gold.color).toBe('#ffd700');

    const presetsList = listMaterialPresets();
    expect(presetsList.length).toBeGreaterThanOrEqual(9);
    expect(presetsList.some((p) => p.id === 'pure-chrome')).toBe(true);
    expect(presetsList.some((p) => p.id === 'emissive-neon')).toBe(true);
  });

  it('creates and clones material configurations', () => {
    const def = createDefaultMaterialConfig();
    expect(def.opacity).toBe(1.0);
    expect(def.doubleSided).toBe(false);

    const cloned = cloneMaterialConfig(def);
    expect(cloned).toEqual(def);
    cloned.color = '#ff0000';
    expect(def.color).not.toBe('#ff0000');
  });

  it('creates MeshStandardMaterial for standard PBR configs', () => {
    const config = getMaterialPreset('brushed-metal');
    const mat = createThreeMaterial(config);

    expect(mat).toBeInstanceOf(THREE.MeshStandardMaterial);
    const standard = mat as THREE.MeshStandardMaterial;
    expect(standard.metalness).toBe(0.9);
    expect(standard.roughness).toBe(0.35);
    expect(standard.side).toBe(THREE.FrontSide);
    mat.dispose();
  });

  it('creates MeshPhysicalMaterial when transmission or clearcoat is configured (e.g. Glass, Plastic)', () => {
    const glassConfig = getMaterialPreset('glass');
    const glassMat = createThreeMaterial(glassConfig);

    expect(glassMat).toBeInstanceOf(THREE.MeshPhysicalMaterial);
    const physical = glassMat as THREE.MeshPhysicalMaterial;
    expect(physical.transmission).toBe(0.95);
    expect(physical.ior).toBe(1.5);
    expect(physical.side).toBe(THREE.DoubleSide); // Glass preset is doubleSided
    glassMat.dispose();

    const plasticConfig = getMaterialPreset('glossy-plastic');
    const plasticMat = createThreeMaterial(plasticConfig);
    expect(plasticMat).toBeInstanceOf(THREE.MeshPhysicalMaterial);
    glassMat.dispose();
  });

  it('handles shading modes (wireframe and solid)', () => {
    const config = getMaterialPreset('default-gray');
    const wireMat = createThreeMaterial(config, 'wireframe');
    expect(wireMat).toBeInstanceOf(THREE.MeshBasicMaterial);
    expect(wireMat.wireframe).toBe(true);
    wireMat.dispose();

    const solidMat = createThreeMaterial(config, 'solid');
    expect(solidMat).toBeInstanceOf(THREE.MeshLambertMaterial);
    solidMat.dispose();
  });

  it('updates existing Three.js materials in-place', () => {
    const config = getMaterialPreset('gold');
    const mat = createThreeMaterial(config) as THREE.MeshStandardMaterial;

    updateThreeMaterial(mat, {
      ...config,
      color: '#ff00ff',
      roughness: 0.1,
      metalness: 0.8,
      doubleSided: true,
    });

    expect(mat.roughness).toBe(0.1);
    expect(mat.metalness).toBe(0.8);
    expect(mat.side).toBe(THREE.DoubleSide);
    expect(mat.color.getHexString()).toBe('ff00ff');
    mat.dispose();
  });

  it('converts Three.js material back to PBRMaterialConfig', () => {
    const origConfig = getMaterialPreset('gold');
    const mat = createThreeMaterial(origConfig);
    const converted = threeMaterialToConfig(mat);

    expect(converted.metalness).toBe(origConfig.metalness);
    expect(converted.roughness).toBe(origConfig.roughness);
    expect(converted.color.toLowerCase()).toBe(origConfig.color.toLowerCase());
    mat.dispose();
  });

  it('manages material definitions with MaterialManager', () => {
    const manager = new MaterialManager();
    expect(manager.getAllMaterials().length).toBeGreaterThan(0);

    const newMat = manager.createMaterial('Custom Chrome', undefined, 'pure-chrome');
    expect(newMat.preset).toBe('pure-chrome');
    expect(newMat.config.metalness).toBe(1.0);

    manager.updateMaterial(newMat.id, { roughness: 0.5 });
    expect(manager.getMaterial(newMat.id)?.config.roughness).toBe(0.5);

    const dup = manager.duplicateMaterial(newMat.id, 'Chrome Copy');
    expect(dup).toBeDefined();
    expect(dup?.name).toBe('Chrome Copy');
    expect(dup?.config.roughness).toBe(0.5);

    manager.deleteMaterial(dup!.id);
    expect(manager.getMaterial(dup!.id)).toBeUndefined();
  });
});
