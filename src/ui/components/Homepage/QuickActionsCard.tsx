/**
 * QuickActionsCard.
 *
 * Sidebar card with shortcut buttons for common actions.
 * Styled with accent-colored icons and hover effects.
 */

import {
  Plus,
  Download,
  Copy,
  Play,
  GitCompare,
  Shield,
  Clock,
  History,
  Sparkles,
} from 'lucide-react';

interface QuickActionsCardProps {
  onNewProject: (queryParams?: string) => void;
  onNavigate: (path: string) => void;
  heroProjectId?: string;
}

interface ActionDef {
  icon: React.ReactNode;
  label: string;
  onClick: (props: QuickActionsCardProps) => void;
  accent?: string;
  bgAccent?: string;
}

const ACTIONS: ActionDef[] = [
  {
    icon: <Sparkles size={15} />,
    label: 'View Presets',
    onClick: (p) => p.heroProjectId ? p.onNavigate(`/project/${p.heroProjectId}?view=presets`) : p.onNewProject('?view=presets'),
    accent: 'text-cyan-400',
    bgAccent: 'bg-cyan-400/10',
  },
  {
    icon: <Plus size={15} />,
    label: 'New Performance',
    onClick: (p) => p.onNewProject(),
    accent: 'text-emerald-400',
    bgAccent: 'bg-emerald-400/10',
  },
  {
    icon: <Download size={15} />,
    label: 'Import MIDI',
    onClick: (p) => p.onNewProject(),
    accent: 'text-blue-400',
    bgAccent: 'bg-blue-400/10',
  },
  {
    icon: <Copy size={15} />,
    label: 'Duplicate Existing Layout',
    onClick: () => {},
    accent: 'text-purple-400',
    bgAccent: 'bg-purple-400/10',
  },
  {
    icon: <Play size={15} />,
    label: 'Resume Last Practice',
    onClick: () => {},
    accent: 'text-amber-400',
    bgAccent: 'bg-amber-400/10',
  },
  {
    icon: <GitCompare size={15} />,
    label: 'Compare Layout Options',
    onClick: () => {},
    accent: 'text-orange-400',
    bgAccent: 'bg-orange-400/10',
  },
  {
    icon: <Shield size={15} />,
    label: 'Constraint Validator',
    onClick: (p) => p.onNavigate('/validator'),
    accent: 'text-cyan-400',
    bgAccent: 'bg-cyan-400/10',
  },
  {
    icon: <Clock size={15} />,
    label: 'Temporal Evaluator',
    onClick: (p) => p.onNavigate('/temporal-evaluator'),
    accent: 'text-cyan-400',
    bgAccent: 'bg-cyan-400/10',
  },
  {
    icon: <History size={15} />,
    label: 'View Practice History',
    onClick: () => {},
    accent: 'text-rose-400',
    bgAccent: 'bg-rose-400/10',
  },
];

export function QuickActionsCard({ onNewProject, onNavigate, heroProjectId }: QuickActionsCardProps) {
  const props = { onNewProject, onNavigate, heroProjectId };

  return (
    <div className="glass-panel rounded-xl p-5">
      <h3 className="font-label uppercase tracking-[0.15em] text-[var(--text-tertiary)] text-xs font-semibold mb-4">
        Quick Actions
      </h3>

      <div className="space-y-1">
        {ACTIONS.map(action => (
          <button
            key={action.label}
            className="w-full flex items-center gap-3 px-3 py-2 rounded-lg hover:bg-[var(--bg-hover)] transition-colors text-left group"
            onClick={() => action.onClick(props)}
          >
            <div className={`w-8 h-8 rounded-lg ${action.bgAccent ?? 'bg-[var(--bg-hover)]'} flex items-center justify-center shrink-0`}>
              <span className={action.accent ?? 'text-[var(--text-tertiary)]'}>
                {action.icon}
              </span>
            </div>
            <span className="text-sm text-[var(--text-secondary)] group-hover:text-[var(--text-primary)] transition-colors">
              {action.label}
            </span>
          </button>
        ))}
      </div>
    </div>
  );
}
