/**
 * A Sound's "⋯" menu in the Sounds panel (S5.1, T45): Rename, Colour, Group,
 * Short label, Name from GM drum map, Unplace and Delete (with Undo). An
 * action that can't be taken now says why beside it (T31). "Exclude from
 * analysis" arrives with S4.4, which makes mute audio-only.
 *
 * Every change is one undo step, named after it.
 */

import { useId, useState } from 'react';
import { useProject } from '../../state/ProjectContext';
import { type SoundStream } from '../../state/projectState';
import { SHORT_LABEL_MAX } from '../../../types/performanceLane';
import { gmDrumName, gmDrumRenames } from '../../../utils/gmDrumMap';
import { useRemovePadWithUndo } from '../../hooks/useRemovePadWithUndo';
import { useUndoToast } from '../../hooks/useUndoToast';
import { COMPOSER_SOURCE_ID } from '../../state/composerSource';
import { Popover } from '../shared/Overlay';
import { ColorSwatches } from './ColorSwatches';
import { useSoundGrouping } from './soundGroups';

const ITEM = 'focus-ring w-full flex items-center justify-between gap-2 px-2 py-1 rounded-pf-sm text-left text-pf-xs text-[var(--text-primary)] enabled:hover:bg-[var(--bg-hover)] disabled:opacity-50 disabled:cursor-not-allowed';
const SECTION = 'text-pf-micro text-[var(--text-tertiary)] uppercase tracking-wider px-2 pt-1.5';

export function SoundRowMenu({ sound, padKeys, locked, groupId, x, y, anchor, onClose, onRename }: {
  sound: SoundStream;
  /** Its pads on the layout on screen. */
  padKeys: string[];
  locked: boolean;
  groupId: string | null;
  x: number;
  y: number;
  anchor: HTMLElement | null;
  onClose: () => void;
  onRename: () => void;
}) {
  const { state, dispatch } = useProject();
  const grouping = useSoundGrouping();
  const removePad = useRemovePadWithUndo();
  const undoToast = useUndoToast();
  const titleId = useId();
  const [label, setLabel] = useState(sound.shortLabel ?? '');

  const lane = state.performanceLanes.find(l => l.id === sound.id);
  const fromComposer = lane?.sourceFileId === COMPOSER_SOURCE_ID;
  const gmName = gmDrumRenames(state.soundStreams)[sound.id] ?? null;
  const gmReason = gmName ? null
    : gmDrumName(sound.originalMidiNote) ? 'It already has its GM name'
    : 'Its pitch is no GM drum (35–81)';
  const unplaceReason = padKeys.length === 0 ? 'Not on the grid' : locked ? 'Locked · Unlock to remove' : null;
  const deleteReason = fromComposer ? 'A Composer lane: delete it in the Composer' : null;
  const groups = [...state.laneGroups].sort((a, b) => a.orderIndex - b.orderIndex);

  const saveLabel = () => {
    dispatch({ type: 'SET_SOUND_SHORT_LABEL', payload: { streamId: sound.id, shortLabel: label.trim() || null } });
    onClose();
  };

  return (
    <Popover
      x={x}
      y={y}
      role="dialog"
      labelledBy={titleId}
      onClose={onClose}
      anchor={anchor}
      returnFocusTo={anchor}
      testId="sound-menu"
      className="w-[236px] p-1.5 rounded-pf-md border border-[var(--border-default)] bg-[var(--bg-panel)] shadow-pf-xl flex flex-col gap-0.5"
    >
      <div id={titleId} className="px-2 pt-0.5 pb-1 text-pf-xs font-semibold text-[var(--text-primary)] truncate" title={sound.name}>{sound.name}</div>

      <button type="button" data-testid="sound-menu-rename" className={ITEM} onClick={() => { onClose(); onRename(); }}>
        Rename
      </button>

      <div className={SECTION}>Colour</div>
      <div className="px-2 py-1">
        <ColorSwatches
          value={sound.color}
          testId="sound-menu-colors"
          onPick={color => { dispatch({ type: 'SET_SOUND_COLOR', payload: { streamId: sound.id, color } }); onClose(); }}
        />
      </div>

      <div className={SECTION}>Group</div>
      <div role="radiogroup" aria-label="Group" className="flex flex-col">
        {[{ groupId: null as string | null, name: 'No group' }, ...groups].map(g => (
          <button
            key={g.groupId ?? 'none'}
            type="button"
            role="radio"
            aria-checked={groupId === g.groupId}
            data-testid={`sound-menu-group-${g.groupId ?? 'none'}`}
            className={ITEM}
            onClick={() => { grouping.moveToGroup([sound.id], g.groupId); onClose(); }}
          >
            <span className="truncate">{g.name}</span>
            {groupId === g.groupId && <span aria-hidden="true">✓</span>}
          </button>
        ))}
        <button type="button" data-testid="sound-menu-new-group" className={ITEM} onClick={() => { grouping.groupInNew([sound.id]); onClose(); }}>
          New group
        </button>
      </div>

      <div className={SECTION}>Short label</div>
      <form
        className="flex items-center gap-1.5 px-2 py-1"
        onSubmit={e => { e.preventDefault(); saveLabel(); }}
      >
        <input
          data-testid="sound-short-label-input"
          className="pf-input w-20 h-6 text-pf-xs font-mono"
          value={label}
          maxLength={SHORT_LABEL_MAX}
          placeholder="Kick"
          aria-label={`Short label, up to ${SHORT_LABEL_MAX} characters: pads show it instead of the name`}
          onChange={e => setLabel(e.target.value)}
        />
        <button type="submit" data-testid="sound-short-label-save" className="pf-btn pf-btn-subtle text-pf-xs px-2 py-0.5">
          {label.trim() ? 'Save' : sound.shortLabel ? 'Clear' : 'Save'}
        </button>
      </form>
      <p className="px-2 text-pf-micro text-[var(--text-tertiary)] leading-snug">Pads show it instead of the name.</p>

      <div className="border-t border-[var(--border-subtle)] my-1" />
      <MenuAction
        testId="sound-menu-gm"
        reason={gmReason}
        title={gmName ? `Rename it ${gmName}, from the General MIDI drum map` : undefined}
        onClick={() => { if (gmName) dispatch({ type: 'RENAME_SOUND', payload: { streamId: sound.id, name: gmName } }); onClose(); }}
      >
        Name from GM drum map{gmName ? ` · ${gmName}` : ''}
      </MenuAction>
      <MenuAction
        testId="sound-menu-unplace"
        reason={unplaceReason}
        title="Take it off the grid, back to To place (with Undo)"
        onClick={() => { removePad(padKeys[0]!); onClose(); }}
      >
        Unplace
      </MenuAction>
      <MenuAction
        testId="sound-menu-delete"
        reason={deleteReason}
        danger
        title="Delete the Sound, its notes and its placements (with Undo)"
        onClick={() => {
          dispatch({ type: 'DELETE_LANE', payload: sound.id });
          undoToast(`Deleted ${sound.name}`, 'Delete Sound');
          onClose();
        }}
      >
        Delete
      </MenuAction>
    </Popover>
  );
}

function MenuAction({ testId, reason, danger = false, title, onClick, children }: {
  testId: string;
  reason: string | null;
  danger?: boolean;
  title?: string;
  onClick: () => void;
  children: React.ReactNode;
}) {
  const id = useId();
  return (
    <div className="flex flex-col">
      <button
        type="button"
        data-testid={testId}
        className={`${ITEM} ${danger ? 'text-red-300' : ''}`}
        disabled={!!reason}
        aria-describedby={reason ? id : undefined}
        title={reason ?? title}
        onClick={onClick}
      >
        {children}
      </button>
      {reason && <span id={id} data-testid="disabled-reason" className="px-2 text-pf-micro text-[var(--text-tertiary)]">{reason}</span>}
    </div>
  );
}
