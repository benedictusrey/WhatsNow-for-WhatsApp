use crate::accounts::{self, ActiveAccount, UnreadMap};
use crate::applock::{self, AppLockConfig};
use crate::lock;
use crate::settings::{AppTheme, Settings};
use serde::Serialize;
use tauri::Manager;

#[derive(Debug, PartialEq, Eq)]
struct NotificationContent {
    title: String,
    body: String,
}

fn notification_content(
    app_name: &str,
    account_name: &str,
    multiple_accounts: bool,
    show_preview: bool,
    page_title: &str,
    page_body: &str,
) -> NotificationContent {
    if !show_preview {
        return NotificationContent {
            title: if multiple_accounts {
                format!("{app_name} — {account_name}")
            } else {
                app_name.to_string()
            },
            body: "You have a new WhatsApp message.".to_string(),
        };
    }

    NotificationContent {
        title: if multiple_accounts {
            format!("{account_name}: {page_title}")
        } else {
            page_title.to_string()
        },
        body: page_body.to_string(),
    }
}

fn notification_context(app: &tauri::AppHandle, account_id: &str) -> Option<(String, bool, bool)> {
    let settings = crate::settings::load(app);
    if !crate::settings::notifications_allowed_at(&settings, crate::settings::now_epoch_secs()) {
        return None;
    }
    if crate::window::has_focused_account_window(app) {
        return None;
    }

    let accounts_file = accounts::load(app);
    let account = accounts_file
        .accounts
        .iter()
        .find(|account| account.id == account_id)?;
    if !account.notifications_enabled {
        return None;
    }

    Some((
        account.name.clone(),
        accounts_file.accounts.len() > 1,
        settings.notification_previews,
    ))
}

/// Account-management commands must NOT be reachable from a remote WhatsApp page.
/// Account windows carry the `wa-<id>` label; the trusted local `settings` window
/// does not. Tauri injects the calling `window`; the remote page cannot forge its
/// label. WhatsApp pages keep only their narrow notification, unread-count,
/// same-account toast activation, self-profile-title, validated-link, and
/// diagnostic bridge commands; they are denied every account-management command.
fn is_remote(window: &tauri::Window) -> bool {
    is_remote_label(window.label())
}

/// Pure predicate behind `is_remote`, broken out so it can be unit-tested without a
/// live `tauri::Window`.
fn is_remote_label(label: &str) -> bool {
    label.starts_with("wa-")
}

fn notification_activation_allowed(caller_label: &str, account_id: &str) -> bool {
    caller_label == accounts::window_label(account_id)
}

fn validate_account_name(name: &str) -> Result<&str, String> {
    let trimmed = name.trim();
    if trimmed.is_empty() {
        return Err("account name cannot be empty".into());
    }
    if trimmed.chars().count() > 60 {
        return Err("account name must be 60 characters or fewer".into());
    }
    if trimmed.chars().any(char::is_control) {
        return Err("account name cannot contain control characters".into());
    }
    Ok(trimmed)
}

#[tauri::command]
pub fn notify(
    window: tauri::Window,
    app: tauri::AppHandle,
    title: String,
    body: String,
    route: Option<crate::notify::NotificationRoute>,
) {
    // issue #3 diagnostics: confirm the command is actually reached from the
    // injected bridge. If this line never appears in the log when a message
    // arrives, the page never called our Notification shim (e.g. it used the
    // service-worker showNotification path), not the OS toast layer. No message
    // content is logged (PII) — only that an event occurred.
    crate::dlog::log("commands::notify invoked");
    // While locked, suppress notifications entirely so message previews don't leak
    // to a popup / lock screen. Count-only unread state still updates the taskbar
    // overlay, tray tooltip, and tray account menu through set_unread.
    if !crate::lock::is_unlocked(&app) {
        crate::dlog::log("commands::notify suppressed: app is locked");
        return;
    }
    let Some(account_id) = accounts::id_from_label(window.label()) else {
        return;
    };
    let Some((account_name, multiple_accounts, show_preview)) =
        notification_context(&app, account_id)
    else {
        crate::dlog::log("commands::notify suppressed by notification policy");
        return;
    };
    let content = notification_content(
        "WhatsNow",
        &account_name,
        multiple_accounts,
        show_preview,
        &title,
        &body,
    );
    let duration_secs = crate::settings::load(&app).notification_preview_duration_secs;
    let mut route = route.unwrap_or_else(|| crate::notify::NotificationRoute {
        chat_title: title,
        message_text: body,
        ..Default::default()
    });
    // When previews are disabled, the toast launch payload must not carry
    // message content either: it lands in the toast XML and (on Windows) on
    // the process command line when the app was not running.
    if !show_preview {
        route.chat_title.clear();
        route.chat_id.clear();
        route.message_id.clear();
        route.message_text.clear();
    }
    let _ = crate::notify::show_message(
        &app,
        &content.title,
        &content.body,
        duration_secs,
        account_id,
        route,
    );
}

/// Reveal an account window only after its page-side toast route has finished.
/// The remote caller may activate only its own `wa-<id>` window.
#[tauri::command]
pub fn activate_notification_window(
    window: tauri::Window,
    app: tauri::AppHandle,
    account_id: String,
) -> Result<(), String> {
    let expected_label = accounts::window_label(&account_id);
    if !notification_activation_allowed(window.label(), &account_id) {
        return Err("forbidden".into());
    }
    if !crate::lock::is_unlocked(&app) {
        crate::lock::show_lock_window(&app);
        return Ok(());
    }
    crate::window::show_account(&app, &expected_label);
    Ok(())
}

/// Diagnostic breadcrumb from the injected page script (bridge.js) into the same
/// file log as the Rust side, so a drag-drop failure can be traced end-to-end on a
/// build with no console. Allowed from the WhatsApp page; it only appends a short,
/// length-capped string we author in bridge.js — no page-controlled PII.
#[tauri::command]
pub fn dlog(msg: String) {
    let msg: String = msg.chars().take(300).collect();
    crate::dlog::log(&format!("js: {msg}"));
}

#[tauri::command]
pub fn set_unread(window: tauri::Window, app: tauri::AppHandle, title: String) {
    let count = crate::unread::parse_unread(&title);
    update_unread_count(&window, &app, count);
}

/// Receive a count-only unread update from the scoped WhatsApp bridge.
///
/// The bridge derives this from accessibility labels and badge elements; it never
/// sends chat text. Rust clamps the value before it reaches shared state.
#[tauri::command]
pub fn set_unread_count(window: tauri::Window, app: tauri::AppHandle, count: u32) {
    update_unread_count(&window, &app, count.min(9_999));
}

/// Persist WhatsApp's own Profile > Name value and reflect it in native chrome.
///
/// Only the calling account window can update its own title. The bridge reads one
/// short self-profile field; no contact, chat, message, or phone data crosses IPC.
#[tauri::command]
pub fn set_profile_name(
    window: tauri::Window,
    app: tauri::AppHandle,
    name: String,
) -> Result<(), String> {
    if !is_remote(&window) {
        return Err("forbidden".into());
    }
    let account_id = accounts::id_from_label(window.label())
        .ok_or_else(|| "unknown account window".to_string())?;
    let name = validate_account_name(&name)?;

    let mut accounts_file = accounts::load(&app);
    if !accounts::set_profile_name(&mut accounts_file, account_id, name)? {
        return Ok(());
    }
    accounts::save(&app, &accounts_file).map_err(|error| error.to_string())?;
    window
        .set_title(&format!("WhatsNow — {name}"))
        .map_err(|error| error.to_string())?;
    Ok(())
}

/// Open a page-selected web link with the operating system's browser handler.
/// URL validation and shell-free process launching are centralized in window.rs.
#[tauri::command]
pub fn open_external_url(
    window: tauri::Window,
    app: tauri::AppHandle,
    url: String,
) -> Result<(), String> {
    if !is_remote(&window) && window.label() != "settings" {
        return Err("forbidden".into());
    }
    crate::window::open_external_url(&app, &url)
}

fn update_unread_count(window: &tauri::Window, app: &tauri::AppHandle, count: u32) {
    let Some(id) = accounts::id_from_label(window.label()) else {
        return;
    };

    // Update the per-account count and compute the aggregate, then drop all
    // UnreadMap guards BEFORE calling tray::rebuild_menu (which re-locks the map)
    // to avoid a deadlock.
    let total = {
        let state = app.state::<UnreadMap>();
        let mut map = state.lock().unwrap_or_else(|error| error.into_inner());
        map.insert(id.to_string(), count);
        accounts::aggregate_unread(&map)
    };

    crate::tray::update_badge(app, total);
    crate::tray::rebuild_menu(app);
}

#[tauri::command]
pub fn get_settings(window: tauri::Window, app: tauri::AppHandle) -> Result<Settings, String> {
    if is_remote(&window) {
        return Err("forbidden".into());
    }
    lock::require_unlocked(&app)?;
    Ok(crate::settings::load(&app))
}

#[tauri::command]
pub fn get_theme(window: tauri::Window, app: tauri::AppHandle) -> Result<AppTheme, String> {
    if is_remote(&window) {
        return Err("forbidden".into());
    }
    Ok(crate::settings::load(&app).theme)
}

#[tauri::command]
pub fn set_settings(
    window: tauri::Window,
    app: tauri::AppHandle,
    settings: Settings,
) -> Result<Option<String>, String> {
    if is_remote(&window) {
        return Err("forbidden".into());
    }
    lock::require_unlocked(&app)?;
    let mut settings = settings;
    settings.notification_preview_duration_secs =
        crate::settings::notification_duration_secs(settings.notification_preview_duration_secs);
    crate::settings::save(&app, &settings).map_err(|e| e.to_string())?;
    Ok(crate::settings::apply(&app, &settings))
}

#[derive(Debug, Clone, Serialize)]
pub struct ProductivityStatus {
    pub focus_active: bool,
    pub focus_until_epoch_secs: u64,
    pub focus_remaining_secs: u64,
}

fn productivity_status(settings: &Settings, now_epoch_secs: u64) -> ProductivityStatus {
    ProductivityStatus {
        focus_active: crate::settings::focus_active_at(settings, now_epoch_secs),
        focus_until_epoch_secs: settings.focus_until_epoch_secs,
        focus_remaining_secs: crate::settings::focus_remaining_secs_at(settings, now_epoch_secs),
    }
}

#[tauri::command]
pub fn get_productivity_status(
    window: tauri::Window,
    app: tauri::AppHandle,
) -> Result<ProductivityStatus, String> {
    if is_remote(&window) {
        return Err("forbidden".into());
    }
    lock::require_unlocked(&app)?;
    let settings = crate::settings::load(&app);
    Ok(productivity_status(
        &settings,
        crate::settings::now_epoch_secs(),
    ))
}

#[tauri::command]
pub fn set_focus_mode(
    window: tauri::Window,
    app: tauri::AppHandle,
    minutes: u32,
) -> Result<ProductivityStatus, String> {
    if is_remote(&window) {
        return Err("forbidden".into());
    }
    lock::require_unlocked(&app)?;
    if minutes > 24 * 60 {
        return Err("Focus mode can be enabled for at most 24 hours.".into());
    }

    let now = crate::settings::now_epoch_secs();
    let settings =
        crate::settings::set_focus_for(&app, minutes).map_err(|error| error.to_string())?;
    crate::tray::rebuild_menu(&app);
    Ok(productivity_status(&settings, now))
}

/// Bridge → Rust: dispatch a TRUSTED mouse click inside the calling account
/// webview at the given viewport CSS-pixel coordinates. WhatsApp Web ignores
/// untrusted page-side .click() on its chat list, so toast routing must
/// synthesize a trusted click (WebView2 DevTools Protocol Input domain) from
/// the host. Only a WhatsApp account window may request it; the bridge
/// verifies the resulting navigation and retries if it did not land.
#[tauri::command]
pub fn notification_click(
    window: tauri::Window,
    app: tauri::AppHandle,
    x: i32,
    y: i32,
) -> Result<(), String> {
    let label = window.label().to_string();
    if !label.starts_with("wa-") {
        return Err("forbidden".into());
    }
    // with_webview must run on the main thread; queue it there.
    let _ = app.clone().run_on_main_thread(move || {
        if let Some(webview) = app.get_webview_window(&label) {
            crate::window::dispatch_trusted_click(&webview, x, y);
        }
    });
    Ok(())
}

#[tauri::command]
pub fn test_notification(window: tauri::Window, app: tauri::AppHandle) -> Result<String, String> {
    if is_remote(&window) {
        return Err("forbidden".into());
    }
    lock::require_unlocked(&app)?;
    let settings = crate::settings::load(&app);
    let account_id = accounts::load(&app)
        .accounts
        .first()
        .map(|account| account.id.clone())
        .unwrap_or_else(|| "default".to_string());
    let delivery = crate::notify::show_message(
        &app,
        "WhatsNow notification test",
        "Notifications are connected correctly.",
        settings.notification_preview_duration_secs,
        &account_id,
        crate::notify::NotificationRoute::default(),
    )?;
    let crate::notify::Delivery::Native = delivery;
    Ok("Native test delivered. Check the banner or notification center.".into())
}

#[tauri::command]
pub fn open_settings(window: tauri::Window, app: tauri::AppHandle) -> Result<(), String> {
    if is_remote(&window) {
        return Err("forbidden".into());
    }
    lock::require_unlocked(&app)?;
    crate::window::open_settings_window(&app);
    Ok(())
}

// ---------------------------------------------------------------------------
// Account-management commands (local-only).
// ---------------------------------------------------------------------------

#[derive(Debug, Clone, Serialize)]
pub struct AccountView {
    pub id: String,
    pub name: String,
    pub order: u32,
    pub unread: u32,
    pub open: bool,
    pub notifications_enabled: bool,
}

fn account_views(app: &tauri::AppHandle) -> Vec<AccountView> {
    let f = accounts::load(app);
    let map = app.state::<UnreadMap>();
    let map = map.lock().unwrap();
    let mut views: Vec<AccountView> = f
        .accounts
        .iter()
        .map(|a| AccountView {
            id: a.id.clone(),
            name: a.name.clone(),
            order: a.order,
            unread: map.get(&a.id).copied().unwrap_or(0),
            open: app
                .get_webview_window(&accounts::window_label(&a.id))
                .is_some(),
            notifications_enabled: a.notifications_enabled,
        })
        .collect();
    views.sort_by_key(|v| v.order);
    views
}

#[tauri::command]
pub fn list_accounts(
    window: tauri::Window,
    app: tauri::AppHandle,
) -> Result<Vec<AccountView>, String> {
    if is_remote(&window) {
        return Err("forbidden".into());
    }
    lock::require_unlocked(&app)?;
    Ok(account_views(&app))
}

#[tauri::command]
pub async fn add_account(
    window: tauri::Window,
    app: tauri::AppHandle,
    name: String,
) -> Result<AccountView, String> {
    if is_remote(&window) {
        return Err("forbidden".into());
    }
    lock::require_unlocked(&app)?;
    // macOS < 14 cannot isolate additional accounts (no data_store_identifier).
    crate::window::ensure_isolation_supported()?;

    let name = validate_account_name(&name)?;

    let mut f = accounts::load(&app);
    let acct = accounts::add(&mut f, name);
    accounts::save(&app, &f).map_err(|e| e.to_string())?;

    crate::window::open_new_account_window(&app, &acct).map_err(|e| e.to_string())?;
    crate::tray::rebuild_menu(&app);

    Ok(AccountView {
        id: acct.id,
        name: acct.name,
        order: acct.order,
        unread: 0,
        open: true,
        notifications_enabled: acct.notifications_enabled,
    })
}

#[tauri::command]
pub fn remove_account(
    window: tauri::Window,
    app: tauri::AppHandle,
    id: String,
) -> Result<(), String> {
    if is_remote(&window) {
        return Err("forbidden".into());
    }
    lock::require_unlocked(&app)?;

    let mut f = accounts::load(&app);
    let removed = accounts::remove(&mut f, &id)?;
    accounts::save(&app, &f).map_err(|e| e.to_string())?;

    // Close the window if open.
    if let Some(w) = app.get_webview_window(&accounts::window_label(&removed.id)) {
        let _ = w.destroy();
    }
    // Drop the per-account unread count.
    {
        let state = app.state::<UnreadMap>();
        let mut map = state.lock().unwrap();
        map.remove(&removed.id);
    }
    accounts::delete_profile(&app, &removed.id);

    // Recompute the aggregate badge and the menu.
    let total = {
        let state = app.state::<UnreadMap>();
        let map = state.lock().unwrap();
        accounts::aggregate_unread(&map)
    };
    crate::tray::update_badge(&app, total);
    crate::tray::rebuild_menu(&app);
    Ok(())
}

#[tauri::command]
pub fn rename_account(
    window: tauri::Window,
    app: tauri::AppHandle,
    id: String,
    name: String,
) -> Result<(), String> {
    if is_remote(&window) {
        return Err("forbidden".into());
    }
    lock::require_unlocked(&app)?;
    let name = validate_account_name(&name)?;

    let mut f = accounts::load(&app);
    accounts::rename(&mut f, &id, name)?;
    accounts::save(&app, &f).map_err(|e| e.to_string())?;

    if let Some(w) = app.get_webview_window(&accounts::window_label(&id)) {
        let title_name = f
            .accounts
            .iter()
            .find(|account| account.id == id)
            .map(accounts::title_name)
            .unwrap_or(name);
        let _ = w.set_title(&format!("WhatsNow — {title_name}"));
    }
    crate::tray::rebuild_menu(&app);
    Ok(())
}

#[tauri::command]
pub fn set_account_notifications(
    window: tauri::Window,
    app: tauri::AppHandle,
    id: String,
    enabled: bool,
) -> Result<(), String> {
    if is_remote(&window) {
        return Err("forbidden".into());
    }
    lock::require_unlocked(&app)?;

    let mut accounts_file = accounts::load(&app);
    accounts::set_notifications_enabled(&mut accounts_file, &id, enabled)?;
    accounts::save(&app, &accounts_file).map_err(|error| error.to_string())?;
    crate::tray::rebuild_menu(&app);
    Ok(())
}

#[tauri::command]
pub fn open_account(
    window: tauri::Window,
    app: tauri::AppHandle,
    id: String,
) -> Result<(), String> {
    if is_remote(&window) {
        return Err("forbidden".into());
    }
    lock::require_unlocked(&app)?;
    let f = accounts::load(&app);
    let Some(acct) = f.accounts.iter().find(|a| a.id == id) else {
        return Err(format!("unknown account: {id}"));
    };
    // Open the window if it was closed, then show + focus it.
    if app
        .get_webview_window(&accounts::window_label(&acct.id))
        .is_none()
    {
        crate::window::open_account_window(&app, acct, false).map_err(|e| e.to_string())?;
    }
    crate::window::show_account(&app, &accounts::window_label(&acct.id));
    // Track as the active account.
    if let Some(active) = app.try_state::<ActiveAccount>() {
        *active.lock().unwrap() = accounts::window_label(&acct.id);
    }
    Ok(())
}

// ---------------------------------------------------------------------------
// App-lock commands.
// ---------------------------------------------------------------------------

#[derive(Debug, Clone, Serialize)]
pub struct LockStatus {
    pub enabled: bool,
    pub biometric_available: bool,
    pub biometric_enabled: bool,
    pub biometric_label: String,
    pub lock_on_launch: bool,
    pub lock_on_hide: bool,
    pub idle_secs: u32,
}

/// Read-only status for BOTH the settings window and the lock screen. Never returns
/// the password hash. Allowed from any non-remote window, even while locked.
#[tauri::command]
pub fn get_lock_status(window: tauri::Window, app: tauri::AppHandle) -> Result<LockStatus, String> {
    if is_remote(&window) {
        return Err("forbidden".into());
    }
    let c = applock::load(&app);
    let available = matches!(
        crate::biometric::availability(),
        crate::biometric::Availability::Available
    );
    Ok(LockStatus {
        enabled: c.is_active(),
        biometric_available: available,
        biometric_enabled: c.biometric_enabled && available,
        biometric_label: crate::biometric::label().to_string(),
        lock_on_launch: c.lock_on_launch,
        lock_on_hide: c.lock_on_hide,
        idle_secs: c.idle_secs,
    })
}

/// Enable the lock by setting the first password. Errors if already enabled (use
/// `change_app_lock_password`). Runs only from an unlocked, local window.
#[tauri::command]
pub fn set_app_lock_password(
    window: tauri::Window,
    app: tauri::AppHandle,
    new: String,
    confirm: String,
) -> Result<(), String> {
    if is_remote(&window) {
        return Err("forbidden".into());
    }
    lock::require_unlocked(&app)?;
    let mut c = applock::load(&app);
    if c.is_active() {
        return Err("app lock is already enabled".into());
    }
    if new != confirm {
        return Err("passwords do not match".into());
    }
    if new.chars().count() < 4 {
        return Err("password must be at least 4 characters".into());
    }
    c.password_phc = Some(applock::hash_password(&new)?);
    c.enabled = true;
    applock::save(&app, &c).map_err(|e| e.to_string())?;
    crate::tray::rebuild_menu(&app);
    Ok(())
}

#[tauri::command]
pub fn change_app_lock_password(
    window: tauri::Window,
    app: tauri::AppHandle,
    current: String,
    new: String,
    confirm: String,
) -> Result<(), String> {
    if is_remote(&window) {
        return Err("forbidden".into());
    }
    lock::require_unlocked(&app)?;
    let mut c = applock::load(&app);
    let phc = c.password_phc.clone().ok_or("app lock is not enabled")?;
    if !applock::verify_password(&current, &phc) {
        return Err("current password is incorrect".into());
    }
    if new != confirm {
        return Err("passwords do not match".into());
    }
    if new.chars().count() < 4 {
        return Err("password must be at least 4 characters".into());
    }
    c.password_phc = Some(applock::hash_password(&new)?);
    applock::save(&app, &c).map_err(|e| e.to_string())
}

#[tauri::command]
pub fn disable_app_lock(
    window: tauri::Window,
    app: tauri::AppHandle,
    current: String,
) -> Result<(), String> {
    if is_remote(&window) {
        return Err("forbidden".into());
    }
    lock::require_unlocked(&app)?;
    let mut c = applock::load(&app);
    let phc = c.password_phc.clone().ok_or("app lock is not enabled")?;
    if !applock::verify_password(&current, &phc) {
        return Err("current password is incorrect".into());
    }
    c = AppLockConfig::default(); // fully reset: disabled, no hash, no biometric, default triggers
    applock::save(&app, &c).map_err(|e| e.to_string())?;
    crate::tray::rebuild_menu(&app);
    Ok(())
}

#[tauri::command]
pub fn set_app_lock_options(
    window: tauri::Window,
    app: tauri::AppHandle,
    lock_on_launch: bool,
    lock_on_hide: bool,
    idle_secs: u32,
) -> Result<(), String> {
    if is_remote(&window) {
        return Err("forbidden".into());
    }
    lock::require_unlocked(&app)?;
    let mut c = applock::load(&app);
    c.lock_on_launch = lock_on_launch;
    c.lock_on_hide = lock_on_hide;
    c.idle_secs = idle_secs;
    applock::save(&app, &c).map_err(|e| e.to_string())
}

/// Enable/disable biometric. Enabling requires the lock to be set, the platform to
/// report Available, and one successful test authentication.
#[tauri::command]
pub fn set_biometric_enabled(
    window: tauri::Window,
    app: tauri::AppHandle,
    enabled: bool,
) -> Result<(), String> {
    if is_remote(&window) {
        return Err("forbidden".into());
    }
    lock::require_unlocked(&app)?;
    let mut c = applock::load(&app);
    if enabled {
        if !c.is_active() {
            return Err("set an app-lock password first".into());
        }
        if !matches!(
            crate::biometric::availability(),
            crate::biometric::Availability::Available
        ) {
            return Err("biometric authentication is not available on this device".into());
        }
        if !crate::biometric::authenticate(&app, "Enable biometric unlock for WhatsNow")? {
            return Err("biometric test did not succeed".into());
        }
    }
    c.biometric_enabled = enabled;
    applock::save(&app, &c).map_err(|e| e.to_string())
}

/// Manual "Lock now" from the settings window.
#[tauri::command]
pub fn lock_app(window: tauri::Window, app: tauri::AppHandle) -> Result<(), String> {
    if is_remote(&window) {
        return Err("forbidden".into());
    }
    if !applock::load(&app).is_active() {
        return Err("app lock is not enabled".into());
    }
    lock::lock_now(&app);
    Ok(())
}

/// Unlock with the password. Lock-window only; works while locked (no require_unlocked).
#[tauri::command]
pub fn unlock_password(
    window: tauri::Window,
    app: tauri::AppHandle,
    password: String,
) -> Result<bool, String> {
    if !lock::is_lock_window(&window) {
        return Err("forbidden".into());
    }
    let c = applock::load(&app);
    let Some(phc) = c.password_phc else {
        // No lock configured — treat as already unlocked.
        lock::unlock(&app);
        return Ok(true);
    };
    if applock::verify_password(&password, &phc) {
        lock::unlock(&app);
        Ok(true)
    } else {
        Ok(false)
    }
}

/// Unlock with biometric. Lock-window only; works while locked.
#[tauri::command]
pub fn unlock_biometric(window: tauri::Window, app: tauri::AppHandle) -> Result<bool, String> {
    if !lock::is_lock_window(&window) {
        return Err("forbidden".into());
    }
    if !applock::load(&app).biometric_enabled {
        return Err("biometric unlock is not enabled".into());
    }
    if crate::biometric::authenticate(&app, "Unlock WhatsNow")? {
        lock::unlock(&app);
        Ok(true)
    } else {
        Ok(false)
    }
}

/// Forgot-password reset: wipe ALL account sessions + the app-lock config, then
/// relaunch fresh (logged out, lock disabled). Lock-window only.
#[tauri::command]
pub fn reset_app_lock(window: tauri::Window, app: tauri::AppHandle) -> Result<(), String> {
    if !lock::is_lock_window(&window) {
        return Err("forbidden".into());
    }
    crate::applock::reset_all(&app);
    app.restart();
}

#[cfg(test)]
mod tests {
    use super::{
        is_remote_label, notification_activation_allowed, notification_content,
        productivity_status, validate_account_name,
    };
    use crate::settings::Settings;

    #[test]
    fn is_remote_wa_prefix_is_true() {
        assert!(is_remote_label("wa-default"));
    }

    #[test]
    fn is_remote_wa_acct_is_true() {
        assert!(is_remote_label("wa-acct-2"));
    }

    #[test]
    fn is_remote_settings_is_false() {
        assert!(!is_remote_label("settings"));
    }

    #[test]
    fn notification_activation_is_scoped_to_the_originating_account() {
        assert!(notification_activation_allowed("wa-acct-2", "acct-2"));
        assert!(!notification_activation_allowed("wa-default", "acct-2"));
        assert!(!notification_activation_allowed("settings", "default"));
    }

    #[test]
    fn hidden_preview_never_contains_message_content() {
        let content = notification_content(
            "WhatsNow",
            "Work",
            true,
            false,
            "Confidential sender",
            "Confidential message",
        );
        assert_eq!(content.title, "WhatsNow — Work");
        assert_eq!(content.body, "You have a new WhatsApp message.");
        assert!(!content.title.contains("Confidential"));
        assert!(!content.body.contains("Confidential"));
    }

    #[test]
    fn rich_notification_is_attributed_for_multiple_accounts() {
        let content = notification_content("WhatsNow", "Work", true, true, "Alice", "Hello");
        assert_eq!(content.title, "Work: Alice");
        assert_eq!(content.body, "Hello");
    }

    #[test]
    fn productivity_status_reports_remaining_time() {
        let settings = Settings {
            focus_until_epoch_secs: 2_000,
            ..Default::default()
        };
        let status = productivity_status(&settings, 1_400);
        assert!(status.focus_active);
        assert_eq!(status.focus_remaining_secs, 600);
    }

    #[test]
    fn account_name_validation_rejects_unsafe_menu_labels() {
        assert!(validate_account_name("   ").is_err());
        assert!(validate_account_name("Work\nInjected").is_err());
        assert!(validate_account_name(&"x".repeat(61)).is_err());
        assert_eq!(validate_account_name("  Work  ").unwrap(), "Work");
    }
}
