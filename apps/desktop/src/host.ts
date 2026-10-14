import { invoke } from '@tauri-apps/api/core';

/**
 * Typed bridge to the Rust side.
 *
 * Every command declared here must exist in `src-tauri/src/lib.rs`. Keeping the
 * surface tiny and explicit means the web build never imports `@tauri-apps/api`
 * in a way that breaks in a plain browser — the calls simply reject, which
 * `App` handles.
 */

export interface HostInfo {
  os: string;
  arch: string;
  /** True when a real media-session source could be opened (Phase 1+). */
  mediaSessionAvailable: boolean;
  appVersion: string;
}

/** Throws when the UI is running outside a Tauri webview. */
export function describeHost(): Promise<string> {
  return invoke<HostInfo>('describe_host').then((info) => {
    const media = info.mediaSessionAvailable ? 'media session available' : 'no media session yet';
    return `${info.os} ${info.arch} · v${info.appVersion} · ${media}`;
  });
}
