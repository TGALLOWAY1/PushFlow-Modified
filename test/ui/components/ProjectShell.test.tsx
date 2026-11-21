// @vitest-environment happy-dom

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, render, screen } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { createEmptyProjectState } from '../../../src/ui/state/projectState';
import { ProjectShell } from '../../../src/ui/pages/ProjectShell';

const storage = vi.hoisted(() => ({
  loadProjectAsync: vi.fn(),
  // A former synchronous loader must never bypass a failed migration/backup.
  loadProject: vi.fn(),
  markProjectOpened: vi.fn(),
}));

vi.mock('../../../src/ui/persistence/projectStorage', () => storage);

afterEach(cleanup);
beforeEach(() => {
  vi.resetAllMocks();
  storage.loadProject.mockReturnValue(createEmptyProjectState());
});

function openProject() {
  render(
    <MemoryRouter initialEntries={['/project/stored-project']}>
      <Routes>
        <Route path="/project/:id" element={<ProjectShell />} />
      </Routes>
    </MemoryRouter>,
  );
}

describe('ProjectShell loading', () => {
  it('shows a load error instead of opening an unbacked legacy copy', async () => {
    storage.loadProjectAsync.mockRejectedValue(new Error('backup write failed'));
    openProject();

    expect((await screen.findByRole('alert')).textContent).toContain('Could not open project');
    expect(storage.loadProject).not.toHaveBeenCalled();
    expect(storage.markProjectOpened).not.toHaveBeenCalled();
    expect(screen.getByRole('button', { name: 'Back to Library' })).toBeTruthy();
  });

  it('distinguishes a missing project from a failed load', async () => {
    storage.loadProjectAsync.mockResolvedValue(null);
    openProject();

    expect(await screen.findByText('Project not found.')).toBeTruthy();
    expect(screen.queryByRole('alert')).toBeNull();
    expect(storage.loadProject).not.toHaveBeenCalled();
  });
});
