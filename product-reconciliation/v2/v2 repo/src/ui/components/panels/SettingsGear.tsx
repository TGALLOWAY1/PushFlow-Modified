/**
 * SettingsGear.
 *
 * Popover for grid view options and layout display settings.
 * Two sections matching the Push-style settings panel:
 * - View Options: note labels, position labels, finger assignment
 * - Layout Options: organize by 4x4 banks, duplicate layout
 */

import { useState, useRef, useEffect } from 'react';
import { type GridLabelSettings, type LayoutDisplaySettings } from '../../state/viewSettings';

interface SettingsGearProps {
  gridLabels: GridLabelSettings;
  layoutDisplay: LayoutDisplaySettings;
  onToggleGridLabel: (key: keyof GridLabelSettings) => void;
  onToggleLayoutDisplay: (key: keyof LayoutDisplaySettings) => void;
  onDuplicateLayout?: () => void;
}

const VIEW_OPTIONS: Array<{ key: keyof GridLabelSettings; label: string }> = [
  { key: 'showNoteLabels', label: 'Show Note Labels' },
  { key: 'showPositionLabels', label: 'Show Position Labels' },
  { key: 'showFingerAssignment', label: 'Show Finger Assignment' },
];

export function SettingsGear({
  gridLabels,
  layoutDisplay,
  onToggleGridLabel,
  onToggleLayoutDisplay,
  onDuplicateLayout,
}: SettingsGearProps) {
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
        className={`w-8 h-8 flex items-center justify-center rounded-lg transition-colors ${
          open ? 'bg-gray-700 text-gray-200' : 'text-gray-500 hover:text-gray-300 hover:bg-gray-800'
        }`}
        onClick={() => setOpen(!open)}
        title="View settings"
        aria-label="View settings"
      >
        {/* Sliders/mixer icon matching the mockup */}
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <line x1="4" y1="21" x2="4" y2="14" />
          <line x1="4" y1="10" x2="4" y2="3" />
          <line x1="12" y1="21" x2="12" y2="12" />
          <line x1="12" y1="8" x2="12" y2="3" />
          <line x1="20" y1="21" x2="20" y2="16" />
          <line x1="20" y1="12" x2="20" y2="3" />
          <line x1="1" y1="14" x2="7" y2="14" />
          <line x1="9" y1="8" x2="15" y2="8" />
          <line x1="17" y1="16" x2="23" y2="16" />
        </svg>
      </button>

      {open && (
        <div className="absolute right-0 top-full mt-1 w-64 rounded-xl border border-gray-700 bg-gray-900 shadow-xl z-50 overflow-hidden">
          {/* View Options section */}
          <div className="px-4 pt-3 pb-1">
            <div className="text-[11px] text-gray-500 uppercase tracking-wider font-medium">
              View Options
            </div>
          </div>
          <div className="px-2 pb-2">
            {VIEW_OPTIONS.map(({ key, label }) => (
              <button
                key={key}
                className="w-full flex items-center gap-3 px-2 py-2.5 text-left hover:bg-gray-800/60 rounded-lg transition-colors"
                onClick={() => onToggleGridLabel(key)}
              >
                <div className={`w-5 h-5 rounded border-2 flex items-center justify-center flex-shrink-0 transition-colors ${
                  gridLabels[key]
                    ? 'bg-white border-white'
                    : 'border-gray-500 bg-transparent'
                }`}>
                  {gridLabels[key] && (
                    <svg width="12" height="12" viewBox="0 0 12 12" fill="none" stroke="#111" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M2 6l3 3 5-5"/>
                    </svg>
                  )}
                </div>
                <span className="text-sm text-gray-200">{label}</span>
              </button>
            ))}
          </div>

          {/* Divider */}
          <div className="border-t border-gray-800 mx-3" />

          {/* Layout Options section */}
          <div className="px-4 pt-3 pb-1">
            <div className="text-[11px] text-gray-500 uppercase tracking-wider font-medium">
              Layout Options
            </div>
          </div>
          <div className="px-2 pb-2">
            <button
              className="w-full flex items-center gap-3 px-2 py-2.5 text-left hover:bg-gray-800/60 rounded-lg transition-colors"
              onClick={() => onToggleLayoutDisplay('organize4x4Banks')}
            >
              <span className={`text-sm ${layoutDisplay.organize4x4Banks ? 'text-gray-200' : 'text-gray-400'}`}>
                Organize by 4x4 Banks
              </span>
            </button>
            {onDuplicateLayout && (
              <button
                className="w-full flex items-center justify-between px-2 py-2.5 text-left hover:bg-gray-800/60 rounded-lg transition-colors"
                onClick={() => {
                  onDuplicateLayout();
                  setOpen(false);
                }}
              >
                <span className="text-sm text-gray-400">Duplicate Layout</span>
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-gray-600">
                  <rect x="9" y="9" width="13" height="13" rx="2" ry="2" />
                  <path d="M5 15H4a2 2 0 01-2-2V4a2 2 0 012-2h9a2 2 0 012 2v1" />
                </svg>
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
