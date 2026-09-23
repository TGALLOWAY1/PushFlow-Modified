// DOM shims for component tests running under happy-dom.
// happy-dom has no layout engine, so ResizeObserver never fires and matchMedia
// never matches; keep geometry and audio checks in Playwright (test/e2e/).
// No-op in the node environment used by engine tests.

if (typeof window !== 'undefined') {
  if (!('ResizeObserver' in window)) {
    class ResizeObserverShim {
      observe() {}
      unobserve() {}
      disconnect() {}
    }
    (window as unknown as { ResizeObserver: unknown }).ResizeObserver = ResizeObserverShim;
    (globalThis as unknown as { ResizeObserver: unknown }).ResizeObserver = ResizeObserverShim;
  }

  window.matchMedia = (query: string): MediaQueryList => ({
    matches: false,
    media: query,
    onchange: null,
    addListener: () => {},
    removeListener: () => {},
    addEventListener: () => {},
    removeEventListener: () => {},
    dispatchEvent: () => false,
  });
}
