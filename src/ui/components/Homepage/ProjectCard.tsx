/**
 * A project in the Library's grid (S2.3, T52/T53): its real facts, dates and
 * variant count, a thumbnail of the layout it opens on (decision Q1) and the
 * shared "⋯" menu. The whole card opens the project.
 */

import { useEffect, useRef, useState } from 'react';
import { type ProjectLibraryEntry } from '../../persistence/projectStorage';
import { type ProjectState } from '../../state/projectState';
import { MiniGridPreview } from '../panels/MiniGridPreview';
import { ProjectMenu, type ProjectMenuActions } from './ProjectMenu';
import { projectDates, projectFacts, thumbnailLayout, variantCount, type ThumbnailBadge } from './projectFacts';

export interface ProjectCardProps {
  project: ProjectLibraryEntry;
  projectState: ProjectState | null;
  renaming: boolean;
  onRenameDone: (name: string | null) => void;
  onOpen: () => void;
  actions: ProjectMenuActions;
}

/** The layout state badge on a thumbnail. */
export function LayoutBadge({ badge }: { badge: ThumbnailBadge }) {
  const draft = badge === 'Draft, not promoted';
  return (
    <span
      data-testid="layout-badge"
      className={`inline-flex items-center px-2 py-0.5 rounded-pf-sm border text-pf-micro font-semibold ${
        draft
          ? 'bg-amber-500/15 border-amber-400/40 text-amber-200'
          : 'bg-emerald-500/15 border-emerald-400/40 text-emerald-200'
      }`}
    >
      {badge}
    </span>
  );
}

/**
 * The project name, a button that opens the project (the keyboard's way in),
 * or a field to rename it in place (Enter keeps it, Escape cancels).
 */
export function ProjectName({ name, renaming, onRenameDone, onOpen, className }: {
  name: string;
  renaming: boolean;
  onRenameDone: (name: string | null) => void;
  onOpen: () => void;
  className: string;
}) {
  const [draft, setDraft] = useState(name);
  const inputRef = useRef<HTMLInputElement>(null);
  const done = useRef(false);
  useEffect(() => {
    if (!renaming) return;
    done.current = false;
    setDraft(name);
    requestAnimationFrame(() => inputRef.current?.select());
  }, [renaming, name]);
  if (!renaming) {
    return (
      <h3 className={`${className} truncate`}>
        <button
          type="button"
          data-testid="project-name"
          className="max-w-full truncate text-left hover:underline outline-none focus-visible:ring-2 focus-visible:ring-sky-400 rounded-sm"
          title={`Open ${name}`}
          onClick={e => { e.stopPropagation(); onOpen(); }}
        >
          {name}
        </button>
      </h3>
    );
  }
  const finish = (value: string | null) => {
    if (done.current) return;
    done.current = true;
    onRenameDone(value);
  };
  return (
    <input
      ref={inputRef}
      data-testid="project-rename"
      aria-label="Project name"
      className={`${className} w-full bg-[var(--bg-input)] border border-[var(--border-strong)] rounded-pf-sm px-1.5 outline-none`}
      value={draft}
      autoFocus
      onClick={e => e.stopPropagation()}
      onChange={e => setDraft(e.target.value)}
      onKeyDown={e => {
        e.stopPropagation();
        if (e.key === 'Enter') finish(draft.trim() || null);
        if (e.key === 'Escape') finish(null);
      }}
      onBlur={() => finish(draft.trim() || null)}
    />
  );
}

export function ProjectCard({ project, projectState, renaming, onRenameDone, onOpen, actions }: ProjectCardProps) {
  const thumb = projectState ? thumbnailLayout(projectState) : null;
  const variants = variantCount(projectState);

  return (
    <div
      data-testid="project-card"
      data-project-id={project.id}
      className="group bg-[var(--bg-panel)] rounded-xl overflow-hidden hover:bg-[var(--bg-card)] transition-colors cursor-pointer border border-[var(--border-subtle)] hover:border-[var(--border-default)]"
      onClick={() => { if (!renaming) onOpen(); }}
    >
      {/* The layout the project opens on */}
      <div className="aspect-[4/3] relative overflow-hidden bg-[var(--bg-app)] flex items-center justify-center">
        {thumb && projectState ? (
          <MiniGridPreview layout={thumb.layout} soundStreams={projectState.soundStreams} size={1.3} />
        ) : (
          <div className="w-full h-full bg-gradient-to-br from-[var(--bg-panel)] to-[var(--bg-app)]" />
        )}
        {thumb && <div className="absolute top-2 left-2"><LayoutBadge badge={thumb.badge} /></div>}
        <div className="absolute top-2 right-2 rounded-pf-md bg-bg-app/80">
          <ProjectMenu projectName={project.name} actions={actions} />
        </div>
      </div>

      <div className="p-4 space-y-1">
        <ProjectName
          name={project.name}
          renaming={renaming}
          onRenameDone={onRenameDone}
          onOpen={onOpen}
          className="font-headline text-base font-bold tracking-tight text-[var(--text-primary)]"
        />
        <p data-testid="project-facts" className="text-pf-xs text-[var(--text-secondary)]">{projectFacts(project)}</p>
        <p data-testid="project-dates" className="text-pf-xs text-[var(--text-tertiary)]">
          {projectDates(project)}{variants ? ` · ${variants}` : ''}
        </p>
      </div>
    </div>
  );
}
