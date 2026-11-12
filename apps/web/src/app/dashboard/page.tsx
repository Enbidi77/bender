'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import {
  Plus,
  Upload,
  Box,
  Trash2,
  Copy,
  Download,
  Calendar,
  Layers,
  Search,
  ExternalLink,
  Sparkles,
  FileCode,
  AlertCircle,
  Check,
} from 'lucide-react';
import { Navigation } from '../../components/Navigation';
import {
  webProjectStorage,
  createDefaultSceneRoot,
  type ProjectSummary,
} from '../../storage/webProjectStorage';
import { selectLocalFile, downloadBlob } from '../../utils/webFileOperations';
import { importScene } from '@blender-elt/file-formats';
import { createProjectMetadata } from '@blender-elt/persistence';

export default function DashboardPage() {
  const router = useRouter();
  const [projects, setProjects] = useState<ProjectSummary[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [isNewModalOpen, setIsNewModalOpen] = useState<boolean>(false);
  const [newProjectName, setNewProjectName] = useState<string>('');
  const [selectedTemplate, setSelectedTemplate] = useState<
    'default' | 'materials' | 'architecture' | 'empty'
  >('default');
  const [isImporting, setIsImporting] = useState<boolean>(false);
  const [statusMessage, setStatusMessage] = useState<{
    text: string;
    type: 'success' | 'error';
  } | null>(null);

  // Load projects from storage
  const refreshProjects = async () => {
    try {
      setLoading(true);
      const list = await webProjectStorage.listProjects();
      setProjects(list);
    } catch (err) {
      console.error('Failed to load projects:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    refreshProjects();
  }, []);

  const showStatus = (text: string, type: 'success' | 'error' = 'success') => {
    setStatusMessage({ text, type });
    setTimeout(() => setStatusMessage(null), 4000);
  };

  // Actions
  const handleCreateProject = async (e: React.FormEvent) => {
    e.preventDefault();
    const name = newProjectName.trim() || 'Untitled Project';
    try {
      const id = await webProjectStorage.createNewProject(name, selectedTemplate);
      setIsNewModalOpen(false);
      setNewProjectName('');
      router.push(`/editor/${id}`);
    } catch (err: unknown) {
      showStatus(err instanceof Error ? err.message : 'Failed to create project', 'error');
    }
  };

  const handleDuplicate = async (id: string, e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    try {
      await webProjectStorage.duplicateProject(id);
      showStatus('Project duplicated');
      await refreshProjects();
    } catch (err: unknown) {
      showStatus(err instanceof Error ? err.message : 'Failed to duplicate project', 'error');
    }
  };

  const handleDelete = async (id: string, name: string, e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (!window.confirm(`Are you sure you want to delete "${name}"?`)) return;

    try {
      await webProjectStorage.deleteProject(id);
      showStatus(`Deleted "${name}"`);
      await refreshProjects();
    } catch (err: unknown) {
      showStatus(err instanceof Error ? err.message : 'Failed to delete project', 'error');
    }
  };

  const handleExportBelt = async (id: string, name: string, e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    try {
      const doc = await webProjectStorage.getProject(id);
      if (!doc) throw new Error('Project not found');

      const json = webProjectStorage.exportProjectToJson(doc);
      const filename = name.endsWith('.belt') ? name : `${name}.belt`;
      downloadBlob(json, filename, 'application/json');
      showStatus(`Downloaded ${filename}`);
    } catch (err: unknown) {
      showStatus(err instanceof Error ? err.message : 'Export failed', 'error');
    }
  };

  const handleImportBeltFile = async () => {
    try {
      setIsImporting(true);
      const file = await selectLocalFile('.belt,.json');
      if (!file) return;

      const text = await file.text();
      const id = await webProjectStorage.importProjectFromJson(text, file.name);
      showStatus(`Imported "${file.name}"`);
      router.push(`/editor/${id}`);
    } catch (err: unknown) {
      showStatus(err instanceof Error ? err.message : 'Failed to import file', 'error');
    } finally {
      setIsImporting(false);
    }
  };

  const handleImport3DFile = async () => {
    try {
      setIsImporting(true);
      const file = await selectLocalFile('.gltf,.glb,.obj,.stl');
      if (!file) return;

      const ext = file.name.split('.').pop()?.toLowerCase();
      let fileData: string | ArrayBuffer | Uint8Array;
      if (ext === 'obj') {
        fileData = await file.text();
      } else {
        fileData = await file.arrayBuffer();
      }

      const format = ext === 'glb' ? 'glb' : ext === 'obj' ? 'obj' : ext === 'stl' ? 'stl' : 'gltf';
      const result = await importScene(format, fileData);

      const root = createDefaultSceneRoot();
      const nodes = result?.nodes || {};
      Object.keys(nodes).forEach((nodeId) => {
        root.childrenIds.push(nodeId);
      });

      const projectName = file.name.replace(/\.[^/.]+$/, '');
      const doc = {
        version: '1.0.0',
        metadata: createProjectMetadata(projectName),
        root,
        nodes,
        collections: {},
        geometries: {},
        materials: {},
      };

      const id = `proj_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
      await webProjectStorage.saveProject(id, projectName, doc as any);
      showStatus(`Created project from ${file.name}`);
      router.push(`/editor/${id}`);
    } catch (err: unknown) {
      showStatus(err instanceof Error ? err.message : 'Failed to import 3D file', 'error');
    } finally {
      setIsImporting(false);
    }
  };

  // Filtered projects
  const filteredProjects = projects.filter((p) =>
    p.name.toLowerCase().includes(searchQuery.toLowerCase()),
  );

  return (
    <div className="min-h-screen bg-[#15161a] text-[#dedede] flex flex-col">
      <Navigation />

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 w-full flex-1">
        {/* Status Toast Notification */}
        {statusMessage && (
          <div
            className={`fixed bottom-6 right-6 z-50 px-4 py-3 rounded-lg shadow-xl border flex items-center gap-2.5 text-xs font-medium ${
              statusMessage.type === 'error'
                ? 'bg-red-950/90 text-red-200 border-red-800'
                : 'bg-emerald-950/90 text-emerald-200 border-emerald-800'
            }`}
          >
            {statusMessage.type === 'error' ? (
              <AlertCircle className="w-4 h-4 text-red-400" />
            ) : (
              <Check className="w-4 h-4 text-emerald-400" />
            )}
            {statusMessage.text}
          </div>
        )}

        {/* Dashboard Header Bar */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-6 border-b border-[#252730]">
          <div>
            <h1 className="text-2xl font-bold text-white flex items-center gap-2">
              <Layers className="w-6 h-6 text-orange-400" />
              Project Workspace
            </h1>
            <p className="text-xs text-zinc-400 mt-1">
              Manage your local 3D studio scenes, open templates, or import external models.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2.5">
            <button
              onClick={handleImportBeltFile}
              disabled={isImporting}
              className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-md bg-[#22242c] hover:bg-[#2b2d38] border border-[#343744] text-xs font-medium text-zinc-200 transition-colors disabled:opacity-50"
            >
              <Upload className="w-3.5 h-3.5 text-zinc-400" />
              Import .belt
            </button>

            <button
              onClick={handleImport3DFile}
              disabled={isImporting}
              className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-md bg-[#22242c] hover:bg-[#2b2d38] border border-[#343744] text-xs font-medium text-zinc-200 transition-colors disabled:opacity-50"
            >
              <FileCode className="w-3.5 h-3.5 text-orange-400" />
              Import 3D Model
            </button>

            <button
              onClick={() => setIsNewModalOpen(true)}
              className="inline-flex items-center gap-1.5 px-4 py-2 rounded-md bg-[#4772b3] hover:bg-[#3b629b] text-white text-xs font-semibold shadow-md shadow-blue-500/20 transition-all active:scale-95"
            >
              <Plus className="w-4 h-4" />
              New Project
            </button>
          </div>
        </div>

        {/* Search & Filter Bar */}
        <div className="mt-6 flex items-center justify-between gap-4">
          <div className="relative flex-1 max-w-md">
            <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-zinc-500" />
            <input
              type="text"
              placeholder="Search projects..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full bg-[#1e2027] border border-[#2e313c] rounded-md pl-9 pr-3 py-1.5 text-xs text-white placeholder-zinc-500 focus:outline-none focus:border-[#4772b3]"
            />
          </div>

          <div className="text-xs text-zinc-500 font-mono">
            {filteredProjects.length} {filteredProjects.length === 1 ? 'project' : 'projects'} found
          </div>
        </div>

        {/* Projects Grid */}
        {loading ? (
          <div className="py-20 text-center text-zinc-500 text-sm">
            Loading projects from storage...
          </div>
        ) : filteredProjects.length === 0 ? (
          <div className="mt-8 p-12 text-center rounded-xl bg-[#1b1d24] border border-[#2b2e38]">
            <Box className="w-10 h-10 mx-auto text-zinc-600 mb-3" />
            <h3 className="text-sm font-semibold text-zinc-300">No projects found</h3>
            <p className="text-xs text-zinc-500 mt-1 max-w-sm mx-auto">
              Create a new project or start from one of the quick starter templates below.
            </p>
            <button
              onClick={() => setIsNewModalOpen(true)}
              className="mt-4 inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded bg-[#4772b3] text-white text-xs font-medium"
            >
              <Plus className="w-3.5 h-3.5" />
              Create Project
            </button>
          </div>
        ) : (
          <div className="mt-6 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
            {filteredProjects.map((p) => {
              const formattedDate = new Date(p.updatedAt).toLocaleDateString(undefined, {
                month: 'short',
                day: 'numeric',
                year: 'numeric',
                hour: '2-digit',
                minute: '2-digit',
              });

              return (
                <div
                  key={p.id}
                  onClick={() => router.push(`/editor/${p.id}`)}
                  className="group cursor-pointer rounded-xl bg-[#1c1e25] border border-[#2c2f3b] hover:border-[#4772b3]/60 transition-all duration-200 hover:-translate-y-0.5 hover:shadow-xl hover:shadow-black/30 flex flex-col justify-between overflow-hidden"
                >
                  {/* Card Visual Banner */}
                  <div className="h-32 bg-gradient-to-br from-[#232630] to-[#18191f] border-b border-[#282a35] p-4 flex items-center justify-center relative overflow-hidden group-hover:from-[#292c38] transition-colors">
                    <Box className="w-12 h-12 text-zinc-600 group-hover:text-orange-400 group-hover:scale-110 transition-all duration-300" />
                    <span className="absolute top-2.5 right-2.5 px-2 py-0.5 rounded text-[10px] font-mono bg-[#141518]/80 text-zinc-400 border border-[#2b2d38]">
                      {p.nodeCount} objects
                    </span>
                  </div>

                  {/* Card Body */}
                  <div className="p-4 flex-1 flex flex-col justify-between">
                    <div>
                      <h3 className="font-semibold text-sm text-white group-hover:text-amber-300 transition-colors truncate">
                        {p.name}
                      </h3>
                      <div className="flex items-center gap-1.5 text-[11px] text-zinc-500 mt-2 font-mono">
                        <Calendar className="w-3 h-3" />
                        {formattedDate}
                      </div>
                    </div>

                    {/* Actions Toolbar */}
                    <div className="mt-4 pt-3 border-t border-[#262833] flex items-center justify-between">
                      <span className="text-xs text-[#82aaff] group-hover:underline flex items-center gap-1 font-medium">
                        Open Studio <ExternalLink className="w-3 h-3" />
                      </span>

                      <div className="flex items-center gap-1">
                        <button
                          title="Export .belt file"
                          onClick={(e) => handleExportBelt(p.id, p.name, e)}
                          className="p-1.5 rounded hover:bg-[#282b36] text-zinc-400 hover:text-zinc-200 transition-colors"
                        >
                          <Download className="w-3.5 h-3.5" />
                        </button>
                        <button
                          title="Duplicate Project"
                          onClick={(e) => handleDuplicate(p.id, e)}
                          className="p-1.5 rounded hover:bg-[#282b36] text-zinc-400 hover:text-zinc-200 transition-colors"
                        >
                          <Copy className="w-3.5 h-3.5" />
                        </button>
                        <button
                          title="Delete Project"
                          onClick={(e) => handleDelete(p.id, p.name, e)}
                          className="p-1.5 rounded hover:bg-red-950/40 text-zinc-400 hover:text-red-400 transition-colors"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {/* Starter Templates Section */}
        <div className="mt-14 pt-8 border-t border-[#252730]">
          <h2 className="text-base font-bold text-white flex items-center gap-2 mb-4">
            <Sparkles className="w-4 h-4 text-amber-400" />
            Starter Project Templates
          </h2>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {[
              {
                id: 'default',
                title: 'Default Studio',
                desc: 'Floor, studio lighting, camera & cube',
              },
              {
                id: 'materials',
                title: 'PBR Showroom',
                desc: 'Gold, chrome, ruby & emerald shaders',
              },
              {
                id: 'architecture',
                title: 'Pavilion',
                desc: 'Geometric architectural columns & slab',
              },
              {
                id: 'empty',
                title: 'Empty Scene',
                desc: 'Blank canvas with camera and light',
              },
            ].map((t) => (
              <button
                key={t.id}
                onClick={async () => {
                  const id = await webProjectStorage.createNewProject(t.title, t.id as any);
                  router.push(`/editor/${id}`);
                }}
                className="text-left p-4 rounded-lg bg-[#191a20] border border-[#272933] hover:border-[#4772b3]/50 hover:bg-[#1e2027] transition-all group"
              >
                <div className="font-semibold text-xs text-white group-hover:text-amber-300">
                  {t.title}
                </div>
                <div className="text-[11px] text-zinc-400 mt-1 leading-snug">{t.desc}</div>
                <div className="text-[10px] text-[#82aaff] mt-3 font-medium flex items-center gap-1">
                  Use Template &rarr;
                </div>
              </button>
            ))}
          </div>
        </div>
      </main>

      {/* New Project Modal */}
      {isNewModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-[#20222a] border border-[#303340] rounded-xl max-w-md w-full p-6 shadow-2xl">
            <h2 className="text-base font-bold text-white mb-1">Create New Project</h2>
            <p className="text-xs text-zinc-400 mb-4">
              Enter a name and choose an initial scene template.
            </p>

            <form onSubmit={handleCreateProject} className="space-y-4">
              <div>
                <label className="block text-xs font-medium text-zinc-300 mb-1">Project Name</label>
                <input
                  type="text"
                  required
                  placeholder="My 3D Scene"
                  value={newProjectName}
                  onChange={(e) => setNewProjectName(e.target.value)}
                  className="w-full bg-[#17181e] border border-[#303340] rounded-md px-3 py-2 text-xs text-white focus:outline-none focus:border-[#4772b3]"
                  autoFocus
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-zinc-300 mb-1">
                  Initial Template
                </label>
                <div className="grid grid-cols-2 gap-2">
                  {[
                    { id: 'default', label: 'Default Studio' },
                    { id: 'materials', label: 'PBR Showroom' },
                    { id: 'architecture', label: 'Pavilion' },
                    { id: 'empty', label: 'Empty Scene' },
                  ].map((tpl) => (
                    <button
                      key={tpl.id}
                      type="button"
                      onClick={() => setSelectedTemplate(tpl.id as any)}
                      className={`px-3 py-2 rounded border text-xs text-left transition-colors ${
                        selectedTemplate === tpl.id
                          ? 'bg-[#4772b3]/20 border-[#4772b3] text-white font-medium'
                          : 'bg-[#18191f] border-[#2b2d38] text-zinc-400 hover:text-zinc-200'
                      }`}
                    >
                      {tpl.label}
                    </button>
                  ))}
                </div>
              </div>

              <div className="pt-3 flex items-center justify-end gap-2 border-t border-[#2b2d38]">
                <button
                  type="button"
                  onClick={() => setIsNewModalOpen(false)}
                  className="px-3.5 py-1.5 rounded bg-[#2b2d38] hover:bg-[#343744] text-xs text-zinc-300 transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-1.5 rounded bg-[#4772b3] hover:bg-[#3b629b] text-xs font-medium text-white shadow transition-colors"
                >
                  Create & Launch
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
