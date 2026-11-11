import React, { useState, useRef } from 'react';
import { cn } from '../common/Button.js';

export interface DockLayoutProps {
  toolbar: React.ReactNode;
  viewport: React.ReactNode;
  outliner: React.ReactNode;
  inspector: React.ReactNode;
  timeline: React.ReactNode;
  header: React.ReactNode;
  className?: string;
}

export const DockLayout: React.FC<DockLayoutProps> = ({
  toolbar,
  viewport,
  outliner,
  inspector,
  timeline,
  header,
  className = '',
}) => {
  const [sidebarWidth, setSidebarWidth] = useState<number>(300);
  const [outlinerHeightPercent, setOutlinerHeightPercent] = useState<number>(50);

  const sidebarDragging = useRef<boolean>(false);
  const splitDragging = useRef<boolean>(false);
  const rightSidebarRef = useRef<HTMLDivElement>(null);

  // Horizontal resize for right sidebar
  const handleSidebarMouseDown = (e: React.MouseEvent) => {
    e.preventDefault();
    sidebarDragging.current = true;

    const handleMouseMove = (moveEvent: MouseEvent) => {
      if (!sidebarDragging.current) return;
      const newWidth = window.innerWidth - moveEvent.clientX;
      if (newWidth >= 220 && newWidth <= 550) {
        setSidebarWidth(newWidth);
      }
    };

    const handleMouseUp = () => {
      sidebarDragging.current = false;
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
    };

    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('mouseup', handleMouseUp);
  };

  // Vertical resize inside right sidebar
  const handleSplitMouseDown = (e: React.MouseEvent) => {
    e.preventDefault();
    splitDragging.current = true;

    const handleMouseMove = (moveEvent: MouseEvent) => {
      if (!splitDragging.current || !rightSidebarRef.current) return;
      const rect = rightSidebarRef.current.getBoundingClientRect();
      const relativeY = moveEvent.clientY - rect.top;
      const pct = (relativeY / rect.height) * 100;
      if (pct >= 20 && pct <= 80) {
        setOutlinerHeightPercent(pct);
      }
    };

    const handleMouseUp = () => {
      splitDragging.current = false;
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
    };

    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('mouseup', handleMouseUp);
  };

  return (
    <div
      className={cn(
        'flex flex-col w-screen h-screen overflow-hidden bg-[#1d1e22] text-[#dedede] select-none',
        className,
      )}
    >
      {/* 1. Header Bar */}
      {header}

      {/* 2. Main Workspace */}
      <div className="flex flex-1 overflow-hidden relative">
        {/* Left Toolbar */}
        {toolbar}

        {/* Viewport Center */}
        <main className="flex-1 relative bg-[#1d1e22] overflow-hidden flex flex-col">
          {viewport}
        </main>

        {/* Resizable Splitter Bar (Horizontal) */}
        <div
          onMouseDown={handleSidebarMouseDown}
          className="w-1 bg-[#181818] hover:bg-[#4772b3] cursor-col-resize transition-colors z-20"
        />

        {/* Right Sidebar (Outliner + Properties) */}
        <aside
          ref={rightSidebarRef}
          style={{ width: `${sidebarWidth}px` }}
          className="bg-[#242424] flex flex-col shrink-0 overflow-hidden"
        >
          {/* Outliner (Top) */}
          <div
            style={{ height: `${outlinerHeightPercent}%` }}
            className="overflow-hidden flex flex-col"
          >
            {outliner}
          </div>

          {/* Resizable Splitter Bar (Vertical) */}
          <div
            onMouseDown={handleSplitMouseDown}
            className="h-1 bg-[#181818] hover:bg-[#4772b3] cursor-row-resize transition-colors z-20 shrink-0"
          />

          {/* Inspector (Bottom) */}
          <div
            style={{ height: `${100 - outlinerHeightPercent}%` }}
            className="overflow-hidden flex flex-col"
          >
            {inspector}
          </div>
        </aside>
      </div>

      {/* 3. Bottom Timeline */}
      {timeline}
    </div>
  );
};
