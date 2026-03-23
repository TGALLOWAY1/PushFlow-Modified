export function formatPlanScore(score: number): string {
  return `${Math.round(score)}%`;
}

export function getPlanScoreQuality(score: number): 'good' | 'ok' | 'bad' {
  if (score >= 80) return 'good';
  if (score >= 50) return 'ok';
  return 'bad';
}

export function getPlanScoreSummary(score: number): string {
  if (score >= 80) return 'Comfortable';
  if (score >= 50) return 'Playable with effort';
  return 'Needs work';
}
