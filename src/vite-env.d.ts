/// <reference types="vite/client" />

interface ImportMetaEnv {
  /** Set only for e2e runs; enables the window.__pf test hook. */
  readonly VITE_E2E?: string;
}
