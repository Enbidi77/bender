import type { MaterialDefinition, MaterialPreset, PBRMaterialConfig } from '@blender-elt/contracts';
import { createDefaultMaterialConfig, cloneMaterialConfig } from './types.js';
import { getMaterialPreset } from './presets.js';

/**
 * Manages registered material definitions
 */
export class MaterialManager {
  private materials = new Map<string, MaterialDefinition>();

  constructor() {
    // Add default clay/gray material
    this.createMaterial(
      'Default',
      getMaterialPreset('default-gray'),
      'default-gray',
      'default-material',
    );
  }

  public createMaterial(
    name: string = 'Material',
    config?: Partial<PBRMaterialConfig>,
    preset?: MaterialPreset,
    id?: string,
  ): MaterialDefinition {
    const matId = id ?? `mat_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
    const baseConfig = preset ? getMaterialPreset(preset) : createDefaultMaterialConfig();

    const mergedConfig: PBRMaterialConfig = {
      ...baseConfig,
      ...config,
    };

    const def: MaterialDefinition = {
      id: matId,
      name,
      type: 'pbr',
      config: mergedConfig,
      preset,
    };

    this.materials.set(matId, def);
    return def;
  }

  public getMaterial(id: string): MaterialDefinition | undefined {
    return this.materials.get(id);
  }

  public updateMaterial(
    id: string,
    updates: Partial<PBRMaterialConfig>,
  ): MaterialDefinition | undefined {
    const existing = this.materials.get(id);
    if (!existing) return undefined;

    existing.config = {
      ...existing.config,
      ...updates,
    };
    return existing;
  }

  public deleteMaterial(id: string): boolean {
    return this.materials.delete(id);
  }

  public duplicateMaterial(id: string, newName?: string): MaterialDefinition | undefined {
    const orig = this.materials.get(id);
    if (!orig) return undefined;

    const dupName = newName ?? `${orig.name} Copy`;
    return this.createMaterial(dupName, cloneMaterialConfig(orig.config), orig.preset);
  }

  public getAllMaterials(): MaterialDefinition[] {
    return Array.from(this.materials.values());
  }

  public clear(): void {
    this.materials.clear();
  }
}
