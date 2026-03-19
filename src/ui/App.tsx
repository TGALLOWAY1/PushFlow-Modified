/**
 * PushFlow App.
 *
 * Root component with routing.
 */

import { BrowserRouter, Routes, Route } from 'react-router-dom';
import { ProjectLibraryPage } from './pages/ProjectLibraryPage';
import { ProjectEditorPage } from './pages/ProjectEditorPage';
import { OptimizerDebugPage } from './pages/OptimizerDebugPage';
import { ConstraintValidatorPage } from './pages/ConstraintValidatorPage';
import { TemporalEvaluatorPage } from './pages/TemporalEvaluatorPage';

export function App() {
  return (
    <BrowserRouter>
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
    </BrowserRouter>
  );
}
