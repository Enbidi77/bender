import React from 'react';
import Link from 'next/link';
import {
  Box,
  Layers,
  Palette,
  Play,
  Download,
  Share2,
  HardDrive,
  Cpu,
  Shield,
  ArrowRight,
  Sparkles,
  CheckCircle2,
  Code2,
} from 'lucide-react';
import { Navigation } from '../components/Navigation';

export default function LandingPage() {
  const templates = [
    {
      id: 'default',
      title: 'Default Studio Scene',
      description: 'Standard studio floor with lighting, camera, and classic gold cube.',
      accent: 'from-amber-500/20 to-orange-500/20 border-amber-500/30',
      tag: 'Starter',
    },
    {
      id: 'materials',
      title: 'PBR Materials Showroom',
      description: 'Preconfigured metallic, dielectric, glass, and clay material samples.',
      accent: 'from-purple-500/20 to-pink-500/20 border-purple-500/30',
      tag: 'Materials',
    },
    {
      id: 'architecture',
      title: 'Geometric Pavilion',
      description: 'Architectural column pavilion with floor slab and accent sculpture.',
      accent: 'from-blue-500/20 to-cyan-500/20 border-blue-500/30',
      tag: 'Scene',
    },
    {
      id: 'empty',
      title: 'Empty Canvas',
      description: 'Clean slate with camera and basic lighting ready for custom creation.',
      accent: 'from-zinc-500/20 to-zinc-700/20 border-zinc-600/30',
      tag: 'Clean',
    },
  ];

  const features = [
    {
      icon: Box,
      title: 'Procedural 3D Primitives',
      description:
        'Instantly generate cubes, spheres, cylinders, cones, toruses, and planes with real-time parametric topology.',
    },
    {
      icon: Palette,
      title: 'Physically Based Shaders',
      description:
        'Realistic PBR material engine with adjustable roughness, metalness, emission, alpha transparency, and presets.',
    },
    {
      icon: Play,
      title: 'Animation Timeline',
      description:
        'Scrub frames, adjust frame rates, toggle loop playback, and evaluate motion tracks directly in the browser.',
    },
    {
      icon: Layers,
      title: 'Scene Graph & Hierarchy',
      description:
        'Full outliner tree with parent-child grouping, visibility toggles, multi-selection, and hierarchical transforms.',
    },
    {
      icon: Download,
      title: 'Universal 3D Import / Export',
      description:
        'Export & import industry-standard GLTF, GLB, Wavefront OBJ with MTL, and STL files with 100% browser fidelity.',
    },
    {
      icon: HardDrive,
      title: 'Local-First Persistence',
      description:
        'Saved instantly to IndexedDB with automatic backups, download as .belt native project files, zero cloud required.',
    },
  ];

  return (
    <div className="min-h-screen bg-[#141518] text-[#e0e0e0] flex flex-col selection:bg-[#4772b3] selection:text-white">
      <Navigation />

      {/* Hero Section */}
      <section className="relative overflow-hidden pt-16 pb-20 md:pt-24 md:pb-28 border-b border-[#23242a]">
        {/* Subtle grid background glow */}
        <div className="absolute inset-0 bg-[linear-gradient(to_right,#20222a_1px,transparent_1px),linear-gradient(to_bottom,#20222a_1px,transparent_1px)] bg-[size:4rem_4rem] [mask-image:radial-gradient(ellipse_60%_50%_at_50%_0%,#000_70%,transparent_100%)] opacity-40 pointer-events-none" />

        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 relative z-10 text-center">
          {/* Badge */}
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-[#242630] border border-[#373a46] text-xs font-medium text-orange-400 mb-8 shadow-sm">
            <Sparkles className="w-3.5 h-3.5 text-orange-400" />
            <span>Next-Generation 3D Web Studio</span>
          </div>

          {/* Main Title */}
          <h1 className="text-4xl sm:text-6xl lg:text-7xl font-extrabold tracking-tight text-white max-w-4xl mx-auto leading-[1.1]">
            Create 3D in the Browser with{' '}
            <span className="text-transparent bg-clip-text bg-gradient-to-r from-orange-400 via-amber-300 to-blue-400">
              Blender-ELT
            </span>
          </h1>

          <p className="mt-6 text-lg sm:text-xl text-zinc-400 max-w-2xl mx-auto font-normal leading-relaxed">
            A lightweight, responsive 3D creation studio inspired by Blender. Built on Three.js,
            React Three Fiber, and Next.js — modeling, materials, and rendering without
            installation.
          </p>

          {/* Action CTAs */}
          <div className="mt-10 flex flex-wrap items-center justify-center gap-4">
            <Link
              href="/editor/new"
              className="inline-flex items-center gap-2 px-7 py-3.5 rounded-lg bg-gradient-to-r from-[#ea7600] to-[#e84a27] hover:from-[#f58210] hover:to-[#f35835] text-white font-semibold text-sm transition-all shadow-xl shadow-orange-500/25 active:scale-95"
            >
              <Box className="w-4 h-4" />
              Launch Studio Now
              <ArrowRight className="w-4 h-4" />
            </Link>

            <Link
              href="/dashboard"
              className="inline-flex items-center gap-2 px-6 py-3.5 rounded-lg bg-[#242630] hover:bg-[#2c2f3c] text-white font-medium text-sm border border-[#373a46] transition-all hover:border-[#4772b3]/50"
            >
              <Layers className="w-4 h-4 text-zinc-400" />
              Manage Projects
            </Link>
          </div>

          {/* Stats Bar */}
          <div className="mt-14 pt-8 border-t border-[#23242a] grid grid-cols-2 sm:grid-cols-4 gap-6 max-w-3xl mx-auto text-left sm:text-center">
            <div>
              <div className="text-2xl font-bold text-white">0s</div>
              <div className="text-xs text-zinc-500 uppercase tracking-wider mt-1 font-mono">
                Install Time
              </div>
            </div>
            <div>
              <div className="text-2xl font-bold text-white">60 FPS</div>
              <div className="text-xs text-zinc-500 uppercase tracking-wider mt-1 font-mono">
                Real-time WebGL
              </div>
            </div>
            <div>
              <div className="text-2xl font-bold text-white">4+ Formats</div>
              <div className="text-xs text-zinc-500 uppercase tracking-wider mt-1 font-mono">
                GLTF, GLB, OBJ, STL
              </div>
            </div>
            <div>
              <div className="text-2xl font-bold text-white">100% Local</div>
              <div className="text-xs text-zinc-500 uppercase tracking-wider mt-1 font-mono">
                IndexedDB Privacy
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Starter Templates Section */}
      <section className="py-16 md:py-24 bg-[#18191e]/60 border-b border-[#23242a]">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex flex-col sm:flex-row sm:items-end justify-between mb-12">
            <div>
              <h2 className="text-2xl sm:text-3xl font-bold text-white tracking-tight">
                Quick Start Templates
              </h2>
              <p className="mt-2 text-sm text-zinc-400 max-w-xl">
                Jumpstart your creation workflow with curated scene environments, materials, and
                lighting presets.
              </p>
            </div>
            <Link
              href="/dashboard"
              className="mt-4 sm:mt-0 text-xs text-[#82aaff] hover:underline flex items-center gap-1 font-medium"
            >
              Browse all templates in dashboard <ArrowRight className="w-3.5 h-3.5" />
            </Link>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
            {templates.map((tpl) => (
              <Link
                key={tpl.id}
                href={`/editor/new?template=${tpl.id}`}
                className={`group flex flex-col justify-between p-5 rounded-xl bg-[#20222a] border transition-all duration-200 hover:-translate-y-1 hover:shadow-xl hover:shadow-black/40 ${tpl.accent}`}
              >
                <div>
                  <div className="flex items-center justify-between mb-3">
                    <span className="text-[10px] font-mono uppercase tracking-wider px-2 py-0.5 rounded bg-[#2a2d38] text-zinc-300 border border-[#3b3f4f]">
                      {tpl.tag}
                    </span>
                    <Box className="w-4 h-4 text-zinc-500 group-hover:text-orange-400 transition-colors" />
                  </div>
                  <h3 className="text-base font-semibold text-white group-hover:text-amber-300 transition-colors">
                    {tpl.title}
                  </h3>
                  <p className="mt-2 text-xs text-zinc-400 leading-relaxed">{tpl.description}</p>
                </div>

                <div className="mt-6 pt-3 border-t border-[#2a2d38] flex items-center justify-between text-xs text-zinc-400 group-hover:text-white font-medium">
                  <span>Open in Studio</span>
                  <ArrowRight className="w-3.5 h-3.5 group-hover:translate-x-1 transition-transform" />
                </div>
              </Link>
            ))}
          </div>
        </div>
      </section>

      {/* Feature Grid */}
      <section className="py-20 md:py-28 max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="text-center max-w-3xl mx-auto mb-16">
          <h2 className="text-3xl sm:text-4xl font-extrabold text-white tracking-tight">
            Engineered for 3D Pair Programming & Authoring
          </h2>
          <p className="mt-4 text-sm sm:text-base text-zinc-400">
            Every feature from the desktop edition re-architected to execute natively in modern web
            browsers.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {features.map((feat, i) => {
            const Icon = feat.icon;
            return (
              <div
                key={i}
                className="p-6 rounded-xl bg-[#1c1d24] border border-[#2b2d38] hover:border-[#4772b3]/60 transition-all hover:bg-[#20222a]"
              >
                <div className="w-10 h-10 rounded-lg bg-[#272935] flex items-center justify-center text-orange-400 mb-4 border border-[#353847]">
                  <Icon className="w-5 h-5" />
                </div>
                <h3 className="text-base font-semibold text-white">{feat.title}</h3>
                <p className="mt-2 text-xs text-zinc-400 leading-relaxed">{feat.description}</p>
              </div>
            );
          })}
        </div>
      </section>

      {/* Architecture / Monorepo section */}
      <section className="py-16 bg-[#16171d] border-t border-b border-[#23242a]">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="bg-[#1e2029] rounded-2xl p-8 sm:p-10 border border-[#2e313f] flex flex-col md:flex-row items-center justify-between gap-8">
            <div className="max-w-xl">
              <div className="flex items-center gap-2 text-xs font-mono text-blue-400 uppercase tracking-wider mb-2">
                <Code2 className="w-4 h-4" />
                Monorepo Package Architecture
              </div>
              <h3 className="text-2xl font-bold text-white">100% Reused Core Engine Packages</h3>
              <p className="mt-3 text-xs sm:text-sm text-zinc-400 leading-relaxed">
                Powered by Turborepo, the web app directly imports pure TypeScript packages:
                <code className="text-[#82aaff] mx-1">@blender-elt/scene-core</code>,
                <code className="text-[#82aaff] mx-1">@blender-elt/commands</code>,
                <code className="text-[#82aaff] mx-1">@blender-elt/modeling</code>,
                <code className="text-[#82aaff] mx-1">@blender-elt/materials</code>,
                <code className="text-[#82aaff] mx-1">@blender-elt/viewport</code>, and
                <code className="text-[#82aaff] mx-1">@blender-elt/ui</code>.
              </p>
              <div className="mt-6 flex flex-wrap gap-2">
                {['TypeScript', 'Three.js', 'R3F', 'Next.js 14', 'Zustand', 'Tailwind CSS'].map(
                  (tech) => (
                    <span
                      key={tech}
                      className="px-2.5 py-1 rounded bg-[#282a36] text-[11px] font-mono text-zinc-300 border border-[#3b3f4f]"
                    >
                      {tech}
                    </span>
                  ),
                )}
              </div>
            </div>

            <div className="w-full md:w-auto flex flex-col gap-3 min-w-[220px]">
              <Link
                href="/editor/new"
                className="w-full text-center px-6 py-3 rounded-lg bg-[#4772b3] hover:bg-[#3b629b] text-white font-medium text-xs shadow-md transition-colors"
              >
                Open Studio
              </Link>
              <Link
                href="/dashboard"
                className="w-full text-center px-6 py-3 rounded-lg bg-[#272935] hover:bg-[#2f3241] text-zinc-300 font-medium text-xs border border-[#383b4c] transition-colors"
              >
                View Dashboard
              </Link>
            </div>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="mt-auto py-8 bg-[#121316] text-xs text-zinc-500 border-t border-[#1e1f26]">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-2">
            <Box className="w-4 h-4 text-orange-400" />
            <span className="font-semibold text-zinc-300">Blender-ELT Web</span>
            <span>&copy; {new Date().getFullYear()}</span>
          </div>

          <div className="flex items-center gap-6">
            <Link href="/dashboard" className="hover:text-zinc-300 transition-colors">
              Projects
            </Link>
            <Link href="/settings" className="hover:text-zinc-300 transition-colors">
              Settings
            </Link>
            <Link href="/editor/new" className="hover:text-zinc-300 transition-colors">
              Launch Studio
            </Link>
          </div>
        </div>
      </footer>
    </div>
  );
}
