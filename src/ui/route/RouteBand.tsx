/**
 * "What you do" (S9.2): the route line and the section cards, on the bar axis.
 *
 * The route line is solid behind the playhead and dashed ahead, with a node
 * at each section's start and a square at the song's end, filled once
 * reached. Each card is as wide as its bars and shows its name and range, its
 * Push modes as pills and its "what you do" text, less of it as it narrows
 * (cardDetail); the tooltip always says everything. A card is upcoming,
 * active (outlined in the live mode's colour) or done (checked).
 */

import { Check } from 'lucide-react';
import { type PerformanceRoute, type PushMode, type RouteSection, PUSH_MODE_ABBREVIATIONS, PUSH_MODE_LABELS } from '../../types/performanceRoute';
import { ModeGlyph } from '../components/shared/ModeGlyph';
import {
  type CardDetail,
  type RouteAxis,
  type SectionState,
  barRangeLabel,
  cardDetail,
  sectionModes,
  sectionState,
  xOfBar,
} from './routeGeometry';
import { ROUTE_CARD_HEIGHT, ROUTE_LINE_HEIGHT, modeColour } from './routeLayout';

/** The placeholder for a section with no "what you do" text. */
export const WHAT_YOU_DO_PLACEHOLDER = 'Add what you do here';

const STATE_WORDS: Record<SectionState, string> = { done: 'Done', active: 'Playing', upcoming: 'Upcoming' };

export function sectionTooltip(section: RouteSection, modes: readonly PushMode[], state: SectionState): string {
  return [
    section.name || 'Unnamed section',
    barRangeLabel(section),
    modes.length > 0 ? modes.map(m => PUSH_MODE_LABELS[m]).join(' → ') : 'No mode set',
    section.text || 'Nothing written yet',
    STATE_WORDS[state],
  ].join(' · ');
}

/** The route line: progress up to the playhead, a node per section. */
export function RouteLine({ axis, sections, playheadBar }: {
  axis: RouteAxis;
  sections: readonly RouteSection[];
  playheadBar: number;
}) {
  const y = ROUTE_LINE_HEIGHT / 2;
  const px = Math.max(0, Math.min(axis.width, xOfBar(axis, playheadBar)));
  const end = sections.length > 0 ? sections[sections.length - 1].endBar : axis.startBar + axis.spanBars;
  const finished = playheadBar >= end;
  return (
    <svg
      data-testid="route-line"
      width={axis.width}
      height={ROUTE_LINE_HEIGHT}
      className="block overflow-visible"
      aria-hidden="true"
    >
      <line x1={px} y1={y} x2={axis.width} y2={y} stroke="var(--text-tertiary)" strokeWidth={1.5} strokeDasharray="4 4" />
      <line x1={0} y1={y} x2={px} y2={y} stroke="var(--text-primary)" strokeWidth={1.5} />
      {sections.map(s => {
        const reached = playheadBar >= s.startBar;
        return (
          <circle
            key={s.id}
            data-testid="route-node"
            data-reached={reached ? 'true' : undefined}
            cx={Math.max(5, xOfBar(axis, s.startBar))}
            cy={y}
            r={4}
            fill={reached ? 'var(--text-primary)' : 'var(--bg-app)'}
            stroke={reached ? 'var(--text-primary)' : 'var(--text-tertiary)'}
            strokeWidth={1.5}
          />
        );
      })}
      <rect
        data-testid="route-end"
        data-reached={finished ? 'true' : undefined}
        x={axis.width - 9}
        y={y - 4}
        width={8}
        height={8}
        fill={finished ? 'var(--text-primary)' : 'var(--bg-app)'}
        stroke={finished ? 'var(--text-primary)' : 'var(--text-tertiary)'}
        strokeWidth={1.5}
      />
    </svg>
  );
}

function ModePill({ mode, detail }: { mode: PushMode; detail: 'full' | 'abbr' | 'glyphs' }) {
  return (
    <span
      data-testid="mode-pill"
      data-mode={mode}
      className="inline-flex items-center gap-1 h-5 px-1.5 rounded-full border text-pf-micro font-semibold whitespace-nowrap"
      style={{
        color: modeColour(mode),
        borderColor: `color-mix(in srgb, ${modeColour(mode)} 55%, transparent)`,
        backgroundColor: `color-mix(in srgb, ${modeColour(mode)} 14%, transparent)`,
      }}
    >
      <ModeGlyph mode={mode} size={10} />
      {detail === 'full' && PUSH_MODE_LABELS[mode]}
      {detail === 'abbr' && PUSH_MODE_ABBREVIATIONS[mode]}
    </span>
  );
}

function StateMark({ state }: { state: SectionState }) {
  if (state === 'done') return <Check size={13} strokeWidth={3} aria-hidden="true" className="text-[var(--text-secondary)] flex-shrink-0" />;
  return (
    <span
      aria-hidden="true"
      className={`w-2 h-2 rounded-full flex-shrink-0 ${state === 'active' ? 'bg-[var(--text-primary)]' : 'border border-[var(--text-tertiary)]'}`}
    />
  );
}

function SectionCard({ section, axis, modes, state, liveMode }: {
  section: RouteSection;
  axis: RouteAxis;
  modes: PushMode[];
  state: SectionState;
  /** The mode at the playhead, for the active card's outline. */
  liveMode: PushMode | null;
}) {
  const left = xOfBar(axis, section.startBar);
  const width = Math.max(0, xOfBar(axis, section.endBar) - left - 4);
  const detail: CardDetail = cardDetail(width);
  const tooltip = sectionTooltip(section, modes, state);
  const ring = state === 'active' ? (liveMode ? modeColour(liveMode) : 'var(--text-primary)') : undefined;
  const showText = detail === 'full' || detail === 'abbr' || detail === 'glyphs';
  return (
    <article
      data-testid="route-card"
      data-section-id={section.id}
      data-state={state}
      data-detail={detail}
      aria-label={tooltip}
      title={tooltip}
      className={`absolute top-0 flex flex-col gap-1 overflow-hidden rounded-pf-md border px-2 py-1.5 ${
        state === 'upcoming'
          ? 'bg-bg-card/75 border-[var(--border-default)]'
          : state === 'done'
            ? 'bg-[var(--bg-card)] border-[var(--border-default)]'
            : 'bg-[var(--bg-card)]'
      }`}
      style={{
        left: left + 2,
        width,
        height: ROUTE_CARD_HEIGHT,
        ...(ring ? { borderColor: ring, borderWidth: 1.6, boxShadow: `0 0 12px color-mix(in srgb, ${ring} 35%, transparent)` } : {}),
      }}
    >
      {detail !== 'none' && (
        <div className="flex items-center gap-1.5 min-w-0">
          <StateMark state={state} />
          {detail !== 'state' && (
            <span className="text-pf-micro font-semibold uppercase tracking-wider text-[var(--text-secondary)] truncate">
              {section.name || 'Unnamed'}
            </span>
          )}
          {(detail === 'full' || detail === 'abbr') && (
            <span className="ml-auto font-mono text-pf-micro text-[var(--text-tertiary)] whitespace-nowrap">{barRangeLabel(section)}</span>
          )}
        </div>
      )}
      {detail === 'glyph' && modes[0] && (
        <span style={{ color: modeColour(modes[0]) }}><ModeGlyph mode={modes[0]} size={12} /></span>
      )}
      {showText && modes.length > 0 && (
        <div className="flex items-center gap-1 overflow-hidden">
          {modes.map(m => <ModePill key={m} mode={m} detail={detail} />)}
        </div>
      )}
      {showText && (
        <p
          data-testid="route-card-text"
          className={`text-pf-sm leading-snug line-clamp-2 ${
            section.text
              ? state === 'upcoming' ? 'text-[var(--text-secondary)]' : 'text-[var(--text-primary)]'
              : 'italic text-[var(--text-tertiary)]'
          }`}
        >
          {section.text || WHAT_YOU_DO_PLACEHOLDER}
        </p>
      )}
    </article>
  );
}

export function SectionCards({ axis, route, playheadBar, liveMode }: {
  axis: RouteAxis;
  route: PerformanceRoute;
  playheadBar: number;
  liveMode: PushMode | null;
}) {
  return (
    <div data-testid="route-cards" className="relative" style={{ width: axis.width, height: ROUTE_CARD_HEIGHT }}>
      {route.sections.map(section => (
        <SectionCard
          key={section.id}
          section={section}
          axis={axis}
          modes={sectionModes(section, route.modeSpans)}
          state={sectionState(section, playheadBar)}
          liveMode={liveMode}
        />
      ))}
    </div>
  );
}

/** "2 / 7 sections done". */
export function doneCount(sections: readonly RouteSection[], playheadBar: number): string {
  const done = sections.filter(s => sectionState(s, playheadBar) === 'done').length;
  return `${done} / ${sections.length} ${sections.length === 1 ? 'section' : 'sections'} done`;
}
