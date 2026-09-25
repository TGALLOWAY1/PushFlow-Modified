/**
 * Pad positions for display (T43): one 1-based format everywhere.
 *
 * Pad keys stay "row,col" with 0-based numbers internally; people read
 * "Row 4 · Col 4", counted from 1 like the grid's own axis labels (rows from
 * the bottom, as on Push). Tight places use the locator "R4 C4".
 */

function parse(padKey: string): [number, number] | null {
  const [row, col] = padKey.split(',').map(Number);
  if (!Number.isFinite(row) || !Number.isFinite(col)) return null;
  return [row!, col!];
}

/** "Row 4 · Col 4" for row 3, column 3 (0-based). */
export function formatRowCol(row: number, col: number): string {
  return `Row ${row + 1} · Col ${col + 1}`;
}

/** "Row 4 · Col 4" for the pad "3,3". */
export function formatPadPosition(padKey: string): string {
  const p = parse(padKey);
  return p ? formatRowCol(p[0], p[1]) : padKey;
}

/** "R4 C4" for the pad "3,3": the compact form for tight rows. */
export function formatPadLocator(padKey: string): string {
  const p = parse(padKey);
  return p ? `R${p[0] + 1} C${p[1] + 1}` : padKey;
}

/** "row 4, column 4", for accessible names that are read aloud. */
export function spokenPadPosition(row: number, col: number): string {
  return `Row ${row + 1}, column ${col + 1}`;
}
