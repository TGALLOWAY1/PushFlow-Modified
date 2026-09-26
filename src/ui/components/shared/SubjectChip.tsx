/**
 * SubjectChip (S3.2, T03): which layout a surface describes, as one role chip
 * plus the layout's name. The layout-state bar, the Analysis panels, the
 * Events list, the selected-event card, the chart, both Compare sides and the
 * timeline head themselves with it, from layoutSubject.ts, so they always
 * name the same subject (canon section 8). The role's colour (a --role-*
 * token) always comes with the role's icon and word, never colour alone.
 */

import { type ReactNode } from 'react';
import { BadgeCheck, Bookmark, History, PencilLine, Sparkles, type LucideIcon } from 'lucide-react';
import { ROLE_META, type LayoutSubject, type SubjectRole } from '../../state/layoutSubject';

export const ROLE_ICON: Record<SubjectRole, LucideIcon> = {
  active: BadgeCheck,
  working: PencilLine,
  candidate: Sparkles,
  variant: Bookmark,
  recovered: History,
};

/** Text, border and fill in the role's colour, from its token (tailwind.config.js). */
const ROLE_CLASS: Record<SubjectRole, string> = {
  active: 'text-role-active border-role-active/40 bg-role-active/10',
  working: 'text-role-working border-role-working/40 bg-role-working/10',
  candidate: 'text-role-candidate border-role-candidate/40 bg-role-candidate/10',
  variant: 'text-role-variant border-role-variant/40 bg-role-variant/10',
  recovered: 'text-role-working border-role-working/40 bg-role-working/5 border-dashed',
};

/** The role's own chip: icon and word ("CANDIDATE B") in the role's colour. */
export function RoleChip({ role, text, className = '' }: { role: SubjectRole; text: string; className?: string }) {
  const Icon = ROLE_ICON[role];
  return (
    <span
      data-testid="role-chip"
      data-role={role}
      title={`${ROLE_META[role].term}: ${ROLE_META[role].description}`}
      className={`inline-flex items-center gap-1 flex-shrink-0 h-5 px-1.5 rounded-pf-sm border text-pf-micro font-semibold uppercase tracking-wide whitespace-nowrap ${ROLE_CLASS[role]} ${className}`}
    >
      <Icon size={11} strokeWidth={2.5} aria-hidden="true" />
      {text}
    </span>
  );
}

export function SubjectChip({ subject, prefix, detail, testId = 'subject-chip', className = '' }: {
  subject: LayoutSubject;
  /** Words before the chip ("Timeline shows"). */
  prefix?: string;
  /** A second line under the name (the state bar's comparison and freshness). */
  detail?: ReactNode;
  testId?: string;
  className?: string;
}) {
  const name = (
    <span
      data-testid={`${testId}-name`}
      className={`truncate min-w-0 ${detail ? 'text-pf-xs font-medium text-[var(--text-primary)]' : 'text-pf-xs text-[var(--text-secondary)]'}`}
    >
      {subject.name}
    </span>
  );
  return (
    <span
      data-testid={testId}
      data-role={subject.role}
      data-chip={subject.chip}
      data-name={subject.name}
      className={`inline-flex items-center gap-1.5 min-w-0 max-w-full ${className}`}
      title={`${prefix ? `${prefix} ` : ''}${subject.chip} · ${subject.name}`}
    >
      {prefix && <span className="text-pf-micro text-[var(--text-tertiary)] whitespace-nowrap flex-shrink-0">{prefix}</span>}
      <RoleChip role={subject.role} text={subject.chip} />
      {detail ? (
        <span className="flex flex-col min-w-0">
          {name}
          <span className="text-pf-micro text-[var(--text-tertiary)] truncate min-w-0">{detail}</span>
        </span>
      ) : name}
    </span>
  );
}
