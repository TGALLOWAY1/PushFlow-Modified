/**
 * SettingsGear.
 *
 * Popover for grid labeling and display mode options.
 * Appears at the top-right of the panel.
 */

import { useState, useRef, useEffect } from 'react';
import { type GridLabelSettings } from '../../state/viewSettings';

interface SettingsGearProps {
  gridLabels: GridLabelSettings;
  onToggle: (key: keyof GridLabelSettings) => void;
}

const LABEL_OPTIONS: Array<{ key: keyof GridLabelSettings; label: string; description: string }> = [
  { key: 'showSoundName', label: 'Sound name', description: 'Voice name on each pad' },
  { key: 'showFingerAssignment', label: 'Finger assignment', description: 'Hand and finger labels (e.g. L-Ix)' },
  { key: 'showNoteLabels', label: 'Note labels', description: 'MIDI note name (e.g. C1)' },
  { key: 'showPositionLabels', label: 'Position labels', description: 'Grid coordinates (e.g. 2,3)' },
];

export function SettingsGear({ gridLabels, onToggle }: SettingsGearProps) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [open]);

  return (
    <div className="relative" ref={ref}>
      <button
        className={`w-7 h-7 flex items-center justify-center rounded transition-colors ${
          open ? 'bg-gray-700 text-gray-200' : 'text-gray-500 hover:text-gray-300 hover:bg-gray-800'
        }`}
        onClick={() => setOpen(!open)}
        title="View settings"
        aria-label="View settings"
      >
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <circle cx="12" cy="12" r="3"/>
          <path d="M12 1v2M12 21v2M4.22 4.22l1.42 1.42M18.36 18.36l1.42 1.42M1 12h2M21 12h2M4.22 19.78l1.42-1.42M18.36 5.64l1.42-1.42"/>
        </svg>
      </button>

      {open && (
        <div className="absolute right-0 top-full mt-1 w-56 rounded-lg border border-gray-700 bg-gray-900 shadow-xl z-50 py-2">
          <div className="px-3 py-1.5 text-[10px] text-gray-500 uppercase tracking-wider font-medium">
            Grid Labels
          </div>
          {LABEL_OPTIONS.map(({ key, label, description }) => (
            <button
              key={key}
              className="w-full flex items-center gap-2 px-3 py-1.5 text-left hover:bg-gray-800 transition-colors"
              onClick={() => onToggle(key)}
            >
              <div className={`w-3.5 h-3.5 rounded border flex items-center justify-center flex-shrink-0 ${
                gridLabels[key]
                  ? 'bg-blue-600 border-blue-500'
                  : 'border-gray-600 bg-gray-800'
              }`}>
                {gridLabels[key] && (
                  <svg width="8" height="8" viewBox="0 0 12 12" fill="none" stroke="white" strokeWidth="2">
                    <path d="M2 6l3 3 5-5"/>
                  </svg>
                )}
              </div>
              <div>
                <div className="text-xs text-gray-300">{label}</div>
                <div className="text-[10px] text-gray-600">{description}</div>
              </div>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
