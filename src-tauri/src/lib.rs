mod accounts;
mod applock;
mod aumid;
mod biometric;
mod commands;
mod dlog;
mod lock;
mod notify;
mod protocol;
mod settings;
mod tray;
mod unread;
mod window;

pub const APP_NAME: &str = "WhatsNow";
pub const APP_AUTHOR: &str = "Benedictus Reynaldo Hartanto (@benedictusrey)";
pub const APP_HOMEPAGE: &str = "https://github.com/benedictusrey/WhatsNow-for-WhatsApp";
pub const APP_AUTHOR_URL: &str = "https://github.com/benedictusrey";

use tauri::Manager;

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    // Linux: expose SharedArrayBuffer in the webview. WhatsApp Web's Chrome
    // codepath (which we present ourselves as — see window::CHROME_UA) runs its
    // wasm media/crypto workers on SharedArrayBuffer, and desktop Chrome exposes
    // SAB unconditionally. Distro WebKitGTK ships it OFF even under full
    // cross-origin isolation (verified: crossOriginIsolated=true, SAB still
    // undefined), so video upload/processing hangs on an endless spinner. JSC
    // reads this option from the environment in every web process it spawns;
    // it must be set before the first webview exists. Verified to give real
    // shared-memory semantics (wasm shared Memory + Atomics across workers).
    // Overridable: an already-set value (e.g. =0) is respected.
    #[cfg(target_os = "linux")]
    if std::env::var_os("JSC_useSharedArrayBuffer").is_none() {
        std::env::set_var("JSC_useSharedArrayBuffer", "1");
    }

    let mut builder = tauri::Builder::default();

    // single-instance MUST be registered first.
    #[cfg(desktop)]
    {
        builder = builder.plugin(tauri_plugin_single_instance::init(|app, args, _cwd| {
            // A native-toast activation for an app that was not running arrives
            // here: Windows relaunched the AUMID shortcut with the toast's
            // `launch` payload on the command line. Route to the sender's chat
            // instead of falling back to the currently visible conversation.
            if let Some((account_id, route)) = crate::notify::route_payload_in_args(&args) {
                crate::dlog::log(&format!(
                    "single-instance: toast route payload for account {account_id}"
                ));
                // Deferred until the account window's page has loaded, so the
                // routing eval always finds the bridge function.
                crate::window::request_notification_target(app, &account_id, &route);
                return;
            }
            // A whatsapp:// deep link from another app (Start menu Run dialog,
            // share sheets, other apps): focus the chat window and navigate it
            // to the normalized web.whatsapp.com URL. Falls back to show_main
            // when the link cannot be converted (still just raises the app).
            if let Some(raw) = crate::protocol::deep_link_in_args(&args) {
                crate::dlog::log("single-instance: whatsapp:// deep link");
                window::show_main(app);
                if let Some(url) = crate::protocol::deep_link_url(&raw) {
                    window::navigate_active_account(app, &url);
                }
                return;
            }
            // `whatsnow --toggle` (bind it to an OS keyboard shortcut — the reliable
            // global-hotkey path on Wayland, where in-process X11 grabs don't fire)
            // toggles the active window. Otherwise a 2nd launch raises it, except an
            // autostart relaunch carrying --minimized (stay hidden in the tray).
            // Both toggle_active and show_main defer to the lock screen when locked,
            // so neither can bypass the app lock.
            if args.iter().any(|a| a == "--test-ui") {
                window::run_ui_diagnostic(app);
            } else if args.iter().any(|a| a == "--settings") {
                // `whatsnow --settings`: open the Settings pop-up (also works
                // when the app is already running — the single-instance plugin
                // forwards this argument to the live instance, so Settings can
                // always be summoned even while every window is hidden to the
                // tray).
                window::open_settings_window(app);
            } else if args.iter().any(|a| a == "--test-notification") {
                // Diagnostic toast. Note: this callback context cannot create
                // WinRT toast objects reliably (CreateToastNotification fails
                // with E_UNEXPECTED even when re-dispatched to the main thread),
                // so a failure here is logged and is NOT a sign that the normal
                // notification flow (bridge -> notify command) is broken — use
                // Settings > Notifications > "Test" for the production path.
                let settings = settings::load(app);
                let account_id = accounts::load(app)
                    .accounts
                    .first()
                    .map(|account| account.id.clone())
                    .unwrap_or_else(|| "default".to_string());
                let result = notify::show_message(
                    app,
                    "WhatsNow notification check",
                    "Native notifications are connected and ready.",
                    settings.notification_preview_duration_secs,
                    &account_id,
                    notify::NotificationRoute::default(),
                );
                if let Err(error) = &result {
                    crate::dlog::log(&format!("test-notification failed: {error}"));
                }
            } else if args.iter().any(|a| a == "--toggle") {
                window::toggle_active(app);
            } else if !args.iter().any(|a| a == "--minimized") {
                window::show_main(app);
            }
        }));
    }

    builder = builder.plugin(tauri_plugin_notification::init());

    #[cfg(desktop)]
    {
        builder = builder
            .plugin(
                // Restore size/position, but NOT visibility — otherwise the plugin
                // force-shows the window on launch and defeats start-minimized / --minimized.
                // DECORATIONS is excluded too: the Settings window is permanently
                // frameless (decorations(false) in its builder), and a stale saved
                // state from an older build must not re-attach the native title bar.
                tauri_plugin_window_state::Builder::default()
                    .with_state_flags(
                        tauri_plugin_window_state::StateFlags::all()
                            & !tauri_plugin_window_state::StateFlags::VISIBLE
                            & !tauri_plugin_window_state::StateFlags::DECORATIONS,
                    )
                    .build(),
            )
            .plugin(
                tauri_plugin_global_shortcut::Builder::new()
                    .with_handler(|app, _shortcut, event| {
                        // In-process global hotkey (X11 / Windows / macOS). On Wayland
                        // this won't fire — use `whatsnow --toggle` via an OS shortcut.
                        if event.state() == tauri_plugin_global_shortcut::ShortcutState::Pressed {
                            window::toggle_active(app);
                        }
                    })
                    .build(),
            )
            .plugin(tauri_plugin_autostart::init(
                tauri_plugin_autostart::MacosLauncher::LaunchAgent,
                Some(vec!["--minimized"]),
            ));
    }

    builder
        .manage(accounts::UnreadMap::default())
        .manage(accounts::ActiveAccount::new("wa-default".into()))
        .manage(window::LoadedWindows(Default::default()))
        .manage(window::PendingNotificationRoutes(Default::default()))
        .manage(window::PendingNavigations(Default::default()))
        .invoke_handler(tauri::generate_handler![
            commands::activate_notification_window,
            commands::notification_click,
            commands::notify,
            commands::set_unread,
            commands::set_unread_count,
            commands::set_profile_name,
            commands::open_external_url,
            commands::dlog,
            commands::get_settings,
            commands::get_theme,
            commands::set_settings,
            commands::get_productivity_status,
            commands::set_focus_mode,
            commands::test_notification,
            commands::open_settings,
            commands::list_accounts,
            commands::add_account,
            commands::remove_account,
            commands::rename_account,
            commands::set_account_notifications,
            commands::open_account,
            commands::get_lock_status,
            commands::set_app_lock_password,
            commands::change_app_lock_password,
            commands::disable_app_lock,
            commands::set_app_lock_options,
            commands::set_biometric_enabled,
            commands::lock_app,
            commands::unlock_password,
            commands::unlock_biometric,
            commands::reset_app_lock,
        ])
        .setup(|app| {
            let handle = app.handle();

            // Start a fresh diagnostic log for this launch (issue #3): the only
            // way to see notification failures on a Windows GUI build with no
            // console. See dlog.rs.
            dlog::init();

            // Windows: register our AppUserModelID so WinRT toast notifications
            // actually render for the installed app (no-op elsewhere). Must run
            // before any account window can fire a notification. See aumid.rs.
            aumid::register(handle);

            // Windows: (re)register the whatsapp:// protocol handler at every
            // launch so the stored command always points at the current
            // executable (no-op elsewhere; portable builds skip it). See
            // protocol.rs.
            protocol::register();

            let s = settings::load(handle);
            let args: Vec<String> = std::env::args().collect();
            let start_hidden = s.start_minimized || args.iter().any(|a| a == "--minimized");

            // Load accounts (seeds a single `default` on first run / corrupt file).
            let mut f = accounts::load(handle);

            // Backfill a persisted store_uuid for any non-default account missing one
            // (older state predating multi-account). Save only if something changed.
            let mut changed = false;
            for a in f.accounts.iter_mut() {
                if a.id != "default" && a.store_uuid.is_none() {
                    a.store_uuid = Some(accounts::gen_store_uuid());
                    changed = true;
                }
            }
            if changed {
                let _ = accounts::save(handle, &f);
            }

            // App lock: decide the initial state and whether to start hidden.
            let lock_cfg = applock::load(handle);
            let lock_on_launch = lock_cfg.is_active() && lock_cfg.lock_on_launch;
            handle.manage(lock::LockState::new(!lock_on_launch));
            let open_hidden = start_hidden || lock_on_launch;

            // Open every account window so each one receives messages/notifications.
            for a in &f.accounts {
                window::open_account_window(handle, a, open_hidden)?;
            }

            // Pre-create the reusable content popup HIDDEN (freeze fix
            // 2026-09-17: the on_new_window handler must never build a webview
            // inside the NewWindowRequested callback — see window.rs). With the
            // popup already alive, family popup requests are served by a cheap
            // navigate + show, and the account windows never stall.
            window::ensure_content_popup(handle);

            tray::setup(handle)?;
            tray::rebuild_menu(handle);
            let _ = settings::apply(handle, &s);

            // Cold-start toast activation: Windows relaunched this (previously
            // exited) app from a toast click with the route payload on the
            // command line. The account windows are being opened now — queue
            // the route so it applies once each page finishes loading.
            if let Some((account_id, route)) = crate::notify::route_payload_in_args(&args) {
                crate::dlog::log(&format!(
                    "cold-start: toast route payload for account {account_id}"
                ));
                crate::window::request_notification_target(handle, &account_id, &route);
            }

            // Cold-start whatsapp:// deep link (Windows launched WhatsNow for
            // the URI while it was not running). Account windows were just
            // opened; navigate the active one once its page has loaded.
            if let Some(raw) = crate::protocol::deep_link_in_args(&args) {
                if let Some(url) = crate::protocol::deep_link_url(&raw) {
                    crate::dlog::log("cold-start: whatsapp:// deep link queued");
                    window::queue_pending_navigation(handle, &url);
                } else {
                    crate::dlog::log("cold-start: whatsapp:// deep link not convertible");
                }
            }

            // Cold-start `--settings`: the app was not running; open the
            // Settings pop-up once setup has finished.
            if args.iter().any(|a| a == "--settings") {
                crate::window::open_settings_window(handle);
            }

            if lock_on_launch && !start_hidden {
                lock::show_lock_window(handle);
            }

            // Idle auto-lock watcher. Always running; no-op unless the lock is active
            // with idle_secs > 0 and the app is currently unlocked.
            #[cfg(desktop)]
            {
                let idle_handle = handle.clone();
                std::thread::spawn(move || loop {
                    std::thread::sleep(std::time::Duration::from_secs(5));
                    let c = applock::load(&idle_handle);
                    if !c.is_active() || c.idle_secs == 0 {
                        continue;
                    }
                    if !lock::is_unlocked(&idle_handle) {
                        continue;
                    }
                    let idle_ok = user_idle::UserIdle::get_time()
                        .map(|t| t.as_seconds() >= c.idle_secs as u64)
                        .unwrap_or(false);
                    if idle_ok {
                        let h = idle_handle.clone();
                        let _ = idle_handle.run_on_main_thread(move || lock::lock_now(&h));
                    }
                });
            }

            Ok(())
        })
        .build(tauri::generate_context!())
        .expect("error while building WhatsNow")
        .run(|_app_handle, _event| {
            // macOS: clicking the dock icon after hide-to-tray re-shows the window
            // (otherwise the app is only reachable via the menu-bar tray icon).
            #[cfg(target_os = "macos")]
            if let tauri::RunEvent::Reopen {
                has_visible_windows,
                ..
            } = &_event
            {
                if !*has_visible_windows {
                    window::show_main(_app_handle);
                }
            }
        });
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn authorship_and_origin_are_anchored() {
        assert_eq!(APP_NAME, "WhatsNow");
        assert!(APP_AUTHOR.contains("Benedictus Reynaldo Hartanto"));
        assert!(APP_AUTHOR.contains("@benedictusrey"));
        assert_eq!(
            APP_HOMEPAGE,
            "https://github.com/benedictusrey/WhatsNow-for-WhatsApp"
        );
        assert_eq!(APP_AUTHOR_URL, "https://github.com/benedictusrey");
    }
}
