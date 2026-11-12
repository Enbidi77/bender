'use client';

import dynamic from 'next/dynamic';
import { Loader2, Box } from 'lucide-react';

const EditorClient = dynamic(() => import('./EditorClient'), {
  ssr: false,
  loading: () => (
    <div className="w-screen h-screen flex flex-col items-center justify-center bg-[#1d1e22] text-zinc-300 select-none">
      <div className="w-12 h-12 rounded-xl bg-gradient-to-tr from-[#ea7600] to-[#f49b42] flex items-center justify-center text-white shadow-lg shadow-orange-500/20 mb-4 animate-pulse">
        <Box className="w-6 h-6 text-white" />
      </div>
      <div className="flex items-center gap-2 text-sm font-medium">
        <Loader2 className="w-4 h-4 animate-spin text-orange-400" />
        Initializing 3D Viewport Engine...
      </div>
      <p className="text-xs text-zinc-500 mt-2 font-mono">Loading WebGL & Three.js shaders</p>
    </div>
  ),
});

export default function EditorPage({ params }: { params: { projectId: string } }) {
  return <EditorClient projectId={params.projectId} />;
}
