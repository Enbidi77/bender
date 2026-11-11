import { contextBridge, ipcRenderer } from 'electron';
import type {
  DesktopBridgeAPI,
  FileDialogOptions,
  SaveProjectPayload,
  OpenProjectPayload,
  ExportPayload,
} from '@blender-elt/contracts';

const api: DesktopBridgeAPI = {
  showOpenDialog: (options?: FileDialogOptions) => ipcRenderer.invoke('dialog:open', options),
  showSaveDialog: (options?: FileDialogOptions) => ipcRenderer.invoke('dialog:save', options),

  saveProject: (payload: SaveProjectPayload) => ipcRenderer.invoke('project:save', payload),
  openProject: (payload: OpenProjectPayload) => ipcRenderer.invoke('project:open', payload),

  exportFile: (payload: ExportPayload) => ipcRenderer.invoke('file:export', payload),
  readFile: (filePath: string) => ipcRenderer.invoke('file:read', filePath),

  getSystemInfo: () => ipcRenderer.invoke('system:info'),
  minimize: () => ipcRenderer.send('window:minimize'),
  maximize: () => ipcRenderer.send('window:maximize'),
  close: () => ipcRenderer.send('window:close'),

  onMenuAction: (callback: (action: string, payload?: unknown) => void) => {
    const handler = (_: Electron.IpcRendererEvent, action: string, payload?: unknown) => {
      callback(action, payload);
    };
    ipcRenderer.on('menu:action', handler);
    return () => {
      ipcRenderer.removeListener('menu:action', handler);
    };
  },
};

contextBridge.exposeInMainWorld('electronBridge', api);
