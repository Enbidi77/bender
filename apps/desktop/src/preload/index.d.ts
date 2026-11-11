import type { DesktopBridgeAPI } from '@blender-elt/contracts';

declare global {
  interface Window {
    electronBridge: DesktopBridgeAPI;
  }
}
