/**
 * ContinuePracticingHero.
 *
 * Full-width hero section for the most recent performance.
 * Features gradient background, 8x8 grid overlay, and stat pills.
 */

import { Play, Pencil } from 'lucide-react';
import { type ProjectLibraryEntry } from '../../persistence/projectStorage';
import { type ProjectState } from '../../state/projectState';
import { MiniGridPreview } from '../panels/MiniGridPreview';

interface ContinuePracticingHeroProps {
  project: ProjectLibraryEntry;
  projectState: ProjectState | null;
  onResume: () => void;
  onOpenEditor: () => void;
}

function relativeDate(iso: string): string {
  try {
    const date = new Date(iso);
    const now = Date.now();
    const diffMs = now - date.getTime();
    const diffMin = Math.floor(diffMs / 60000);
    if (diffMin < 1) return 'Just now';
    if (diffMin < 60) return `${diffMin}m ago`;
    const diffHr = Math.floor(diffMin / 60);
    if (diffHr < 24) return `${diffHr}h ago`;
    const diffDays = Math.floor(diffHr / 24);
    if (diffDays < 30) return `${diffDays}d ago`;
    return date.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' });
  } catch {
    return '';
  }
}

export function ContinuePracticingHero({
  project,
  projectState,
  onResume,
  onOpenEditor,
}: ContinuePracticingHeroProps) {
  const tempo = projectState?.tempo ?? 120;
  const soundCount = projectState?.soundStreams.length ?? project.soundCount;
  const eventCount = projectState
    ? projectState.soundStreams.reduce((sum, s) => sum + s.events.length, 0)
    : project.eventCount;
  const padsUsed = projectState?.activeLayout
    ? Object.keys(projectState.activeLayout.padToVoice).length
    : 0;

  return (
    <section className="relative rounded-xl overflow-hidden group" style={{ minHeight: 380 }}>
      {/* Background gradient */}
      <div className="absolute inset-0">
        <div
          className="absolute inset-0"
          style={{
            background: 'linear-gradient(135deg, #131316 0%, #1a1a2e 30%, #16213e 60%, #0f0f1a 100%)',
          }}
        />
        {/* Subtle animated accent glow */}
        <div
          className="absolute inset-0 opacity-30"
          style={{
            background: 'radial-gradient(ellipse at 30% 80%, rgba(46, 91, 255, 0.15) 0%, transparent 60%), radial-gradient(ellipse at 70% 20%, rgba(139, 92, 246, 0.1) 0%, transparent 50%)',
          }}
        />
        {/* Bottom fade */}
        <div className="absolute inset-0 bg-gradient-to-t from-[var(--bg-app)] via-transparent to-transparent" />
      </div>

      {/* Content */}
      <div className="relative h-full flex flex-col justify-end p-10 space-y-5" style={{ minHeight: 380 }}>
        <div className="space-y-2">
          <span className="font-label uppercase tracking-[0.2em] text-[var(--accent-primary)] text-xs font-semibold">
            Current Session
          </span>
          <h1 className="font-headline text-5xl font-bold tracking-tighter text-[var(--text-primary)]">
            {project.name}
          </h1>
          <p className="text-[var(--text-secondary)] max-w-xl font-body text-base">
            {soundCount} sounds &middot; {eventCount} events{padsUsed > 0 ? ` \u00b7 ${padsUsed} pads` : ''}.
            Last edited {relativeDate(project.updatedAt)}.
          </p>
        </div>

        <div className="flex items-center gap-6">
          <button
            onClick={onResume}
            className="px-7 py-3 bg-gradient-to-br from-[var(--accent-primary)] to-[#1a3fcc] text-white font-headline font-bold rounded-xl flex items-center gap-2 inner-button-shadow hover:scale-[1.02] transition-transform"
          >
            <Play size={16} />
            Resume Session
          </button>
          <button
            onClick={onOpenEditor}
            className="px-5 py-3 border border-[var(--border-default)] hover:border-[var(--border-strong)] text-[var(--text-secondary)] hover:text-[var(--text-primary)] font-headline font-medium rounded-xl flex items-center gap-2 transition-colors"
          >
            <Pencil size={14} />
            Open Layout Editor
          </button>

          {/* Stat pills */}
          <div className="flex gap-4 ml-2">
            <div className="glass-panel-blur px-4 py-2 rounded-lg">
              <span className="block font-label uppercase text-[10px] text-[var(--accent-primary)] tracking-widest">BPM</span>
              <span className="font-headline text-xl font-bold text-[var(--text-primary)]">{tempo}</span>
            </div>
            <div className="glass-panel-blur px-4 py-2 rounded-lg">
              <span className="block font-label uppercase text-[10px] text-[var(--accent-secondary)] tracking-widest">Sounds</span>
              <span className="font-headline text-xl font-bold text-[var(--text-primary)]">{soundCount}</span>
            </div>
            <div className="glass-panel-blur px-4 py-2 rounded-lg">
              <span className="block font-label uppercase text-[10px] text-[var(--accent-tertiary)] tracking-widest">Events</span>
              <span className="font-headline text-xl font-bold text-[var(--text-primary)]">{eventCount}</span>
            </div>
          </div>
        </div>
      </div>

      {/* 8x8 Grid Preview Overlay (top-right) */}
      <div className="absolute top-8 right-8 glass-panel-blur p-4 rounded-xl hidden lg:block">
        {projectState ? (
          <>
            <MiniGridPreview
              layout={projectState.activeLayout}
              soundStreams={projectState.soundStreams}
              size={2.5}
              highlighted
            />
            <div className="mt-3 flex justify-between items-center">
              <span className="font-label text-[10px] uppercase tracking-wider text-[var(--text-tertiary)]">
                Active Pads
              </span>
              <span className="text-[var(--accent-primary)] font-bold text-xs">
                {padsUsed} / 64
              </span>
            </div>
          </>
        ) : (
          <div
            className="rounded-lg bg-[var(--bg-card)] border border-[var(--border-subtle)]"
            style={{ width: 240, height: 240 }}
          />
        )}
      </div>
    </section>
  );
}
