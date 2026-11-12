'use client';

import React, { useState, useEffect, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import type { ProjectDocument } from '@blender-elt/contracts';
import { EditorStudio, ThemeProvider } from '@blender-elt/ui';
import { createWebPlatformBridge } from '../../../bridge/webPlatformBridge';
import { webProjectStorage } from '../../../storage/webProjectStorage';
import { ArrowLeft, Loader2 } from 'lucide-react';

interface EditorClientProps {
  projectId: string;
}

export const WebStudioContainer: React.FC<EditorClientProps> = ({ projectId }) => {
  const router = useRouter();
  const [initialDoc, setInitialDoc] = useState<ProjectDocument | null>(null);
  const [isLoaded, setIsLoaded] = useState<boolean>(false);

  // Load project or template on mount
  useEffect(() => {
    let active = true;

    async function loadProject() {
      try {
        if (projectId && projectId !== 'new') {
          const doc = await webProjectStorage.getProject(projectId);
          if (doc && active) {
            setInitialDoc(doc);
            setIsLoaded(true);
            return;
          }
        }

        if (active) {
          const params = new URLSearchParams(window.location.search);
          const tpl = (params.get('template') as any) || 'default';
          const defaultDoc = webProjectStorage.buildTemplateDocument('Untitled Scene', tpl);
          setInitialDoc(defaultDoc);
          setIsLoaded(true);
        }
      } catch (err) {
        console.error('Failed to load project:', err);
        setIsLoaded(true);
      }
    }

    loadProject();

    return () => {
      active = false;
    };
  }, [projectId]);

  const platformBridge = useMemo(
    () =>
      createWebPlatformBridge({
        projectId,
        onNavigate: (path) => router.push(path),
        onProjectIdAssigned: (newId) => router.replace(`/editor/${newId}`),
      }),
    [projectId, router],
  );

  const headerPrefix = (
    <button
      onClick={() => router.push('/dashboard')}
      title="Return to Projects Dashboard"
      className="flex items-center gap-1 px-2.5 h-full bg-[#202024] hover:bg-[#2b2d38] border-r border-[#181818] text-zinc-400 hover:text-white transition-colors"
    >
      <ArrowLeft className="w-3.5 h-3.5" />
      <span className="text-[11px] font-medium hidden sm:inline">Projects</span>
    </button>
  );

  if (!isLoaded || !initialDoc) {
    return (
      <div className="w-screen h-screen flex flex-col items-center justify-center bg-[#1d1e22] text-gray-300 gap-3">
        <Loader2 className="w-8 h-8 animate-spin text-[#4772b3]" />
        <span className="text-sm font-medium">Loading project environment...</span>
      </div>
    );
  }

  return (
    <EditorStudio
      platformBridge={platformBridge}
      initialProject={{
        document: initialDoc,
        name: initialDoc.metadata?.name || 'Untitled Scene',
        filePath: projectId,
      }}
      headerPrefix={headerPrefix}
    />
  );
};

export default function EditorClient({ projectId }: EditorClientProps) {
  return (
    <ThemeProvider defaultTheme="dark">
      <WebStudioContainer projectId={projectId} />
    </ThemeProvider>
  );
}
