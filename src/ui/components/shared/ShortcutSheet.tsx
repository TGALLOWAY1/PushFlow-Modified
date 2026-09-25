/**
 * The '?' shortcut sheet (T61), generated from the one input table, so it can
 * never list a key that does something else. Learn More's keyboard tab renders
 * the same sections.
 */

import { Fragment } from 'react';
import { Dialog, useOverlayTitleId } from './Overlay';
import {
  INPUT_GROUPS,
  boundRows,
  displayInput,
  displayWhen,
  isKeyInput,
  isMacPlatform,
} from '../../input/inputTable';

export function InputTableSections({ mac = isMacPlatform() }: { mac?: boolean }) {
  const rows = boundRows();
  return (
    <div className="space-y-4">
      {INPUT_GROUPS.map(group => {
        const groupRows = rows.filter(r => r.group === group);
        if (groupRows.length === 0) return null;
        return (
          <section key={group} aria-label={group}>
            <h3 className="section-header mb-1">{group}</h3>
            {/* Fixed columns, so every group's columns line up. */}
            <table className="w-full table-fixed text-pf-sm border-collapse">
              <colgroup>
                <col style={{ width: '32%' }} />
                <col style={{ width: '24%' }} />
                <col />
              </colgroup>
              <tbody>
                {groupRows.map(row => (
                  <tr key={row.id} data-row-id={row.id} className="border-t border-[var(--border-subtle)] align-top">
                    <td className="py-1.5 pr-3">
                      {row.input.map((input, i) => (
                        <Fragment key={input}>
                          {i > 0 && <span className="text-[var(--text-tertiary)]"> or </span>}
                          {isKeyInput(input)
                            ? <kbd className="px-1.5 py-0.5 rounded-pf-sm bg-[var(--bg-card)] border border-[var(--border-default)] font-mono text-pf-xs text-[var(--text-primary)]">{displayInput(input, mac)}</kbd>
                            : <span className="text-[var(--text-primary)]">{displayInput(input, mac)}</span>}
                        </Fragment>
                      ))}
                    </td>
                    <td className="py-1.5 pr-3 text-[var(--text-tertiary)]">{displayWhen(row.when, mac)}</td>
                    <td className="py-1.5 text-[var(--text-secondary)]">{row.does}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </section>
        );
      })}
    </div>
  );
}

export function ShortcutSheet({ onClose }: { onClose: () => void }) {
  const titleId = useOverlayTitleId();
  return (
    <Dialog
      onClose={onClose}
      labelledBy={titleId}
      testId="shortcut-sheet"
      className="fixed inset-6 z-[61] max-w-3xl mx-auto rounded-pf-lg border border-[var(--border-default)] bg-[var(--bg-app)] shadow-pf-xl flex flex-col overflow-hidden"
    >
      <div className="flex items-center justify-between px-5 py-3 border-b border-[var(--border-subtle)]">
        <h2 id={titleId} className="text-pf-lg font-semibold text-[var(--text-primary)]">Keyboard and mouse</h2>
        <button
          type="button"
          className="text-[var(--text-tertiary)] hover:text-[var(--text-primary)] transition-colors text-lg"
          onClick={onClose}
          aria-label="Close"
        >
          &times;
        </button>
      </div>
      <div className="flex-1 overflow-y-auto px-5 py-4">
        <InputTableSections />
      </div>
    </Dialog>
  );
}
