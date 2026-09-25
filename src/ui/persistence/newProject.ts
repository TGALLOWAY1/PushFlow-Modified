/**
 * Starting a project from the Library (S2.3, T51).
 *
 * "New project" starts empty. "Import MIDI" starts a project named after the
 * file with the file's Sounds, through the same import plan as the editor, and
 * places nothing (invariant 7; bottomLeftNote stays 36, invariant 5). "Open
 * demo project" does the same with the bundled copy of TEST MIDI 1. A
 * PushFlow project file picked through Import MIDI is recognised by its
 * content, whatever it is called.
 */

import { parseMidiFileToProject } from '../../import/midiImport';
import { createEmptyProjectState, projectReducer, type ProjectState } from '../state/projectState';
import { planMidiImport } from '../state/midiImportPlan';
import { generateId } from '../../utils/idGenerator';

export const UNTITLED_PROJECT_NAME = 'Untitled project';
export const DEMO_MIDI_FILE = 'TEST MIDI 1.mid';
export const DEMO_PROJECT_NAME = 'Demo · TEST MIDI 1';

/** A new, empty project, opened now. */
export function newProjectState(name: string = UNTITLED_PROJECT_NAME): ProjectState {
  const now = new Date().toISOString();
  return {
    ...createEmptyProjectState(),
    id: generateId('proj'),
    name,
    createdAt: now,
    updatedAt: now,
    lastOpenedAt: now,
  };
}

/** "TEST MIDI 1" for "TEST MIDI 1.mid". */
export function projectNameFromFile(fileName: string): string {
  return fileName.replace(/\.(mid|midi)$/i, '').trim() || UNTITLED_PROJECT_NAME;
}

export interface MidiProjectResult {
  state: ProjectState;
  importedCount: number;
}

/** A new project holding these MIDI files' Sounds, named after the first file (or `name`), nothing placed. */
export async function projectFromMidiFiles(files: File[], name?: string): Promise<MidiProjectResult> {
  const parsed = [];
  for (const file of files) parsed.push({ fileName: file.name, projectData: await parseMidiFileToProject(file) });
  let state = newProjectState(name ?? projectNameFromFile(files[0]?.name ?? ''));
  const plan = planMidiImport(state, parsed);
  for (const action of plan.actions) state = projectReducer(state, action);
  return { state, importedCount: plan.importedCount };
}

export type PickedFileKind = 'midi' | 'project' | 'unknown';

/** What a picked file is, by its content: a Standard MIDI File starts "MThd"; a project file is JSON. */
export async function pickedFileKind(file: File): Promise<PickedFileKind> {
  const head = new Uint8Array(await file.slice(0, 4).arrayBuffer());
  if (String.fromCharCode(...head) === 'MThd') return 'midi';
  const text = (await file.slice(0, 64).text()).trimStart();
  return text.startsWith('{') ? 'project' : 'unknown';
}

/** The bundled demo MIDI file, fetched from the app's own public/demo folder. */
export async function fetchDemoMidi(baseUrl: string = import.meta.env.BASE_URL): Promise<File> {
  const response = await fetch(`${baseUrl.replace(/\/?$/, '/')}demo/${encodeURIComponent(DEMO_MIDI_FILE)}`);
  if (!response.ok) throw new Error(`The demo file could not be loaded (${response.status}).`);
  return new File([await response.blob()], DEMO_MIDI_FILE, { type: 'audio/midi' });
}
