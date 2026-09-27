/**
 * The timeline's own controls (T05, S4.3a): + MIDI, the Sound count, Zoom
 * and Fit. While the timeline is shown they sit in the drawer's tab row,
 * beside its tab (DrawerToolbarSlot); the transport is the workspace's and
 * sits above the tabs (TransportBar).
 */

import { createContext } from 'react';
import { ToggleButton } from './shared/ToggleButton';

/** The drawer's tab-row element the shown tab puts its own controls in; null outside a workspace. */
export const DrawerToolbarSlot = createContext<HTMLElement | null>(null);

export interface TimelineToolbarProps {
  soundCount: number;
  onImportClick: () => void;
  zoom: number;
  minZoom: number;
  maxZoom: number;
  isAutoFit: boolean;
  onZoom: (zoom: number) => void;
  onFit: () => void;
}

export function TimelineToolbar({
  soundCount, onImportClick, zoom, minZoom, maxZoom, isAutoFit, onZoom, onFit,
}: TimelineToolbarProps) {
  return (
    <div data-testid="timeline-toolbar" className="flex items-center gap-2 flex-shrink-0">
      <button
        type="button"
        data-testid="timeline-import"
        className="pf-btn pf-btn-subtle text-pf-xs h-7 flex-shrink-0"
        onClick={onImportClick}
        title="Import more MIDI files into this project"
      >
        + MIDI
      </button>
      <span data-testid="timeline-sound-count" className="text-pf-sm text-[var(--text-tertiary)] whitespace-nowrap flex-shrink-0">
        {soundCount} {soundCount === 1 ? 'Sound' : 'Sounds'}
      </span>
      <label className="flex items-center gap-1.5 text-pf-xs text-[var(--text-tertiary)] flex-shrink-0">
        Zoom
        <input
          type="range"
          aria-label="Timeline zoom"
          min={minZoom}
          max={maxZoom}
          value={Math.max(minZoom, Math.min(maxZoom, zoom))}
          onChange={e => onZoom(Math.max(minZoom, Number(e.target.value)))}
          className="w-20 h-1 accent-blue-500"
        />
      </label>
      <ToggleButton
        testId="timeline-fit"
        pressed={isAutoFit}
        onPressedChange={() => onFit()}
        label="Fit"
        title="Fit: the whole performance fills the timeline's width"
        size="sm"
        className="flex-shrink-0"
      />
    </div>
  );
}
