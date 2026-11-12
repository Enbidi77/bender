import React from 'react';
import type { SculptBrushType, BrushFalloffType } from '@blender-elt/contracts';

interface BrushIconProps {
  type: SculptBrushType;
  className?: string;
  size?: number;
}

export const BrushIcon: React.FC<BrushIconProps> = ({ type, className = '', size = 18 }) => {
  switch (type) {
    case 'draw':
      return (
        <svg
          width={size}
          height={size}
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
          className={className}
        >
          {/* Smooth mound with brush curve */}
          <path d="M3 18c3 0 5-8 9-8s6 8 9 8" />
          <path d="M12 4v4" />
          <path d="M10 6l2-2 2 2" />
        </svg>
      );
    case 'draw-sharp':
      return (
        <svg
          width={size}
          height={size}
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
          className={className}
        >
          {/* Sharp peak with pointed apex */}
          <path d="M3 19h4l5-13 5 13h4" />
          <path d="M12 2v3" />
        </svg>
      );
    case 'clay':
      return (
        <svg
          width={size}
          height={size}
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
          className={className}
        >
          {/* Clay strip layer */}
          <rect x="4" y="10" width="16" height="5" rx="1.5" />
          <rect x="6" y="5" width="12" height="4" rx="1" strokeDasharray="2 2" />
          <path d="M3 19h18" />
        </svg>
      );
    case 'clay-strips':
      return (
        <svg
          width={size}
          height={size}
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
          className={className}
        >
          {/* Parallel rectangular strips */}
          <rect x="3" y="6" width="18" height="4" rx="1" />
          <rect x="5" y="13" width="14" height="4" rx="1" />
        </svg>
      );
    case 'inflate':
      return (
        <svg
          width={size}
          height={size}
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
          className={className}
        >
          {/* Outward inflating circle with radial arrows */}
          <circle cx="12" cy="12" r="6" />
          <path d="M12 2v3M12 19v3M2 12h3M19 12h3" />
        </svg>
      );
    case 'blob':
      return (
        <svg
          width={size}
          height={size}
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
          className={className}
        >
          {/* Droplet / organic volume bubble */}
          <path d="M12 3a6 6 0 0 0-6 6c0 5 6 12 6 12s6-7 6-12a6 6 0 0 0-6-6z" />
          <circle cx="10" cy="8" r="1.5" fill="currentColor" />
        </svg>
      );
    case 'crease':
      return (
        <svg
          width={size}
          height={size}
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
          className={className}
        >
          {/* Deep V-crease with inward pinch arrows */}
          <path d="M3 5h4l5 13 5-13h4" />
          <path d="M8 12l2 2-2 2M16 12l-2 2 2 2" />
        </svg>
      );
    case 'pinch':
      return (
        <svg
          width={size}
          height={size}
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
          className={className}
        >
          {/* Opposing converging arrows */}
          <path d="M4 12h7M20 12h-7" />
          <path d="M8 8l4 4-4 4M16 8l-4 4 4 4" />
          <circle cx="12" cy="12" r="1.5" fill="currentColor" />
        </svg>
      );
    case 'smooth':
      return (
        <svg
          width={size}
          height={size}
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
          className={className}
        >
          {/* Wavy stroke leveling out into smooth curve */}
          <path d="M3 15c2-4 4-4 6 0s4 4 6 0 4-2 6-2" />
          <path d="M3 20h18" strokeDasharray="2 2" />
        </svg>
      );
    case 'flatten':
      return (
        <svg
          width={size}
          height={size}
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
          className={className}
        >
          {/* Planar line with downward pressing bar */}
          <line x1="3" y1="12" x2="21" y2="12" strokeWidth="2.5" />
          <path d="M8 6l4 4 4-4" />
          <path d="M3 18c3-1 6-2 9-2s6 1 9 2" strokeDasharray="2 2" />
        </svg>
      );
    case 'scrape':
      return (
        <svg
          width={size}
          height={size}
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
          className={className}
        >
          {/* Beveled cutting scraper edge */}
          <path d="M4 19l11-14 5 4-11 14z" />
          <path d="M2 21h8" />
        </svg>
      );
    case 'grab':
      return (
        <svg
          width={size}
          height={size}
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
          className={className}
        >
          {/* Hand / grab cursor */}
          <path d="M18 11V6a2 2 0 0 0-4 0v4M14 10V4a2 2 0 0 0-4 0v6M10 10.5V6a2 2 0 0 0-4 0v8" />
          <path d="M6 14a6 6 0 0 0 12 0v-3a2 2 0 0 0-4 0" />
        </svg>
      );
    case 'elastic-deform':
      return (
        <svg
          width={size}
          height={size}
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
          className={className}
        >
          {/* Elastic curved grid lattice */}
          <path d="M4 6c4 2 12 2 16 0" />
          <path d="M4 12c3 5 13 5 16 0" />
          <path d="M4 18c4-2 12-2 16 0" />
          <path d="M8 4c1 4 1 12 0 16M16 4c-1 4-1 12 0 16" />
        </svg>
      );
    case 'mask':
      return (
        <svg
          width={size}
          height={size}
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
          className={className}
        >
          {/* Protective shield with cross-hatch */}
          <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
          <path d="M12 2v20" />
          <path d="M12 7l5 3M12 12l5 3" />
        </svg>
      );
    default:
      return (
        <svg
          width={size}
          height={size}
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          className={className}
        >
          <circle cx="12" cy="12" r="8" />
        </svg>
      );
  }
};

interface FalloffCurvePreviewProps {
  type: BrushFalloffType;
  width?: number;
  height?: number;
  className?: string;
  active?: boolean;
}

export const FalloffCurvePreview: React.FC<FalloffCurvePreviewProps> = ({
  type,
  width = 36,
  height = 20,
  className = '',
  active = false,
}) => {
  let pathD = '';
  switch (type) {
    case 'smooth':
      // S-curve: starts at (2, 2), eases down to (34, 18)
      pathD = 'M 3 3 C 14 3, 20 17, 33 17';
      break;
    case 'sphere':
      // Quarter circle: convex curve
      pathD = 'M 3 3 A 30 14 0 0 1 33 17';
      break;
    case 'sharp':
      // Steep concave curve
      pathD = 'M 3 3 C 6 15, 15 17, 33 17';
      break;
    case 'linear':
      // Straight line
      pathD = 'M 3 3 L 33 17';
      break;
    case 'constant':
      // Step function
      pathD = 'M 3 3 L 31 3 L 31 17 L 33 17';
      break;
  }

  return (
    <svg width={width} height={height} viewBox="0 0 36 20" className={className} fill="none">
      {/* Background grid/axis */}
      <line x1="2" y1="18" x2="34" y2="18" stroke="#3a3a3a" strokeWidth="1" />
      <line x1="2" y1="2" x2="2" y2="18" stroke="#3a3a3a" strokeWidth="1" />
      {/* Falloff curve */}
      <path
        d={pathD}
        stroke={active ? '#60a5fa' : '#dedede'}
        strokeWidth="2"
        strokeLinecap="round"
      />
    </svg>
  );
};
