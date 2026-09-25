/**
 * One staged empty state, at the grid (S2.3, T44).
 *
 * With no Sounds, a card in the grid's centre offers the two ways in, Import
 * MIDI or build a pattern in the Composer, and takes .mid files dropped on
 * it. With Sounds but nothing placed, a line in the state bar above the grid
 * says how to place them and offers "Suggest a starting layout"; it stays off
 * the pads, so Sounds and presets can be dropped anywhere. Nothing is placed
 * without a click (invariant 7).
 */

import { useRef, useState } from 'react';
import { Music, Upload, Wand2 } from 'lucide-react';

const isMidiFile = (file: File) => /\.(mid|midi)$/i.test(file.name);
const carriesFiles = (e: React.DragEvent) => Array.from(e.dataTransfer.types).includes('Files');

export function GridStartCard({ onImportFiles, onBuildPattern, onRejectedFiles }: {
  onImportFiles: (files: File[]) => void;
  onBuildPattern: () => void;
  /** Files dropped that aren't MIDI. */
  onRejectedFiles: (names: string[]) => void;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [dropping, setDropping] = useState(false);
  const take = (files: File[]) => {
    const midi = files.filter(isMidiFile);
    const others = files.filter(f => !isMidiFile(f));
    if (midi.length > 0) onImportFiles(midi);
    if (others.length > 0) onRejectedFiles(others.map(f => f.name));
  };

  return (
    <div
      data-testid="grid-start"
      className={`absolute inset-0 z-20 flex items-center justify-center p-6 transition-colors ${dropping ? 'bg-accent-primary/10' : 'bg-bg-app/60'}`}
      onDragOver={e => {
        if (!carriesFiles(e)) return;
        e.preventDefault();
        e.dataTransfer.dropEffect = 'copy';
        setDropping(true);
      }}
      onDragLeave={e => {
        if (e.currentTarget === e.target) setDropping(false);
      }}
      onDrop={e => {
        if (!carriesFiles(e)) return;
        e.preventDefault();
        setDropping(false);
        take(Array.from(e.dataTransfer.files));
      }}
    >
      <div className={`max-w-md w-full rounded-pf-lg border bg-[var(--bg-panel)] shadow-pf-xl p-6 text-center space-y-4 ${dropping ? 'border-accent-primary' : 'border-[var(--border-default)]'}`}>
        <div className="space-y-1">
          <h2 className="text-pf-lg font-semibold text-[var(--text-primary)]">Start with some Sounds</h2>
          <p className="text-pf-sm text-[var(--text-secondary)]">
            Import a MIDI file, or drop one here: each pitch becomes a Sound you place on the grid.
          </p>
        </div>
        <div className="flex items-center justify-center gap-2 flex-wrap">
          <button
            type="button"
            data-testid="grid-start-import"
            className="pf-btn pf-btn-primary text-pf-sm"
            onClick={() => inputRef.current?.click()}
          >
            <Upload size={14} aria-hidden="true" />
            Import MIDI
          </button>
          <button
            type="button"
            data-testid="grid-start-composer"
            className="pf-btn pf-btn-subtle text-pf-sm"
            onClick={onBuildPattern}
          >
            <Music size={14} aria-hidden="true" />
            Build a pattern in Composer
          </button>
        </div>
        <p className="text-pf-xs text-[var(--text-tertiary)]">
          Then drag Sounds onto pads, or let PushFlow suggest a starting layout. Analysis updates as you place them.
        </p>
        <input
          ref={inputRef}
          type="file"
          accept=".mid,.midi"
          multiple
          className="hidden"
          onChange={e => {
            take(Array.from(e.target.files ?? []));
            e.target.value = '';
          }}
        />
      </div>
    </div>
  );
}

/** For the state bar while Sounds exist but none is on the grid. */
export function NothingPlacedHint({ soundCount, onSuggest }: { soundCount: number; onSuggest: () => void }) {
  return (
    <span data-testid="grid-place-hint" className="flex items-center gap-2 min-w-0">
      <span className="text-pf-xs text-[var(--text-secondary)] truncate">
        Drag your {soundCount === 1 ? 'Sound' : `${soundCount} Sounds`} onto pads, or
      </span>
      <button
        type="button"
        className="pf-btn pf-btn-subtle text-pf-xs px-2 py-0.5 flex-shrink-0"
        onClick={onSuggest}
        title="Places your Sounds in a natural hand position as a Working/Test Layout you can edit, discard, or promote"
      >
        <Wand2 size={12} aria-hidden="true" />
        Suggest a starting layout
      </button>
    </span>
  );
}
