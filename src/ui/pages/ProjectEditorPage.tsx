/**
 * ProjectEditorPage.
 *
 * Single coupled performance workspace for timeline editing, pattern
 * generation, grid layout assignment, and analysis. The project, the
 * transport and the view settings come from ProjectShell, its parent route.
 */

import { PerformanceWorkspace } from '../components/workspace/PerformanceWorkspace';

export function ProjectEditorPage() {
  return <PerformanceWorkspace />;
}
