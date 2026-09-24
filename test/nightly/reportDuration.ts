import * as fs from 'fs';

/** Logs a duration and, in GitHub Actions, adds it to the job summary. */
export function reportDuration(label: string, ms: number): void {
  const line = `${label}: ${(ms / 60_000).toFixed(1)} min (${Math.round(ms / 1000)} s)`;
  console.log(line);
  const summary = process.env.GITHUB_STEP_SUMMARY;
  if (summary) fs.appendFileSync(summary, `- ${line}\n`);
}
