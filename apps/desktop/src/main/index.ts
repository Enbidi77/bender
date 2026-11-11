import { app, shell, BrowserWindow, ipcMain, dialog } from 'electron';
import { join } from 'path';
import { promises as fs } from 'fs';
import type {
  FileDialogOptions,
  SaveProjectPayload,
  OpenProjectPayload,
  ExportPayload,
  SystemInfo,
} from '@blender-elt/contracts';

let mainWindow: BrowserWindow | null = null;

function createWindow(): void {
  mainWindow = new BrowserWindow({
    width: 1440,
    height: 900,
    minWidth: 1024,
    minHeight: 700,
    show: false,
    autoHideMenuBar: true,
    backgroundColor: '#1d1e22',
    webPreferences: {
      preload: join(__dirname, '../preload/index.js'),
      sandbox: false,
      contextIsolation: true,
      nodeIntegration: false,
    },
  });

  mainWindow.on('ready-to-show', () => {
    mainWindow?.show();
  });

  mainWindow.webContents.setWindowOpenHandler((details) => {
    shell.openExternal(details.url);
    return { action: 'deny' };
  });

  // HMR for renderer base on electron-vite cli
  if (process.env.ELECTRON_RENDERER_URL) {
    mainWindow.loadURL(process.env.ELECTRON_RENDERER_URL);
  } else {
    mainWindow.loadFile(join(__dirname, '../renderer/index.html'));
  }
}

// IPC Handlers
ipcMain.handle('dialog:open', async (_, options?: FileDialogOptions) => {
  if (!mainWindow) return { canceled: true, filePaths: [] };
  const res = await dialog.showOpenDialog(mainWindow, {
    title: options?.title,
    defaultPath: options?.defaultPath,
    filters: options?.filters,
    properties: options?.properties || ['openFile'],
  });
  return res;
});

ipcMain.handle('dialog:save', async (_, options?: FileDialogOptions) => {
  if (!mainWindow) return { canceled: true };
  const res = await dialog.showSaveDialog(mainWindow, {
    title: options?.title,
    defaultPath: options?.defaultPath,
    filters: options?.filters,
  });
  return res;
});

ipcMain.handle('project:save', async (_, payload: SaveProjectPayload) => {
  try {
    let targetPath = payload.filePath;
    if (!targetPath) {
      if (!mainWindow) throw new Error('No active window');
      const dialogRes = await dialog.showSaveDialog(mainWindow, {
        title: 'Save Project',
        filters: [{ name: 'Blender-ELT Project', extensions: ['belt', 'json'] }],
      });
      if (dialogRes.canceled || !dialogRes.filePath) {
        return { success: false, error: 'User cancelled save dialog' };
      }
      targetPath = dialogRes.filePath;
    }

    const content = JSON.stringify(payload.document, null, 2);
    await fs.writeFile(targetPath, content, 'utf-8');
    return { success: true, filePath: targetPath };
  } catch (err: unknown) {
    const error = err instanceof Error ? err.message : String(err);
    return { success: false, error };
  }
});

ipcMain.handle('project:open', async (_, payload: OpenProjectPayload) => {
  try {
    const raw = await fs.readFile(payload.filePath, 'utf-8');
    const document = JSON.parse(raw);
    return { success: true, filePath: payload.filePath, document };
  } catch (err: unknown) {
    const error = err instanceof Error ? err.message : String(err);
    return { success: false, error };
  }
});

ipcMain.handle('file:export', async (_, payload: ExportPayload) => {
  try {
    if (typeof payload.data === 'string') {
      await fs.writeFile(payload.filePath, payload.data, 'utf-8');
    } else {
      await fs.writeFile(payload.filePath, Buffer.from(payload.data));
    }
    return { success: true, filePath: payload.filePath };
  } catch (err: unknown) {
    const error = err instanceof Error ? err.message : String(err);
    return { success: false, filePath: payload.filePath, error };
  }
});

ipcMain.handle('file:read', async (_, filePath: string) => {
  try {
    const buffer = await fs.readFile(filePath);
    return { success: true, data: new Uint8Array(buffer) };
  } catch (err: unknown) {
    const error = err instanceof Error ? err.message : String(err);
    return { success: false, error };
  }
});

ipcMain.handle('system:info', async (): Promise<SystemInfo> => {
  return {
    platform: process.platform as 'win32' | 'darwin' | 'linux',
    arch: process.arch,
    nodeVersion: process.versions.node,
    electronVersion: process.versions.electron,
    appVersion: app.getVersion(),
    memory: {
      total: process.getSystemMemoryInfo().total,
      free: process.getSystemMemoryInfo().free,
    },
  };
});

ipcMain.on('window:minimize', () => {
  mainWindow?.minimize();
});

ipcMain.on('window:maximize', () => {
  if (mainWindow?.isMaximized()) {
    mainWindow.unmaximize();
  } else {
    mainWindow?.maximize();
  }
});

ipcMain.on('window:close', () => {
  mainWindow?.close();
});

app.whenReady().then(() => {
  createWindow();

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});
