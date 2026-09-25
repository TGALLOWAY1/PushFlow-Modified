/**
 * A Sound, as people read it (T20): its colour chip and its name, looked up by
 * id. An id that names no current Sound reads "a removed Sound", never the raw
 * id ("lane_1790…", "sound_…").
 */

export interface SoundRef {
  id: string;
  name: string;
  color?: string;
}

/** The Sound's name, or a plain phrase when the id is not a current Sound. */
export function soundNameFor(id: string, sounds: readonly SoundRef[]): string {
  return sounds.find(s => s.id === id)?.name ?? 'a removed Sound';
}

export function SoundLabel({ id, sounds, className = '' }: {
  id: string;
  sounds: readonly SoundRef[];
  className?: string;
}) {
  const sound = sounds.find(s => s.id === id);
  return (
    <span className={`inline-flex items-center gap-1 min-w-0 ${className}`}>
      <span
        aria-hidden="true"
        className="w-2 h-2 rounded-sm flex-shrink-0 border border-white/10"
        style={{ backgroundColor: sound?.color ?? 'transparent' }}
      />
      <span className="truncate">{sound?.name ?? 'a removed Sound'}</span>
    </span>
  );
}
