import React, { useState, useMemo } from 'react';
import type { SculptBrushType } from '@blender-elt/contracts';
import { BrushIcon } from './BrushIcons.js';
import { SCULPT_BRUSH_DEFINITIONS, type SculptBrushMetadata, type BrushCategory } from './types.js';
import { cn } from '../common/Button.js';
import { Search, Star, Clock, X } from 'lucide-react';

export interface BrushPickerProps {
  activeBrush: SculptBrushType;
  onSelectBrush: (brush: SculptBrushType) => void;
  recentBrushes?: SculptBrushType[];
  favoriteBrushes?: SculptBrushType[];
  onToggleFavorite?: (brush: SculptBrushType) => void;
  onClose?: () => void;
  className?: string;
}

export const BrushPicker: React.FC<BrushPickerProps> = ({
  activeBrush,
  onSelectBrush,
  recentBrushes = ['draw', 'clay', 'grab', 'smooth'],
  favoriteBrushes: propFavoriteBrushes,
  onToggleFavorite: propOnToggleFavorite,
  onClose,
  className = '',
}) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<BrushCategory | 'all' | 'favorites'>(
    'all',
  );
  const [localFavorites, setLocalFavorites] = useState<SculptBrushType[]>([
    'draw',
    'clay',
    'grab',
    'smooth',
    'mask',
  ]);

  const favorites = propFavoriteBrushes ?? localFavorites;

  const handleToggleFavorite = (brushId: SculptBrushType, e: React.MouseEvent) => {
    e.stopPropagation();
    if (propOnToggleFavorite) {
      propOnToggleFavorite(brushId);
    } else {
      setLocalFavorites((prev) =>
        prev.includes(brushId) ? prev.filter((id) => id !== brushId) : [...prev, brushId],
      );
    }
  };

  // Filtered brushes based on category, search query, and favorites
  const filteredBrushes = useMemo(() => {
    let result = SCULPT_BRUSH_DEFINITIONS;

    if (selectedCategory === 'favorites') {
      result = result.filter((b) => favorites.includes(b.id));
    } else if (selectedCategory !== 'all') {
      result = result.filter((b) => b.category === selectedCategory);
    }

    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase().trim();
      result = result.filter(
        (b) =>
          b.name.toLowerCase().includes(q) ||
          b.description.toLowerCase().includes(q) ||
          b.shortcut.toLowerCase().includes(q) ||
          b.id.toLowerCase().includes(q),
      );
    }

    return result;
  }, [selectedCategory, searchQuery, favorites]);

  // Resolve recent brush items
  const recentBrushItems = useMemo(() => {
    return recentBrushes
      .map((id) => SCULPT_BRUSH_DEFINITIONS.find((b) => b.id === id))
      .filter((b): b is SculptBrushMetadata => Boolean(b));
  }, [recentBrushes]);

  const categories: { id: BrushCategory | 'all' | 'favorites'; label: string; count?: number }[] = [
    { id: 'all', label: 'All', count: SCULPT_BRUSH_DEFINITIONS.length },
    { id: 'volume', label: 'Volume' },
    { id: 'polish', label: 'Polish' },
    { id: 'deform', label: 'Deform' },
    { id: 'mask', label: 'Mask' },
    { id: 'favorites', label: 'Favorites', count: favorites.length },
  ];

  return (
    <div
      className={cn(
        'flex flex-col bg-[#242424] text-gray-200 border border-[#383838] rounded-md shadow-2xl overflow-hidden select-none w-80 max-h-[480px]',
        className,
      )}
    >
      {/* Header & Search */}
      <div className="p-2.5 bg-[#202020] border-b border-[#303030] space-y-2">
        <div className="flex items-center justify-between">
          <span className="text-xs font-bold text-gray-300 tracking-wide uppercase">
            Sculpt Brush Gallery
          </span>
          {onClose && (
            <button
              onClick={onClose}
              className="p-1 rounded text-gray-400 hover:text-white hover:bg-[#333]"
              title="Close gallery"
            >
              <X size={13} />
            </button>
          )}
        </div>

        {/* Search bar */}
        <div className="relative flex items-center">
          <Search size={13} className="absolute left-2 text-gray-400 pointer-events-none" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search brushes or shortcuts (X, G, C...)"
            className="w-full bg-[#181818] border border-[#3e3e3e] focus:border-[#4772b3] focus:outline-none text-xs text-gray-200 pl-7 pr-7 py-1 rounded placeholder:text-gray-500"
          />
          {searchQuery && (
            <button
              onClick={() => setSearchQuery('')}
              className="absolute right-2 text-gray-400 hover:text-white"
            >
              <X size={12} />
            </button>
          )}
        </div>

        {/* Category Tabs */}
        <div className="flex items-center gap-1 overflow-x-auto scrollbar-none pt-0.5">
          {categories.map((cat) => {
            const isActive = selectedCategory === cat.id;
            return (
              <button
                key={cat.id}
                onClick={() => setSelectedCategory(cat.id)}
                className={cn(
                  'px-2 py-0.5 rounded text-[11px] font-medium whitespace-nowrap transition-colors flex items-center gap-1',
                  isActive
                    ? 'bg-[#4772b3] text-white'
                    : 'text-gray-400 hover:text-gray-200 hover:bg-[#303030]',
                )}
              >
                {cat.id === 'favorites' && (
                  <Star size={10} className="fill-amber-400 text-amber-400" />
                )}
                <span>{cat.label}</span>
                {cat.count !== undefined && (
                  <span className="text-[10px] opacity-70">({cat.count})</span>
                )}
              </button>
            );
          })}
        </div>
      </div>

      {/* Recents Bar (when no search query) */}
      {!searchQuery && recentBrushItems.length > 0 && selectedCategory === 'all' && (
        <div className="px-2.5 py-1.5 bg-[#202020]/50 border-b border-[#2d2d2d] flex items-center gap-1 text-[11px] text-gray-400">
          <Clock size={11} className="mr-1 text-gray-500 shrink-0" />
          <span className="text-[10px] uppercase font-semibold text-gray-500 mr-1">Recent:</span>
          <div className="flex items-center gap-1 overflow-x-auto scrollbar-none">
            {recentBrushItems.map((b) => (
              <button
                key={b.id}
                onClick={() => onSelectBrush(b.id)}
                className={cn(
                  'px-1.5 py-0.5 rounded text-[11px] flex items-center gap-1 transition-colors border',
                  activeBrush === b.id
                    ? 'bg-[#4772b3] text-white border-transparent'
                    : 'bg-[#2a2a2a] text-gray-300 border-[#383838] hover:bg-[#353535]',
                )}
              >
                <BrushIcon type={b.id} size={11} />
                <span>{b.name}</span>
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Brush Grid */}
      <div className="flex-1 overflow-y-auto p-2 space-y-1 scrollbar-thin">
        {filteredBrushes.length === 0 ? (
          <div className="py-8 text-center text-gray-500 text-xs">
            No brushes match your criteria.
          </div>
        ) : (
          filteredBrushes.map((brush) => {
            const isActive = activeBrush === brush.id;
            const isFav = favorites.includes(brush.id);

            return (
              <div
                key={brush.id}
                onClick={() => onSelectBrush(brush.id)}
                className={cn(
                  'flex items-center justify-between p-1.5 rounded cursor-pointer transition-colors group',
                  isActive ? 'bg-[#3b5998] text-white' : 'hover:bg-[#303030] text-gray-300',
                )}
              >
                {/* Left: Icon + Details */}
                <div className="flex items-center gap-2.5 min-w-0">
                  <div
                    className={cn(
                      'w-7 h-7 rounded flex items-center justify-center shrink-0',
                      isActive ? 'bg-[#2b4478] text-white' : 'bg-[#1e1e1e] text-gray-300',
                    )}
                  >
                    <BrushIcon type={brush.id} size={16} />
                  </div>
                  <div className="min-w-0">
                    <div className="flex items-center gap-1.5">
                      <span className="text-xs font-semibold truncate">{brush.name}</span>
                      <span className="text-[10px] text-gray-400 capitalize px-1 rounded bg-[#1c1c1c] border border-[#333]">
                        {brush.category}
                      </span>
                    </div>
                    <p className="text-[10px] text-gray-400 truncate max-w-[160px]">
                      {brush.description}
                    </p>
                  </div>
                </div>

                {/* Right: Shortcut badge + Favorite Star */}
                <div className="flex items-center gap-1.5 shrink-0 pl-1">
                  <kbd className="px-1.5 py-0.5 rounded bg-[#1c1c1c] border border-[#353535] text-[10px] font-mono text-gray-400">
                    {brush.shortcut}
                  </kbd>
                  <button
                    onClick={(e) => handleToggleFavorite(brush.id, e)}
                    title={isFav ? 'Remove from favorites' : 'Add to favorites'}
                    className={cn(
                      'p-1 rounded transition-colors',
                      isFav
                        ? 'text-amber-400 hover:text-amber-300'
                        : 'text-gray-500 hover:text-gray-300 opacity-0 group-hover:opacity-100',
                    )}
                  >
                    <Star size={13} className={cn(isFav && 'fill-amber-400')} />
                  </button>
                </div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
};
