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
    <div className="flex items-center justify-between py-1.5 border-b border-gray-800 last:border-0">
      <span className="text-[11px] text-gray-500">{label}</span>
      <span className="text-sm font-medium text-gray-200">{value}</span>
    </div>
  );
}

export function PracticeStatsCard({ stats }: PracticeStatsCardProps) {
  return (
    <div className="glass-panel rounded-lg p-4">
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-sm font-medium text-gray-300">Practice Stats</h3>
        <span className="text-[10px] text-gray-600 cursor-pointer hover:text-gray-400 transition-colors">
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
