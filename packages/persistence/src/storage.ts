import { promises as fs } from 'fs';
import { dirname } from 'path';

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
 * Node.js / Electron file system storage adapter
 */
export class FileStorageAdapter implements IStorageAdapter {
  async read(keyOrPath: string): Promise<string> {
    return await fs.readFile(keyOrPath, 'utf-8');
  }

  async write(keyOrPath: string, content: string): Promise<void> {
    const dir = dirname(keyOrPath);
    await fs.mkdir(dir, { recursive: true });
    await fs.writeFile(keyOrPath, content, 'utf-8');
  }

  async exists(keyOrPath: string): Promise<boolean> {
    try {
      await fs.access(keyOrPath);
      return true;
    } catch {
      return false;
    }
  }

  async delete(keyOrPath: string): Promise<void> {
    try {
      await fs.unlink(keyOrPath);
    } catch {
      // file might not exist
    }
  }
}
