use serde::{Deserialize, Serialize};

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

pub fn save(app: &AppHandle, s: &Settings) -> tauri::Result<()> {
    let path = settings_path(app)?;
    let json = serde_json::to_string_pretty(s).expect("serialize settings");
    std::fs::write(path, json)?;
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

/// Apply side effects of settings (autostart + global shortcut). Returns the global-
/// shortcut registration error as `Some(msg)` if registering failed; `None` if it
/// registered successfully, or the shortcut is disabled/empty, or on non-desktop.
pub fn apply(app: &AppHandle, s: &Settings) -> Option<String> {
    #[cfg(desktop)]
    {
        let mut warnings = Vec::new();

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
            Err(error) => warnings.push(format!("autostart status could not be read: {error}")),
        }

        use tauri_plugin_global_shortcut::GlobalShortcutExt;
        let gs = app.global_shortcut();
        if let Err(error) = gs.unregister_all() {
            warnings.push(format!("previous shortcut could not be released: {error}"));
        }
        if s.hotkey_enabled && !s.hotkey.trim().is_empty() {
            if let Err(error) = gs.register(s.hotkey.as_str()) {
                warnings.push(format!("shortcut could not be registered: {error}"));
            }
        }

        for (label, window) in app.webview_windows() {
            if let Err(error) = window.set_theme(s.theme.native_theme()) {
                warnings.push(format!(
                    "{label} window theme could not be applied: {error}"
                ));
            }
            if label.starts_with("wa-") {
                if let Err(error) = window.set_always_on_top(s.always_on_top) {
                    warnings.push(format!(
                        "{label} always-on-top could not be applied: {error}"
                    ));
                }
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
                if let Err(error) = window.eval(chat_appearance_script(s.theme, s.chat_doodles)) {
                    warnings.push(format!(
                        "{label} chat appearance could not be applied: {error}"
                    ));
                }
            }
        }

        (!warnings.is_empty()).then(|| warnings.join("; "))
    }
    #[cfg(not(desktop))]
    {
        let _ = (app, s);
        None
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
