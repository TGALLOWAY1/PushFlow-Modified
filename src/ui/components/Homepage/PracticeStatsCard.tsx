/**
 * PracticeStatsCard.
 *
 * Compact sidebar card showing practice statistics.
 * Updated with design guide styling.
 */

import { type PracticeStatsData } from './homepageDemoData';

interface PracticeStatsCardProps {
  stats: PracticeStatsData;
}

interface StatEntryProps {
  label: string;
  value: string;
}

function StatEntry({ label, value }: StatEntryProps) {
  return (
    <div className="flex items-center justify-between py-2 border-b border-[var(--border-subtle)] last:border-0">
      <span className="text-sm text-[var(--text-tertiary)]">{label}</span>
      <span className="text-sm font-bold font-headline text-[var(--text-primary)]">{value}</span>
    </div>
  );
}

export function PracticeStatsCard({ stats }: PracticeStatsCardProps) {
  return (
    <div className="glass-panel rounded-xl p-5">
      <div className="flex items-center justify-between mb-3">
        <h3 className="font-label uppercase tracking-[0.15em] text-[var(--text-tertiary)] text-xs font-semibold">
          Practice Stats
        </h3>
        <span className="text-[10px] font-label uppercase tracking-widest text-[var(--accent-primary)] cursor-pointer hover:underline transition-colors">
          Refined stats
        </span>
      </div>

      <div>
        <StatEntry label="Hours practiced this week" value={stats.hoursThisWeek} />
        <StatEntry label="Total hours practiced" value={stats.totalHours} />
        <StatEntry label="Sessions completed" value={String(stats.sessionsCompleted)} />
        <StatEntry label="Average session length" value={stats.avgSessionLength} />
        <StatEntry label="Layout iterations explored" value={String(stats.layoutsExplored)} />
        <StatEntry label="Current streak" value={stats.currentStreak} />
      </div>
    </div>
  );
}
