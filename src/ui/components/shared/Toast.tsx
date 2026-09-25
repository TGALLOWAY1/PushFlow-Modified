/**
 * Toast region primitive (T31 slice).
 *
 * One app-wide place that reports what just happened, in a polite live region
 * so screen readers announce it without stealing focus. A toast can carry one
 * action (usually Undo or Restore). Toasts dismiss themselves after a while,
 * but never while the pointer or keyboard focus is on them.
 *
 * Usage: const toast = useToast(); toast.show({ message, action }).
 * Outside a ToastProvider, useToast() is a no-op, so state code and tests that
 * render without the app shell keep working.
 */

import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';

export interface ToastAction {
  label: string;
  onClick: () => void;
}

export interface ToastOptions {
  message: string;
  action?: ToastAction;
  /** How long it stays up, in ms. Defaults: 5 s, or 8 s with an action. */
  durationMs?: number;
}

interface ToastItem extends ToastOptions {
  id: number;
}

export interface ToastApi {
  /** Shows a toast and returns its id. */
  show: (options: ToastOptions) => number;
  dismiss: (id: number) => void;
}

/** Oldest toasts drop off beyond this many. */
const MAX_TOASTS = 3;

const NOOP_API: ToastApi = { show: () => -1, dismiss: () => {} };

const ToastContext = createContext<ToastApi>(NOOP_API);

export function useToast(): ToastApi {
  return useContext(ToastContext);
}

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<ToastItem[]>([]);
  const nextId = useRef(1);

  const dismiss = useCallback((id: number) => {
    setToasts(prev => prev.filter(t => t.id !== id));
  }, []);

  const show = useCallback((options: ToastOptions) => {
    const id = nextId.current++;
    setToasts(prev => [...prev, { ...options, id }].slice(-MAX_TOASTS));
    return id;
  }, []);

  const api = useMemo(() => ({ show, dismiss }), [show, dismiss]);

  return (
    <ToastContext.Provider value={api}>
      {children}
      <ToastRegion toasts={toasts} onDismiss={dismiss} />
    </ToastContext.Provider>
  );
}

function ToastRegion({ toasts, onDismiss }: { toasts: ToastItem[]; onDismiss: (id: number) => void }) {
  // The live region is always in the DOM, so screen readers are already
  // listening when the first toast is added.
  return (
    <div
      role="status"
      aria-live="polite"
      aria-label="Notifications"
      data-testid="toast-region"
      className="fixed bottom-4 left-1/2 -translate-x-1/2 z-[90] flex flex-col items-center gap-2 pointer-events-none"
    >
      {toasts.map(t => <Toast key={t.id} toast={t} onDismiss={onDismiss} />)}
    </div>
  );
}

function Toast({ toast, onDismiss }: { toast: ToastItem; onDismiss: (id: number) => void }) {
  const [held, setHeld] = useState(false);
  const duration = toast.durationMs ?? (toast.action ? 8000 : 5000);

  useEffect(() => {
    if (held) return;
    const timer = setTimeout(() => onDismiss(toast.id), duration);
    return () => clearTimeout(timer);
  }, [held, duration, toast.id, onDismiss]);

  return (
    <div
      data-testid="toast"
      className="pointer-events-auto flex items-center gap-3 min-h-[36px] pl-3 pr-1 py-1 rounded-pf-md border border-[var(--border-strong)] bg-[var(--bg-panel)] shadow-pf-lg text-pf-sm text-[var(--text-primary)]"
      onMouseEnter={() => setHeld(true)}
      onMouseLeave={() => setHeld(false)}
      onFocus={() => setHeld(true)}
      onBlur={() => setHeld(false)}
    >
      <span>{toast.message}</span>
      {toast.action && (
        <button
          type="button"
          className="pf-btn pf-btn-subtle text-pf-sm min-h-[24px] font-semibold text-accent-primary-soft"
          onClick={() => {
            toast.action!.onClick();
            onDismiss(toast.id);
          }}
        >
          {toast.action.label}
        </button>
      )}
      <button
        type="button"
        aria-label="Dismiss notification"
        className="pf-btn pf-btn-subtle min-w-[24px] min-h-[24px] text-[var(--text-secondary)]"
        onClick={() => onDismiss(toast.id)}
      >
        ×
      </button>
    </div>
  );
}
