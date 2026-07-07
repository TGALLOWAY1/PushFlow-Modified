/**
 * PushFlow App.
 *
 * Root component with routing. Pages are lazy-loaded so the heavy editor +
 * engine code is fetched per-route instead of in one monolithic bundle.
 */

import { Suspense, lazy } from 'react';
import { BrowserRouter, Routes, Route } from 'react-router-dom';

const ProjectLibraryPage = lazy(() =>
  import('./pages/ProjectLibraryPage').then(m => ({ default: m.ProjectLibraryPage })),
);
const ProjectEditorPage = lazy(() =>
  import('./pages/ProjectEditorPage').then(m => ({ default: m.ProjectEditorPage })),
);
const OptimizerDebugPage = lazy(() =>
  import('./pages/OptimizerDebugPage').then(m => ({ default: m.OptimizerDebugPage })),
);
const ConstraintValidatorPage = lazy(() =>
  import('./pages/ConstraintValidatorPage').then(m => ({ default: m.ConstraintValidatorPage })),
);
const TemporalEvaluatorPage = lazy(() =>
  import('./pages/TemporalEvaluatorPage').then(m => ({ default: m.TemporalEvaluatorPage })),
);

function RouteFallback() {
  return (
    <div className="min-h-screen flex items-center justify-center">
      <p className="text-sm text-[var(--text-secondary)]">Loading…</p>
    </div>
  );
}

export function App() {
  return (
    <BrowserRouter basename={import.meta.env.BASE_URL.replace(/\/$/, '')}>
      <Suspense fallback={<RouteFallback />}>
        <Routes>
          {/* Editor route: full-viewport app shell, no padding */}
          <Route path="/project/:id" element={
            <div className="h-[100dvh] overflow-hidden text-[var(--foreground)]">
              <ProjectEditorPage />
            </div>
          } />
          {/* Non-editor routes: scrollable page with padding */}
          <Route path="/" element={
            <div className="min-h-screen text-[var(--foreground)] p-6">
              <ProjectLibraryPage />
            </div>
          } />
          <Route path="/optimizer-debug" element={
            <div className="min-h-screen text-[var(--foreground)] p-6">
              <OptimizerDebugPage />
            </div>
          } />
          <Route path="/validator" element={
            <div className="min-h-screen text-[var(--foreground)] p-6">
              <ConstraintValidatorPage />
            </div>
          } />
          <Route path="/temporal-evaluator" element={
            <div className="min-h-screen text-[var(--foreground)] p-6">
              <TemporalEvaluatorPage />
            </div>
          } />
        </Routes>
      </Suspense>
    </BrowserRouter>
  );
}
