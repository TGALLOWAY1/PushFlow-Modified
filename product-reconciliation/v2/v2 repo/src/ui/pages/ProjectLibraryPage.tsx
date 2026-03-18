/**
 * ProjectLibraryPage.
 *
 * Browse, create, open, and manage projects.
 * MIDI import creates a new project with sound naming step.
 */

import { useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { type ProjectState, type SoundStream, type SoundEvent, createEmptyProjectState } from '../state/projectState';
import { listProjects, saveProject, deleteProject, removeFromIndex, clearProjectIndex, type ProjectLibraryEntry } from '../persistence/projectStorage';
import { parseMidiFileToProject } from '../../import/midiImport';
import { analyzePerformance } from '../../engine/structure/performanceAnalyzer';
import { generateId } from '../../utils/idGenerator';

/** Common drum kit presets for quick naming. */
const DRUM_PRESETS: Record<number, string> = {
  36: 'Kick', 37: 'Sidestick', 38: 'Snare', 39: 'Clap',
  40: 'Snare 2', 41: 'Lo Tom', 42: 'Closed HH', 43: 'Lo Tom 2',
  44: 'Pedal HH', 45: 'Mid Tom', 46: 'Open HH', 47: 'Mid Tom 2',
  48: 'Hi Tom', 49: 'Crash', 50: 'Hi Tom 2', 51: 'Ride',
  52: 'China', 53: 'Ride Bell', 54: 'Tambourine', 55: 'Splash',
  56: 'Cowbell', 57: 'Crash 2',
};

const VOICE_COLORS = [
  '#ef4444', '#3b82f6', '#22c55e', '#f59e0b', '#a855f7', '#06b6d4',
  '#ec4899', '#f97316', '#84cc16', '#14b8a6', '#6366f1', '#d946ef',
];

type Step = 'library' | 'naming';

interface PendingImport {
  name: string;
  streams: SoundStream[];
  tempo: number;
  instrumentConfig: ProjectState['instrumentConfig'];
  sections: ProjectState['sections'];
  voiceProfiles: ProjectState['voiceProfiles'];
}

export function ProjectLibraryPage() {
  const navigate = useNavigate();
  const [step, setStep] = useState<Step>('library');
  const [savedProjects, setSavedProjects] = useState<ProjectLibraryEntry[]>(() => listProjects());
  const [pendingImport, setPendingImport] = useState<PendingImport | null>(null);
  const [dragOver, setDragOver] = useState(false);
  const [error, setError] = useState<string | null>(null);
  // ---- MIDI Import ----

  const handleFile = useCallback(async (file: File) => {
    try {
      setError(null);
      const projectData = await parseMidiFileToProject(file);
      const structure = analyzePerformance(
        projectData.performance.events,
        projectData.performance.tempo ?? 120,
      );

      // Decompose performance into sound streams
      const byNote = new Map<number, import('../../types/performanceEvent').PerformanceEvent[]>();
      for (const e of projectData.performance.events) {
        const list = byNote.get(e.noteNumber) ?? [];
        list.push(e);
        byNote.set(e.noteNumber, list);
      }

      const sortedNotes = [...byNote.keys()].sort((a, b) => a - b);
      const streams: SoundStream[] = sortedNotes.map((noteNumber, i) => {
        const events: SoundEvent[] = (byNote.get(noteNumber) ?? []).map(e => ({
          startTime: e.startTime,
          duration: e.duration ?? 0.25,
          velocity: e.velocity ?? 100,
          eventKey: e.eventKey ?? `${noteNumber}:${e.startTime}`,
        }));

        const preset = DRUM_PRESETS[noteNumber];
        return {
          id: generateId('stream'),
          name: preset ?? `Note ${noteNumber}`,
          color: VOICE_COLORS[i % VOICE_COLORS.length],
          originalMidiNote: noteNumber,
          events,
          muted: false,
        };
      });

      setPendingImport({
        name: projectData.performance.name ?? 'Untitled',
        streams,
        tempo: projectData.performance.tempo ?? 120,
        instrumentConfig: projectData.instrumentConfig,
        sections: structure.sections,
        voiceProfiles: structure.voiceProfiles,
      });
      setStep('naming');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to parse MIDI file');
    }
  }, []);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(false);
    const file = e.dataTransfer.files[0];
    if (file) handleFile(file);
  }, [handleFile]);

  const handleInputChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) handleFile(file);
  }, [handleFile]);

  // ---- Sound Naming Step ----

  const handleCreateProject = useCallback(() => {
    if (!pendingImport) return;

    const now = new Date().toISOString();
    const id = generateId('proj');

    const state: ProjectState = {
      ...createEmptyProjectState(),
      id,
      name: pendingImport.name,
      createdAt: now,
      updatedAt: now,
      soundStreams: pendingImport.streams,
      tempo: pendingImport.tempo,
      instrumentConfig: pendingImport.instrumentConfig,
      sections: pendingImport.sections,
      voiceProfiles: pendingImport.voiceProfiles,
    };

    saveProject(state);
    setSavedProjects(listProjects());
    setPendingImport(null);
    setStep('library');
    navigate(`/project/${id}`);
  }, [pendingImport, navigate]);

  const applyDrumPresets = useCallback(() => {
    if (!pendingImport) return;
    setPendingImport({
      ...pendingImport,
      streams: pendingImport.streams.map(s => ({
        ...s,
        name: DRUM_PRESETS[s.originalMidiNote] ?? s.name,
      })),
    });
  }, [pendingImport]);

  const updateStreamName = useCallback((streamId: string, name: string) => {
    if (!pendingImport) return;
    setPendingImport({
      ...pendingImport,
      streams: pendingImport.streams.map(s =>
        s.id === streamId ? { ...s, name } : s
      ),
    });
  }, [pendingImport]);

  // ---- New Blank Project ----

  const handleNewProject = useCallback(() => {
    const now = new Date().toISOString();
    const id = generateId('proj');

    const state: ProjectState = {
      ...createEmptyProjectState(),
      id,
      name: 'Untitled Project',
      createdAt: now,
      updatedAt: now,
    };

    saveProject(state);
    setSavedProjects(listProjects());
    navigate(`/project/${id}`);
  }, [navigate]);

  // ---- Project Actions ----

  const handleOpenProject = useCallback((id: string) => {
    navigate(`/project/${id}`);
  }, [navigate]);

  // @ts-expect-error Declared for future use, not yet wired to UI
  const handleDeleteProject = useCallback((id: string) => {
    deleteProject(id);
    setSavedProjects(listProjects());
  }, []);

  const handleRemoveFromHistory = useCallback((id: string) => {
    removeFromIndex(id);
    setSavedProjects(listProjects());
  }, []);

  const handleClearHistory = useCallback(() => {
    clearProjectIndex();
    setSavedProjects([]);
  }, []);

  // ---- Render ----

  if (step === 'naming' && pendingImport) {
    return (
      <div className="max-w-2xl mx-auto space-y-6">
        <div>
          <h1 className="text-2xl font-bold mb-1">Name Your Sounds</h1>
          <p className="text-gray-400 text-sm">
            Each unique MIDI note becomes an independent sound stream.
            Give each one a meaningful name.
          </p>
        </div>

        {/* Project name */}
        <div>
          <label className="text-xs text-gray-500 block mb-1">Project Name</label>
          <input
            className="w-full bg-gray-900 border border-gray-700 rounded px-3 py-2 text-gray-200 focus:border-blue-500 focus:outline-none"
            value={pendingImport.name}
            onChange={e => setPendingImport({ ...pendingImport, name: e.target.value })}
          />
        </div>

        {/* Sound streams */}
        <div className="p-4 rounded-lg bg-gray-800/50 border border-gray-700 space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-sm font-medium text-gray-200">
              {pendingImport.streams.length} sounds detected
            </span>
            <button
              className="text-[11px] px-2 py-1 rounded bg-gray-700 hover:bg-gray-600 text-gray-300"
              onClick={applyDrumPresets}
            >
              Apply GM Drum Names
            </button>
          </div>
          <div className="space-y-2">
            {pendingImport.streams.map(s => (
              <div key={s.id} className="flex items-center gap-2">
                <span
                  className="w-3 h-3 rounded-sm flex-shrink-0"
                  style={{ backgroundColor: s.color }}
                />
                <span className="text-[11px] text-gray-500 w-10 flex-shrink-0 font-mono">
                  #{s.originalMidiNote}
                </span>
                <input
                  className="flex-1 bg-gray-900 border border-gray-700 rounded px-2 py-1 text-sm text-gray-200 focus:border-blue-500 focus:outline-none"
                  value={s.name}
                  onChange={e => updateStreamName(s.id, e.target.value)}
                  placeholder="Sound name..."
                />
                <span className="text-[10px] text-gray-500 flex-shrink-0 w-14 text-right">
                  {s.events.length} hits
                </span>
              </div>
            ))}
          </div>
        </div>

        {/* Actions */}
        <div className="flex gap-3">
          <button
            className="px-4 py-2 bg-gray-700 hover:bg-gray-600 rounded text-sm"
            onClick={() => { setStep('library'); setPendingImport(null); }}
          >
            Cancel
          </button>
          <button
            className="flex-1 py-2 bg-blue-600 hover:bg-blue-500 rounded text-sm font-medium text-white"
            onClick={handleCreateProject}
          >
            Create Project
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-3xl mx-auto space-y-6">
      <div>
        <h1 className="text-2xl font-bold mb-1">PushFlow</h1>
        <p className="text-gray-400 text-sm">Performance Ergonomics Optimizer for Ableton Push 3</p>
      </div>

      {/* MIDI upload zone */}
      <div
        className={`border-2 border-dashed rounded-xl p-6 text-center transition-colors cursor-pointer ${
          dragOver ? 'border-blue-500 bg-blue-500/10' : 'border-gray-700 hover:border-gray-600'
        }`}
        onDragOver={e => { e.preventDefault(); setDragOver(true); }}
        onDragLeave={() => setDragOver(false)}
        onDrop={handleDrop}
        onClick={() => document.getElementById('midi-input')?.click()}
      >
        <input
          id="midi-input"
          type="file"
          accept=".mid,.midi"
          className="hidden"
          onChange={handleInputChange}
        />
        <div className="text-gray-400">
          <div className="text-lg mb-1">Import MIDI File</div>
          <div className="text-sm text-gray-500">Drop a .mid file or click to browse</div>
        </div>
      </div>

      {/* Quick actions */}
      <div className="flex gap-2">
        <button
          className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-500 rounded text-sm font-medium text-white transition-colors"
          onClick={handleNewProject}
        >
          + New Project
        </button>
        <button
          className="px-3 py-1.5 bg-purple-600/80 hover:bg-purple-500/80 rounded text-sm font-medium text-white transition-colors"
          onClick={() => navigate('/validator')}
        >
          Constraint Validator
        </button>
        <button
          className="px-3 py-1.5 bg-cyan-600/80 hover:bg-cyan-500/80 rounded text-sm font-medium text-white transition-colors"
          onClick={() => navigate('/temporal-evaluator')}
        >
          Temporal Evaluator
        </button>
      </div>

      {error && (
        <div className="p-3 rounded-lg bg-red-500/10 border border-red-500/30 text-red-400 text-sm">
          {error}
        </div>
      )}

      {/* Saved Projects */}
      {savedProjects.length > 0 && (
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-medium text-gray-400">Your Projects</h2>
            <button
              className="text-[11px] text-gray-600 hover:text-gray-400 transition-colors"
              onClick={handleClearHistory}
            >
              Clear All
            </button>
          </div>
          <div className="space-y-1">
            {savedProjects.map(entry => (
              <div
                key={entry.id}
                className="flex items-center gap-3 p-3 rounded-lg bg-gray-800/30 border border-gray-700 hover:border-gray-600 transition-colors"
              >
                <button
                  className="flex-1 text-left"
                  onClick={() => handleOpenProject(entry.id)}
                >
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-medium text-gray-200">{entry.name}</span>
                    {entry.difficulty && (
                      <span className={`text-[10px] px-1.5 py-0.5 rounded font-mono ${
                        entry.difficulty === 'Easy' ? 'bg-green-500/15 text-green-400' :
                        entry.difficulty === 'Moderate' ? 'bg-yellow-500/15 text-yellow-400' :
                        entry.difficulty === 'Hard' ? 'bg-orange-500/15 text-orange-400' :
                        'bg-red-500/15 text-red-400'
                      }`}>
                        {entry.difficulty}
                      </span>
                    )}
                  </div>
                  <div className="text-[11px] text-gray-500 mt-0.5">
                    {entry.soundCount} sounds, {entry.eventCount} events
                    <span className="mx-1">·</span>
                    {new Date(entry.updatedAt).toLocaleDateString()}
                  </div>
                </button>
                <button
                  className="text-gray-600 hover:text-gray-400 text-sm px-1.5 py-0.5 transition-colors"
                  onClick={e => { e.stopPropagation(); handleRemoveFromHistory(entry.id); }}
                  title="Remove from history"
                >
                  ×
                </button>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
