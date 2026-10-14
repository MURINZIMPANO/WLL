'use client';

import { AnimatePresence, motion, useReducedMotion } from 'framer-motion';
import { AlertTriangle, CheckCircle2, Info, X, XCircle } from 'lucide-react';
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react';

import { cn } from '../lib/cn';

export type ToastTone = 'info' | 'success' | 'warning' | 'danger';

export interface ToastAction {
  label: string;
  onClick: () => void;
}

export interface ToastOptions {
  title: string;
  description?: string;
  tone?: ToastTone;
  /** 0 keeps it until dismissed. */
  durationMs?: number;
  action?: ToastAction;
}

interface ToastEntry extends Required<Omit<ToastOptions, 'description' | 'action'>> {
  id: string;
  description?: string;
  action?: ToastAction;
}

export interface ToastContextValue {
  toast(options: ToastOptions): string;
  dismiss(id: string): void;
}

const ToastContext = createContext<ToastContextValue | null>(null);

const DEFAULT_DURATION_MS = 4_000;

const TONE_ICON: Record<ToastTone, typeof Info> = {
  info: Info,
  success: CheckCircle2,
  warning: AlertTriangle,
  danger: XCircle,
};

const TONE_CLASS: Record<ToastTone, string> = {
  info: 'text-text-mid',
  success: 'text-success',
  warning: 'text-warning',
  danger: 'text-danger',
};

export function ToastProvider({ children, max = 3 }: { children: ReactNode; max?: number }) {
  const [toasts, setToasts] = useState<ToastEntry[]>([]);
  const timers = useRef(new Map<string, ReturnType<typeof setTimeout>>());
  const counter = useRef(0);

  const dismiss = useCallback((id: string) => {
    const timer = timers.current.get(id);
    if (timer !== undefined) {
      clearTimeout(timer);
      timers.current.delete(id);
    }
    setToasts((current) => current.filter((entry) => entry.id !== id));
  }, []);

  const toast = useCallback(
    (options: ToastOptions): string => {
      counter.current += 1;
      const id = `toast-${counter.current}`;
      const entry: ToastEntry = {
        id,
        title: options.title,
        ...(options.description !== undefined ? { description: options.description } : {}),
        ...(options.action !== undefined ? { action: options.action } : {}),
        tone: options.tone ?? 'info',
        durationMs: options.durationMs ?? DEFAULT_DURATION_MS,
      };

      setToasts((current) => {
        const next = [...current, entry];
        // Drop the oldest rather than letting the stack grow without bound.
        return next.length > max ? next.slice(next.length - max) : next;
      });

      if (entry.durationMs > 0) {
        timers.current.set(
          id,
          setTimeout(() => {
            dismiss(id);
          }, entry.durationMs),
        );
      }

      return id;
    },
    [dismiss, max],
  );

  // Clear every pending timer on unmount so a closed app does not fire into a
  // dead component tree.
  useEffect(() => {
    const pending = timers.current;
    return () => {
      for (const timer of pending.values()) clearTimeout(timer);
      pending.clear();
    };
  }, []);

  const value = useMemo<ToastContextValue>(() => ({ toast, dismiss }), [toast, dismiss]);

  return (
    <ToastContext.Provider value={value}>
      {children}
      <ToastViewport toasts={toasts} onDismiss={dismiss} />
    </ToastContext.Provider>
  );
}

export function useToast(): ToastContextValue {
  const context = useContext(ToastContext);
  if (context === null) {
    throw new Error('useToast must be used inside a <ToastProvider>');
  }
  return context;
}

function ToastViewport({
  toasts,
  onDismiss,
}: {
  toasts: ToastEntry[];
  onDismiss: (id: string) => void;
}) {
  const reduced = useReducedMotion();

  return (
    <div
      className="pointer-events-none fixed inset-x-0 bottom-24 z-50 flex flex-col items-center gap-2 px-4 sm:bottom-6 sm:left-auto sm:right-6 sm:items-end sm:px-0"
      // Errors interrupt; everything else is announced politely.
      aria-live="polite"
      aria-atomic="false"
    >
      <AnimatePresence initial={false}>
        {toasts.map((entry) => {
          const Icon = TONE_ICON[entry.tone];
          return (
            <motion.div
              key={entry.id}
              layout={!reduced}
              initial={reduced ? { opacity: 0 } : { opacity: 0, y: 12, scale: 0.97 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={reduced ? { opacity: 0 } : { opacity: 0, y: 8, scale: 0.97 }}
              transition={{ duration: 0.2, ease: [0.22, 1, 0.36, 1] }}
              role={entry.tone === 'danger' ? 'alert' : 'status'}
              className="glass pointer-events-auto flex w-full max-w-sm items-start gap-3 rounded-card border border-border-subtle p-4 shadow-elevated"
            >
              <Icon aria-hidden className={cn('mt-0.5 size-5 shrink-0', TONE_CLASS[entry.tone])} />

              <div className="min-w-0 flex-1">
                <p className="text-sm font-bold text-text-high">{entry.title}</p>
                {entry.description !== undefined && (
                  <p className="mt-0.5 text-sm text-text-mid">{entry.description}</p>
                )}
                {entry.action !== undefined && (
                  <button
                    type="button"
                    onClick={() => {
                      entry.action?.onClick();
                      onDismiss(entry.id);
                    }}
                    className="mt-2 rounded-pill px-3 py-1 text-sm font-bold text-accent-text transition-colors hover:bg-accent-soft focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
                  >
                    {entry.action.label}
                  </button>
                )}
              </div>

              <button
                type="button"
                onClick={() => {
                  onDismiss(entry.id);
                }}
                aria-label="Dismiss notification"
                className="shrink-0 rounded-pill p-1 text-text-low transition-colors hover:bg-surface-glass hover:text-text-high focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
              >
                <X aria-hidden className="size-4" />
              </button>
            </motion.div>
          );
        })}
      </AnimatePresence>
    </div>
  );
}
