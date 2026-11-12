export interface IStorageAdapter {
  read(keyOrPath: string): Promise<string>;
  write(keyOrPath: string, content: string): Promise<void>;
  exists(keyOrPath: string): Promise<boolean>;
  delete?(keyOrPath: string): Promise<void>;
}

/**
 * In-memory storage adapter for unit tests and headless environments
 */
export class MemoryStorageAdapter implements IStorageAdapter {
  private store: Map<string, string> = new Map();

  async read(keyOrPath: string): Promise<string> {
    const val = this.store.get(keyOrPath);
    if (val === undefined) {
      throw new Error(`File or key not found: ${keyOrPath}`);
    }
    return val;
  }

  async write(keyOrPath: string, content: string): Promise<void> {
    this.store.set(keyOrPath, content);
  }

  async exists(keyOrPath: string): Promise<boolean> {
    return this.store.has(keyOrPath);
  }

  async delete(keyOrPath: string): Promise<void> {
    this.store.delete(keyOrPath);
  }

  clear(): void {
    this.store.clear();
  }
}

/**
 * Browser localStorage adapter
 */
export class LocalStorageAdapter implements IStorageAdapter {
  private prefix: string;

  constructor(prefix = 'belt_') {
    this.prefix = prefix;
  }

  private getKey(key: string): string {
    return `${this.prefix}${key}`;
  }

  async read(keyOrPath: string): Promise<string> {
    if (typeof window === 'undefined' || !window.localStorage) {
      throw new Error('localStorage is not available');
    }
    const val = window.localStorage.getItem(this.getKey(keyOrPath));
    if (val === null) {
      throw new Error(`Key not found in localStorage: ${keyOrPath}`);
    }
    return val;
  }

  async write(keyOrPath: string, content: string): Promise<void> {
    if (typeof window === 'undefined' || !window.localStorage) {
      throw new Error('localStorage is not available');
    }
    window.localStorage.setItem(this.getKey(keyOrPath), content);
  }

  async exists(keyOrPath: string): Promise<boolean> {
    if (typeof window === 'undefined' || !window.localStorage) return false;
    return window.localStorage.getItem(this.getKey(keyOrPath)) !== null;
  }

  async delete(keyOrPath: string): Promise<void> {
    if (typeof window !== 'undefined' && window.localStorage) {
      window.localStorage.removeItem(this.getKey(keyOrPath));
    }
  }
}

/**
 * Minimal interfaces for lazy Node.js fs/path injection
 */
export interface NodeFsPromises {
  readFile(path: string, encoding: string): Promise<string>;
  writeFile(path: string, data: string, encoding: string): Promise<void>;
  mkdir(path: string, options?: { recursive?: boolean }): Promise<string | undefined | void>;
  access(path: string): Promise<void>;
  unlink(path: string): Promise<void>;
}

export interface NodePathModule {
  dirname(path: string): string;
}

export interface FileStorageAdapterOptions {
  fs?: NodeFsPromises;
  path?: NodePathModule;
}

/**
 * Node.js / Electron file system storage adapter.
 * Uses lazy dynamic import and optional dependency injection to ensure
 * no top-level Node.js imports occur when evaluated in browser/Next.js runtimes.
 */
export class FileStorageAdapter implements IStorageAdapter {
  private fsPromise: Promise<{ fs: NodeFsPromises; path: NodePathModule }> | null = null;
  private injectedFs?: NodeFsPromises;
  private injectedPath?: NodePathModule;

  constructor(options?: FileStorageAdapterOptions) {
    if (options?.fs) this.injectedFs = options.fs;
    if (options?.path) this.injectedPath = options.path;
  }

  private async getNodeDeps(): Promise<{ fs: NodeFsPromises; path: NodePathModule }> {
    if (this.injectedFs && this.injectedPath) {
      return { fs: this.injectedFs, path: this.injectedPath };
    }

    if (!this.fsPromise) {
      this.fsPromise = (async () => {
        const fsMod = await import('fs');
        const pathMod = await import('path');
        const fs = (this.injectedFs || (fsMod.promises ?? fsMod)) as unknown as NodeFsPromises;
        const path = (this.injectedPath || pathMod) as NodePathModule;
        return { fs, path };
      })();
    }

    return this.fsPromise;
  }

  async read(keyOrPath: string): Promise<string> {
    const { fs } = await this.getNodeDeps();
    return await fs.readFile(keyOrPath, 'utf-8');
  }

  async write(keyOrPath: string, content: string): Promise<void> {
    const { fs, path } = await this.getNodeDeps();
    const dir = path.dirname(keyOrPath);
    await fs.mkdir(dir, { recursive: true });
    await fs.writeFile(keyOrPath, content, 'utf-8');
  }

  async exists(keyOrPath: string): Promise<boolean> {
    try {
      const { fs } = await this.getNodeDeps();
      await fs.access(keyOrPath);
      return true;
    } catch {
      return false;
    }
  }

  async delete(keyOrPath: string): Promise<void> {
    try {
      const { fs } = await this.getNodeDeps();
      await fs.unlink(keyOrPath);
    } catch {
      // file might not exist
    }
  }
}
