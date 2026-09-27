/**
 * The Events list's filter, held by the workspace (S4.2, T27), so the
 * Analysis panel's "N events need attention" can apply it and bring the
 * Events tab up. Outside the workspace (a component test) the list keeps its
 * own filter and the button is plain text.
 */

import { createContext, useContext } from 'react';
import { type EventsFilter } from '../../analysis/eventDifficulty';

export interface EventsNavigation {
  filter: EventsFilter;
  setFilter: (filter: EventsFilter) => void;
  /** Shows the Events tab with this filter applied. */
  showEvents: (filter: EventsFilter) => void;
}

const EventsNavigationContext = createContext<EventsNavigation | null>(null);

export const EventsNavigationProvider = EventsNavigationContext.Provider;

export function useEventsNavigation(): EventsNavigation | null {
  return useContext(EventsNavigationContext);
}
