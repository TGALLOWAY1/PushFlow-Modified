/**
 * PerformanceLanesView.
 *
 * Top-level layout for the Performance Lanes tab.
 * Three-column layout: sidebar (left), timeline (center), inspector (right, conditional).
 */

import { useState, useCallback, useRef, useMemo, useEffect } from 'react';
import { useProject } from '../../state/ProjectContext';
import { useLaneImport } from '../../hooks/useLaneImport';
import { LaneToolbar } from './LaneToolbar';
import { LaneSidebar } from './LaneSidebar';
import { LaneTimeline } from './LaneTimeline';
import { LaneInspector } from './LaneInspector';

// Sidebar width + inspector width + padding
const SIDEBAR_WIDTH = 256;
const INSPECTOR_WIDTH = 288;
const TIMELINE_PADDING = 100;

export function PerformanceLanesView() {
  const { state } = useProject();
  const { importFiles } = useLaneImport();

  // Compute minimum zoom to fit exactly 4 bars in the viewport
  const minZoom = useMemo(() => {
    const secondsPerBeat = 60 / state.tempo;
    const totalDuration = secondsPerBeat * 16; // 4 bars * 4 beats

    // Estimate available width (viewport minus sidebar, inspector, padding)
    const availableWidth = Math.max(window.innerWidth - SIDEBAR_WIDTH - INSPECTOR_WIDTH - TIMELINE_PADDING, 400);
    return Math.max(20, Math.round(availableWidth / totalDuration));
  }, [state.tempo]);

  // Local UI state
  const [selectedLaneIds, setSelectedLaneIds] = useState<Set<string>>(new Set());
  const [currentZoom, setCurrentZoom] = useState(minZoom); // pixels per second
  const zoom = Math.max(currentZoom, minZoom);
  const setZoom = useCallback((z: number) => setCurrentZoom(Math.max(z, minZoom)), [minZoom]);
  const [scrollLeft, setScrollLeft] = useState(0);
  const [showInactive, setShowInactive] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [dragOver, setDragOver] = useState(false);
  const sidebarScrollRef = useRef<HTMLDivElement>(null);

  // Selected time step for arrow key navigation
  const [selectedTimeIdx, setSelectedTimeIdx] = useState<number | null>(null);

  // Build sorted unique time steps for navigation
  const uniqueTimes = useMemo(() => {
    const times = new Set<number>();
    for (const lane of state.performanceLanes) {
      if (lane.isMuted || lane.isHidden) continue;
      for (const e of lane.events) {
        times.add(e.startTime);
      }
    }
    return [...times].sort((a, b) => a - b);
  }, [state.performanceLanes]);

  const selectedTime = selectedTimeIdx !== null ? uniqueTimes[selectedTimeIdx] ?? null : null;

  // Arrow key handler for lane time-step navigation
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement;
      if (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.isContentEditable) return;
      if (uniqueTimes.length === 0) return;

      if (e.key === 'ArrowLeft' || e.key === 'ArrowRight') {
        e.preventDefault();
        setSelectedTimeIdx(prev => {
          if (prev === null) {
            return e.key === 'ArrowRight' ? 0 : uniqueTimes.length - 1;
          }
          if (e.key === 'ArrowRight') {
            return prev < uniqueTimes.length - 1 ? prev + 1 : 0;
          }
          return prev > 0 ? prev - 1 : uniqueTimes.length - 1;
        });
      }
      if (e.key === 'Escape') {
        setSelectedTimeIdx(null);
      }
    };
    document.addEventListener('keydown', handler);
    return () => document.removeEventListener('keydown', handler);
  }, [uniqueTimes.length]);

  const hasLanes = state.performanceLanes.length > 0;
  const selectedLanes = state.performanceLanes.filter(l => selectedLaneIds.has(l.id));

  const handleSelectLane = useCallback((id: string | null, multiSelect?: boolean) => {
    if (!id) {
      setSelectedLaneIds(new Set());
      return;
    }
    setSelectedLaneIds(prev => {
      if (multiSelect) {
        const next = new Set(prev);
        if (next.has(id)) next.delete(id);
        else next.add(id);
        return next;
      }
      // Single click: if already the only selection, deselect
      if (prev.size === 1 && prev.has(id)) return new Set();
      return new Set([id]);
    });
  }, []);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(false);
    const files = Array.from(e.dataTransfer.files).filter(
      f => f.name.match(/\.(mid|midi)$/i)
    );
    if (files.length > 0) {
      importFiles(files);
    }
  }, [importFiles]);

  // Empty state — show import prompt
  if (!hasLanes) {
    return (
      <div className="space-y-0">
        <LaneToolbar
          zoom={zoom}
          minZoom={minZoom}
          onZoomChange={setZoom}
          showInactive={showInactive}
          onToggleShowInactive={() => setShowInactive(!showInactive)}
          searchQuery={searchQuery}
          onSearchChange={setSearchQuery}
        />
        <div className="flex items-center justify-center py-24">
          <div
            className={`border-2 border-dashed rounded-xl p-12 text-center transition-colors cursor-pointer max-w-lg ${
              dragOver ? 'border-blue-500 bg-blue-500/10' : 'border-gray-700 hover:border-gray-600'
            }`}
            onDragOver={e => { e.preventDefault(); setDragOver(true); }}
            onDragLeave={() => setDragOver(false)}
            onDrop={handleDrop}
          >
            <div className="text-gray-400 space-y-2">
              <div className="text-lg font-medium">Import MIDI Files</div>
              <div className="text-sm text-gray-500">
                Drop one or more .mid files here to create performance lanes.
                Each file will be split by pitch into individual lanes.
              </div>
              <div className="text-xs text-gray-600 mt-3">
                Or use the Import button in the toolbar above.
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full">
      <LaneToolbar
        zoom={zoom}
        minZoom={minZoom}
        onZoomChange={setZoom}
        showInactive={showInactive}
        onToggleShowInactive={() => setShowInactive(!showInactive)}
        searchQuery={searchQuery}
        onSearchChange={setSearchQuery}
      />

      {/* Main content area */}
      <div
        className="flex flex-1 min-h-0 overflow-hidden"
        onDragOver={e => { e.preventDefault(); setDragOver(true); }}
        onDragLeave={() => setDragOver(false)}
        onDrop={handleDrop}
      >
        {/* Left: Lane sidebar */}
        <LaneSidebar
          selectedLaneIds={selectedLaneIds}
          onSelectLane={handleSelectLane}
          searchQuery={searchQuery}
          showInactive={showInactive}
          scrollRef={sidebarScrollRef}
        />

        {/* Center: Timeline */}
        <LaneTimeline
          zoom={zoom}
          scrollLeft={scrollLeft}
          onScrollLeft={setScrollLeft}
          selectedLaneIds={selectedLaneIds}
          onSelectLane={handleSelectLane}
          searchQuery={searchQuery}
          showInactive={showInactive}
          selectedEventTime={selectedTime}
          onVerticalScroll={scrollTop => {
            if (sidebarScrollRef.current) {
              sidebarScrollRef.current.scrollTop = scrollTop;
            }
          }}
        />

        {/* Right: Inspector (conditional) */}
        {selectedLanes.length > 0 && (
          <LaneInspector
            lane={selectedLanes[0]}
            lanes={selectedLanes}
            onClose={() => setSelectedLaneIds(new Set())}
          />
        )}
      </div>
    </div>
  );
}
