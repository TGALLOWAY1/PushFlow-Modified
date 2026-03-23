/**
 * QuickActionsCard.
 *
 * Sidebar card with shortcut buttons for common actions.
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
}

const ACTIONS: ActionDef[] = [
  {
    icon: <Sparkles size={14} />,
    label: 'View Presets',
    onClick: (p) => p.heroProjectId ? p.onNavigate(`/project/${p.heroProjectId}?view=presets`) : p.onNewProject('?view=presets'),
    accent: 'text-cyan-400',
  },
  {
    icon: <Plus size={14} />,
    label: 'New Performance',
    onClick: (p) => p.onNewProject(),
    accent: 'text-emerald-400',
  },
  {
    icon: <Download size={14} />,
    label: 'Import MIDI',
    onClick: (p) => p.onNewProject(), // Creates project, MIDI imported inside editor
    accent: 'text-blue-400',
  },
  {
    icon: <Copy size={14} />,
    label: 'Duplicate Existing Layout',
    onClick: () => {},
    accent: 'text-purple-400',
  },
  {
    icon: <Play size={14} />,
    label: 'Resume Last Practice',
    onClick: () => {},
    accent: 'text-amber-400',
  },
  {
    icon: <GitCompare size={14} />,
    label: 'Compare Layout Options',
    onClick: () => {},
    accent: 'text-orange-400',
  },
  {
    icon: <Shield size={14} />,
    label: 'Constraint Validator',
    onClick: (p) => p.onNavigate('/validator'),
    accent: 'text-cyan-400',
  },
  {
    icon: <Clock size={14} />,
    label: 'Temporal Evaluator',
    onClick: (p) => p.onNavigate('/temporal-evaluator'),
    accent: 'text-cyan-400',
  },
  {
    icon: <History size={14} />,
    label: 'View Practice History',
    onClick: () => {},
    accent: 'text-rose-400',
  },
];

export function QuickActionsCard({ onNewProject, onNavigate }: QuickActionsCardProps) {
  const props = { onNewProject, onNavigate };

  return (
    <div className="glass-panel rounded-pf-lg p-4">
      <h3 className="text-pf-base font-medium text-[var(--text-secondary)] mb-3">Quick Actions</h3>

      <div className="space-y-0.5">
        {ACTIONS.map(action => (
          <button
            key={action.label}
            className="w-full flex items-center gap-2.5 px-2 py-1.5 rounded-pf-sm hover:bg-[var(--bg-hover)] transition-colors text-left group"
            onClick={() => action.onClick(props)}
          >
            <span className={action.accent ?? 'text-[var(--text-tertiary)] group-hover:text-[var(--text-secondary)]'}>
              {action.icon}
            </span>
            <span className="text-pf-sm text-[var(--text-secondary)] group-hover:text-[var(--text-primary)]">
              {action.label}
            </span>
          </button>
        ))}
      </div>
    </div>
  );
}
