use serde::{Deserialize, Deserializer, Serialize};

#[derive(Debug, Clone, Copy, Default, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "lowercase")]
pub enum AppTheme {
    #[default]
    System,
    Light,
    Dark,
    Midnight,
    Forest,
    Graphite,
    Ocean,
    Blush,
    Lavender,
    Candy,
    Aurora,
}

impl AppTheme {
    pub fn native_theme(self) -> Option<tauri::Theme> {
        match self {
            Self::Light | Self::Blush | Self::Lavender | Self::Candy | Self::Aurora => {
                Some(tauri::Theme::Light)
            }
            Self::System
            | Self::Dark
            | Self::Midnight
            | Self::Forest
            | Self::Graphite
            | Self::Ocean => Some(tauri::Theme::Dark),
        }
    }
}

/// Unknown or malformed theme values (for example after a downgrade) fall back
/// to `System` instead of discarding the whole settings file.
fn lenient_theme<'de, D: Deserializer<'de>>(deserializer: D) -> Result<AppTheme, D::Error> {
    let value = serde_json::Value::deserialize(deserializer)?;
    Ok(serde_json::from_value(value).unwrap_or_default())
}

pub fn default_hotkey() -> &'static str {
    #[cfg(target_os = "windows")]
    {
        "Alt+W"
    }
    #[cfg(target_os = "macos")]
    {
        "Alt+W"
    }
    #[cfg(target_os = "linux")]
    {
        "Ctrl+Alt+W"
    }
    #[cfg(not(any(target_os = "windows", target_os = "macos", target_os = "linux")))]
    {
        "CmdOrCtrl+Shift+W"
    }
}

fn migrate_legacy_defaults(mut settings: Settings) -> Settings {
    if settings.hotkey == "CmdOrCtrl+Shift+W" {
        settings.hotkey = default_hotkey().to_string();
    }
    // "Night" was the previous custom dark choice. The Settings UI now exposes
    // one official Dark option under the stable `system` value (which also
    // resolves the native window chrome to dark).
    // 2.6.0: the old rewrite to `System` stayed, but the DOODLE decision no
    // longer distinguishes `system` from the official themes — System, Light,
    // and Dark all show WhatsApp's native doodle wallpaper (see
    // `chat_appearance_script`).
    if settings.theme == AppTheme::Dark {
        settings.theme = AppTheme::System;
    }
    settings
}

pub fn chat_appearance_script(theme: AppTheme, _legacy_chat_doodles: bool) -> String {
    let theme_json = serde_json::to_string(&theme).expect("serialize app theme");
    // LOCKED BEHAVIOR (user-specified, 2.6.0 — see AGENTS.md section 1):
    // the OFFICIAL themes show WhatsApp's native doodle wallpaper exactly like
    // the official site does — System (the Settings UI's "Dark" option, which
    // is official dark), Light, and Dark. Every PERSONALITY theme
    // (midnight..aurora) keeps doodles disabled everywhere. The 2.5.0 code
    // enabled doodles only for `Light | Dark`, so the UI's "Dark" (saved as
    // `system`) silently got the kill-switch while "Light" showed doodles —
    // the reported "Dark has no doodles" bug. There is no user toggle; the
    // theme alone decides.
    let native_doodles = !matches!(
        theme,
        AppTheme::Midnight
            | AppTheme::Forest
            | AppTheme::Graphite
            | AppTheme::Ocean
            | AppTheme::Blush
            | AppTheme::Lavender
            | AppTheme::Candy
            | AppTheme::Aurora
    );
    format!(
        "window.__whatsnowApplyTheme&&window.__whatsnowApplyTheme({theme_json});\
         window.__whatsnowSetDoodlesEnabled&&window.__whatsnowSetDoodlesEnabled({native_doodles})"
    )
}

#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
#[serde(default)]
pub struct Settings {
    #[serde(deserialize_with = "lenient_theme")]
    pub theme: AppTheme,
    pub close_to_tray: bool,
    pub start_minimized: bool,
    pub autostart: bool,
    pub hotkey_enabled: bool,
    pub hotkey: String,
    pub notifications: bool,
    pub notification_previews: bool,
    /// Preferred visible duration for message previews. Native platforms retain
    /// final control over their toast timing.
    pub notification_preview_duration_secs: u32,
    /// Legacy serialized field retained so existing settings files remain
    /// readable. Doodle visibility is now derived exclusively from the theme.
    pub chat_doodles: bool,
    pub always_on_top: bool,
    /// UNIX timestamp in seconds. `0` means Focus mode is disabled.
    pub focus_until_epoch_secs: u64,
}

impl Default for Settings {
    fn default() -> Self {
        Self {
            theme: AppTheme::System,
            close_to_tray: true,
            start_minimized: false,
            // Launch at startup is the out-of-the-box behavior: the app sits in
            // the tray and keeps WhatsApp reachable from a toast at any time.
            // Users who do not want it can turn it off in Settings > Preferences.
            autostart: true,
            hotkey_enabled: true,
            hotkey: default_hotkey().to_string(),
            notifications: true,
            notification_previews: true,
            notification_preview_duration_secs: 2,
            chat_doodles: false,
            always_on_top: false,
            focus_until_epoch_secs: 0,
        }
    }
}

use std::path::PathBuf;
use tauri::{AppHandle, Manager};

fn settings_path(app: &AppHandle) -> tauri::Result<PathBuf> {
    let dir = app.path().app_config_dir()?;
    std::fs::create_dir_all(&dir)?;
    Ok(dir.join("settings.json"))
}

pub fn load(app: &AppHandle) -> Settings {
    let settings = settings_path(app)
        .ok()
        .and_then(|p| std::fs::read_to_string(p).ok())
        .and_then(|s| serde_json::from_str(&s).ok())
        .unwrap_or_default();
    migrate_legacy_defaults(settings)
}

/// Write `bytes` to `path` without ever leaving a truncated file behind: the
/// data goes to a sibling `*.json.tmp` first and is renamed over the target, so
/// a crash or power loss keeps either the old file or the new one.
pub fn write_atomic(path: &std::path::Path, bytes: &[u8]) -> std::io::Result<()> {
    use std::io::Write;
    let tmp = path.with_extension("json.tmp");
    {
        let mut file = std::fs::File::create(&tmp)?;
        file.write_all(bytes)?;
        file.sync_all()?;
    }
    std::fs::rename(&tmp, path).inspect_err(|_| {
        let _ = std::fs::remove_file(&tmp);
    })
}

pub fn save(app: &AppHandle, s: &Settings) -> tauri::Result<()> {
    let path = settings_path(app)?;
    let json = serde_json::to_string_pretty(s).expect("serialize settings");
    write_atomic(&path, json.as_bytes())?;
    Ok(())
}

pub fn now_epoch_secs() -> u64 {
    std::time::SystemTime::now()
        .duration_since(std::time::UNIX_EPOCH)
        .map(|duration| duration.as_secs())
        .unwrap_or(0)
}

pub fn focus_remaining_secs_at(s: &Settings, now_epoch_secs: u64) -> u64 {
    s.focus_until_epoch_secs.saturating_sub(now_epoch_secs)
}

pub fn focus_active_at(s: &Settings, now_epoch_secs: u64) -> bool {
    focus_remaining_secs_at(s, now_epoch_secs) > 0
}

pub fn notifications_allowed_at(s: &Settings, now_epoch_secs: u64) -> bool {
    s.notifications && !focus_active_at(s, now_epoch_secs)
}

pub fn notification_duration_secs(value: u32) -> u32 {
    value.clamp(2, 30)
}

pub fn set_focus_for(app: &AppHandle, minutes: u32) -> tauri::Result<Settings> {
    let now = now_epoch_secs();
    let mut settings = load(app);
    settings.focus_until_epoch_secs = if minutes == 0 {
        0
    } else {
        now.saturating_add(u64::from(minutes) * 60)
    };
    save(app, &settings)?;
    Ok(settings)
}

/// Parse a shortcut string without touching any registration, so a typo can be
/// rejected before it replaces a working shortcut.
#[cfg(desktop)]
pub fn parse_hotkey(hotkey: &str) -> Result<tauri_plugin_global_shortcut::Shortcut, String> {
    use std::str::FromStr;
    tauri_plugin_global_shortcut::Shortcut::from_str(hotkey.trim())
        .map_err(|error| format!("\"{}\" is not a valid shortcut ({error})", hotkey.trim()))
}

/// `Err` when the settings carry an enabled but unparseable shortcut.
pub fn validate_hotkey(s: &Settings) -> Result<(), String> {
    #[cfg(desktop)]
    if s.hotkey_enabled && !s.hotkey.trim().is_empty() {
        parse_hotkey(&s.hotkey)?;
    }
    let _ = s;
    Ok(())
}

/// Apply the side effects of settings (autostart, global shortcut, native theme,
/// always-on-top, chat appearance). Only what differs from `prev` is touched,
/// which keeps instant-apply cheap; `prev == None` (startup) applies everything.
/// Returns warnings joined as `Some(msg)`, or `None` when everything applied.
pub fn apply(app: &AppHandle, prev: Option<&Settings>, s: &Settings) -> Option<String> {
    #[cfg(desktop)]
    {
        let mut warnings = Vec::new();

        if prev.is_none_or(|p| p.autostart != s.autostart) {
            use tauri_plugin_autostart::ManagerExt;
            let autostart = app.autolaunch();
            match autostart.is_enabled() {
                Ok(enabled) if s.autostart && !enabled => {
                    if let Err(error) = autostart.enable() {
                        warnings.push(format!("autostart could not be enabled: {error}"));
                    }
                }
                Ok(enabled) if !s.autostart && enabled => {
                    if let Err(error) = autostart.disable() {
                        warnings.push(format!("autostart could not be disabled: {error}"));
                    }
                }
                Ok(_) => {}
                Err(error) => {
                    warnings.push(format!("autostart status could not be read: {error}"));
                }
            }
        }

        if prev.is_none_or(|p| {
            p.hotkey_enabled != s.hotkey_enabled || p.hotkey.trim() != s.hotkey.trim()
        }) {
            if let Some(message) = apply_hotkey(app, prev, s) {
                warnings.push(message);
            }
        }

        let theme_changed = prev.is_none_or(|p| p.theme != s.theme);
        let on_top_changed = prev.is_none_or(|p| p.always_on_top != s.always_on_top);
        if theme_changed || on_top_changed {
            for (label, window) in app.webview_windows() {
                if theme_changed {
                    if let Err(error) = window.set_theme(s.theme.native_theme()) {
                        warnings.push(format!(
                            "{label} window theme could not be applied: {error}"
                        ));
                    }
                }
                // Call windows (`wa-call-*`) and the content popup are not
                // account windows: always-on-top and chat appearance belong to
                // account windows only.
                if !crate::accounts::is_account_label(&label) {
                    continue;
                }
                if theme_changed {
                    crate::window::apply_native_theme(&window, s.theme);
                }
                if on_top_changed {
                    if let Err(error) = window.set_always_on_top(s.always_on_top) {
                        warnings.push(format!(
                            "{label} always-on-top could not be applied: {error}"
                        ));
                    }
                }
                if theme_changed {
                    // Log the appearance decision so theme/doodle complaints can
                    // be verified from the log: theme -> doodles on/off is a FIXED
                    // mapping (official System/Light/Dark -> ON, personality -> OFF).
                    crate::dlog::log(&format!(
                        "appearance: theme={:?} doodles={}",
                        s.theme,
                        !matches!(
                            s.theme,
                            AppTheme::Midnight
                                | AppTheme::Forest
                                | AppTheme::Graphite
                                | AppTheme::Ocean
                                | AppTheme::Blush
                                | AppTheme::Lavender
                                | AppTheme::Candy
                                | AppTheme::Aurora
                        ),
                    ));
                    if let Err(error) = window.eval(chat_appearance_script(s.theme, s.chat_doodles))
                    {
                        warnings.push(format!(
                            "{label} chat appearance could not be applied: {error}"
                        ));
                    }
                }
            }
        }

        (!warnings.is_empty()).then(|| warnings.join("; "))
    }
    #[cfg(not(desktop))]
    {
        let _ = (app, prev, s);
        None
    }
}

/// Swap the registered global shortcut. The new string was already validated, so
/// the only remaining failure is a conflict with another application; in that
/// case the previous shortcut is put back so the user is never left without one.
#[cfg(desktop)]
fn apply_hotkey(app: &AppHandle, prev: Option<&Settings>, s: &Settings) -> Option<String> {
    use tauri_plugin_global_shortcut::GlobalShortcutExt;
    let gs = app.global_shortcut();
    let previous = prev
        .filter(|p| p.hotkey_enabled && !p.hotkey.trim().is_empty())
        .and_then(|p| parse_hotkey(&p.hotkey).ok());
    match prev {
        None => {
            let _ = gs.unregister_all();
        }
        Some(_) => {
            if let Some(old) = previous {
                let _ = gs.unregister(old);
            }
        }
    }
    if !(s.hotkey_enabled && !s.hotkey.trim().is_empty()) {
        return None;
    }
    let shortcut = match parse_hotkey(&s.hotkey) {
        Ok(shortcut) => shortcut,
        Err(error) => return Some(error),
    };
    match gs.register(shortcut) {
        Ok(()) => None,
        Err(error) => {
            if let Some(old) = previous {
                let _ = gs.register(old);
            }
            Some(format!("shortcut could not be registered: {error}"))
        }
    }
}

#[cfg(test)]
mod tests {
    use super::{default_hotkey, AppTheme, Settings};

    #[test]
    fn defaults_are_sane() {
        let s = Settings::default();
        assert_eq!(s.theme, AppTheme::System);
        assert!(s.close_to_tray);
        assert!(s.notifications);
        assert!(s.notification_previews);
        assert_eq!(s.notification_preview_duration_secs, 2);
        assert!(!s.chat_doodles);
        assert_eq!(s.hotkey, default_hotkey());
        // Launch at startup is the default behavior (tray-resident app).
        assert!(s.autostart);
        assert!(!s.always_on_top);
        assert_eq!(s.focus_until_epoch_secs, 0);
    }

    #[test]
    fn partial_json_fills_defaults() {
        let s: Settings = serde_json::from_str(r#"{"autostart": true}"#).unwrap();
        assert!(s.autostart);
        assert!(s.close_to_tray);
        assert_eq!(s.theme, AppTheme::System);
        assert_eq!(s.hotkey, default_hotkey());
    }

    #[test]
    fn theme_names_are_stable_and_unknown_values_are_rejected() {
        for (theme, json) in [
            (AppTheme::System, "\"system\""),
            (AppTheme::Light, "\"light\""),
            (AppTheme::Dark, "\"dark\""),
            (AppTheme::Midnight, "\"midnight\""),
            (AppTheme::Forest, "\"forest\""),
            (AppTheme::Graphite, "\"graphite\""),
            (AppTheme::Ocean, "\"ocean\""),
            (AppTheme::Blush, "\"blush\""),
            (AppTheme::Lavender, "\"lavender\""),
            (AppTheme::Candy, "\"candy\""),
            (AppTheme::Aurora, "\"aurora\""),
        ] {
            assert_eq!(serde_json::to_string(&theme).unwrap(), json);
            assert_eq!(serde_json::from_str::<AppTheme>(json).unwrap(), theme);
        }
        assert!(serde_json::from_str::<AppTheme>("\"neon\"").is_err());
    }

    #[test]
    fn decorative_dark_themes_use_dark_native_chrome() {
        assert_eq!(AppTheme::System.native_theme(), Some(tauri::Theme::Dark));
        assert_eq!(AppTheme::Light.native_theme(), Some(tauri::Theme::Light));
        assert_eq!(AppTheme::Midnight.native_theme(), Some(tauri::Theme::Dark));
        assert_eq!(AppTheme::Forest.native_theme(), Some(tauri::Theme::Dark));
        assert_eq!(AppTheme::Graphite.native_theme(), Some(tauri::Theme::Dark));
        assert_eq!(AppTheme::Ocean.native_theme(), Some(tauri::Theme::Dark));
        assert_eq!(AppTheme::Blush.native_theme(), Some(tauri::Theme::Light));
        assert_eq!(AppTheme::Lavender.native_theme(), Some(tauri::Theme::Light));
        assert_eq!(AppTheme::Candy.native_theme(), Some(tauri::Theme::Light));
        assert_eq!(AppTheme::Aurora.native_theme(), Some(tauri::Theme::Light));
    }

    #[test]
    fn unknown_theme_keeps_the_other_fields() {
        let s: Settings =
            serde_json::from_str(r#"{"theme":"neon","autostart":false,"hotkey":"Ctrl+Alt+9"}"#)
                .unwrap();
        assert_eq!(s.theme, AppTheme::System);
        assert!(!s.autostart);
        assert_eq!(s.hotkey, "Ctrl+Alt+9");
        let s: Settings = serde_json::from_str(r#"{"theme":42,"close_to_tray":false}"#).unwrap();
        assert_eq!(s.theme, AppTheme::System);
        assert!(!s.close_to_tray);
    }

    #[test]
    fn write_atomic_round_trips_and_leaves_no_temp_file() {
        let dir = std::env::temp_dir().join(format!("whatsnow-atomic-{}", std::process::id()));
        std::fs::create_dir_all(&dir).unwrap();
        let path = dir.join("settings.json");
        super::write_atomic(&path, b"{\"a\":1}").unwrap();
        super::write_atomic(&path, b"{\"a\":2}").unwrap();
        assert_eq!(std::fs::read_to_string(&path).unwrap(), "{\"a\":2}");
        assert!(!dir.join("settings.json.tmp").exists());
        let _ = std::fs::remove_dir_all(&dir);
    }

    #[test]
    fn invalid_shortcut_is_rejected_before_it_can_be_saved() {
        let bad = Settings {
            hotkey: "Ctrl+Banana".into(),
            ..Default::default()
        };
        assert!(super::validate_hotkey(&bad).is_err());
        let disabled = Settings {
            hotkey_enabled: false,
            hotkey: "Ctrl+Banana".into(),
            ..Default::default()
        };
        assert!(super::validate_hotkey(&disabled).is_ok());
        assert!(super::validate_hotkey(&Settings::default()).is_ok());
    }

    #[test]
    fn empty_json_is_all_defaults() {
        let s: Settings = serde_json::from_str("{}").unwrap();
        assert_eq!(s, Settings::default());
    }

    #[test]
    fn roundtrip() {
        let s = Settings {
            theme: AppTheme::Candy,
            close_to_tray: false,
            start_minimized: true,
            autostart: true,
            hotkey_enabled: false,
            hotkey: "Ctrl+Alt+W".into(),
            notifications: false,
            notification_previews: false,
            notification_preview_duration_secs: 12,
            chat_doodles: true,
            always_on_top: true,
            focus_until_epoch_secs: 42,
        };
        let json = serde_json::to_string(&s).unwrap();
        let back: Settings = serde_json::from_str(&json).unwrap();
        assert_eq!(s, back);
    }

    #[test]
    fn chat_appearance_script_derives_doodles_from_the_theme() {
        assert_eq!(
            super::chat_appearance_script(AppTheme::Lavender, true),
            "window.__whatsnowApplyTheme&&window.__whatsnowApplyTheme(\"lavender\");\
             window.__whatsnowSetDoodlesEnabled&&window.__whatsnowSetDoodlesEnabled(false)"
        );
        // 2.6.0: the official themes — System (the UI's "Dark" option), Light,
        // and Dark — ALL show WhatsApp's native doodle wallpaper. The 2.5.0
        // mapping left `System` with doodles disabled, which broke Dark
        // (Settings saves the official Dark choice as `system`).
        assert!(super::chat_appearance_script(AppTheme::System, false)
            .ends_with("__whatsnowSetDoodlesEnabled(true)"));
        assert!(super::chat_appearance_script(AppTheme::Light, false)
            .ends_with("__whatsnowSetDoodlesEnabled(true)"));
        assert!(super::chat_appearance_script(AppTheme::Dark, false)
            .ends_with("__whatsnowSetDoodlesEnabled(true)"));
        assert!(super::chat_appearance_script(AppTheme::Aurora, true)
            .ends_with("__whatsnowSetDoodlesEnabled(false)"));
    }

    #[test]
    fn every_personality_theme_keeps_doodles_disabled() {
        for theme in [
            AppTheme::Midnight,
            AppTheme::Forest,
            AppTheme::Graphite,
            AppTheme::Ocean,
            AppTheme::Blush,
            AppTheme::Lavender,
            AppTheme::Candy,
            AppTheme::Aurora,
        ] {
            let script = super::chat_appearance_script(theme, false);
            assert!(
                script.ends_with("__whatsnowSetDoodlesEnabled(false)"),
                "{theme:?} must keep doodles disabled"
            );
        }
    }

    #[test]
    fn legacy_default_shortcut_migrates_to_the_platform_default() {
        let legacy = Settings {
            hotkey: "CmdOrCtrl+Shift+W".into(),
            ..Default::default()
        };
        assert_eq!(
            super::migrate_legacy_defaults(legacy).hotkey,
            default_hotkey()
        );

        let custom = Settings {
            hotkey: "Ctrl+Shift+9".into(),
            ..Default::default()
        };
        assert_eq!(
            super::migrate_legacy_defaults(custom).hotkey,
            "Ctrl+Shift+9"
        );

        let legacy_night = Settings {
            theme: AppTheme::Dark,
            ..Default::default()
        };
        assert_eq!(
            super::migrate_legacy_defaults(legacy_night).theme,
            AppTheme::System
        );
    }

    #[test]
    fn focus_window_is_boundary_safe() {
        let s = Settings {
            focus_until_epoch_secs: 1_500,
            ..Default::default()
        };
        assert!(super::focus_active_at(&s, 1_499));
        assert_eq!(super::focus_remaining_secs_at(&s, 1_499), 1);
        assert!(!super::focus_active_at(&s, 1_500));
        assert!(!super::focus_active_at(&s, 1_501));
    }

    #[test]
    fn focus_mode_suppresses_notifications() {
        let focused = Settings {
            focus_until_epoch_secs: 1_500,
            ..Default::default()
        };
        assert!(!super::notifications_allowed_at(&focused, 1_000));
        assert!(super::notifications_allowed_at(&focused, 1_500));

        let disabled = Settings {
            notifications: false,
            ..Default::default()
        };
        assert!(!super::notifications_allowed_at(&disabled, 2_000));
    }

    #[test]
    fn notification_duration_is_bounded() {
        assert_eq!(super::notification_duration_secs(0), 2);
        assert_eq!(super::notification_duration_secs(6), 6);
        assert_eq!(super::notification_duration_secs(90), 30);
    }
}
