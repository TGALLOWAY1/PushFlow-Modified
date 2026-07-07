/**
 * LibraryStatsCard.
 *
 * Sidebar card showing real aggregates computed from the project library —
 * no mock or placeholder values.
 */

import { LayoutGrid, Music, Activity, Clock } from 'lucide-react';
import { type ProjectLibraryEntry } from '../../persistence/projectStorage';

interface LibraryStatsCardProps {
  projects: ProjectLibraryEntry[];
}

function relativeDate(iso: string): string {
  try {
    const date = new Date(iso);
    if (Number.isNaN(date.getTime())) return '—';
    const diffMin = Math.floor((Date.now() - date.getTime()) / 60000);
    if (diffMin < 1) return 'Just now';
    if (diffMin < 60) return `${diffMin}m ago`;
    const diffHr = Math.floor(diffMin / 60);
    if (diffHr < 24) return `${diffHr}h ago`;
    const diffDays = Math.floor(diffHr / 24);
    if (diffDays < 30) return `${diffDays}d ago`;
    return date.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' });
  } catch {
    return '—';
  }
}

interface StatRowProps {
  icon: React.ReactNode;
  label: string;
  value: string;
}

function StatRow({ icon, label, value }: StatRowProps) {
  return (
    <div className="flex items-center gap-2.5">
      <span>{icon}</span>
      <div className="min-w-0">
        <p className="text-sm font-bold font-headline text-[var(--text-primary)]">{value}</p>
        <p className="text-[10px] font-label uppercase tracking-wider text-[var(--text-tertiary)]">{label}</p>
      </div>
    </div>
  );
}

export function LibraryStatsCard({ projects }: LibraryStatsCardProps) {
  const totalSounds = projects.reduce((sum, p) => sum + p.soundCount, 0);
  const totalEvents = projects.reduce((sum, p) => sum + p.eventCount, 0);
  const lastEdited = projects.length > 0 ? relativeDate(projects[0].updatedAt) : '—';

  return (
    <div className="glass-panel rounded-xl p-5">
      <h3 className="font-label uppercase tracking-[0.15em] text-[var(--text-tertiary)] text-xs font-semibold mb-4">
        Library
      </h3>
      <div className="grid grid-cols-2 gap-x-6 gap-y-3 w-full">
        <StatRow
          icon={<LayoutGrid size={14} className="text-[var(--accent-primary)]" />}
          label="Performances"
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
          label="Last edited"
          value={lastEdited}
        />
      </div>
    </div>
  );
}
