/**
 * The zoom rail (S9.2): the five levels of the Route, Song to Pad / Control,
 * with what each spans now. Only the Song level is reachable until semantic
 * zoom ships (S9.3); the others say so.
 */

import { ROUTE_RAIL_WIDTH } from './routeLayout';

export const ROUTE_LEVELS = ['Song', 'Section', 'Phrase', 'Action', 'Pad / Control'] as const;

/** Why a deeper level can't be reached yet. */
export const ZOOM_REASON = 'Zooming in comes in a later update';

export function RouteRail({ level, captions }: {
  /** The level shown, 0 (Song) to 4. */
  level: number;
  /** What each level spans ("8 bars", "1 press"), in level order. */
  captions: readonly string[];
}) {
  return (
    <nav
      data-testid="route-rail"
      aria-label="Zoom level"
      className="flex flex-col py-4 border-r border-[var(--border-subtle)] bg-[var(--bg-panel)] flex-shrink-0"
      style={{ width: ROUTE_RAIL_WIDTH }}
    >
      <ol className="relative flex flex-col gap-1 px-2">
        {ROUTE_LEVELS.map((name, i) => {
          const reached = i <= level;
          const current = i === level;
          const reachable = i === 0;
          return (
            <li key={name}>
              <button
                type="button"
                data-testid="route-rail-level"
                data-level={i}
                aria-current={current ? 'step' : undefined}
                disabled={!reachable}
                title={reachable ? `${name} · ${captions[i] ?? ''}` : ZOOM_REASON}
                className="focus-ring w-full flex items-center gap-2 rounded-pf-sm px-1.5 py-1.5 text-left disabled:cursor-not-allowed"
              >
                <span
                  aria-hidden="true"
                  className={`w-3 h-3 rounded-full flex-shrink-0 border-2 ${
                    current
                      ? 'border-[var(--text-primary)] bg-[var(--text-primary)]'
                      : reached ? 'border-[var(--text-primary)]' : 'border-[var(--border-strong)]'
                  }`}
                />
                <span className="flex flex-col min-w-0">
                  <span className={`text-pf-micro font-semibold uppercase tracking-wider ${current ? 'text-[var(--text-primary)]' : 'text-[var(--text-tertiary)]'}`}>
                    {name}
                  </span>
                  <span data-testid="route-rail-caption" className="text-pf-micro text-[var(--text-tertiary)] truncate">
                    {captions[i]}
                  </span>
                </span>
              </button>
            </li>
          );
        })}
      </ol>
    </nav>
  );
}
