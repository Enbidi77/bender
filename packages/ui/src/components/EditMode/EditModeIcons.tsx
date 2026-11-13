import React from 'react';

export interface EditIconProps {
  size?: number;
  className?: string;
}

export const VertexSelectIcon: React.FC<EditIconProps> = ({ size = 16, className = '' }) => (
  <svg
    width={size}
    height={size}
    viewBox="0 0 16 16"
    fill="none"
    xmlns="http://www.w3.org/2000/svg"
    className={className}
  >
    {/* Background wireframe cube corner */}
    <path d="M4 12V4L12 4" stroke="currentColor" strokeWidth="1.2" strokeOpacity="0.4" />
    <path d="M4 4L9 9" stroke="currentColor" strokeWidth="1" strokeOpacity="0.3" />
    {/* Active vertex dot at top-left corner */}
    <rect x="2.5" y="2.5" width="3.5" height="3.5" rx="0.5" fill="currentColor" />
  </svg>
);

export const EdgeSelectIcon: React.FC<EditIconProps> = ({ size = 16, className = '' }) => (
  <svg
    width={size}
    height={size}
    viewBox="0 0 16 16"
    fill="none"
    xmlns="http://www.w3.org/2000/svg"
    className={className}
  >
    {/* Background wireframe face */}
    <path d="M3 13V3H13V13H3Z" stroke="currentColor" strokeWidth="1" strokeOpacity="0.3" />
    {/* Highlighted active edge (top edge) */}
    <line
      x1="3"
      y1="3"
      x2="13"
      y2="3"
      stroke="currentColor"
      strokeWidth="2.2"
      strokeLinecap="round"
    />
  </svg>
);

export const FaceSelectIcon: React.FC<EditIconProps> = ({ size = 16, className = '' }) => (
  <svg
    width={size}
    height={size}
    viewBox="0 0 16 16"
    fill="none"
    xmlns="http://www.w3.org/2000/svg"
    className={className}
  >
    {/* Filled face with dark border */}
    <rect
      x="3"
      y="3"
      width="10"
      height="10"
      rx="1"
      fill="currentColor"
      fillOpacity="0.4"
      stroke="currentColor"
      strokeWidth="1.2"
    />
    <circle cx="8" cy="8" r="1.5" fill="currentColor" />
  </svg>
);

export const Cursor3DIcon: React.FC<EditIconProps> = ({ size = 16, className = '' }) => (
  <svg
    width={size}
    height={size}
    viewBox="0 0 16 16"
    fill="none"
    xmlns="http://www.w3.org/2000/svg"
    className={className}
  >
    <circle cx="8" cy="8" r="5" stroke="currentColor" strokeWidth="1" strokeDasharray="2 1.5" />
    <circle cx="8" cy="8" r="1.5" fill="currentColor" />
    <line
      x1="8"
      y1="1"
      x2="8"
      y2="4"
      stroke="currentColor"
      strokeWidth="1.2"
      strokeLinecap="round"
    />
    <line
      x1="8"
      y1="12"
      x2="8"
      y2="15"
      stroke="currentColor"
      strokeWidth="1.2"
      strokeLinecap="round"
    />
    <line
      x1="1"
      y1="8"
      x2="4"
      y2="8"
      stroke="currentColor"
      strokeWidth="1.2"
      strokeLinecap="round"
    />
    <line
      x1="12"
      y1="8"
      x2="15"
      y2="8"
      stroke="currentColor"
      strokeWidth="1.2"
      strokeLinecap="round"
    />
  </svg>
);

export const ExtrudeIcon: React.FC<EditIconProps> = ({ size = 16, className = '' }) => (
  <svg
    width={size}
    height={size}
    viewBox="0 0 16 16"
    fill="none"
    xmlns="http://www.w3.org/2000/svg"
    className={className}
  >
    {/* Base square */}
    <rect
      x="3"
      y="9"
      width="10"
      height="4.5"
      rx="0.5"
      stroke="currentColor"
      strokeWidth="1"
      strokeOpacity="0.4"
    />
    {/* Extruded top square */}
    <rect
      x="3"
      y="2.5"
      width="10"
      height="4.5"
      rx="0.5"
      fill="currentColor"
      fillOpacity="0.25"
      stroke="currentColor"
      strokeWidth="1.2"
    />
    {/* Upward extrusion arrow / lines */}
    <line x1="3" y1="9" x2="3" y2="7" stroke="currentColor" strokeWidth="1.2" />
    <line x1="13" y1="9" x2="13" y2="7" stroke="currentColor" strokeWidth="1.2" />
    <path
      d="M8 8V4.5M8 4.5L6.5 6M8 4.5L9.5 6"
      stroke="currentColor"
      strokeWidth="1.2"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
  </svg>
);

export const InsetIcon: React.FC<EditIconProps> = ({ size = 16, className = '' }) => (
  <svg
    width={size}
    height={size}
    viewBox="0 0 16 16"
    fill="none"
    xmlns="http://www.w3.org/2000/svg"
    className={className}
  >
    {/* Outer face boundary */}
    <rect
      x="2"
      y="2"
      width="12"
      height="12"
      rx="1"
      stroke="currentColor"
      strokeWidth="1"
      strokeOpacity="0.4"
    />
    {/* Inset inner face */}
    <rect
      x="5.5"
      y="5.5"
      width="5"
      height="5"
      rx="0.5"
      fill="currentColor"
      fillOpacity="0.3"
      stroke="currentColor"
      strokeWidth="1.2"
    />
    {/* Diagonal corner connect lines */}
    <line
      x1="2"
      y1="2"
      x2="5.5"
      y2="5.5"
      stroke="currentColor"
      strokeWidth="1"
      strokeOpacity="0.4"
    />
    <line
      x1="14"
      y1="2"
      x2="10.5"
      y2="5.5"
      stroke="currentColor"
      strokeWidth="1"
      strokeOpacity="0.4"
    />
    <line
      x1="2"
      y1="14"
      x2="5.5"
      y2="10.5"
      stroke="currentColor"
      strokeWidth="1"
      strokeOpacity="0.4"
    />
    <line
      x1="14"
      y1="14"
      x2="10.5"
      y2="10.5"
      stroke="currentColor"
      strokeWidth="1"
      strokeOpacity="0.4"
    />
  </svg>
);

export const BevelIcon: React.FC<EditIconProps> = ({ size = 16, className = '' }) => (
  <svg
    width={size}
    height={size}
    viewBox="0 0 16 16"
    fill="none"
    xmlns="http://www.w3.org/2000/svg"
    className={className}
  >
    {/* 90-degree corner with chamfer cut */}
    <path
      d="M3 13V7L7 3H13V13H3Z"
      stroke="currentColor"
      strokeWidth="1.2"
      fill="currentColor"
      fillOpacity="0.15"
      strokeLinejoin="round"
    />
    {/* Bevel cut line highlight */}
    <line x1="3" y1="7" x2="7" y2="3" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
  </svg>
);

export const LoopCutIcon: React.FC<EditIconProps> = ({ size = 16, className = '' }) => (
  <svg
    width={size}
    height={size}
    viewBox="0 0 16 16"
    fill="none"
    xmlns="http://www.w3.org/2000/svg"
    className={className}
  >
    {/* Outer cylinder/quad frame */}
    <rect
      x="3"
      y="2.5"
      width="10"
      height="11"
      rx="1"
      stroke="currentColor"
      strokeWidth="1"
      strokeOpacity="0.4"
    />
    {/* Loop cut line through the middle (horizontal) with indicator dots */}
    <line
      x1="2"
      y1="8"
      x2="14"
      y2="8"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
    />
    <circle cx="5" cy="8" r="1.2" fill="currentColor" />
    <circle cx="11" cy="8" r="1.2" fill="currentColor" />
  </svg>
);

export const KnifeIcon: React.FC<EditIconProps> = ({ size = 16, className = '' }) => (
  <svg
    width={size}
    height={size}
    viewBox="0 0 16 16"
    fill="none"
    xmlns="http://www.w3.org/2000/svg"
    className={className}
  >
    {/* Scalpel blade angled */}
    <path
      d="M13 2L9.5 5.5L4 11L2 14L5 12L10.5 6.5L14 3L13 2Z"
      fill="currentColor"
      fillOpacity="0.25"
      stroke="currentColor"
      strokeWidth="1.2"
      strokeLinejoin="round"
    />
    <line x1="9.5" y1="5.5" x2="10.5" y2="6.5" stroke="currentColor" strokeWidth="1.2" />
    {/* Cut marks */}
    <line
      x1="1"
      y1="15"
      x2="5"
      y2="15"
      stroke="currentColor"
      strokeWidth="1"
      strokeLinecap="round"
      strokeOpacity="0.5"
    />
  </svg>
);

export const PolyBuildIcon: React.FC<EditIconProps> = ({ size = 16, className = '' }) => (
  <svg
    width={size}
    height={size}
    viewBox="0 0 16 16"
    fill="none"
    xmlns="http://www.w3.org/2000/svg"
    className={className}
  >
    {/* Existing polygon */}
    <path
      d="M2 13L2 6L8 3L8 10L2 13Z"
      fill="currentColor"
      fillOpacity="0.25"
      stroke="currentColor"
      strokeWidth="1"
    />
    {/* New building polygon with dashed line */}
    <path
      d="M8 3L14 5L14 12L8 10"
      stroke="currentColor"
      strokeWidth="1.2"
      strokeDasharray="1.5 1.5"
    />
    {/* Interactive cursor vertex */}
    <circle cx="14" cy="5" r="1.5" fill="currentColor" />
  </svg>
);

export const SpinIcon: React.FC<EditIconProps> = ({ size = 16, className = '' }) => (
  <svg
    width={size}
    height={size}
    viewBox="0 0 16 16"
    fill="none"
    xmlns="http://www.w3.org/2000/svg"
    className={className}
  >
    {/* Curved arc arrow */}
    <path
      d="M3 10A6 6 0 1 1 12.5 11"
      stroke="currentColor"
      strokeWidth="1.3"
      strokeLinecap="round"
    />
    <path
      d="M11 13.5L13.5 11L11 8.5"
      stroke="currentColor"
      strokeWidth="1.3"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
    {/* Center pivot point */}
    <circle cx="8" cy="8" r="1.5" fill="currentColor" />
  </svg>
);

export const SmoothIcon: React.FC<EditIconProps> = ({ size = 16, className = '' }) => (
  <svg
    width={size}
    height={size}
    viewBox="0 0 16 16"
    fill="none"
    xmlns="http://www.w3.org/2000/svg"
    className={className}
  >
    {/* Smooth sin curve */}
    <path
      d="M2 10C4 6 6 6 8 8C10 10 12 10 14 6"
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinecap="round"
    />
    <path
      d="M2 13C4 10 6 10 8 11.5C10 13 12 13 14 10"
      stroke="currentColor"
      strokeWidth="1"
      strokeOpacity="0.4"
      strokeLinecap="round"
    />
  </svg>
);
