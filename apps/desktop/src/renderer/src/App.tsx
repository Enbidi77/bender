import React, { useMemo } from 'react';
import { EditorStudio, ThemeProvider } from '@blender-elt/ui';
import { createDesktopPlatformBridge } from './bridge/desktopPlatformBridge.js';

export const AppContent: React.FC = () => {
  const platformBridge = useMemo(() => createDesktopPlatformBridge(), []);
  return <EditorStudio platformBridge={platformBridge} />;
};

export const App: React.FC = () => {
  return (
    <ThemeProvider defaultTheme="dark">
      <AppContent />
    </ThemeProvider>
  );
};

export default App;
