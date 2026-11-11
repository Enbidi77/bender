import type { DesktopBridgeAPI } from '@blender-elt/contracts';

declare global {
  interface Window {
    electronAPI: DesktopBridgeAPI;
    electronBridge: DesktopBridgeAPI;
  }
}
