import { app, shell, BrowserWindow, ipcMain, dialog, Menu, session } from 'electron';
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

function createApplicationMenu(): void {
  const sendAction = (action: string, payload?: unknown) => {
    if (mainWindow && !mainWindow.isDestroyed()) {
      mainWindow.webContents.send('menu:action', action, payload);
    }
  };

  const isMac = process.platform === 'darwin';

  const template: Electron.MenuItemConstructorOptions[] = [
    ...(isMac
      ? [
          {
            label: app.name,
            submenu: [
              { label: 'About Blender-ELT', click: () => sendAction('help:about') },
              { type: 'separator' as const },
              { role: 'services' as const },
              { type: 'separator' as const },
              { role: 'hide' as const },
              { role: 'hideOthers' as const },
              { role: 'unhide' as const },
              { type: 'separator' as const },
              { role: 'quit' as const },
            ],
          },
        ]
      : []),
    {
      label: 'File',
      submenu: [
        {
          label: 'New Project',
          accelerator: 'CmdOrCtrl+N',
          click: () => sendAction('file:new'),
        },
        {
          label: 'Open...',
          accelerator: 'CmdOrCtrl+O',
          click: () => sendAction('file:open'),
        },
        {
          label: 'Save',
          accelerator: 'CmdOrCtrl+S',
          click: () => sendAction('file:save'),
        },
        {
          label: 'Save As...',
          accelerator: 'CmdOrCtrl+Shift+S',
          click: () => sendAction('file:save-as'),
        },
        { type: 'separator' as const },
        {
          label: 'Import',
          submenu: [
            { label: 'glTF / GLB (.gltf, .glb)', click: () => sendAction('import:gltf') },
            { label: 'Wavefront OBJ (.obj)', click: () => sendAction('import:obj') },
            { label: 'STL (.stl)', click: () => sendAction('import:stl') },
          ],
        },
        {
          label: 'Export',
          submenu: [
            { label: 'glTF 2.0 (.gltf)', click: () => sendAction('export:gltf') },
            { label: 'glTF Binary (.glb)', click: () => sendAction('export:glb') },
            { label: 'Wavefront OBJ (.obj)', click: () => sendAction('export:obj') },
            { label: 'STL (.stl)', click: () => sendAction('export:stl') },
          ],
        },
        { type: 'separator' as const },
        {
          label: 'Preferences...',
          accelerator: 'CmdOrCtrl+,',
          click: () => sendAction('app:preferences'),
        },
        { type: 'separator' as const },
        isMac ? { role: 'close' as const } : { role: 'quit' as const },
      ],
    },
    {
      label: 'Edit',
      submenu: [
        {
          label: 'Undo',
          accelerator: 'CmdOrCtrl+Z',
          click: () => sendAction('edit:undo'),
        },
        {
          label: 'Redo',
          accelerator: isMac ? 'Shift+CmdOrCtrl+Z' : 'CmdOrCtrl+Y',
          click: () => sendAction('edit:redo'),
        },
        { type: 'separator' as const },
        { role: 'cut' as const },
        { role: 'copy' as const },
        { role: 'paste' as const },
        { role: 'selectAll' as const },
      ],
    },
    {
      label: 'Add',
      submenu: [
        {
          label: 'Mesh',
          submenu: [
            { label: 'Cube', click: () => sendAction('add:mesh:cube') },
            { label: 'Sphere', click: () => sendAction('add:mesh:sphere') },
            { label: 'Cylinder', click: () => sendAction('add:mesh:cylinder') },
            { label: 'Cone', click: () => sendAction('add:mesh:cone') },
            { label: 'Plane', click: () => sendAction('add:mesh:plane') },
            { label: 'Torus', click: () => sendAction('add:mesh:torus') },
          ],
        },
        {
          label: 'Light',
          submenu: [
            { label: 'Point Light', click: () => sendAction('add:light:point') },
            { label: 'Directional Light', click: () => sendAction('add:light:directional') },
            { label: 'Spot Light', click: () => sendAction('add:light:spot') },
          ],
        },
        { label: 'Camera', click: () => sendAction('add:camera') },
      ],
    },
    {
      label: 'View',
      submenu: [
        { label: 'Front View', accelerator: 'num1', click: () => sendAction('view:front') },
        { label: 'Right View', accelerator: 'num3', click: () => sendAction('view:right') },
        { label: 'Top View', accelerator: 'num7', click: () => sendAction('view:top') },
        { label: 'Active Camera', accelerator: 'num0', click: () => sendAction('view:camera') },
        {
          label: 'Toggle Persp/Ortho',
          accelerator: 'num5',
          click: () => sendAction('view:persp-ortho'),
        },
        { type: 'separator' as const },
        {
          label: 'Frame Selected',
          accelerator: 'F',
          click: () => sendAction('view:focus'),
        },
        { label: 'Toggle Grid', click: () => sendAction('view:toggle-grid') },
        { label: 'Toggle Wireframe', click: () => sendAction('view:toggle-wireframe') },
        { type: 'separator' as const },
        { role: 'reload' as const },
        { role: 'forceReload' as const },
        { role: 'toggleDevTools' as const },
      ],
    },
    {
      label: 'Window',
      submenu: [
        { role: 'minimize' as const },
        { role: 'zoom' as const },
        ...(isMac
          ? [
              { type: 'separator' as const },
              { role: 'front' as const },
              { type: 'separator' as const },
              { role: 'window' as const },
            ]
          : [{ role: 'close' as const }]),
      ],
    },
    {
      label: 'Help',
      submenu: [
        {
          label: 'Keyboard Shortcuts',
          accelerator: 'CmdOrCtrl+/',
          click: () => sendAction('help:shortcuts'),
        },
        {
          label: 'About Blender-ELT',
          click: () => sendAction('help:about'),
        },
      ],
    },
  ];

  const menu = Menu.buildFromTemplate(template);
  Menu.setApplicationMenu(menu);
}

function createWindow(): void {
  // Set up CSP header for security
  session.defaultSession.webRequest.onHeadersReceived((details, callback) => {
    callback({
      responseHeaders: {
        ...details.responseHeaders,
        'Content-Security-Policy': [
          "default-src 'self' 'unsafe-inline' data: blob:; script-src 'self' 'unsafe-inline' 'unsafe-eval' blob:; style-src 'self' 'unsafe-inline'; img-src 'self' data: blob: https:; font-src 'self' data:; connect-src 'self' data: blob:;",
        ],
      },
    });
  });

  mainWindow = new BrowserWindow({
    width: 1440,
    height: 900,
    minWidth: 1024,
    minHeight: 700,
    show: false,
    frame: false,
    titleBarStyle: 'hidden',
    titleBarOverlay: false,
    autoHideMenuBar: true,
    backgroundColor: '#1d1e22',
    webPreferences: {
      preload: join(__dirname, '../preload/index.js'),
      sandbox: false,
      contextIsolation: true,
      nodeIntegration: false,
    },
  });

  if (process.platform === 'darwin') {
    createApplicationMenu();
  } else {
    mainWindow.setMenu(null);
  }

  mainWindow.on('maximize', () => {
    mainWindow?.webContents.send('window:maximized-change', true);
  });

  mainWindow.on('unmaximize', () => {
    mainWindow?.webContents.send('window:maximized-change', false);
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

ipcMain.on('window:minimize', (event) => {
  const win = BrowserWindow.fromWebContents(event.sender) || mainWindow;
  win?.minimize();
});

ipcMain.on('window:maximize', (event) => {
  const win = BrowserWindow.fromWebContents(event.sender) || mainWindow;
  if (!win) return;
  if (win.isMaximized()) {
    win.unmaximize();
  } else {
    win?.maximize();
  }
});

ipcMain.on('window:close', (event) => {
  const win = BrowserWindow.fromWebContents(event.sender) || mainWindow;
  win?.close();
});

ipcMain.handle('window:is-maximized', (event) => {
  const win = BrowserWindow.fromWebContents(event.sender) || mainWindow;
  return win?.isMaximized() ?? false;
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
