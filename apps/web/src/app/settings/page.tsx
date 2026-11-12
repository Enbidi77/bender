'use client';

import React, { useState, useEffect } from 'react';
import {
  Settings,
  Palette,
  Monitor,
  HardDrive,
  Save,
  Trash2,
  Download,
  Upload,
  Check,
  AlertCircle,
} from 'lucide-react';
import { Navigation } from '../../components/Navigation';
import { webProjectStorage } from '../../storage/webProjectStorage';
import { downloadBlob, selectLocalFile } from '../../utils/webFileOperations';

export default function SettingsPage() {
  const [theme, setTheme] = useState<string>('dark');
  const [defaultShading, setDefaultShading] = useState<string>('solid');
  const [defaultFps, setDefaultFps] = useState<number>(24);
  const [showGrid, setShowGrid] = useState<boolean>(true);
  const [autosaveInterval, setAutosaveInterval] = useState<number>(30);
  const [projectCount, setProjectCount] = useState<number>(0);
  const [notification, setNotification] = useState<{
    text: string;
    type: 'success' | 'error';
  } | null>(null);

  useEffect(() => {
    // Load local settings
    if (typeof window !== 'undefined') {
      const savedTheme = localStorage.getItem('belt_pref_theme') || 'dark';
      const savedShading = localStorage.getItem('belt_pref_shading') || 'solid';
      const savedFps = parseInt(localStorage.getItem('belt_pref_fps') || '24', 10);
      const savedGrid = localStorage.getItem('belt_pref_grid') !== 'false';
      const savedAutosave = parseInt(localStorage.getItem('belt_pref_autosave') || '30', 10);

      setTheme(savedTheme);
      setDefaultShading(savedShading);
      setDefaultFps(savedFps);
      setShowGrid(savedGrid);
      setAutosaveInterval(savedAutosave);

      webProjectStorage.listProjects().then((list) => {
        setProjectCount(list.length);
      });
    }
  }, []);

  const notify = (text: string, type: 'success' | 'error' = 'success') => {
    setNotification({ text, type });
    setTimeout(() => setNotification(null), 3500);
  };

  const handleSavePreferences = () => {
    if (typeof window !== 'undefined') {
      localStorage.setItem('belt_pref_theme', theme);
      localStorage.setItem('belt_pref_shading', defaultShading);
      localStorage.setItem('belt_pref_fps', defaultFps.toString());
      localStorage.setItem('belt_pref_grid', showGrid.toString());
      localStorage.setItem('belt_pref_autosave', autosaveInterval.toString());
      notify('Preferences saved successfully!');
    }
  };

  const handleBackupAll = async () => {
    try {
      const list = await webProjectStorage.listProjects();
      const allDocs: Record<string, any> = {};
      for (const p of list) {
        const doc = await webProjectStorage.getProject(p.id);
        if (doc) allDocs[p.id] = { summary: p, document: doc };
      }
      const json = JSON.stringify(allDocs, null, 2);
      downloadBlob(json, `blender-elt-backup-${Date.now()}.json`, 'application/json');
      notify(`Exported ${list.length} projects backup`);
    } catch (err: unknown) {
      notify(err instanceof Error ? err.message : 'Backup failed', 'error');
    }
  };

  const handleRestoreBackup = async () => {
    try {
      const file = await selectLocalFile('.json');
      if (!file) return;

      const text = await file.text();
      const parsed = JSON.parse(text);
      let count = 0;
      for (const [id, item] of Object.entries<any>(parsed)) {
        if (item.document) {
          await webProjectStorage.saveProject(
            id,
            item.summary?.name || item.document?.metadata?.name || 'Restored',
            item.document,
          );
          count++;
        }
      }
      const updated = await webProjectStorage.listProjects();
      setProjectCount(updated.length);
      notify(`Successfully restored ${count} projects!`);
    } catch (err: unknown) {
      notify(err instanceof Error ? err.message : 'Restore failed', 'error');
    }
  };

  const handleClearAll = async () => {
    if (
      !window.confirm('WARNING: This will delete ALL local projects in browser storage! Continue?')
    ) {
      return;
    }
    try {
      const list = await webProjectStorage.listProjects();
      for (const p of list) {
        await webProjectStorage.deleteProject(p.id);
      }
      setProjectCount(0);
      notify('All local projects deleted');
    } catch (err: unknown) {
      notify(err instanceof Error ? err.message : 'Clear failed', 'error');
    }
  };

  return (
    <div className="min-h-screen bg-[#15161a] text-[#dedede] flex flex-col">
      <Navigation />

      <main className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-10 w-full flex-1">
        {notification && (
          <div
            className={`fixed bottom-6 right-6 z-50 px-4 py-3 rounded-lg shadow-xl border flex items-center gap-2.5 text-xs font-medium ${
              notification.type === 'error'
                ? 'bg-red-950/90 text-red-200 border-red-800'
                : 'bg-emerald-950/90 text-emerald-200 border-emerald-800'
            }`}
          >
            {notification.type === 'error' ? (
              <AlertCircle className="w-4 h-4 text-red-400" />
            ) : (
              <Check className="w-4 h-4 text-emerald-400" />
            )}
            {notification.text}
          </div>
        )}

        <div className="pb-6 border-b border-[#252730]">
          <h1 className="text-2xl font-bold text-white flex items-center gap-2">
            <Settings className="w-6 h-6 text-zinc-400" />
            Studio Preferences & Settings
          </h1>
          <p className="text-xs text-zinc-400 mt-1">
            Configure default viewport rendering modes, timeline playback, and storage management.
          </p>
        </div>

        <div className="mt-8 space-y-8">
          {/* Section 1: Appearance & Theme */}
          <div className="bg-[#1b1d24] border border-[#2c2f3b] rounded-xl p-6">
            <h2 className="text-sm font-semibold text-white flex items-center gap-2 mb-4">
              <Palette className="w-4 h-4 text-orange-400" />
              Interface & Theme
            </h2>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs text-zinc-300 font-medium mb-1.5">
                  Theme Preset
                </label>
                <select
                  value={theme}
                  onChange={(e) => setTheme(e.target.value)}
                  className="w-full bg-[#14151a] border border-[#303340] rounded-md px-3 py-2 text-xs text-white focus:outline-none focus:border-[#4772b3]"
                >
                  <option value="dark">Blender Classic Dark (#1d1e22)</option>
                  <option value="charcoal">Deep Charcoal (#121316)</option>
                  <option value="slate">Modern Slate (#1e2129)</option>
                </select>
              </div>

              <div>
                <label className="block text-xs text-zinc-300 font-medium mb-1.5">
                  Default Viewport Shading
                </label>
                <select
                  value={defaultShading}
                  onChange={(e) => setDefaultShading(e.target.value)}
                  className="w-full bg-[#14151a] border border-[#303340] rounded-md px-3 py-2 text-xs text-white focus:outline-none focus:border-[#4772b3]"
                >
                  <option value="solid">Solid (MatCap Studio)</option>
                  <option value="material">Material Preview (PBR)</option>
                  <option value="wireframe">Wireframe</option>
                  <option value="rendered">Rendered Lighting</option>
                </select>
              </div>
            </div>
          </div>

          {/* Section 2: Viewport & Animation */}
          <div className="bg-[#1b1d24] border border-[#2c2f3b] rounded-xl p-6">
            <h2 className="text-sm font-semibold text-white flex items-center gap-2 mb-4">
              <Monitor className="w-4 h-4 text-blue-400" />
              Viewport & Animation
            </h2>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs text-zinc-300 font-medium mb-1.5">
                  Default Animation Frame Rate
                </label>
                <select
                  value={defaultFps}
                  onChange={(e) => setDefaultFps(parseInt(e.target.value, 10))}
                  className="w-full bg-[#14151a] border border-[#303340] rounded-md px-3 py-2 text-xs text-white focus:outline-none focus:border-[#4772b3]"
                >
                  <option value={24}>24 FPS (Cinematic standard)</option>
                  <option value={30}>30 FPS (Video)</option>
                  <option value={60}>60 FPS (Fluid realtime)</option>
                </select>
              </div>

              <div>
                <label className="block text-xs text-zinc-300 font-medium mb-1.5">
                  Autosave Interval
                </label>
                <select
                  value={autosaveInterval}
                  onChange={(e) => setAutosaveInterval(parseInt(e.target.value, 10))}
                  className="w-full bg-[#14151a] border border-[#303340] rounded-md px-3 py-2 text-xs text-white focus:outline-none focus:border-[#4772b3]"
                >
                  <option value={15}>Every 15 seconds</option>
                  <option value={30}>Every 30 seconds</option>
                  <option value={60}>Every 1 minute</option>
                  <option value={0}>Disabled</option>
                </select>
              </div>
            </div>

            <div className="mt-4 flex items-center gap-3">
              <input
                type="checkbox"
                id="showGridCheck"
                checked={showGrid}
                onChange={(e) => setShowGrid(e.target.checked)}
                className="w-4 h-4 rounded bg-[#14151a] border-[#303340] text-[#4772b3] focus:ring-0"
              />
              <label htmlFor="showGridCheck" className="text-xs text-zinc-300 cursor-pointer">
                Show reference grid and Cartesian ground axes in viewport
              </label>
            </div>

            <div className="mt-6 flex justify-end">
              <button
                onClick={handleSavePreferences}
                className="inline-flex items-center gap-1.5 px-4 py-2 rounded-md bg-[#4772b3] hover:bg-[#3b629b] text-white text-xs font-semibold shadow transition-colors"
              >
                <Save className="w-3.5 h-3.5" />
                Save Preferences
              </button>
            </div>
          </div>

          {/* Section 3: Storage Management */}
          <div className="bg-[#1b1d24] border border-[#2c2f3b] rounded-xl p-6">
            <h2 className="text-sm font-semibold text-white flex items-center gap-2 mb-2">
              <HardDrive className="w-4 h-4 text-emerald-400" />
              IndexedDB Storage & Backups
            </h2>
            <p className="text-xs text-zinc-400 mb-6">
              Blender-ELT Web saves your scenes locally on your machine. Currently storing{' '}
              <span className="font-semibold text-white">{projectCount}</span> local{' '}
              {projectCount === 1 ? 'project' : 'projects'}.
            </p>

            <div className="flex flex-wrap items-center gap-3">
              <button
                onClick={handleBackupAll}
                className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-md bg-[#242630] hover:bg-[#2c2f3c] border border-[#343744] text-xs font-medium text-zinc-200 transition-colors"
              >
                <Download className="w-3.5 h-3.5 text-zinc-400" />
                Backup All Projects (.json)
              </button>

              <button
                onClick={handleRestoreBackup}
                className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-md bg-[#242630] hover:bg-[#2c2f3c] border border-[#343744] text-xs font-medium text-zinc-200 transition-colors"
              >
                <Upload className="w-3.5 h-3.5 text-zinc-400" />
                Restore Projects Backup
              </button>

              <button
                onClick={handleClearAll}
                className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-md bg-red-950/40 hover:bg-red-900/50 border border-red-800 text-xs font-medium text-red-300 transition-colors ml-auto"
              >
                <Trash2 className="w-3.5 h-3.5 text-red-400" />
                Clear Local Storage
              </button>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
