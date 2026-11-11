import React, { useState } from 'react';
import {
  Layers,
  Box,
  Sun,
  Video,
  Eye,
  EyeOff,
  Trash2,
  Plus,
  ChevronRight,
  ChevronDown,
  Folder,
} from 'lucide-react';
import { cn } from '../common/Button.js';
import type { SceneNode, SceneCollection } from '@blender-elt/contracts';

export interface OutlinerPanelProps {
  nodes: Record<string, SceneNode>;
  collections?: Record<string, SceneCollection>;
  selectedNodeIds: string[];
  activeNodeId: string | null;
  onSelectNode: (nodeId: string, multi?: boolean) => void;
  onToggleVisibility: (nodeId: string, currentVisible: boolean) => void;
  onDeleteNode: (nodeId: string) => void;
  onRenameNode: (nodeId: string, newName: string) => void;
  onAddPrimitive?: (type: 'cube' | 'sphere' | 'plane' | 'cylinder' | 'light' | 'camera') => void;
  className?: string;
}

export const OutlinerPanel: React.FC<OutlinerPanelProps> = ({
  nodes,
  collections = {},
  selectedNodeIds,
  activeNodeId,
  onSelectNode,
  onToggleVisibility,
  onDeleteNode,
  onRenameNode,
  onAddPrimitive,
  className = '',
}) => {
  const [editingNodeId, setEditingNodeId] = useState<string | null>(null);
  const [editingName, setEditingName] = useState<string>('');
  const [showAddMenu, setShowAddMenu] = useState<boolean>(false);
  const [collapsedCollections, setCollapsedCollections] = useState<Record<string, boolean>>({});

  const toggleCollection = (colId: string) => {
    setCollapsedCollections((prev) => ({
      ...prev,
      [colId]: !prev[colId],
    }));
  };

  const handleStartRename = (node: SceneNode, e: React.MouseEvent) => {
    e.stopPropagation();
    setEditingNodeId(node.id);
    setEditingName(node.name);
  };

  const handleFinishRename = (nodeId: string) => {
    if (editingName.trim()) {
      onRenameNode(nodeId, editingName.trim());
    }
    setEditingNodeId(null);
  };

  const getNodeIcon = (node: SceneNode) => {
    switch (node.type) {
      case 'mesh':
        return <Box size={13} className="text-amber-500 shrink-0" />;
      case 'light':
        return <Sun size={13} className="text-yellow-400 shrink-0" />;
      case 'camera':
        return <Video size={13} className="text-sky-400 shrink-0" />;
      case 'group':
        return <Folder size={13} className="text-indigo-400 shrink-0" />;
      default:
        return <Box size={13} className="text-gray-400 shrink-0" />;
    }
  };

  // Group nodes by collection or standalone
  const collectionList = Object.values(collections);
  const nodeIdsInCollections = new Set<string>();
  collectionList.forEach((c) => c.nodeIds.forEach((id) => nodeIdsInCollections.add(id)));

  const uncollectedNodes = Object.values(nodes).filter(
    (n) => !nodeIdsInCollections.has(n.id) && n.parentId === 'root',
  );

  const renderNodeItem = (node: SceneNode, depth: number = 0) => {
    const isSelected = selectedNodeIds.includes(node.id);
    const isActive = activeNodeId === node.id;
    const isEditing = editingNodeId === node.id;

    return (
      <div
        key={node.id}
        onClick={(e) => {
          onSelectNode(node.id, e.shiftKey || e.ctrlKey || e.metaKey);
        }}
        onDoubleClick={(e) => handleStartRename(node, e)}
        style={{ paddingLeft: `${depth * 14 + 10}px` }}
        className={cn(
          'group flex items-center justify-between py-1 pr-2 rounded text-xs select-none cursor-pointer transition-colors',
          {
            'bg-[#4772b3] text-white font-medium': isActive,
            'bg-[#374c6e] text-white': isSelected && !isActive,
            'hover:bg-[#353535] text-gray-300': !isSelected,
            'opacity-50': !node.visible,
          },
        )}
      >
        <div className="flex items-center gap-1.5 flex-1 min-w-0 pr-1">
          {getNodeIcon(node)}

          {isEditing ? (
            <input
              type="text"
              autoFocus
              value={editingName}
              onChange={(e) => setEditingName(e.target.value)}
              onBlur={() => handleFinishRename(node.id)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') handleFinishRename(node.id);
                if (e.key === 'Escape') setEditingNodeId(null);
              }}
              onClick={(e) => e.stopPropagation()}
              className="bg-[#1d1e22] text-white px-1 py-0.5 rounded text-xs border border-[#4772b3] focus:outline-none w-full"
            />
          ) : (
            <span className="truncate select-none">{node.name}</span>
          )}
        </div>

        {/* Action icons */}
        <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
          {/* Visibility Toggle */}
          <button
            onClick={(e) => {
              e.stopPropagation();
              onToggleVisibility(node.id, node.visible);
            }}
            title={node.visible ? 'Hide (H)' : 'Show (Alt+H)'}
            className={cn('p-0.5 rounded hover:text-white', {
              'opacity-100': !node.visible,
            })}
          >
            {node.visible ? (
              <Eye size={12} className="text-gray-400 hover:text-white" />
            ) : (
              <EyeOff size={12} className="text-red-400 hover:text-red-300" />
            )}
          </button>

          {/* Delete Button */}
          <button
            onClick={(e) => {
              e.stopPropagation();
              onDeleteNode(node.id);
            }}
            title="Delete Object"
            className="p-0.5 rounded hover:text-red-400 text-gray-400"
          >
            <Trash2 size={12} />
          </button>
        </div>
      </div>
    );
  };

  return (
    <div className={cn('flex flex-col h-full bg-[#242424] border-b border-[#181818]', className)}>
      {/* Header */}
      <div className="flex items-center justify-between px-3 py-1.5 bg-[#202020] border-b border-[#181818] select-none">
        <div className="flex items-center gap-1.5 text-xs font-semibold text-gray-300">
          <Layers size={13} className="text-gray-400" />
          <span>Outliner</span>
        </div>

        <div className="relative">
          {onAddPrimitive && (
            <button
              onClick={() => setShowAddMenu(!showAddMenu)}
              title="Add Object"
              className="p-1 rounded bg-[#2e2e2e] hover:bg-[#3e3e3e] text-gray-300 hover:text-white transition-colors"
            >
              <Plus size={12} />
            </button>
          )}

          {/* Quick Add Flyout */}
          {showAddMenu && onAddPrimitive && (
            <div className="absolute right-0 top-full mt-1 w-32 bg-[#202020] border border-[#3e3e3e] rounded shadow-xl py-1 z-40 text-xs">
              <button
                onClick={() => {
                  onAddPrimitive('cube');
                  setShowAddMenu(false);
                }}
                className="w-full text-left px-2 py-1 text-gray-300 hover:bg-[#4772b3] hover:text-white"
              >
                Cube
              </button>
              <button
                onClick={() => {
                  onAddPrimitive('sphere');
                  setShowAddMenu(false);
                }}
                className="w-full text-left px-2 py-1 text-gray-300 hover:bg-[#4772b3] hover:text-white"
              >
                Sphere
              </button>
              <button
                onClick={() => {
                  onAddPrimitive('cylinder');
                  setShowAddMenu(false);
                }}
                className="w-full text-left px-2 py-1 text-gray-300 hover:bg-[#4772b3] hover:text-white"
              >
                Cylinder
              </button>
              <button
                onClick={() => {
                  onAddPrimitive('plane');
                  setShowAddMenu(false);
                }}
                className="w-full text-left px-2 py-1 text-gray-300 hover:bg-[#4772b3] hover:text-white"
              >
                Plane
              </button>
              <div className="h-[1px] bg-[#333] my-1" />
              <button
                onClick={() => {
                  onAddPrimitive('light');
                  setShowAddMenu(false);
                }}
                className="w-full text-left px-2 py-1 text-gray-300 hover:bg-[#4772b3] hover:text-white"
              >
                Light
              </button>
              <button
                onClick={() => {
                  onAddPrimitive('camera');
                  setShowAddMenu(false);
                }}
                className="w-full text-left px-2 py-1 text-gray-300 hover:bg-[#4772b3] hover:text-white"
              >
                Camera
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Tree Content */}
      <div className="flex-1 p-1 overflow-y-auto space-y-0.5">
        {/* Collections */}
        {collectionList.map((col) => {
          const isCollapsed = collapsedCollections[col.id];
          return (
            <div key={col.id} className="space-y-0.5">
              <div
                onClick={() => toggleCollection(col.id)}
                className="flex items-center justify-between px-2 py-1 rounded text-xs font-semibold text-gray-400 hover:text-gray-200 hover:bg-[#2c2c2c] cursor-pointer select-none"
              >
                <div className="flex items-center gap-1">
                  {isCollapsed ? <ChevronRight size={12} /> : <ChevronDown size={12} />}
                  <Folder size={12} style={{ color: col.color || '#4772b3' }} />
                  <span>{col.name}</span>
                </div>
                <span className="text-[10px] text-gray-500 font-mono">{col.nodeIds.length}</span>
              </div>

              {!isCollapsed && (
                <div className="space-y-0.5">
                  {col.nodeIds.map((nid) => {
                    const node = nodes[nid];
                    return node ? renderNodeItem(node, 1) : null;
                  })}
                </div>
              )}
            </div>
          );
        })}

        {/* Uncollected Nodes */}
        {uncollectedNodes.map((node) => renderNodeItem(node, 0))}

        {Object.keys(nodes).length === 0 && (
          <div className="p-4 text-center text-gray-500 text-xs italic">
            Scene is empty. Click + to add an object.
          </div>
        )}
      </div>
    </div>
  );
};
