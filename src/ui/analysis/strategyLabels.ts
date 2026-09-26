/**
 * Readable names for how a candidate was made (T20): the generators' strategy
 * keys ("pose0-offset-1", "compact-right") are engine vocabulary. Greedy's
 * family names ("Natural Pose Anchor (seed 1)") are already words and pass
 * through unchanged.
 */

export function strategyLabel(strategy: string | undefined | null): string {
  if (!strategy) return 'Candidate';
  const offset = /^pose0-offset-(\d+)$/.exec(strategy);
  if (offset) {
    const rows = Number(offset[1]);
    return rows === 0 ? 'Natural hand pose' : `Natural hand pose, shifted ${rows} ${rows === 1 ? 'row' : 'rows'}`;
  }
  switch (strategy) {
    case 'baseline': return 'Based on your layout';
    case 'compact-right': return 'Compact, right hand';
    case 'compact-left': return 'Compact, left hand';
    // "Place remaining N Sounds" (S3.3): your placed Sounds, plus the rest.
    case 'remaining-placed': return 'Remaining placed';
    default: return strategy;
  }
}
