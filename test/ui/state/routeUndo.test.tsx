// @vitest-environment happy-dom
/**
 * S9.1 · every Performance Route edit is one undo step (P9-1c).
 *
 * Runs the real ProjectProvider (reducer + document-only history): each route
 * action adds one step named for what it did, one Undo takes the route back
 * to exactly what it was, and none of it marks the analysis stale.
 */

import { describe, it, expect } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import type { ReactNode } from 'react';
import { ProjectProvider, useProject } from '../../../src/ui/state/ProjectContext';
import { type ProjectAction, type ProjectState } from '../../../src/ui/state/projectState';
import { laneIdOfSound } from '../../../src/types/performanceRoute';
import { routeProject, placedOnActive } from '../../helpers/routeProject';

function renderProject(initial: ProjectState) {
  const wrapper = ({ children }: { children: ReactNode }) => (
    <ProjectProvider initialState={initial}>{children}</ProjectProvider>
  );
  return renderHook(() => useProject(), { wrapper });
}

const STEPS: [ProjectAction, string][] = [
  [{ type: 'ROUTE_SET_SECTION_NAME', payload: { sectionId: 'section-1', name: 'Drop' } }, 'Rename section'],
  [{ type: 'ROUTE_SET_SECTION_TEXT', payload: { sectionId: 'section-1', text: 'Kick L2 · Snare R3' } }, 'What you do'],
  [{ type: 'ROUTE_SPLIT_SECTION', payload: { bar: 8, newSectionId: 'b' } }, 'Split section'],
  [{ type: 'ROUTE_MOVE_BOUNDARY', payload: { sectionId: 'b', bar: 6 } }, 'Move section boundary'],
  [{ type: 'ROUTE_SET_MODE_SPAN', payload: { startBar: 6, endBar: 10, mode: 'instrument' } }, 'Push mode'],
  [{ type: 'ROUTE_SET_SPAN_ENDS', payload: { atBar: 7, startBar: 6, endBar: 12 } }, 'Push mode span'],
  [{ type: 'ROUTE_SET_PERFORMED', payload: { laneId: laneIdOfSound('snare'), startBar: 6, endBar: 12, performed: false } }, 'Lanes you perform'],
  [{ type: 'ROUTE_MERGE_SECTION', payload: { sectionId: 'b' } }, 'Merge sections'],
  [{ type: 'ROUTE_CLEAR' }, 'Clear route'],
];

describe('route edits and undo (P9-1c)', () => {
  it('each route action is one undo step with a readable name, and none marks the analysis stale', () => {
    const placed = placedOnActive(routeProject({
      sounds: [
        { id: 'kick', bars: Array.from({ length: 16 }, (_, i) => i) },
        { id: 'snare', bars: Array.from({ length: 16 }, (_, i) => i + 0.5) },
      ],
    }), ['kick', 'snare']);
    const { result } = renderProject({ ...placed, analysisStale: false });
    expect(result.current.canUndo).toBe(false);

    for (const [action, label] of STEPS) {
      const before = result.current.state.performanceRoute;
      act(() => result.current.dispatch(action));
      const after = result.current.state.performanceRoute;
      expect(after, action.type).not.toEqual(before);
      expect(result.current.undoLabel, action.type).toBe(label);
      expect(result.current.state.analysisStale, action.type).toBe(false);

      // One Undo takes the route back exactly; Redo re-applies it.
      act(() => result.current.undo());
      expect(result.current.state.performanceRoute, action.type).toEqual(before);
      expect(result.current.state.analysisStale, action.type).toBe(false);
      act(() => result.current.redo());
      expect(result.current.state.performanceRoute, action.type).toEqual(after);
    }

    // Nine steps, the first of which adopted the detected route: nine Undos go back to no route.
    for (let i = 0; i < STEPS.length; i++) act(() => result.current.undo());
    expect(result.current.state.performanceRoute).toBeNull();
    expect(result.current.canUndo).toBe(false);
  });
});
