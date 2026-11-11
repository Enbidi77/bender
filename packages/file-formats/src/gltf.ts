import * as THREE from 'three';
import {
  GLTFExporter,
  type GLTFExporterOptions,
} from 'three/examples/jsm/exporters/GLTFExporter.js';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import type { ExportOptions, ImportOptions } from '@blender-elt/contracts';
import { ensureNodePolyfills } from './utils/polyfill.js';
import { beltToThree, threeToBelt } from './bridge.js';
import type { ExportInput, ImportedSceneResult } from './types.js';

ensureNodePolyfills();

/**
 * Resolves ExportInput into a Three.js Object3D
 */
function resolveThreeObject(input: ExportInput): THREE.Object3D {
  if (input instanceof THREE.Object3D) {
    return input;
  }
  return beltToThree(input);
}

/**
 * Exports scene or domain nodes into glTF 2.0 JSON
 */
export async function exportGLTF(
  input: ExportInput,
  options?: ExportOptions,
): Promise<string | object> {
  ensureNodePolyfills();
  const threeObject = resolveThreeObject(input);
  const exporter = new GLTFExporter();

  const exporterOptions: GLTFExporterOptions = {
    binary: false,
    embedImages: options?.embedTextures ?? true,
    animations: options?.includeAnimations ? (threeObject.animations ?? []) : [],
  };

  return new Promise<string | object>((resolve, reject) => {
    exporter.parse(
      threeObject,
      (result) => {
        if (options?.prettyPrint) {
          resolve(typeof result === 'string' ? result : JSON.stringify(result, null, 2));
        } else {
          resolve(result);
        }
      },
      (error) => {
        reject(error instanceof Error ? error : new Error(String(error)));
      },
      exporterOptions,
    );
  });
}

/**
 * Exports scene or domain nodes into binary GLB format
 */
export async function exportGLB(input: ExportInput, options?: ExportOptions): Promise<Uint8Array> {
  ensureNodePolyfills();
  const threeObject = resolveThreeObject(input);
  const exporter = new GLTFExporter();

  const exporterOptions: GLTFExporterOptions = {
    binary: true,
    embedImages: options?.embedTextures ?? true,
    animations: options?.includeAnimations ? (threeObject.animations ?? []) : [],
  };

  return new Promise<Uint8Array>((resolve, reject) => {
    exporter.parse(
      threeObject,
      (result) => {
        if (result instanceof ArrayBuffer) {
          resolve(new Uint8Array(result));
        } else if (result instanceof Uint8Array) {
          resolve(result);
        } else {
          reject(new Error('GLTFExporter did not return binary ArrayBuffer for GLB export'));
        }
      },
      (error) => {
        reject(error instanceof Error ? error : new Error(String(error)));
      },
      exporterOptions,
    );
  });
}

/**
 * Imports glTF 2.0 text or GLB binary into Blender-ELT domain scene
 */
export async function importGLTF(
  data: string | ArrayBuffer | Uint8Array,
  options?: ImportOptions,
): Promise<ImportedSceneResult> {
  ensureNodePolyfills();
  const loader = new GLTFLoader();

  let parseInput: string | ArrayBuffer;
  if (data instanceof Uint8Array) {
    const ab = new ArrayBuffer(data.byteLength);
    new Uint8Array(ab).set(data);
    parseInput = ab;
  } else {
    parseInput = data;
  }

  return new Promise<ImportedSceneResult>((resolve, reject) => {
    loader.parse(
      parseInput,
      '',
      (gltf) => {
        const sceneResult = threeToBelt(gltf.scene);

        // Center or normalize scale if requested in options
        if (options?.centerGeometry || options?.normalizeScale) {
          const box = new THREE.Box3().setFromObject(gltf.scene);
          const center = new THREE.Vector3();
          box.getCenter(center);
          const size = new THREE.Vector3();
          box.getSize(size);
          const maxDim = Math.max(size.x, size.y, size.z);

          for (const node of Object.values(sceneResult.nodes)) {
            if (options.centerGeometry && node.parentId === null) {
              node.transform.position.x -= center.x;
              node.transform.position.y -= center.y;
              node.transform.position.z -= center.z;
            }
            if (options.normalizeScale && maxDim > 0 && node.parentId === null) {
              const scaleFactor = 2 / maxDim;
              node.transform.scale.x *= scaleFactor;
              node.transform.scale.y *= scaleFactor;
              node.transform.scale.z *= scaleFactor;
            }
          }
        }

        resolve(sceneResult);
      },
      (error) => {
        reject(error instanceof Error ? error : new Error(String(error)));
      },
    );
  });
}

/**
 * Imports binary GLB buffer into Blender-ELT domain scene
 */
export async function importGLB(
  buffer: ArrayBuffer | Uint8Array,
  options?: ImportOptions,
): Promise<ImportedSceneResult> {
  return importGLTF(buffer, options);
}
