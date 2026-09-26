/**
 * PadGrid Component.
 *
 * Visualizes the 8x8 Push 3 grid showing:
 * - Which sounds/voices are assigned to each pad: the layout's pads first,
 *   then the plan's assignments over them (S3.3, T08), so a placed Sound the
 *   plan doesn't play (muted, or no notes) still shows on its pad
 * - Which fingers play each pad
 * - Hand zones (left blue, right purple)
 * - Hit counts and selection state
 */

import { useMemo } from 'react';
import { type Layout } from '../../types/layout';
import { type Voice } from '../../types/voice';
import { type FingerAssignment } from '../../types/executionPlan';
import { padLabel, sharedNamePrefix } from '../analysis/padLabels';
import { formatPadLocator, formatPadPosition } from '../../utils/padPosition';

interface PadGridProps {
  layout: Layout;
  voices: Voice[];
  assignments?: FingerAssignment[];
  onPadClick?: (row: number, col: number) => void;
  /** Render smaller pads for side-by-side comparison. */
  compact?: boolean;
  /** Pad keys to highlight as "different" (for compare mode). */
  diffPads?: Set<string>;
  /** Label shown above the grid (e.g., "Candidate #1"). */
  label?: string;
  /** Tailwind color class for the label (e.g., "text-blue-400"). */
  labelColor?: string;
}

/** Abbreviated finger names for display */
const FINGER_ABBREV: Record<string, string> = {
  thumb: '1', index: '2', middle: '3', ring: '4', pinky: '5',
};

const HAND_COLORS = {
  left: { bg: 'rgba(59,130,246,0.25)', border: '#3b82f6', text: '#93c5fd' },
  right: { bg: 'rgba(168,85,247,0.25)', border: '#a855f7', text: '#d8b4fe' },
  Unplayable: { bg: 'rgba(239,68,68,0.2)', border: '#ef4444', text: '#fca5a5' },
  mixed: { bg: 'rgba(234,179,8,0.2)', border: '#eab308', text: '#fde68a' },
};

interface PadSummary {
  voiceName: string | null;
  voiceColor: string | null;
  noteNumber: number | null;
  hands: Set<string>;
  fingers: Set<string>;
  hitCount: number;
  assignments: FingerAssignment[];
}

export function PadGrid({ layout, voices, assignments, onPadClick, compact, diffPads, label, labelColor }: PadGridProps) {
  const padSize = compact ? 'w-10 h-10' : 'w-14 h-14';
  const padSizeClass = compact ? 'w-10' : 'w-14';
  // Text never goes below 11 px (T64): compact pads show one line of name
  // (without the words every Sound shares) above the fingers.
  const padPx = compact ? 40 : 56;
  const nameLines = compact ? 1 : 2;
  const textSize = compact ? 'text-pf-micro' : 'text-pf-xs';
  const zoneWidth = compact ? 'w-[calc(4*2.5rem+3*0.25rem)]' : 'w-[calc(4*3.5rem+3*0.25rem)]';
  const rowLabelWidth = compact ? 'w-3 text-pf-micro' : 'w-4 text-pf-xs';
  // Voices by Sound identity, never by pitch (invariant 5)
  const voiceById = useMemo(() => {
    const map = new Map<string, Voice>();
    for (const v of voices) map.set(v.id, v);
    return map;
  }, [voices]);
  const namePrefix = useMemo(() => sharedNamePrefix(voices.map(v => v.name)), [voices]);

  // Per-pad summary: the layout's pads, then the plan's assignments over them.
  const padSummaries = useMemo(() => {
    const map = new Map<string, PadSummary>();

    for (const [key, placed] of Object.entries(layout.padToVoice)) {
      const voice = voiceById.get(placed.id);
      map.set(key, {
        voiceName: voice?.name ?? placed.name ?? 'Unknown Sound',
        voiceColor: voice?.color ?? placed.color ?? null,
        noteNumber: placed.originalMidiNote ?? null,
        hands: new Set(),
        fingers: new Set(),
        hitCount: 0,
        assignments: [],
      });
    }

    if (assignments) {
      for (const a of assignments) {
        if (a.row === undefined || a.col === undefined) continue;
        const key = `${a.row},${a.col}`;
        let summary = map.get(key);
        if (!summary) {
          const voice = a.voiceId ? voiceById.get(a.voiceId) : undefined;
          summary = {
            voiceName: voice?.name ?? 'Unknown Sound',
            voiceColor: voice?.color ?? null,
            noteNumber: a.noteNumber,
            hands: new Set(),
            fingers: new Set(),
            hitCount: 0,
            assignments: [],
          };
          map.set(key, summary);
        }
        summary.hands.add(a.assignedHand);
        if (a.finger) summary.fingers.add(`${a.assignedHand[0].toUpperCase()}${FINGER_ABBREV[a.finger] ?? a.finger}`);
        summary.hitCount++;
        summary.assignments.push(a);
      }
    }

    return map;
  }, [layout, assignments, voiceById]);

  // Render rows top-to-bottom (row 7 at top, row 0 at bottom)
  const rows = [];
  for (let row = 7; row >= 0; row--) {
    const cells = [];
    for (let col = 0; col < 8; col++) {
      const padKey = `${row},${col}`;
      const summary = padSummaries.get(padKey);
      const isDiff = diffPads?.has(padKey) ?? false;
      const isLeftZone = col < 4;

      // Determine pad colors
      let bgColor: string;
      let borderColor: string;
      let textColor: string;

      if (summary && summary.hitCount > 0) {
        const hands = [...summary.hands];
        if (hands.length === 1 && hands[0] !== 'Unplayable') {
          const scheme = HAND_COLORS[hands[0] as 'left' | 'right'] ?? HAND_COLORS.mixed;
          bgColor = summary.voiceColor ? `${summary.voiceColor}40` : scheme.bg;
          borderColor = scheme.border;
          textColor = scheme.text;
        } else if (hands.includes('Unplayable') && hands.length === 1) {
          bgColor = HAND_COLORS.Unplayable.bg;
          borderColor = HAND_COLORS.Unplayable.border;
          textColor = HAND_COLORS.Unplayable.text;
        } else {
          bgColor = summary.voiceColor ? `${summary.voiceColor}40` : HAND_COLORS.mixed.bg;
          borderColor = HAND_COLORS.mixed.border;
          textColor = HAND_COLORS.mixed.text;
        }
      } else if (summary) {
        // Placed, but the plan plays no note on it (a muted Sound, say).
        bgColor = summary.voiceColor ? `${summary.voiceColor}26` : '#1e293b';
        borderColor = '#334155';
        textColor = '#94a3b8';
      } else {
        bgColor = isLeftZone ? '#0f172a' : '#120f1f';
        borderColor = '#1e293b';
        textColor = '#475569';
      }

      // Finger display: show most common fingers
      const fingerList = summary ? [...summary.fingers].slice(0, 2) : [];

      cells.push(
        <button
          key={padKey}
          className={`
            relative flex flex-col items-center justify-center
            ${padSize} rounded-pf-lg ${textSize} font-mono leading-tight
            border-2 transition-all duration-100
            ${isDiff ? 'ring-2 ring-amber-400/70 z-10' : ''}
            ${summary ? (summary.hitCount > 0 ? '' : 'opacity-70') : 'opacity-40'}
            hover:opacity-100 hover:scale-[1.02]
          `}
          style={{ backgroundColor: bgColor, borderColor, color: textColor }}
          onClick={() => onPadClick?.(row, col)}
          title={summary
            ? `${formatPadPosition(padKey)} · ${summary.voiceName} · ${summary.hitCount > 0 ? `Fingers ${[...summary.fingers].join(', ')} · ${summary.hitCount} hits` : 'no notes in this plan'}`
            : `${formatPadPosition(padKey)} · empty`}
        >
          {summary ? (
            <>
              {/* Voice name */}
              <span
                className="block w-full px-0.5 text-center text-pf-micro font-semibold text-white/90 leading-[13px] overflow-hidden [overflow-wrap:anywhere]"
                style={{ display: '-webkit-box', WebkitLineClamp: nameLines, WebkitBoxOrient: 'vertical' }}
              >
                {padLabel(summary.voiceName ?? '', namePrefix, padPx, nameLines)}
              </span>
              {/* Fingers */}
              <span className="block text-pf-micro leading-none mt-0.5" style={{ color: textColor }}>
                {fingerList.join(' ')}
              </span>
              {/* Hit count badge */}
              {!compact && summary.hitCount > 0 && (
                <span className="absolute top-0.5 right-0.5 text-pf-micro font-bold bg-black/40 rounded px-0.5" style={{ color: textColor }}>
                  {summary.hitCount}
                </span>
              )}
            </>
          ) : null}
        </button>
      );
    }
    rows.push(
      <div key={row} className="flex gap-1 items-center">
        <span className={`${rowLabelWidth} text-[var(--text-secondary)] text-right mr-1 font-mono`} aria-hidden="true">{row + 1}</span>
        {cells}
      </div>
    );
  }

  // Collect used pads for the detail table
  const usedPads = [...padSummaries.entries()]
    .filter(([, s]) => s.hitCount > 0)
    .sort((a, b) => b[1].hitCount - a[1].hitCount);

  const colLabelMl = compact ? 'ml-4' : 'ml-5';

  return (
    <div className="space-y-3">
      {/* Label above grid */}
      {label && (
        <div className={`text-pf-sm font-medium ${labelColor ?? 'text-[var(--text-secondary)]'}`}>{label}</div>
      )}
      <div className="inline-block">
        <div className="flex flex-col gap-1">
          {rows}
          {/* Column labels */}
          {!compact && (
            <div className={`flex gap-1 ${colLabelMl}`}>
              {Array.from({ length: 8 }, (_, col) => (
                <div key={col} className={`${padSizeClass} text-center ${textSize} text-[var(--text-secondary)] font-mono`} aria-hidden="true">{col + 1}</div>
              ))}
            </div>
          )}
        </div>
        {/* Zone labels */}
        {!compact && (
          <div className={`flex ${colLabelMl} mt-1 gap-1`}>
            <div className={`${zoneWidth} text-center ${textSize} text-blue-400/70 border-t border-blue-500/20 pt-0.5`}>
              Left Hand
            </div>
            <div className={`${zoneWidth} text-center ${textSize} text-purple-400/70 border-t border-purple-500/20 pt-0.5`}>
              Right Hand
            </div>
          </div>
        )}
      </div>

      {/* Pad assignments table (hidden in compact mode) */}
      {!compact && usedPads.length > 0 && (
        <div className="space-y-1">
          <h4 className="text-pf-sm text-[var(--text-secondary)] font-medium">Pad Assignments ({usedPads.length} pads used)</h4>
          <div className="grid grid-cols-2 gap-x-4 gap-y-0.5 text-pf-sm">
            {usedPads.map(([padKey, summary]) => {
              const hands = [...summary.hands];
              const handColor = hands.length === 1 && hands[0] === 'left' ? 'text-blue-400'
                : hands.length === 1 && hands[0] === 'right' ? 'text-purple-400'
                : 'text-yellow-400';
              return (
                <div key={padKey} className="flex items-center gap-2 text-[var(--text-secondary)]">
                  <span className="font-mono text-[var(--text-secondary)] w-14 tabular-nums" title={formatPadPosition(padKey)}>{formatPadLocator(padKey)}</span>
                  <span className="text-[var(--text-primary)] font-medium truncate w-16">{summary.voiceName}</span>
                  <span className={`${handColor} w-16`}>{[...summary.fingers].join(', ')}</span>
                  <span className="text-[var(--text-secondary)]">{summary.hitCount}x</span>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
