export function formatPadPosition(padKey: string): string {
  const [row, col] = padKey.split(',').map(Number);
  if (!Number.isFinite(row) || !Number.isFinite(col)) return padKey;
  return `(${row},${col})`;
}
