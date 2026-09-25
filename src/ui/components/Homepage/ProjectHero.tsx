/**
 * The project the Library offers to continue: the one opened last (S2.3,
 * T52), not the one saved last. Same facts, thumbnail rule and "⋯" menu as
 * the cards, and one way in: Continue.
 */

import { Play } from 'lucide-react';
import { type ProjectLibraryEntry } from '../../persistence/projectStorage';
import { type ProjectState } from '../../state/projectState';
import { MiniGridPreview } from '../panels/MiniGridPreview';
import { ProjectMenu, type ProjectMenuActions } from './ProjectMenu';
import { LayoutBadge, ProjectName } from './ProjectCard';
import { projectDates, projectFacts, thumbnailLayout, variantCount } from './projectFacts';

export function ProjectHero({ project, projectState, renaming, onRenameDone, onOpen, actions }: {
  project: ProjectLibraryEntry;
  projectState: ProjectState | null;
  renaming: boolean;
  onRenameDone: (name: string | null) => void;
  onOpen: () => void;
  actions: ProjectMenuActions;
}) {
  const thumb = projectState ? thumbnailLayout(projectState) : null;
  const padCount = thumb ? Object.keys(thumb.layout.padToVoice).length : 0;
  const variants = variantCount(projectState);

  return (
    <section
      data-testid="project-hero"
      data-project-id={project.id}
      className="relative rounded-xl overflow-hidden border border-[var(--border-subtle)]"
      style={{ background: 'linear-gradient(135deg, #131316 0%, #1a1a2e 35%, #16213e 70%, #0f0f1a 100%)' }}
    >
      <div className="relative flex items-end justify-between gap-8 p-10" style={{ minHeight: 300 }}>
        <div className="min-w-0 space-y-3">
          <span className="block text-pf-xs font-semibold uppercase tracking-[0.15em] text-accent-primary-soft">
            Last opened
          </span>
          <ProjectName
            name={project.name}
            renaming={renaming}
            onRenameDone={onRenameDone}
            onOpen={onOpen}
            className="font-headline text-4xl font-bold tracking-tight text-[var(--text-primary)]"
          />
          <p data-testid="project-facts" className="text-pf-md text-[var(--text-secondary)]">{projectFacts(project)}</p>
          <p data-testid="project-dates" className="text-pf-sm text-[var(--text-tertiary)]">
            {projectDates(project)}{variants ? ` · ${variants}` : ''}
          </p>
          <div className="flex items-center gap-3 pt-2">
            <button
              type="button"
              data-testid="project-continue"
              onClick={onOpen}
              className="px-6 py-2.5 bg-accent-primary hover:bg-accent-hover text-white font-headline font-bold rounded-xl flex items-center gap-2 transition-colors"
            >
              <Play size={16} aria-hidden="true" />
              Continue
            </button>
            <ProjectMenu projectName={project.name} actions={actions} className="w-10 h-10 border border-[var(--border-default)]" />
          </div>
        </div>

        {/* The layout the project opens on */}
        <div className="flex-shrink-0 glass-panel-blur p-4 rounded-xl hidden lg:block">
          {thumb && projectState ? (
            <>
              <MiniGridPreview layout={thumb.layout} soundStreams={projectState.soundStreams} size={2.4} highlighted />
              <div className="mt-3 flex items-center justify-between gap-3">
                <LayoutBadge badge={thumb.badge} />
                <span className="text-pf-xs text-[var(--text-secondary)] tabular-nums">{padCount} / 64 pads</span>
              </div>
            </>
          ) : (
            <div className="rounded-lg bg-[var(--bg-card)] border border-[var(--border-subtle)]" style={{ width: 230, height: 230 }} />
          )}
        </div>
      </div>
    </section>
  );
}
