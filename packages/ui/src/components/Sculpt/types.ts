export type {
  SculptBrushType,
  BrushFalloffType,
  SculptBrushConfig,
  SculptStrokeSettings,
  SymmetryConfig,
  SculptMaskOperation,
  VoxelRemeshConfig,
  SculptSessionState,
} from '@blender-elt/contracts';

import type { SculptBrushType, BrushFalloffType } from '@blender-elt/contracts';

export type BrushCategory = 'deform' | 'volume' | 'polish' | 'mask';

export interface SculptBrushMetadata {
  id: SculptBrushType;
  name: string;
  category: BrushCategory;
  shortcut: string;
  description: string;
  defaultRadius: number;
  defaultStrength: number;
  defaultFalloff: BrushFalloffType;
  supportsAccumulate?: boolean;
}

export const SCULPT_BRUSH_DEFINITIONS: SculptBrushMetadata[] = [
  // Volume Brushes
  {
    id: 'draw',
    name: 'Draw',
    category: 'volume',
    shortcut: 'X',
    description: 'Displaces vertices outward or inward along the surface normal.',
    defaultRadius: 50,
    defaultStrength: 0.5,
    defaultFalloff: 'smooth',
    supportsAccumulate: true,
  },
  {
    id: 'draw-sharp',
    name: 'Draw Sharp',
    category: 'volume',
    shortcut: 'Shift+D',
    description: 'Creates sharp ridges or creased strokes with narrow falloff.',
    defaultRadius: 35,
    defaultStrength: 0.6,
    defaultFalloff: 'sharp',
    supportsAccumulate: true,
  },
  {
    id: 'clay',
    name: 'Clay',
    category: 'volume',
    shortcut: 'C',
    description: 'Builds up planar strips of clay on the mesh surface.',
    defaultRadius: 50,
    defaultStrength: 0.5,
    defaultFalloff: 'smooth',
    supportsAccumulate: true,
  },
  {
    id: 'clay-strips',
    name: 'Clay Strips',
    category: 'volume',
    shortcut: 'Space+C',
    description: 'Applies flat rectangular clay ribbon strokes with hard edges.',
    defaultRadius: 40,
    defaultStrength: 0.6,
    defaultFalloff: 'linear',
    supportsAccumulate: false,
  },
  {
    id: 'inflate',
    name: 'Inflate',
    category: 'volume',
    shortcut: 'I',
    description: 'Pushes vertices outward along their local normals to expand volume.',
    defaultRadius: 50,
    defaultStrength: 0.35,
    defaultFalloff: 'smooth',
    supportsAccumulate: true,
  },
  {
    id: 'blob',
    name: 'Blob',
    category: 'volume',
    shortcut: 'B',
    description: 'Pulls surface into spherical volume deposits with spherical falloff.',
    defaultRadius: 50,
    defaultStrength: 0.4,
    defaultFalloff: 'sphere',
    supportsAccumulate: true,
  },

  // Polish & Shape Brushes
  {
    id: 'crease',
    name: 'Crease',
    category: 'polish',
    shortcut: 'Shift+C',
    description: 'Creates deep indentations while pinching opposing vertices together.',
    defaultRadius: 35,
    defaultStrength: 0.5,
    defaultFalloff: 'sharp',
    supportsAccumulate: true,
  },
  {
    id: 'pinch',
    name: 'Pinch',
    category: 'polish',
    shortcut: 'P',
    description: 'Pulls vertices radially toward the center of the brush cursor.',
    defaultRadius: 45,
    defaultStrength: 0.5,
    defaultFalloff: 'smooth',
    supportsAccumulate: true,
  },
  {
    id: 'smooth',
    name: 'Smooth',
    category: 'polish',
    shortcut: 'S',
    description: 'Averages vertex positions with their neighbors to eliminate roughness.',
    defaultRadius: 50,
    defaultStrength: 0.6,
    defaultFalloff: 'smooth',
    supportsAccumulate: false,
  },
  {
    id: 'flatten',
    name: 'Flatten',
    category: 'polish',
    shortcut: 'T',
    description: 'Projects surface vertices onto the average hit plane.',
    defaultRadius: 50,
    defaultStrength: 0.5,
    defaultFalloff: 'smooth',
    supportsAccumulate: false,
  },
  {
    id: 'scrape',
    name: 'Scrape',
    category: 'polish',
    shortcut: 'Alt+S',
    description: 'Levels peaks and cuts away geometry above the calculated plane.',
    defaultRadius: 50,
    defaultStrength: 0.5,
    defaultFalloff: 'smooth',
    supportsAccumulate: false,
  },

  // Deform Brushes
  {
    id: 'grab',
    name: 'Grab',
    category: 'deform',
    shortcut: 'G',
    description: 'Translates a group of vertices following mouse motion smoothly.',
    defaultRadius: 75,
    defaultStrength: 1.0,
    defaultFalloff: 'smooth',
    supportsAccumulate: false,
  },
  {
    id: 'elastic-deform',
    name: 'Elastic Deform',
    category: 'deform',
    shortcut: 'K',
    description: 'Deforms surface while preserving local geometric volume realistically.',
    defaultRadius: 75,
    defaultStrength: 0.8,
    defaultFalloff: 'smooth',
    supportsAccumulate: false,
  },

  // Masking
  {
    id: 'mask',
    name: 'Mask',
    category: 'mask',
    shortcut: 'M',
    description: 'Paints a protective weight mask to lock vertices from being displaced.',
    defaultRadius: 50,
    defaultStrength: 1.0,
    defaultFalloff: 'smooth',
    supportsAccumulate: true,
  },
];

export const BRUSH_METADATA_MAP: Record<SculptBrushType, SculptBrushMetadata> =
  SCULPT_BRUSH_DEFINITIONS.reduce(
    (acc, brush) => {
      acc[brush.id] = brush;
      return acc;
    },
    {} as Record<SculptBrushType, SculptBrushMetadata>,
  );
