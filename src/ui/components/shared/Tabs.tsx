/**
 * Tabs (T63): a tab list and its panels, per the ARIA tabs pattern.
 *
 * - The tablist needs an accessible name (`label`, or `labelledBy` a visible
 *   heading); the types refuse a Tabs without one.
 * - Each tab is a <button role="tab"> with aria-selected and aria-controls; each
 *   panel is role=tabpanel with aria-labelledby, so a screen reader hears
 *   "Timeline, tab, 1 of 2, selected".
 * - Roving tabindex: only the selected tab is in the Tab order, and Tab moves on
 *   from it into the panel.
 * - ←/→ (wrapping), Home and End move focus and select (automatic activation).
 *   They preventDefault, which is how the input table leaves them to the tabs
 *   instead of stepping events (inputRegistry.ts, widgetOwnsKey). Space and
 *   Enter are left alone: the focused tab is already selected, and Space plays
 *   as on every other button (S2.4).
 * Every panel stays in the DOM, hidden unless selected, so each aria-controls
 * resolves; an unselected panel's content mounts only with `keepMounted`.
 */

import { useId, useRef, type KeyboardEvent, type ReactNode } from 'react';

export interface TabItem<Id extends string = string> {
  id: Id;
  /** The tab's visible text: its accessible name. */
  label: ReactNode;
  /** data-testid for the tab, so existing selectors can move onto it. */
  testId?: string;
  /** data-testid for its panel. */
  panelTestId?: string;
}

/** The tab list's accessible name: an aria-label, or the id of a visible heading. */
type TabListName =
  | { label: string; labelledBy?: undefined }
  | { labelledBy: string; label?: undefined };

export type TabsProps<Id extends string> = TabListName & {
  tabs: readonly TabItem<Id>[];
  selected: Id;
  onSelect: (id: Id) => void;
  /** A panel's content: called for the selected tab, and for every tab with `keepMounted`. */
  renderPanel: (id: Id) => ReactNode;
  /** Keep unselected panels mounted (hidden), e.g. a Composer that keeps playing. */
  keepMounted?: boolean;
  /** Controls after the tabs in the same row (a collapse button); outside the tablist. */
  listEnd?: ReactNode;
  className?: string;
  /** The row holding the tablist and `listEnd`, when there is a `listEnd`. */
  rowClassName?: string;
  listClassName?: string;
  tabClassName?: string;
  panelClassName?: string;
};

export function Tabs<Id extends string>({
  tabs, selected, onSelect, renderPanel, keepMounted = false, listEnd, label, labelledBy,
  className, rowClassName, listClassName, tabClassName, panelClassName,
}: TabsProps<Id>) {
  const base = `tabs-${useId().replace(/:/g, '')}`;
  const tabRefs = useRef(new Map<Id, HTMLButtonElement>());
  const tabId = (i: number) => `${base}-tab-${i}`;
  const panelId = (i: number) => `${base}-panel-${i}`;

  const onKeyDown = (e: KeyboardEvent<HTMLDivElement>) => {
    if (e.altKey || e.ctrlKey || e.metaKey || e.shiftKey || tabs.length === 0) return;
    // From the focused tab (normally the selected one).
    const focused = tabs.findIndex(t => tabRefs.current.get(t.id) === e.target);
    const from = focused >= 0 ? focused : Math.max(0, tabs.findIndex(t => t.id === selected));
    let to: number;
    switch (e.key) {
      case 'ArrowRight': to = (from + 1) % tabs.length; break;
      case 'ArrowLeft': to = (from - 1 + tabs.length) % tabs.length; break;
      case 'Home': to = 0; break;
      case 'End': to = tabs.length - 1; break;
      default: return;
    }
    e.preventDefault();
    const target = tabs[to]!;
    tabRefs.current.get(target.id)?.focus();
    if (target.id !== selected) onSelect(target.id);
  };

  const list = (
    <div
      role="tablist"
      aria-label={label}
      aria-labelledby={labelledBy}
      aria-orientation="horizontal"
      className={`flex ${listClassName ?? ''}`}
      onKeyDown={onKeyDown}
    >
      {tabs.map((tab, i) => {
        const isSelected = tab.id === selected;
        return (
          <button
            key={tab.id}
            ref={el => {
              if (el) tabRefs.current.set(tab.id, el);
              else tabRefs.current.delete(tab.id);
            }}
            type="button"
            role="tab"
            id={tabId(i)}
            aria-selected={isSelected}
            aria-controls={panelId(i)}
            tabIndex={isSelected ? 0 : -1}
            data-testid={tab.testId}
            className={`pf-tab focus-ring ${isSelected ? 'active' : ''} ${tabClassName ?? ''}`}
            onClick={() => { if (!isSelected) onSelect(tab.id); }}
          >
            {tab.label}
          </button>
        );
      })}
    </div>
  );

  return (
    <div className={className}>
      {listEnd ? <div className={`flex items-center ${rowClassName ?? ''}`}>{list}{listEnd}</div> : list}
      {tabs.map((tab, i) => {
        const isSelected = tab.id === selected;
        return (
          <div
            key={tab.id}
            role="tabpanel"
            id={panelId(i)}
            aria-labelledby={tabId(i)}
            hidden={!isSelected}
            tabIndex={isSelected ? 0 : undefined}
            data-testid={tab.panelTestId}
            // A display utility (flex) would beat [hidden], so a hidden panel gets no classes.
            className={isSelected ? `focus-ring ${panelClassName ?? ''}` : undefined}
          >
            {isSelected || keepMounted ? renderPanel(tab.id) : null}
          </div>
        );
      })}
    </div>
  );
}
