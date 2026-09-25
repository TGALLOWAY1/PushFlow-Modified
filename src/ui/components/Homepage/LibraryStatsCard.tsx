/**
 * LibraryStatsCard.
 *
 * Sidebar card showing real aggregates computed from the project library —
 * no mock or placeholder values. Events count moments (decision Q7).
 */

import { LayoutGrid, Music, Activity, Clock } from 'lucide-react';
import { type ProjectLibraryEntry } from '../../persistence/projectStorage';
import { lastOpenedProject } from '../../persistence/projectIndex';
import { relativeTime } from './projectFacts';

interface LibraryStatsCardProps {
  projects: ProjectLibraryEntry[];
}

interface StatRowProps {
  icon: React.ReactNode;
  label: string;
  value: string;
}

function StatRow({ icon, label, value }: StatRowProps) {
  return (
    <div className="flex items-center gap-2.5">
      <span aria-hidden="true">{icon}</span>
      <div className="min-w-0">
        <p className="text-sm font-bold font-headline text-[var(--text-primary)]">{value}</p>
        <p className="text-pf-micro uppercase tracking-wider text-[var(--text-tertiary)]">{label}</p>
      </div>
    </div>
  );
}

export function LibraryStatsCard({ projects }: LibraryStatsCardProps) {
  const totalSounds = projects.reduce((sum, p) => sum + p.soundCount, 0);
  const totalEvents = projects.reduce((sum, p) => sum + p.eventCount, 0);
  const last = lastOpenedProject(projects);
  const lastOpened = last?.lastOpenedAt ? relativeTime(last.lastOpenedAt) : '—';

  return (
    <div className="glass-panel rounded-xl p-5">
      <h3 className="text-pf-xs font-semibold uppercase tracking-[0.12em] text-[var(--text-tertiary)] mb-4">
        Library
      </h3>
      <div className="grid grid-cols-2 gap-x-6 gap-y-3 w-full">
        <StatRow
          icon={<LayoutGrid size={14} className="text-accent-primary-soft" />}
          label="Projects"
          value={String(projects.length)}
        />
        <StatRow
          icon={<Music size={14} className="text-[var(--accent-secondary)]" />}
          label="Sounds"
          value={String(totalSounds)}
        />
        <StatRow
          icon={<Activity size={14} className="text-emerald-400" />}
          label="Events"
          value={String(totalEvents)}
        />
        <StatRow
          icon={<Clock size={14} className="text-[var(--accent-tertiary)]" />}
          label="Last opened"
          value={lastOpened}
        />
      </div>
    </div>
  );
}
