/**
 * Draws the Route's lanes on a canvas (S9.2; design spec §11: the canvas
 * layer). It only paints what laneScene worked out, so the picture is tested
 * through the scene and this stays a thin, dumb painter.
 *
 * Colours come from the app's tokens (R-D1), read once per draw from the
 * document: the Push modes (--mode-*), and the route aliases (--route-*).
 */

import { type LaneScene, type RouteAxis, xOfBar } from './routeGeometry';
import { PUSH_MODES, type PushMode } from '../../types/performanceRoute';

export interface LanePalette {
  clip: string;
  clipEdge: string;
  note: string;
  grid: string;
  unplayable: string;
  modes: Record<PushMode, string>;
  /** A performed span with no mode set. */
  unsetMode: string;
}

/** The palette from the document's tokens. */
export function lanePalette(root: Element = document.documentElement): LanePalette {
  const style = getComputedStyle(root);
  const token = (name: string, fallback: string) => style.getPropertyValue(name).trim() || fallback;
  const modes = {} as Record<PushMode, string>;
  for (const mode of PUSH_MODES) modes[mode] = token(`--mode-${mode}`, '#888888');
  return {
    clip: token('--route-clip', '#2a2a2a'),
    clipEdge: token('--route-clip-edge', '#434656'),
    note: token('--route-note', '#8e90a2'),
    grid: token('--route-grid', '#2e2e32'),
    unplayable: token('--route-unplayable', '#ef4444'),
    modes,
    unsetMode: token('--text-tertiary', '#8e90a2'),
  };
}

export interface DrawLanesInput {
  scene: LaneScene;
  axis: RouteAxis;
  height: number;
  /** Bar lines to draw across the lanes, and the section boundaries (drawn stronger). */
  barLines: readonly number[];
  sectionLines: readonly number[];
  palette: LanePalette;
}

export function drawLanes(ctx: CanvasRenderingContext2D, input: DrawLanesInput): void {
  const { scene, axis, height, barLines, sectionLines, palette } = input;
  ctx.clearRect(0, 0, axis.width, height);

  // Grid: bar lines, then section boundaries.
  ctx.fillStyle = palette.grid;
  for (const bar of barLines) ctx.fillRect(Math.round(xOfBar(axis, bar)), 0, 1, height);
  ctx.fillStyle = palette.clipEdge;
  for (const bar of sectionLines) ctx.fillRect(Math.round(xOfBar(axis, bar)), 0, 1, height);

  const dim = new Set(scene.rows.filter(r => r.dim).map(r => r.laneId));
  const alpha = (laneId: string) => (dim.has(laneId) ? 0.45 : 1);

  for (const p of scene.primitives) {
    ctx.globalAlpha = alpha(p.laneId);
    switch (p.kind) {
      case 'clip':
        ctx.fillStyle = palette.clip;
        ctx.fillRect(p.x, p.y, p.w, p.h);
        ctx.strokeStyle = palette.clipEdge;
        ctx.lineWidth = 1;
        ctx.strokeRect(p.x + 0.5, p.y + 0.5, Math.max(0, p.w - 1), Math.max(0, p.h - 1));
        break;
      case 'performed': {
        const colour = p.mode ? palette.modes[p.mode] : palette.unsetMode;
        ctx.fillStyle = colour;
        ctx.globalAlpha = alpha(p.laneId) * 0.24;
        ctx.fillRect(p.x, p.y, p.w, p.h);
        ctx.globalAlpha = alpha(p.laneId);
        // The 2.5 px top rule.
        ctx.fillRect(p.x, p.y, p.w, 2.5);
        break;
      }
      case 'density':
      case 'note':
        ctx.fillStyle = palette.note;
        ctx.fillRect(p.x, p.y, p.w, p.h);
        if (p.unplayable) {
          // Never hidden: kept in place, outlined red.
          ctx.strokeStyle = palette.unplayable;
          ctx.lineWidth = 1;
          ctx.strokeRect(p.x - 0.5, p.y - 0.5, p.w + 1, p.h + 1);
        }
        break;
    }
  }
  ctx.globalAlpha = 1;
}
