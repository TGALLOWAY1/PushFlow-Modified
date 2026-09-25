/**
 * A name not already taken: the name itself, else "name (2)", "name (3)" …
 * (compared without regard to case or surrounding spaces).
 */
export function uniqueName(name: string, taken: Iterable<string>): string {
  const used = new Set([...taken].map(n => n.trim().toLowerCase()));
  const base = name.trim();
  if (!used.has(base.toLowerCase())) return base;
  for (let n = 2; ; n++) {
    const candidate = `${base} (${n})`;
    if (!used.has(candidate.toLowerCase())) return candidate;
  }
}
