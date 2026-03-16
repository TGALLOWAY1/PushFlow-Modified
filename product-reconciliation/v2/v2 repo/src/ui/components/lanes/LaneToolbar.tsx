/**
 * LaneToolbar.
 *
 * Top toolbar for the Performance Lanes view.
 * Contains: song name, import button, auto-group, search, zoom, display toggle.
 */

import { useRef } from 'react';
import { useProject } from '../../state/ProjectContext';
import { useLaneImport } from '../../hooks/useLaneImport';
import { countTimeSlices } from '../../../types/performanceLane';

interface LaneToolbarProps {
  zoom: number;
  minZoom: number;
  onZoomChange: (zoom: number) => void;
  showInactive: boolean;
  onToggleShowInactive: () => void;
  searchQuery: string;
  onSearchChange: (query: string) => void;
}

export function LaneToolbar({
  zoom,
  minZoom,
  onZoomChange,
  showInactive,
  onToggleShowInactive,
  searchQuery,
  onSearchChange,
}: LaneToolbarProps) {
  const { state } = useProject();
  const { importFiles } = useLaneImport();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleImportClick = () => {
    fileInputRef.current?.click();
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (files && files.length > 0) {
      importFiles(Array.from(files));
    }
    // Reset input so the same file can be re-imported
    e.target.value = '';
  };

  const totalLanes = state.performanceLanes.length;
  const totalEvents = countTimeSlices(state.performanceLanes);

  return (
    <div className="flex items-center gap-3 px-4 py-2 bg-gray-900/50 border-b border-gray-700">
      {/* Song info */}
      <div className="flex items-center gap-2">
        <h2 className="text-sm font-semibold text-gray-200">Performance Lanes</h2>
        {totalLanes > 0 && (
          <span className="text-[11px] text-gray-500">
            {totalLanes} lanes, {totalEvents} events
          </span>
        )}
      </div>

      <div className="flex-1" />

      {/* Import button */}
      <button
        className="px-3 py-1.5 bg-blue-600 hover:bg-blue-500 rounded text-sm font-medium text-white transition-colors"
        onClick={handleImportClick}
      >
        Import MIDI Files
      </button>
      <input
        ref={fileInputRef}
        type="file"
        accept=".mid,.midi"
        multiple
        className="hidden"
        onChange={handleFileChange}
      />

      {/* Search */}
      <div className="relative">
        <input
          type="text"
          placeholder="Search..."
          value={searchQuery}
          onChange={e => onSearchChange(e.target.value)}
          className="w-36 bg-gray-800 border border-gray-700 rounded px-2 py-1 text-xs text-gray-200 placeholder-gray-500 focus:border-blue-500 focus:outline-none"
        />
      </div>

      {/* Zoom slider */}
      <div className="flex items-center gap-1.5">
        <span className="text-[10px] text-gray-500">Zoom</span>
        <input
          type="range"
          min={minZoom}
          max={Math.max(400, minZoom * 4)}
          value={zoom}
          onChange={e => onZoomChange(Number(e.target.value))}
          className="w-20 h-1 accent-blue-500"
        />
      </div>

      {/* Show/hide inactive toggle */}
      <label className="flex items-center gap-1.5 text-[11px] text-gray-400 cursor-pointer select-none">
        <span>Show inactive</span>
        <input
          type="checkbox"
          checked={showInactive}
          onChange={onToggleShowInactive}
          className="accent-blue-500"
        />
      </label>
    </div>
  );
}
