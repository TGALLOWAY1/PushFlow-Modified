/**
 * QuickActionsCard.
 *
 * Sidebar card with shortcuts: the demo project, the preset library, and
 * the two developer tools. "New project" is in the header, once.
 */

import {
  Shield,
  Clock,
  Sparkles,
  Music,
} from 'lucide-react';

interface QuickActionsCardProps {
  onNewProject: (queryParams?: string) => void;
  onOpenDemo: () => void;
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
    icon: <Music size={15} />,
    label: 'Open the demo',
    onClick: (p) => p.onOpenDemo(),
    accent: 'text-emerald-400',
    bgAccent: 'bg-emerald-400/10',
  },
  {
    icon: <Sparkles size={15} />,
    label: 'View presets',
    onClick: (p) => p.heroProjectId ? p.onNavigate(`/project/${p.heroProjectId}?view=presets`) : p.onNewProject('?view=presets'),
    accent: 'text-cyan-400',
    bgAccent: 'bg-cyan-400/10',
  },
  {
    icon: <Shield size={15} />,
    label: 'Constraint validator',
    onClick: (p) => p.onNavigate('/validator'),
    accent: 'text-cyan-400',
    bgAccent: 'bg-cyan-400/10',
  },
  {
    icon: <Clock size={15} />,
    label: 'Temporal evaluator',
    onClick: (p) => p.onNavigate('/temporal-evaluator'),
    accent: 'text-cyan-400',
    bgAccent: 'bg-cyan-400/10',
  },
];

export function QuickActionsCard(props: QuickActionsCardProps) {
  return (
    <div className="glass-panel rounded-xl p-5">
      <h3 className="text-pf-xs font-semibold uppercase tracking-[0.12em] text-[var(--text-tertiary)] mb-4">
        Quick actions
      </h3>

      <div className="space-y-1">
        {ACTIONS.map(action => (
          <button
            key={action.label}
            type="button"
            className="w-full flex items-center gap-3 px-3 py-2 rounded-lg hover:bg-[var(--bg-hover)] transition-colors text-left group"
            onClick={() => action.onClick(props)}
          >
            <div className={`w-8 h-8 rounded-lg ${action.bgAccent ?? 'bg-[var(--bg-hover)]'} flex items-center justify-center shrink-0`}>
              <span className={action.accent ?? 'text-[var(--text-tertiary)]'} aria-hidden="true">
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
