import * as THREE from 'three';
import type {
  SupportedFileFormat,
  ImportOptions,
  ExportOptions,
  ProjectDocument,
} from '@blender-elt/contracts';

export type { SupportedFileFormat, ImportOptions, ExportOptions, ProjectDocument };

export interface FileFormatConverter {
  format: SupportedFileFormat;
  export(scene: THREE.Object3D, options?: ExportOptions): Promise<string | Uint8Array>;
  import(data: string | ArrayBuffer, options?: ImportOptions): Promise<THREE.Object3D>;
}

/**
 * Basic OBJ exporter generator
 */
export function exportToOBJ(object: THREE.Object3D): string {
  let output = '# Blender-ELT OBJ Export\n';
  let vertexOffset = 1;

  object.traverse((child) => {
    if (child instanceof THREE.Mesh && child.geometry) {
      const geo = child.geometry;
      const pos = geo.getAttribute('position');
      if (!pos) return;

      output += `o ${child.name || 'Mesh'}\n`;

      // Export vertices
      for (let i = 0; i < pos.count; i++) {
        const v = new THREE.Vector3().fromBufferAttribute(pos, i);
        v.applyMatrix4(child.matrixWorld);
        output += `v ${v.x.toFixed(6)} ${v.y.toFixed(6)} ${v.z.toFixed(6)}\n`;
      }

      // Export faces
      const index = geo.getIndex();
      if (index) {
        for (let i = 0; i < index.count; i += 3) {
          const a = index.getX(i) + vertexOffset;
          const b = index.getX(i + 1) + vertexOffset;
          const c = index.getX(i + 2) + vertexOffset;
          output += `f ${a} ${b} ${c}\n`;
        }
        vertexOffset += pos.count;
      } else {
        for (let i = 0; i < pos.count; i += 3) {
          const a = i + vertexOffset;
          const b = i + 1 + vertexOffset;
          const c = i + 2 + vertexOffset;
          output += `f ${a} ${b} ${c}\n`;
        }
        vertexOffset += pos.count;
      }
    }
  });

  return output;
}
