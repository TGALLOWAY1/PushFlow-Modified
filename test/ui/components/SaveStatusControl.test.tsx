// @vitest-environment happy-dom
/**
 * The toolbar's save control (S1a.4, T57 slice): its label is the true save
 * state, and a failed save is a persistent chip with Retry and Export a copy.
 */

import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, screen, fireEvent, cleanup } from '@testing-library/react';
import { SaveStatusControl } from '../../../src/ui/components/workspace/SaveStatusControl';

afterEach(cleanup);

describe('SaveStatusControl', () => {
  it.each([
    ['saved', 'Saved'],
    ['saving', 'Saving…'],
    ['unsaved', 'Save'],
  ] as const)('shows the %s state as "%s" on the Save project button', (status, label) => {
    render(<SaveStatusControl status={status} onSave={() => {}} onExport={() => {}} />);
    const button = screen.getByTitle('Save project');
    expect(button.textContent).toBe(label);
    expect(button.getAttribute('data-save-status')).toBe(status);
    expect(screen.queryByText("Couldn’t save")).toBeNull();
  });

  it('after a failed write shows "Couldn’t save · Retry · Export a copy" and never "Saved"', () => {
    const onSave = vi.fn();
    const onExport = vi.fn();
    render(<SaveStatusControl status="error" onSave={onSave} onExport={onExport} />);
    const chip = screen.getByRole('alert');
    expect(chip.getAttribute('data-save-status')).toBe('error');
    expect(chip.textContent).toBe('Couldn’t save·Retry·Export a copy');
    expect(screen.queryByText('Saved')).toBeNull();

    fireEvent.click(screen.getByRole('button', { name: 'Retry' }));
    expect(onSave).toHaveBeenCalledTimes(1);
    fireEvent.click(screen.getByRole('button', { name: 'Export a copy' }));
    expect(onExport).toHaveBeenCalledTimes(1);
  });
});
