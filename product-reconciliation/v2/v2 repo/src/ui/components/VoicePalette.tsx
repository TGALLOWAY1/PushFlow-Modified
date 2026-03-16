/**
 * VoicePalette.
 *
 * Lists all SoundStreams with: color swatch, name, event count, mute toggle,
 * pad location (if assigned), and drag handle for placing on grid.
 * Streams are grouped into "On Grid" and "Unassigned".
 */

import { useMemo } from 'react';
import { useProject } from '../state/ProjectContext';
import { getActiveLayout, type SoundStream } from '../state/projectState';

export function VoicePalette() {
  const { state, dispatch } = useProject();
  const layout = getActiveLayout(state);

  // Build a map of which pads each stream occupies
  const streamPadLocations = useMemo(() => {
    const map = new Map<string, string[]>();
    if (!layout) return map;
    for (const [padKey, voice] of Object.entries(layout.padToVoice)) {
      const existing = map.get(voice.id) ?? [];
      existing.push(padKey);
      map.set(voice.id, existing);
    }
    return map;
  }, [layout]);

  // Build per-stream solver assignment summary from analysisResult
  const solverSummary = useMemo(() => {
    const map = new Map<string, { label: string; hand: string }>();
    const fa = state.analysisResult?.executionPlan.fingerAssignments;
    if (!fa || fa.length === 0) return map;

    // Map noteNumber → stream id
    const noteToStreamId = new Map<number, string>();
    for (const s of state.soundStreams) {
      noteToStreamId.set(s.originalMidiNote, s.id);
    }

    // Aggregate hand/finger counts per stream
    const counts = new Map<string, Map<string, number>>();
    for (const a of fa) {
      const streamId = noteToStreamId.get(a.noteNumber);
      if (!streamId || a.assignedHand === 'Unplayable') continue;
      const handChar = a.assignedHand === 'left' ? 'L' : 'R';
      const FINGER_SHORT: Record<string, string> = {
        thumb: 'Th', index: 'Ix', middle: 'Md', ring: 'Rg', pinky: 'Pk',
      };
      const fingerStr = a.finger ? FINGER_SHORT[a.finger] ?? '' : '';
      const key = fingerStr ? `${handChar}-${fingerStr}` : handChar;

      const streamCounts = counts.get(streamId) ?? new Map<string, number>();
      streamCounts.set(key, (streamCounts.get(key) ?? 0) + 1);
      counts.set(streamId, streamCounts);
    }

    // Pick dominant assignment per stream
    for (const [streamId, streamCounts] of counts) {
      let best = '';
      let bestCount = 0;
      for (const [key, count] of streamCounts) {
        if (count > bestCount) { best = key; bestCount = count; }
      }
      if (best) {
        map.set(streamId, { label: best, hand: best.startsWith('L') ? 'left' : 'right' });
      }
    }
    return map;
  }, [state.analysisResult, state.soundStreams]);

  // Split into assigned vs unassigned
  const { assigned, unassigned } = useMemo(() => {
    const a: SoundStream[] = [];
    const u: SoundStream[] = [];
    for (const stream of state.soundStreams) {
      if (streamPadLocations.has(stream.id)) {
        a.push(stream);
      } else {
        u.push(stream);
      }
    }
    return { assigned: a, unassigned: u };
  }, [state.soundStreams, streamPadLocations]);

  const handleDragStart = (e: React.DragEvent, stream: SoundStream) => {
    e.dataTransfer.setData('application/pushflow-stream', JSON.stringify({
      id: stream.id,
      name: stream.name,
      color: stream.color,
      originalMidiNote: stream.originalMidiNote,
      source: 'palette',
    }));
    e.dataTransfer.effectAllowed = 'copyMove';
  };

  return (
    <div className="space-y-3">
      <h3 className="text-xs font-medium text-gray-400 uppercase tracking-wide">
        Sounds
      </h3>

      {/* Column headers for constraint dropdowns */}
      <ConstraintColumnHeaders />

      {/* Unassigned streams */}
      {unassigned.length > 0 && (
        <div className="space-y-1">
          <span className="text-[10px] text-gray-500">
            Unassigned ({unassigned.length})
          </span>
          {unassigned.map(stream => (
            <StreamRow
              key={stream.id}
              stream={stream}
              padKeys={[]}
              voiceConstraint={state.voiceConstraints[stream.id]}
              solverAssignment={solverSummary.get(stream.id)}
              analysisStale={state.analysisStale}
              onToggleMute={() => dispatch({ type: 'TOGGLE_MUTE', payload: stream.id })}
              onDragStart={handleDragStart}
              onSetConstraint={(hand, finger) => dispatch({
                type: 'SET_VOICE_CONSTRAINT',
                payload: { streamId: stream.id, hand, finger },
              })}
            />
          ))}
        </div>
      )}

      {/* Assigned streams */}
      {assigned.length > 0 && (
        <div className="space-y-1">
          <span className="text-[10px] text-gray-500">
            On Grid ({assigned.length})
          </span>
          {assigned.map(stream => (
            <StreamRow
              key={stream.id}
              stream={stream}
              padKeys={streamPadLocations.get(stream.id) ?? []}
              voiceConstraint={state.voiceConstraints[stream.id]}
              solverAssignment={solverSummary.get(stream.id)}
              analysisStale={state.analysisStale}
              onToggleMute={() => dispatch({ type: 'TOGGLE_MUTE', payload: stream.id })}
              onDragStart={handleDragStart}
              onSetConstraint={(hand, finger) => dispatch({
                type: 'SET_VOICE_CONSTRAINT',
                payload: { streamId: stream.id, hand, finger },
              })}
            />
          ))}
        </div>
      )}

      {state.soundStreams.length === 0 && (
        <p className="text-xs text-gray-500 py-2">No sounds loaded.</p>
      )}
    </div>
  );
}

function StreamRow({
  stream,
  padKeys,
  voiceConstraint,
  solverAssignment,
  analysisStale,
  onToggleMute,
  onDragStart,
  onSetConstraint,
}: {
  stream: SoundStream;
  padKeys: string[];
  voiceConstraint?: { hand?: 'left' | 'right'; finger?: string };
  solverAssignment?: { label: string; hand: string };
  analysisStale: boolean;
  onToggleMute: () => void;
  onDragStart: (e: React.DragEvent, stream: SoundStream) => void;
  onSetConstraint: (hand?: 'left' | 'right' | null, finger?: string | null) => void;
}) {
  return (
    <div
      className={`
        flex items-center gap-1.5 px-2 py-1.5 rounded-md text-xs
        border border-transparent hover:border-gray-700
        cursor-grab active:cursor-grabbing active:scale-95 transition-transform duration-150
        ${stream.muted ? 'opacity-40' : ''}
      `}
      draggable
      onDragStart={e => onDragStart(e, stream)}
    >
      {/* Color swatch */}
      <span
        className="w-2.5 h-2.5 rounded-sm flex-shrink-0"
        style={{ backgroundColor: stream.color }}
      />

      {/* Name */}
      <span className="flex-1 truncate text-gray-200 font-medium">
        {stream.name}
      </span>

      {/* Event count */}
      <span className="text-gray-500 text-[10px] flex-shrink-0">
        {stream.events.length}x
      </span>

      {/* Pad location(s) */}
      {padKeys.length > 0 && (
        <span className="text-[10px] text-gray-500 font-mono flex-shrink-0">
          [{padKeys[0]}]
          {padKeys.length > 1 && `+${padKeys.length - 1}`}
        </span>
      )}

      {/* Solver assignment pill */}
      {solverAssignment && (
        <span
          className={`text-[9px] font-mono px-1 py-0.5 rounded flex-shrink-0 ${
            analysisStale ? 'text-gray-600 bg-gray-800/30' : 'text-sky-300/70 bg-sky-500/10'
          }`}
          title={`Solver: ${solverAssignment.label}${analysisStale ? ' (stale)' : ''}`}
        >
          {solverAssignment.label}
        </span>
      )}

      {/* Hand constraint */}
      <select
        className="bg-gray-800 border border-gray-700 text-[10px] text-gray-400 rounded px-0.5 py-0.5 w-7 flex-shrink-0"
        value={voiceConstraint?.hand ?? ''}
        onChange={e => onSetConstraint(
          e.target.value === '' ? null : e.target.value as 'left' | 'right',
          undefined
        )}
        onClick={e => e.stopPropagation()}
        onMouseDown={e => e.stopPropagation()}
        title="Hand constraint"
      >
        <option value="">-</option>
        <option value="left">L</option>
        <option value="right">R</option>
      </select>

      {/* Finger constraint */}
      <select
        className="bg-gray-800 border border-gray-700 text-[10px] text-gray-400 rounded px-0.5 py-0.5 w-9 flex-shrink-0"
        value={voiceConstraint?.finger ?? ''}
        onChange={e => onSetConstraint(
          undefined,
          e.target.value === '' ? null : e.target.value
        )}
        onClick={e => e.stopPropagation()}
        onMouseDown={e => e.stopPropagation()}
        title="Finger constraint"
      >
        <option value="">-</option>
        <option value="thumb">Th</option>
        <option value="index">Ix</option>
        <option value="middle">Md</option>
        <option value="ring">Rg</option>
        <option value="pinky">Pk</option>
      </select>

      {/* Mute toggle */}
      <button
        className={`
          flex-shrink-0 w-5 h-5 flex items-center justify-center rounded
          text-[10px] transition-colors
          ${stream.muted
            ? 'bg-red-500/20 text-red-400 hover:bg-red-500/30'
            : 'bg-gray-800 text-gray-400 hover:bg-gray-700'}
        `}
        onClick={e => {
          e.stopPropagation();
          onToggleMute();
        }}
        title={stream.muted ? 'Unmute' : 'Mute'}
      >
        {stream.muted ? 'M' : 'S'}
      </button>
    </div>
  );
}

function ConstraintColumnHeaders() {
  return (
    <div className="flex items-center gap-1.5 px-2 py-0.5">
      {/* Spacer for color swatch */}
      <span className="w-2.5 flex-shrink-0" />
      {/* Spacer for name */}
      <span className="flex-1" />
      {/* Spacer for event count */}
      <span className="text-[10px] flex-shrink-0" />
      {/* Spacer for pad location */}
      <span className="flex-shrink-0" />
      {/* Hand label */}
      <span className="text-[8px] text-gray-600 w-7 text-center flex-shrink-0">Hand</span>
      {/* Finger label */}
      <span className="text-[8px] text-gray-600 w-9 text-center flex-shrink-0">Finger</span>
      {/* Mute label */}
      <span className="text-[8px] text-gray-600 w-5 text-center flex-shrink-0" />
    </div>
  );
}
