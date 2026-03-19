/**
 * Homepage Demo Data.
 *
 * Deterministic mock data for homepage dashboard cards.
 * Uses a simple hash of project IDs so values are stable across refreshes.
 */

// ---------------------------------------------------------------------------
// Seeded random helper
// ---------------------------------------------------------------------------

function hashString(s: string): number {
  let h = 0;
  for (let i = 0; i < s.length; i++) {
    h = ((h << 5) - h + s.charCodeAt(i)) | 0;
  }
  return Math.abs(h);
}

function seededRandom(seed: number, index: number): number {
  const x = Math.sin(seed + index * 9301 + 49297) * 49297;
  return x - Math.floor(x);
}

// ---------------------------------------------------------------------------
// Readiness data
// ---------------------------------------------------------------------------

export interface ReadinessData {
  score: number;
  hoursPracticed: string;
  layoutsExplored: number;
  difficultyLevel: string;
  currentStreak: number;
}

export function getReadinessData(): ReadinessData {
  return {
    score: 70,
    hoursPracticed: '2h 38m',
    layoutsExplored: 4,
    difficultyLevel: 'High',
    currentStreak: 2,
  };
}

// ---------------------------------------------------------------------------
// Improvement plan
// ---------------------------------------------------------------------------

export interface ImprovementItem {
  id: string;
  text: string;
  tags: string[];
  impact: 'high' | 'medium' | 'low';
  completed: boolean;
}

export function getImprovementPlan(): ImprovementItem[] {
  return [
    {
      id: 'imp-1',
      text: 'Reduce transition difficulty in Drop A',
      tags: ['Layout', 'Constraints', 'Timing'],
      impact: 'high',
      completed: false,
    },
    {
      id: 'imp-2',
      text: 'Revisit finger assignment for snare accents',
      tags: ['Practice', 'Constraints', 'Timing'],
      impact: 'high',
      completed: false,
    },
    {
      id: 'imp-3',
      text: 'Practice Event 34-42 slowly',
      tags: ['Practice', 'Ergonomics'],
      impact: 'medium',
      completed: false,
    },
    {
      id: 'imp-4',
      text: 'Promote Layout Option B for better learnability',
      tags: ['Layout', 'Constraints'],
      impact: 'medium',
      completed: false,
    },
    {
      id: 'imp-5',
      text: 'Review zone violations in Bridge',
      tags: ['Layout', 'Constraints', 'Timing'],
      impact: 'low',
      completed: false,
    },
    {
      id: 'imp-6',
      text: 'Resolve repeated pinky overload in Fill 2',
      tags: ['Practice', 'Constraints', 'Timing'],
      impact: 'low',
      completed: false,
    },
  ];
}

// ---------------------------------------------------------------------------
// Suggested similarities
// ---------------------------------------------------------------------------

export interface SimilarityItem {
  id: string;
  icon: 'rhythm' | 'layout';
  title: string;
  description: string;
}

export function getSuggestedSimilarities(): SimilarityItem[] {
  return [
    {
      id: 'sim-1',
      icon: 'rhythm',
      title: 'Rhythmically similar to Neon Pulse',
      description: 'This performance is rhythmically similar to Neon Pulse',
    },
    {
      id: 'sim-2',
      icon: 'layout',
      title: 'Layout resembles Glass Circuit',
      description: 'The current drum mapping resembles your layout in Glass Circuit. Suggesting layout reuse or transferable practice skills.',
    },
  ];
}

// ---------------------------------------------------------------------------
// Practice stats
// ---------------------------------------------------------------------------

export interface PracticeStatsData {
  hoursThisWeek: string;
  totalHours: string;
  sessionsCompleted: number;
  avgSessionLength: string;
  layoutsExplored: number;
  currentStreak: string;
}

export function getPracticeStats(): PracticeStatsData {
  return {
    hoursThisWeek: '74h',
    totalHours: '6:37',
    sessionsCompleted: 34,
    avgSessionLength: '00:53 sec',
    layoutsExplored: 1,
    currentStreak: '0',
  };
}

// ---------------------------------------------------------------------------
// Per-project mock enrichment
// ---------------------------------------------------------------------------

export interface ProjectMockData {
  improvementScore: number;
  progressPercent: number;
  hoursSpent: string;
  lastPracticedLabel: string;
  status: 'in-progress' | 'needs-review' | 'practice-ready' | 'mostly-mastered' | 'archived';
  statusLabel: string;
  sectionLabel: string;
  practiceInsight: string;
  sectionsCount: number;
  minHours: string;
}

const STATUS_OPTIONS: Array<{ status: ProjectMockData['status']; label: string }> = [
  { status: 'in-progress', label: 'In Progress' },
  { status: 'needs-review', label: 'Needs Layout Review' },
  { status: 'practice-ready', label: 'Practice Ready' },
  { status: 'mostly-mastered', label: 'Mostly Mastered' },
  { status: 'archived', label: 'Archived' },
];

const SECTIONS = ['Intro', 'Verse', 'Chorus', 'Build', 'Drop A', 'Bridge', 'Break', 'Outro', 'Full Piece'];
const INSIGHTS = [
  'Drop section needs smoother transition cost',
  'Transition flow improved 12% since last session',
  'Finger alternation pattern stabilizing',
  'Learnability score trending up',
  'Bridge section constraint violations reduced',
  'Hand balance improved after layout change',
];

const TIME_LABELS = [
  'Jan 15, 2024', 'Dec 16, 2024', 'Dec 16, 2024',
  '2 hours ago', '3 days ago', '1 week ago',
  'Yesterday', '5 hours ago', 'Nov 28, 2024',
];

export function getProjectMockData(projectId: string): ProjectMockData {
  const seed = hashString(projectId);

  const improvementScore = Math.floor(seededRandom(seed, 0) * 60) + 40; // 40-100
  const progressPercent = Math.floor(seededRandom(seed, 1) * 80) + 20; // 20-100
  const hoursIdx = Math.floor(seededRandom(seed, 2) * 30) + 1;
  const statusIdx = Math.floor(seededRandom(seed, 3) * STATUS_OPTIONS.length);
  const sectionIdx = Math.floor(seededRandom(seed, 4) * SECTIONS.length);
  const insightIdx = Math.floor(seededRandom(seed, 5) * INSIGHTS.length);
  const timeIdx = Math.floor(seededRandom(seed, 6) * TIME_LABELS.length);
  const sectionsCount = Math.floor(seededRandom(seed, 7) * 6) + 1;
  const minHours = `${Math.floor(seededRandom(seed, 8) * 150) + 10} min: hours`;

  const chosen = STATUS_OPTIONS[statusIdx];

  return {
    improvementScore,
    progressPercent,
    hoursSpent: `${hoursIdx}h`,
    lastPracticedLabel: TIME_LABELS[timeIdx],
    status: chosen.status,
    statusLabel: chosen.label,
    sectionLabel: SECTIONS[sectionIdx],
    practiceInsight: INSIGHTS[insightIdx],
    sectionsCount,
    minHours,
  };
}
