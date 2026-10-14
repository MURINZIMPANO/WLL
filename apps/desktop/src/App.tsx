import { Badge, Button } from '@lyriclens/ui';
import { AudioLines, MonitorPlay, Pin } from 'lucide-react';
import { useEffect, useState } from 'react';

import { describeHost } from './host.js';

/**
 * Overlay shell.
 *
 * Phase 0 shows the window chrome and proves the shared design system renders
 * inside a Tauri webview. Media-session detection (Windows SMTC / macOS
 * NowPlaying / Linux MPRIS) lands in Phase 1 behind `describeHost()`'s sibling
 * commands; until then this states plainly what it cannot do rather than
 * showing a fake "now playing".
 */

export function App() {
  const [host, setHost] = useState<string>('detecting…');
  const [inTauri, setInTauri] = useState(false);

  useEffect(() => {
    let cancelled = false;

    describeHost()
      .then((info) => {
        if (cancelled) return;
        setHost(info);
        setInTauri(true);
      })
      .catch(() => {
        // Running `vite dev` in a plain browser: expected during UI work.
        if (!cancelled) setHost('browser (no native host)');
      });

    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <div className="w-[420px] rounded-card">
      <div
        data-tauri-drag-region
        className="glass flex items-center justify-between gap-3 rounded-card border border-border-subtle p-3 shadow-overlay"
      >
        <div className="flex min-w-0 items-center gap-2.5">
          <span
            aria-hidden
            className="grid size-8 shrink-0 place-items-center rounded-md bg-accent text-accent-ink"
          >
            <AudioLines className="size-4" />
          </span>
          <div className="min-w-0">
            <p className="truncate text-sm font-extrabold tracking-tight text-text-high">
              LyricLens
            </p>
            <p className="truncate text-xs text-text-low">{host}</p>
          </div>
        </div>

        <Button
          size="icon"
          variant="ghost"
          aria-label="Keep the overlay on top"
          disabled={!inTauri}
        >
          <Pin aria-hidden className="size-4" />
        </Button>
      </div>

      <div className="glass mt-2 rounded-card border border-border-subtle p-4 shadow-overlay">
        <div className="flex items-start gap-3">
          <MonitorPlay aria-hidden className="mt-0.5 size-5 shrink-0 text-text-low" />
          <div className="min-w-0">
            <p className="text-sm font-bold text-text-high">Waiting for media sessions</p>
            <p className="mt-1 text-sm text-text-mid">
              Reading what is playing from other applications is the next step. On Windows that
              means the System Media Transport Controls API, on macOS NowPlaying, on Linux MPRIS.
            </p>
          </div>
        </div>

        <div className="mt-3 flex flex-wrap gap-2">
          <Badge tone="warning">Phase 1</Badge>
          <Badge>Sync engine ready</Badge>
          <Badge>Design system shared</Badge>
        </div>
      </div>
    </div>
  );
}
