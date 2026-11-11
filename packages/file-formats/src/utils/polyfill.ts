/**
 * Polyfills required for Node.js / headless test environments when executing
 * Three.js GLTFExporter and loaders that expect browser APIs like FileReader and ProgressEvent.
 */
export function ensureNodePolyfills(): void {
  if (typeof (globalThis as unknown as { self: unknown }).self === 'undefined') {
    (globalThis as unknown as { self: unknown }).self = globalThis;
  }

  if (typeof globalThis.ProgressEvent === 'undefined') {
    class NodeProgressEvent extends Event {
      lengthComputable: boolean;
      loaded: number;
      total: number;

      constructor(
        type: string,
        dict?: { lengthComputable?: boolean; loaded?: number; total?: number }
      ) {
        super(type);
        this.lengthComputable = dict?.lengthComputable ?? false;
        this.loaded = dict?.loaded ?? 0;
        this.total = dict?.total ?? 0;
      }
    }

    (globalThis as unknown as { ProgressEvent: typeof NodeProgressEvent }).ProgressEvent =
      NodeProgressEvent;
  }

  if (typeof globalThis.FileReader === 'undefined') {
    class NodeFileReader {
      onloadend: ((e: { target: NodeFileReader }) => void) | null = null;
      onerror: ((e: { target: NodeFileReader; error: unknown }) => void) | null = null;
      result: string | ArrayBuffer | null = null;

      readAsArrayBuffer(blob: Blob): void {
        blob
          .arrayBuffer()
          .then((buf) => {
            this.result = buf;
            if (this.onloadend) {
              this.onloadend({ target: this });
            }
          })
          .catch((err) => {
            if (this.onerror) {
              this.onerror({ target: this, error: err });
            }
          });
      }

      readAsDataURL(blob: Blob): void {
        blob
          .arrayBuffer()
          .then((buf) => {
            const base64 = Buffer.from(buf).toString('base64');
            const mime = blob.type || 'application/octet-stream';
            this.result = `data:${mime};base64,${base64}`;
            if (this.onloadend) {
              this.onloadend({ target: this });
            }
          })
          .catch((err) => {
            if (this.onerror) {
              this.onerror({ target: this, error: err });
            }
          });
      }

      readAsText(blob: Blob): void {
        blob
          .text()
          .then((text) => {
            this.result = text;
            if (this.onloadend) {
              this.onloadend({ target: this });
            }
          })
          .catch((err) => {
            if (this.onerror) {
              this.onerror({ target: this, error: err });
            }
          });
      }
    }

    // Assign to globalThis
    (globalThis as unknown as { FileReader: typeof NodeFileReader }).FileReader = NodeFileReader;
  }
}

// Call automatically upon module evaluation
ensureNodePolyfills();
