/**
 * PracticeStatsCard.
 *
 * Compact sidebar card showing practice statistics.
 * Single instance on the homepage — no duplication.
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
    <div className="flex items-center justify-between py-1.5 border-b border-[var(--border-subtle)] last:border-0">
      <span className="text-pf-sm text-[var(--text-tertiary)]">{label}</span>
      <span className="text-pf-base font-medium text-[var(--text-primary)]">{value}</span>
    </div>
  );
}

export function PracticeStatsCard({ stats }: PracticeStatsCardProps) {
  return (
    <div className="glass-panel rounded-pf-lg p-4">
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-pf-base font-medium text-[var(--text-secondary)]">Practice Stats</h3>
        <span className="text-pf-xs text-[var(--text-tertiary)] cursor-pointer hover:text-[var(--text-secondary)] transition-colors">
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
