/**
 * Performance structure types.
 *
 * Sections, voice roles and transition graphs used by the project and engine.
 */

/**
 * Section: A meaningful temporal segment of the performance.
 * E.g., intro, verse, chorus, drop, fill phrase.
 */
export interface Section {
  id: string;
  name: string;
  startTime: number;
  endTime: number;
  /** Average event density (events per second) in this section. */
  density: number;
  /** Characterization of the section's density level. */
  densityLevel: 'sparse' | 'moderate' | 'dense';
}

/**
 * TransitionEdge: A directed transition from one voice to another.
 */
export interface TransitionEdge {
  fromVoice: number; // noteNumber
  toVoice: number;   // noteNumber
  count: number;
  averageDt: number; // average time delta in seconds
  minDt: number;     // minimum time delta
}

/**
 * TransitionGraph: Directed graph of voice-to-voice transitions.
 */
export interface TransitionGraph {
  edges: TransitionEdge[];
  /** Most frequent transition pairs, sorted by count descending. */
  mostFrequent: TransitionEdge[];
}

/**
 * MusicalRole: Functional purpose of a voice in the arrangement.
 */
export type MusicalRole = 'backbone' | 'accent' | 'fill' | 'texture' | 'lead';

/**
 * VoiceProfile: Statistics and role for a single voice.
 */
export interface VoiceProfile {
  noteNumber: number;
  eventCount: number;
  /** Average events per second when this voice is active. */
  frequency: number;
  /** How regular the voice's timing is (0 = irregular, 1 = perfectly regular). */
  regularity: number;
  /** Average velocity. */
  averageVelocity: number;
  /** Inferred musical role. */
  role: MusicalRole;
}
