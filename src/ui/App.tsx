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
      <div className="min-h-screen text-[var(--foreground)] p-6">
        <Routes>
          <Route path="/" element={<ProjectLibraryPage />} />
          <Route path="/project/:id" element={<ProjectEditorPage />} />
          <Route path="/optimizer-debug" element={<OptimizerDebugPage />} />
          <Route path="/validator" element={<ConstraintValidatorPage />} />
          <Route path="/temporal-evaluator" element={<TemporalEvaluatorPage />} />
        </Routes>
      </div>
    </BrowserRouter>
  );
}
