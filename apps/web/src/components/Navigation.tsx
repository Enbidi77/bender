'use client';

import React from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Box, Layers, Settings, Plus, Sparkles, ExternalLink } from 'lucide-react';

export const Navigation: React.FC = () => {
  const pathname = usePathname();

  const navLinks = [
    { href: '/', label: 'Overview', icon: Box },
    { href: '/dashboard', label: 'Projects', icon: Layers },
    { href: '/settings', label: 'Settings', icon: Settings },
  ];

  return (
    <header className="sticky top-0 z-50 w-full bg-[#18181c]/90 backdrop-blur-md border-b border-[#28282e]">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-14 flex items-center justify-between">
        {/* Brand */}
        <div className="flex items-center gap-6">
          <Link href="/" className="flex items-center gap-2.5 group">
            <div className="w-8 h-8 rounded bg-gradient-to-br from-[#ea7600] to-[#e84a27] flex items-center justify-center shadow-lg shadow-orange-500/20 group-hover:scale-105 transition-transform">
              <Box className="w-4 h-4 text-white" />
            </div>
            <div className="flex flex-col">
              <span className="font-bold text-sm tracking-wide text-white flex items-center gap-1.5">
                Blender-ELT
                <span className="text-[10px] font-semibold bg-[#4772b3]/30 text-[#82aaff] px-1.5 py-0.5 rounded border border-[#4772b3]/40">
                  WEB
                </span>
              </span>
              <span className="text-[10px] text-zinc-400 font-mono">v0.1.0 Beta</span>
            </div>
          </Link>

          {/* Nav links */}
          <nav className="hidden md:flex items-center gap-1">
            {navLinks.map((item) => {
              const Icon = item.icon;
              const isActive =
                item.href === '/' ? pathname === '/' : pathname.startsWith(item.href);

              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={`flex items-center gap-2 px-3 py-1.5 rounded-md text-xs font-medium transition-colors ${
                    isActive
                      ? 'bg-[#28282e] text-white shadow-sm'
                      : 'text-zinc-400 hover:text-white hover:bg-[#202024]'
                  }`}
                >
                  <Icon className="w-3.5 h-3.5" />
                  {item.label}
                </Link>
              );
            })}
          </nav>
        </div>

        {/* Action CTAs */}
        <div className="flex items-center gap-3">
          <Link
            href="/dashboard"
            className="hidden sm:inline-flex items-center gap-1.5 text-xs text-zinc-400 hover:text-white px-3 py-1.5 rounded hover:bg-[#202024] transition-colors"
          >
            <Sparkles className="w-3.5 h-3.5 text-amber-400" />
            Templates
          </Link>

          <Link
            href="/editor/new"
            className="inline-flex items-center gap-1.5 bg-[#4772b3] hover:bg-[#3b629b] text-white text-xs font-medium px-3.5 py-1.5 rounded-md transition-all shadow-md shadow-blue-500/20 active:scale-95"
          >
            <Plus className="w-3.5 h-3.5" />
            Launch Studio
          </Link>
        </div>
      </div>
    </header>
  );
};
