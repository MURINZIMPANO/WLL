'use client';

import * as Dialog from '@radix-ui/react-dialog';
import { X } from 'lucide-react';
import type { ReactNode } from 'react';

import { cn } from '../lib/cn';

export interface SheetProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  description?: string;
  children: ReactNode;
  /** `bottom` is the mobile default; `side` suits desktop settings panels. */
  side?: 'bottom' | 'side';
  className?: string;
}

/**
 * Bottom sheet built on Radix Dialog, so focus trapping, `aria-modal`, escape
 * handling, scroll locking and focus restoration are correct without
 * hand-rolling them.
 *
 * Motion is plain CSS keyframes (see globals.css) rather than a JS animation
 * library: the enter transition is the only one that needs animating, and CSS
 * keeps the reduced-motion handling in exactly one place.
 */
export function Sheet({
  open,
  onOpenChange,
  title,
  description,
  children,
  side = 'bottom',
  className,
}: SheetProps) {
  return (
    <Dialog.Root open={open} onOpenChange={onOpenChange}>
      <Dialog.Portal>
        <Dialog.Overlay className="overlay-fade-in fixed inset-0 z-50 bg-bg-900/70 backdrop-blur-sm" />

        <Dialog.Content
          className={cn(
            'fixed z-50 flex flex-col bg-surface shadow-overlay',
            side === 'bottom'
              ? cn(
                  'sheet-up inset-x-0 bottom-0 max-h-[85dvh] rounded-t-xl border-t border-border-subtle',
                  'pb-[max(1.5rem,env(safe-area-inset-bottom))]',
                )
              : 'sheet-side-in inset-y-0 right-0 w-full max-w-md rounded-l-xl border-l border-border-subtle',
            className,
          )}
        >
          {/* Drag affordance on the mobile sheet. */}
          {side === 'bottom' && (
            <div aria-hidden className="flex justify-center pt-3 pb-1">
              <span className="h-1 w-10 rounded-pill bg-border-strong" />
            </div>
          )}

          <div className="flex items-start justify-between gap-4 px-6 pt-4 pb-3">
            <div className="min-w-0">
              <Dialog.Title className="text-lg font-extrabold tracking-tight text-text-high">
                {title}
              </Dialog.Title>
              {description !== undefined && (
                <Dialog.Description className="mt-1 text-sm text-text-mid">
                  {description}
                </Dialog.Description>
              )}
            </div>

            <Dialog.Close
              aria-label="Close"
              className="grid size-9 shrink-0 place-items-center rounded-pill text-text-mid transition-colors hover:bg-surface-glass hover:text-text-high focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
            >
              <X aria-hidden className="size-5" />
            </Dialog.Close>
          </div>

          <div className="min-h-0 flex-1 overflow-y-auto px-6 pb-6">{children}</div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
