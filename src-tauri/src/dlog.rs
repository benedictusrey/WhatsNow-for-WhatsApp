//! Minimal diagnostic log to a file under the app-data dir, so failures are
//! visible even on a Windows GUI-subsystem build (which has no attached
//! console — `eprintln!` goes nowhere there). Added for issue #3 (Windows
//! toast notifications not appearing).
//!
//! - Windows: `%LOCALAPPDATA%\WhatsNow\logs\whatsnow.log`
//! - Linux:   `$XDG_DATA_HOME/WhatsNow/logs/whatsnow.log` (or `~/.local/share/...`)
//!
//! Truncated once per launch via [`init`], appended thereafter, so it stays
//! bounded to a single session. Best-effort: never panics. It records control
//! flow and error codes only — never message titles or bodies (no PII).

use std::io::Write;
use std::path::PathBuf;
use std::sync::Mutex;

/// Serializes writes across the per-account notification threads.
static LOCK: Mutex<()> = Mutex::new(());

fn log_path() -> Option<PathBuf> {
    #[cfg(windows)]
    let base: Option<PathBuf> = std::env::var_os("LOCALAPPDATA").map(PathBuf::from);
    #[cfg(not(windows))]
    let base: Option<PathBuf> = std::env::var_os("XDG_DATA_HOME")
        .map(PathBuf::from)
        .or_else(|| std::env::var_os("HOME").map(|h| PathBuf::from(h).join(".local/share")));

    let dir = base?.join("WhatsNow").join("logs");
    std::fs::create_dir_all(&dir).ok()?;
    Some(dir.join("whatsnow.log"))
}

/// Start a fresh log for this launch (truncate). Best-effort.
pub fn init() {
    if let Some(p) = log_path() {
        let _g = LOCK.lock().unwrap_or_else(|e| e.into_inner());
        let _ = std::fs::File::create(&p);
    }
    log("=== session start ===");
}

/// Append one line. Best-effort: silently does nothing if the path or write
/// fails, and never panics (mutex poison is recovered).
pub fn log(msg: &str) {
    let Some(p) = log_path() else { return };
    let ts = std::time::SystemTime::now()
        .duration_since(std::time::UNIX_EPOCH)
        .map(|d| d.as_secs())
        .unwrap_or(0);
    let _g = LOCK.lock().unwrap_or_else(|e| e.into_inner());
    if let Ok(mut f) = std::fs::OpenOptions::new()
        .create(true)
        .append(true)
        .open(&p)
    {
        let _ = writeln!(f, "[{ts}] {msg}");
    }
}
