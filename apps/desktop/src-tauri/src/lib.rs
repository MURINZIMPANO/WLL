//! LyricLens desktop shell.
//!
//! Phase 0 responsibilities:
//!   - own the overlay window (frameless, transparent, always on top)
//!   - report host details to the web layer
//!
//! Phase 1 adds the media-session source per platform (Windows SMTC, macOS
//! NowPlaying, Linux MPRIS) and streams `PositionSample`s to the web layer,
//! where `packages/sync-engine` turns them into synced lyrics.

use serde::Serialize;

/// Host facts the web layer needs. Mirrors `HostInfo` in `src/host.ts`.
#[derive(Serialize)]
pub struct HostInfo {
    os: String,
    arch: String,
    /// False until the platform media-session source is wired in Phase 1.
    media_session_available: bool,
    app_version: String,
}

#[tauri::command]
fn describe_host() -> HostInfo {
    HostInfo {
        os: std::env::consts::OS.to_string(),
        arch: std::env::consts::ARCH.to_string(),
        media_session_available: false,
        app_version: env!("CARGO_PKG_VERSION").to_string(),
    }
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .invoke_handler(tauri::generate_handler![describe_host])
        .run(tauri::generate_context!())
        .expect("failed to start the LyricLens overlay");
}
