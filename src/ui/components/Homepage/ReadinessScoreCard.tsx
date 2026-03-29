/**
 * ReadinessScoreCard.
 *
 * Circular gauge showing overall performance readiness plus key stats.
 * Updated with design guide color palette.
 */

import { Clock, LayoutGrid, TrendingUp, Flame } from 'lucide-react';
import { type ReadinessData } from './homepageDemoData';

interface ReadinessScoreCardProps {
  data: ReadinessData;
}

function CircularGauge({ score }: { score: number }) {
  const radius = 52;
  const stroke = 6;
  const center = 60;
  const circumference = 2 * Math.PI * radius;
  const offset = circumference * (1 - score / 100);

  return (
    <svg width={120} height={120} viewBox="0 0 120 120">
      {/* Background track */}
      <circle
        cx={center}
        cy={center}
        r={radius}
        fill="none"
        stroke="var(--bg-input)"
        strokeWidth={stroke}
      />
      {/* Foreground arc */}
      <circle
        cx={center}
        cy={center}
        r={radius}
        fill="none"
        stroke="url(#readinessGradient)"
        strokeWidth={stroke}
        strokeLinecap="round"
        strokeDasharray={circumference}
        strokeDashoffset={offset}
        transform={`rotate(-90 ${center} ${center})`}
      />
      <defs>
        <linearGradient id="readinessGradient" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="#2e5bff" />
          <stop offset="100%" stopColor="#22c55e" />
        </linearGradient>
      </defs>
      {/* Score text */}
      <text
        x={center}
        y={center - 4}
        textAnchor="middle"
        dominantBaseline="central"
        className="fill-white"
        style={{ fontSize: 32, fontWeight: 700, fontFamily: 'Space Grotesk, sans-serif' }}
      >
        {score}
      </text>
      <text
        x={center}
        y={center + 18}
        textAnchor="middle"
        className="fill-[var(--text-tertiary)]"
        style={{ fontSize: 9, fontFamily: 'Inter, sans-serif', textTransform: 'uppercase', letterSpacing: '0.1em' }}
      >
        Readiness Score
      </text>
    </svg>
  );
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

export function ReadinessScoreCard({ data }: ReadinessScoreCardProps) {
  return (
    <div className="glass-panel rounded-xl p-5 flex flex-col items-center">
      <div className="flex items-center justify-between w-full mb-3">
        <h3 className="font-label uppercase tracking-[0.15em] text-[var(--text-tertiary)] text-xs font-semibold">
          Performance Readiness
        </h3>
      </div>

      <CircularGauge score={data.score} />

      <div className="grid grid-cols-2 gap-x-6 gap-y-3 mt-5 w-full">
        <StatRow
          icon={<Clock size={14} className="text-[var(--accent-primary)]" />}
          label="Hours practiced"
          value={data.hoursPracticed}
        />
        <StatRow
          icon={<LayoutGrid size={14} className="text-[var(--accent-secondary)]" />}
          label="Layouts"
          value={String(data.layoutsExplored)}
        />
        <StatRow
          icon={<TrendingUp size={14} className="text-emerald-400" />}
          label="Difficulty"
          value={data.difficultyLevel}
        />
        <StatRow
          icon={<Flame size={14} className="text-[var(--accent-tertiary)]" />}
          label="Current Streak"
          value={`${data.currentStreak}d`}
        />
      </div>
    </div>
  );
}
