/**
 * The open workspace's transport engine, for the e2e hook (window.__pf), which
 * lives outside the workspace. TransportProvider registers it; nothing else
 * reads this.
 */

import { type TransportEngine } from './transportEngine';

let current: TransportEngine | null = null;

export function setLiveTransport(engine: TransportEngine | null): void {
  current = engine;
}

export function liveTransport(): TransportEngine | null {
  return current;
}
