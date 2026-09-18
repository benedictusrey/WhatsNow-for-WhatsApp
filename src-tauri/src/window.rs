use crate::accounts::{self, Account, ActiveAccount};
use std::collections::HashSet;
use std::sync::atomic::{AtomicU64, Ordering};
use std::sync::Mutex;
use tauri::{
    webview::PageLoadEvent, AppHandle, Manager, WebviewUrl, WebviewWindow, WebviewWindowBuilder,
};

/// Account windows whose page has finished its first load (bridge injected).
/// Toast routing must wait for this — an eval against a not-yet-loaded page
/// finds no `__whatsnowOpenNotificationTarget` and silently does nothing.
pub struct LoadedWindows(pub Mutex<HashSet<String>>);

/// Toast routes waiting for their account window's page to finish loading
/// (cold-start activations and relaunches that beat the page).
pub struct PendingNotificationRoutes(pub Mutex<Vec<(String, crate::notify::NotificationRoute)>>);

/// WhatsApp-family URLs waiting for an account window's page to finish
/// loading (cold-start `whatsapp://` deep links that beat the page). Drained
/// by the same page-load hook that drains toast routes.
pub struct PendingNavigations(pub Mutex<Vec<String>>);

/// Label of the single reusable popup window that hosts WhatsApp-family
/// content (call stages, invite pages, wa.me confirmations). All
/// window.open requests to family hosts are shown here instead of spawning
/// one window per link.
pub const CONTENT_POPUP_LABEL: &str = "wa-content";

/// Recent desktop Chrome UA. WhatsApp Web rejects the default WebKitGTK/Safari UA.
/// Bump the major version occasionally, and keep it in sync with the client-hints
/// shim in `resources/bridge.js` (brands/fullVersionList/uaFullVersion).
///
/// Per-OS variants: on Windows WebView2 exposes REAL Chromium client hints with
/// platform "Windows", and on macOS the engine is WKWebView — advertising an
/// "X11; Linux" UA there produces a self-contradictory browser fingerprint, so
/// each OS claims the Chrome build that actually matches its platform token.
///
/// NOTE (Linux): setting this alone is NOT enough — WebKitGTK's site-specific
/// quirks override the embedder UA for web.whatsapp.com with a fake macOS Safari
/// string. `enable_webview_media` turns quirks off so this UA actually reaches
/// the site.
#[cfg(target_os = "linux")]
pub const CHROME_UA: &str =
    "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/143.0.0.0 Safari/537.36";
#[cfg(target_os = "windows")]
pub const CHROME_UA: &str =
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/143.0.0.0 Safari/537.36";
#[cfg(target_os = "macos")]
pub const CHROME_UA: &str =
    "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/143.0.0.0 Safari/537.36";

const BRIDGE_JS: &str = include_str!("../resources/bridge.js");
const CHAT_THEME_JS: &str = include_str!("../resources/chat-theme.js");
const APP_ICON: &[u8] = include_bytes!("../icons/128x128.png");

fn external_web_url(url: &tauri::Url) -> bool {
    matches!(url.scheme(), "http" | "https") && !whatsapp_family_host(url)
}

/// The WhatsApp host family that always stays inside WhatsNow. EXACT host
/// equality only (no subdomain suffixes): `web.whatsapp.com.evil.com` or
/// `faq.whatsapp.com` (not on the user's list) keep the external-browser
/// flow. The chat host `web.whatsapp.com` is included so the existing
/// chat/in-page flow is unchanged; the rest are the hosts the user listed
/// as "verified links should open in WhatsNow, not the browser".
fn whatsapp_family_host(url: &tauri::Url) -> bool {
    const WHATSAPP_HOSTS: [&str; 9] = [
        "web.whatsapp.com",
        "wa.me",
        "chat.whatsapp.com",
        "call.whatsapp.com",
        "www.whatsapp.com",
        "whatsapp.com",
        "api.whatsapp.com",
        "event.whatsapp.com",
        "v.whatsapp.com",
    ];
    url.host_str().is_some_and(|host| {
        WHATSAPP_HOSTS
            .iter()
            .any(|known| host.eq_ignore_ascii_case(known))
    })
}

/// Whether a `window.open` request from the WhatsApp page should become a real
/// popup window instead of being denied. Pure and unit-tested: ONLY
/// WhatsApp-family pages may spawn a window — every other host keeps the
/// external-browser flow.
fn whatsapp_popup_allowed(url: &tauri::Url) -> bool {
    url.scheme() == "https" && whatsapp_family_host(url)
}

/// Whether a popup URL is a Web Calling call stage (call.whatsapp.com/...) or
/// the account window navigating to a call URL in place. Call stages keep
/// their dedicated always-on-top window (the 2.6.0 fix); every other family
/// URL shares the reusable content popup. Pure and unit-tested.
fn is_whatsapp_call_url(url: &tauri::Url) -> bool {
    url.host_str()
        .is_some_and(|host| host.eq_ignore_ascii_case("call.whatsapp.com"))
}

/// Open a validated web URL through the operating system.
///
/// This delegates browser selection to Windows/macOS/Linux. When no default
/// browser is configured, the operating system can present its normal app picker.
/// Arguments are passed directly to the launcher, never through a command shell.
pub fn open_external_url(app: &AppHandle, value: &str) -> Result<(), String> {
    let url = tauri::Url::parse(value).map_err(|_| "invalid link".to_string())?;
    if !matches!(url.scheme(), "http" | "https") || url.host_str().is_none() {
        return Err("only http and https links can be opened".into());
    }
    if value.len() > 8_192 {
        return Err("link is too long".into());
    }

    #[cfg(target_os = "windows")]
    let result = std::process::Command::new("rundll32.exe")
        .arg("url.dll,FileProtocolHandler")
        .arg(url.as_str())
        .spawn();

    #[cfg(target_os = "macos")]
    let result = std::process::Command::new("open").arg(url.as_str()).spawn();

    #[cfg(target_os = "linux")]
    let result = std::process::Command::new("xdg-open")
        .arg(url.as_str())
        .spawn()
        .or_else(|_| {
            std::process::Command::new("gio")
                .arg("open")
                .arg(url.as_str())
                .spawn()
        });

    result
        .map(|_| {
            crate::dlog::log("external link handed to the operating system");
        })
        .map_err(|error| {
            let message = format!(
                "No browser launcher was available ({error}). Choose a default browser and try again."
            );
            let _ = crate::notify::show(app, "Choose a browser", &message);
            message
        })
}

/// Run a content-free live check inside each WhatsApp window.
///
/// This is intentionally triggered only by a local second-instance
/// `--test-ui` launch. It records theme wiring and the scoped You-panel credit
/// without reading or logging contacts, chats, messages, or profile data.
pub fn run_ui_diagnostic(app: &AppHandle) {
    const SCRIPT: &str = r##"
(function whatsNowUiDiagnostic() {
  var invoke = window.__TAURI_INTERNALS__ && window.__TAURI_INTERNALS__.invoke;
  if (!invoke) return;
  function log(message) {
    invoke("dlog", { msg: String(message).slice(0, 280) });
  }
  function exactLabel(element) {
    return String(
      element.getAttribute("aria-label") ||
      element.getAttribute("title") ||
      element.textContent ||
      ""
    ).replace(/\s+/g, " ").trim().toLowerCase();
  }
  var root = document.documentElement;
  var app = document.getElementById("app");
  var theme = root && root.dataset.whatsnowTheme || "system";
  var styleReady = Boolean(document.getElementById("whatsnow-chat-theme"));
  var surface = getComputedStyle(app || root)
    .getPropertyValue("--WDS-background-surface-default").trim();
  var ordinaryCredit = document.querySelectorAll("#whatsnow-author-credit").length;
  var controls = Array.from(
    document.querySelectorAll("button, [role='button'], [aria-label], [title]")
  );
  var you = controls.find(function (control) {
    return exactLabel(control) === "you";
  });
  if (!you) {
    log(
      "ui-check theme=" + theme +
      " style=" + styleReady +
      " surface=" + Boolean(surface) +
      " ordinary_credit=" + ordinaryCredit +
      " you=false"
    );
    return;
  }
  you.click();
  setTimeout(function () {
    var visibleLabel = Array.from(document.querySelectorAll("span, div"))
      .find(function (element) {
        var label = String(element.textContent || "")
          .replace(/\s+/g, " ").trim().toLowerCase();
        return label === "log out" || label === "logout";
      });
    var logout = visibleLabel && visibleLabel.closest("button, [role='button']");
    var credit = document.getElementById("whatsnow-author-credit");
    var logoutRow = logout && logout.parentElement;
    var authorReady = Boolean(
      logoutRow &&
      credit &&
      logoutRow.parentElement === credit.parentElement &&
      credit.previousElementSibling === logoutRow &&
      credit.textContent.indexOf("@benedictusrey") !== -1 &&
      credit.textContent.indexOf("sole author") !== -1
    );
    log(
      "ui-check theme=" + theme +
      " style=" + styleReady +
      " surface=" + Boolean(surface) +
      " ordinary_credit=" + ordinaryCredit +
      " you=true logout=" + Boolean(logout) +
      " author=" + authorReady
    );
    you.click();
  }, 1200);
})()
"##;

    for (label, window) in app.webview_windows() {
        if label.starts_with("wa-") {
            let _ = window.eval(SCRIPT);
        }
    }
}

/// Open (or focus, if it already exists) the window for `account`. The label is
/// `wa-<id>`; everything the single-account window carried is preserved (Chrome UA,
/// `bridge.js`, app icon, sizes, close-to-tray), plus per-account session isolation
/// for non-default accounts.
pub fn open_account_window(
    app: &AppHandle,
    account: &Account,
    start_hidden: bool,
) -> tauri::Result<WebviewWindow> {
    open_account_window_inner(app, account, start_hidden, false)
}

/// Open a newly-added account without displaying an empty WebView while its
/// isolated WhatsApp session initializes. Dynamic WebView creation is invoked
/// from an async command; the window is revealed after its first page finishes.
pub fn open_new_account_window(app: &AppHandle, account: &Account) -> tauri::Result<WebviewWindow> {
    open_account_window_inner(app, account, false, true)
}

fn open_account_window_inner(
    app: &AppHandle,
    account: &Account,
    start_hidden: bool,
    // Historical: dynamic windows used this to hide until first paint. All
    // windows now start hidden and reveal on first paint (see reveal_pending).
    _reveal_when_ready: bool,
) -> tauri::Result<WebviewWindow> {
    use std::sync::atomic::Ordering;

    let label = accounts::window_label(&account.id);

    // Reuse the existing window if it is already open.
    if let Some(w) = app.get_webview_window(&label) {
        return Ok(w);
    }

    let url = "https://web.whatsapp.com/".parse().expect("valid url");
    let icon = tauri::image::Image::from_bytes(APP_ICON)?;
    let current_settings = crate::settings::load(app);
    let initialization_script = format!(
        "{BRIDGE_JS}\n{CHAT_THEME_JS}\n{}",
        crate::settings::chat_appearance_script(
            current_settings.theme,
            current_settings.chat_doodles,
        )
    );

    let navigation_app = app.clone();
    let new_window_app = app.clone();
    // Reveal the window only after its first page load paints, so the white
    // "launch flash" never shows (the user's eyes will thank us). start_hidden
    // (autostart/tray) keeps the window invisible indefinitely.
    let reveal_pending = std::sync::Arc::new(std::sync::atomic::AtomicBool::new(!start_hidden));
    if !start_hidden {
        // Bounded fallback: if the first page load never finishes (offline,
        // site hiccup), reveal the window anyway so the user is never left
        // with an invisible app.
        let fallback_app = app.clone();
        let fallback_label = label.clone();
        let fallback_pending = reveal_pending.clone();
        std::thread::spawn(move || {
            std::thread::sleep(std::time::Duration::from_secs(12));
            if fallback_pending.swap(false, std::sync::atomic::Ordering::AcqRel) {
                if let Some(w) = fallback_app.get_webview_window(&fallback_label) {
                    let _ = w.show();
                    crate::dlog::log("account window revealed by fallback timer");
                }
            }
        });
    }
    // Default size clamped to the monitor work area so small screens (e.g.
    // 1366x768 laptops, high-DPI 125%/150% scaling) never open a window that
    // is larger than the desktop.
    let (default_w, default_h) = clamped_logical_size(app, 1100.0, 800.0);
    let builder = WebviewWindowBuilder::new(app, &label, WebviewUrl::External(url))
        .title(format!("WhatsNow — {}", accounts::title_name(account)))
        .inner_size(default_w, default_h)
        .min_inner_size(560.0, 480.0)
        .icon(icon)?
        .user_agent(CHROME_UA)
        .initialization_script(initialization_script);

    // WebView2 must receive Windows file drops directly. Tauri's OS handler can
    // consume them before either WhatsApp or `WindowEvent::DragDrop` sees them,
    // leaving no attachment action at all. WhatsApp's native HTML5 drop flow opens
    // the confirmation composer directly and keeps the active chat unchanged.
    #[cfg(target_os = "windows")]
    let builder = builder.disable_drag_drop_handler();

    // Linux keeps Tauri's handler enabled because WebKitGTK does not reliably
    // deliver OS file drops to the page. `register_drop_handler` streams those
    // paths through bridge.js instead. On Windows that listener is harmless because
    // the disabled Tauri handler leaves the drop with WebView2.
    let builder = builder
        // Keep WhatsApp in its own webview. Normal web links are handed to the
        // operating system's default-browser flow, while file:// is always denied.
        .on_navigation(move |url| {
            if external_web_url(url) {
                let _ = open_external_url(&navigation_app, url.as_str());
                return false;
            }
            // WhatsApp-family URL navigated by the CHAT window itself (the
            // bridge routes chat.*/wa.me here deliberately): it is already the
            // chat surface — allow the in-place navigation.
            if whatsapp_family_host(url) {
                return true;
            }
            url.scheme() != "file"
        })
        .on_new_window(move |url, features| {
            // WhatsApp Web Calling (2026) opens the CALL STAGE through
            // window.open on web.whatsapp.com. The 2.5.0 code denied EVERY
            // popup, which wedged the call into the tiny in-page surface with
            // no maximize button. Create a REAL webview window instead: sized
            // from the popup's requested features (resizable, maximizable,
            // always-on-top) running WhatsApp's own call UI.
            //
            // 2.6.0 link-routing extension: every WhatsApp-family host may
            // open a window here. Call URLs keep their DEDICATED window (the
            // always-on-top call stage of the 2.6.0 fix); every other family
            // URL is hosted in the single REUSABLE content popup (user
            // decision 2026-09-15) so shared invite/business links get
            // WhatsApp's own page and the chat window never navigates away
            // from the active chat. Non-WhatsApp hosts keep the
            // external-browser flow.
            if whatsapp_popup_allowed(&url) {
                let is_call = is_whatsapp_call_url(&url);
                if !is_call {
                    if let Some(existing) = new_window_app.get_webview_window(CONTENT_POPUP_LABEL) {
                        // REUSE NAVIGATION (2026-09-17 fix): navigate() on an
                        // existing webview window is a silent NO-OP here —
                        // proven live ("Continue to WhatsApp Web" fired a
                        // new-window request, the reuse logged, the popup URL
                        // never changed). Eval a location.replace instead:
                        // that demonstrably navigates the popup (also proven
                        // live in the same session).
                        //
                        // FREEZE FIX (2026-09-17, §2.11): show/eval here run
                        // SYNCHRONOUSLY inside WebView2's NewWindowRequested
                        // callback — the same re-entrancy that §2.10 fixed for
                        // popup CREATION, still live on the reuse path (user-
                        // reported black "Not Responding" popup). Capture the
                        // target URL and run every action on the NEXT main-
                        // loop pass; the callback only returns Deny.
                        let reuse_url = url.clone();
                        let _ = new_window_app.run_on_main_thread(move || {
                            crate::dlog::log(
                                "content popup: reused for a WhatsApp-family popup request",
                            );
                            let _ = existing.show();
                            let _ = existing.unminimize();
                            let _ = existing.set_focus();
                            let _ = existing.set_title(&format!(
                                "WhatsNow — {}",
                                reuse_url.host_str().unwrap_or("WhatsApp")
                            ));
                            let script = popup_reuse_replace_script(reuse_url.as_str());
                            if existing.eval(&script).is_err() {
                                let _ = existing.navigate(reuse_url.clone());
                            }
                        });
                        return tauri::webview::NewWindowResponse::Deny;
                    }
                }
                // FREEZE FIX (2026-09-17, DEVELOPMENT_LOG §2.10): building a
                // webview SYNCHRONOUSLY inside this NewWindowRequested callback
                // re-enters WebView2's message pump mid-request and can wedge
                // the whole process (reproduced: deep link → popup request →
                // Responding=False forever, window half-painted). The call-stage
                // path keeps its synchronous build (the exact 2.6.0 behavior,
                // unchanged — calls have always worked); CONTENT popups take the
                // deferred path: Deny now, build on the next main-loop pass.
                // PendingPopup carries everything the deferred build needs.
                let seq = CALL_WINDOW_SEQ.fetch_add(1, Ordering::Relaxed);
                let label = if is_call {
                    format!("wa-call-{seq}")
                } else {
                    CONTENT_POPUP_LABEL.to_string()
                };
                // Size from the popup's requested dimensions (WhatsApp's own
                // call-stage proportions), clamped to the monitor work area so
                // small screens never get an oversized window.
                let (width, height) = match features.size() {
                    Some(size) => clamped_logical_size(&new_window_app, size.width, size.height),
                    None => clamped_logical_size(&new_window_app, 940.0, 640.0),
                };
                let mut builder = WebviewWindowBuilder::new(
                    &new_window_app,
                    &label,
                    WebviewUrl::External(url.clone()),
                )
                .title("WhatsNow — Call")
                .inner_size(width, height)
                .min_inner_size(320.0, 240.0)
                .resizable(true)
                .maximizable(true)
                .minimizable(true)
                .closable(true)
                .visible(true)
                .focused(true)
                .user_agent(CHROME_UA);
                if !is_call {
                    // Content popup: NEVER build inside this callback (see
                    // freeze note above). The popup is pre-created hidden at
                    // boot (ensure_content_popup), so the normal path is just
                    // navigate + show — instant and deadlock-free. If it is
                    // genuinely absent (closed by the user, ultra-early
                    // request), defer an ordinary builder to the next
                    // main-loop pass: no opener environment is passed, but
                    // session sharing comes from the shared WebView2
                    // user-data folder, which every webview of this app uses.
                    let url = url.clone();
                    let position = features.position().map(|p| (p.x.max(0.0), p.y.max(0.0)));
                    let title = format!("WhatsNow — {}", url.host_str().unwrap_or("WhatsApp"));
                    let app_for_popup = new_window_app.clone();
                    let _ = new_window_app.run_on_main_thread(move || {
                        build_deferred_content_popup(
                            app_for_popup,
                            url,
                            width,
                            height,
                            position,
                            &title,
                        );
                    });
                    return tauri::webview::NewWindowResponse::Deny;
                }
                if let Some(position) = features.position() {
                    builder = builder.position(position.x.max(0.0), position.y.max(0.0));
                }
                // Session sharing (CRITICAL for WebRTC): on Windows the popup
                // MUST reuse the opener's ICoreWebView2Environment — a foreign
                // environment breaks the call and the account isolation. Same
                // rule per platform as WhatsApp's own desktop shell.
                #[cfg(windows)]
                {
                    builder = builder.with_environment(features.opener().environment.clone());
                }
                #[cfg(target_os = "macos")]
                {
                    builder = builder
                        .with_webview_configuration(features.opener().target_configuration.clone());
                }
                #[cfg(target_os = "linux")]
                {
                    builder = builder.with_related_view(features.opener().webview.clone());
                }
                match builder.build() {
                    Ok(window) => {
                        if is_call {
                            // A call must stay in front while the user chats.
                            let _ = window.set_always_on_top(true);
                        }
                        // Auto-allow mic/camera for popups created after boot
                        // (the chat window's handler does not cover them).
                        #[cfg(target_os = "windows")]
                        let _ = window.with_webview(enable_media_windows);
                        // Same media guard as chat windows: a visible call
                        // window must never sit at the LOW memory target.
                        register_windows_memory_target(&window);
                        crate::dlog::log(&format!(
                            "{} window: created for {}",
                            if is_call { "call" } else { "content" },
                            url.host_str().unwrap_or("?"),
                        ));
                        return tauri::webview::NewWindowResponse::Create { window };
                    }
                    Err(error) => {
                        crate::dlog::log(&format!(
                            "popup window: could not create ({error}); falling back to deny"
                        ));
                    }
                }
            }
            tauri::webview::NewWindowResponse::Deny
        })
        .on_page_load(move |window, payload| {
            if payload.event() == PageLoadEvent::Finished {
                // The bridge is now injected in this window: remember it so
                // queued toast routes can apply, and drain anything waiting.
                if let Some(loaded) = window.app_handle().try_state::<LoadedWindows>() {
                    loaded
                        .0
                        .lock()
                        .unwrap_or_else(|error| error.into_inner())
                        .insert(window.label().to_string());
                }
                crate::window::drain_pending_notification_routes(
                    window.app_handle(),
                    window.label(),
                );
                // Same hook serves queued whatsapp:// deep links (cold start):
                // the page is loaded, so the navigation can finally apply.
                crate::window::drain_pending_navigations(window.app_handle(), window.label());
                if reveal_pending.swap(false, Ordering::AcqRel) {
                    let _ = window.show();
                    let _ = window.set_focus();
                    crate::dlog::log("account window revealed after initial page load");
                }
            }
        })
        // Downloads: with NO handler registered, wry never wires up the platform's
        // download machinery at all — on Linux nobody answers WebKit's
        // `decide-destination` and the engine cancels every download, so WhatsApp's
        // "Download" button (videos, images, documents) silently did nothing.
        // Accept every download into the user's Downloads folder (wry pre-fills a
        // de-duplicated absolute path on Linux/Windows; the fallback covers a
        // platform handing us an empty/relative destination) and toast on finish.
        .on_download(|webview, event| {
            match event {
                tauri::webview::DownloadEvent::Requested { url, destination } => {
                    ensure_download_destination(
                        destination,
                        webview.app_handle().path().download_dir().ok(),
                    );
                    // Log routing only — never the file name (matches dlog's no-PII rule).
                    crate::dlog::log(&format!(
                        "download: requested scheme={} dest_abs={}",
                        url.scheme(),
                        destination.is_absolute()
                    ));
                }
                tauri::webview::DownloadEvent::Finished { path, success, .. } => {
                    crate::dlog::log(&format!(
                        "download: finished success={success} path_known={}",
                        path.is_some()
                    ));
                    let app = webview.app_handle();
                    if success {
                        let body = match path.as_ref().and_then(|p| p.file_name()) {
                            Some(n) => {
                                format!("{} — saved to your Downloads folder.", n.to_string_lossy())
                            }
                            // macOS never reports the final path; the folder is still right.
                            None => "Saved to your Downloads folder.".to_string(),
                        };
                        let _ = crate::notify::show(app, "Download complete", &body);
                    } else {
                        let _ = crate::notify::show(
                            app,
                            "Download failed",
                            "The file could not be downloaded. Please try again.",
                        );
                    }
                }
                _ => {}
            }
            true
        })
        .visible(false);

    let builder = apply_isolation(builder, account, app);
    let win = builder.build()?;
    let _ = win.set_always_on_top(current_settings.always_on_top);
    let _ = win.set_theme(current_settings.theme.native_theme());

    // Close-to-tray (reads the live setting so the toggle takes effect without a restart).
    let app_handle = app.clone();
    let label_for_close = label.clone();
    win.on_window_event(move |event| {
        if let tauri::WindowEvent::CloseRequested { api, .. } = event {
            if crate::settings::load(&app_handle).close_to_tray {
                let lc = crate::applock::load(&app_handle);
                if lc.is_active() && lc.lock_on_hide {
                    crate::lock::lock_to_tray(&app_handle);
                } else if let Some(w) = app_handle.get_webview_window(&label_for_close) {
                    let _ = w.hide();
                }
                api.prevent_close();
            }
        }
    });

    register_focus_listener(app, &win);
    register_windows_memory_target(&win);
    register_drop_handler(&win);
    enable_webview_media(&win);
    Ok(win)
}

/// Largest single dropped file we will inline-inject into the page. The page must
/// hold the decoded bytes to build the `File`, so keep it bounded; larger files are
/// skipped (with a user-visible toast) rather than risking an OOM or a long UI stall.
const MAX_DROP_FILE_BYTES: u64 = 100 * 1024 * 1024;
/// Aggregate raw-byte budget for ONE drop. Files are individually capped, but the
/// page holds every accepted file of a batch in memory at once — without a batch
/// budget, 30 near-cap files still meant multiple GiB in flight.
const MAX_DROP_TOTAL_BYTES: u64 = 300 * 1024 * 1024;
/// Cap how many files one drop can inject, counted over files that actually pass
/// the checks (a folder or an oversized file does not use up a slot).
const MAX_DROP_FILES: usize = 30;
/// Raw bytes per streamed chunk eval. A multiple of 3, so every non-final chunk
/// base64-encodes standalone without padding and the page can decode chunks
/// independently. ~4 MiB raw ≈ 5.6 MiB base64 per eval — far below WebView2's
/// cross-process message ceiling (the old single-eval transport marshaled a
/// 100 MiB file as ~266 MiB of UTF-16 in one ExecuteScript and could die
/// silently), and it keeps peak memory at one chunk instead of one file.
const DROP_CHUNK_BYTES: usize = 85 * 48 * 1024; // 4_177_920, multiple of 3

/// Capture OS file drops and inject them into WhatsApp Web.
///
/// On Linux the webview never delivers the drop into the page DOM, so Tauri's
/// drag-drop handler (kept enabled in the builder) is our only source of the dropped
/// paths — and because that handler consumes the drop on every platform, Windows and
/// macOS drops arrive here too. Files are read off the UI thread and streamed to the
/// page-side `__whatsnowDropFeed` (bridge.js) as begin/chunk/end messages keyed by a
/// process-unique drop id, then committed; bridge.js rebuilds the `File`s and hands
/// them to WhatsApp's own attach flow. The commit runs through `eval_with_callback`,
/// so "the page actually executed the handler" is confirmed instead of assumed, and
/// every skipped file is surfaced to the user as a toast (not just a log line).
fn register_drop_handler(win: &WebviewWindow) {
    // AtomicU64/Ordering come from the module-level import (also used by
    // CALL_WINDOW_SEQ).
    static DROP_SEQ: AtomicU64 = AtomicU64::new(1);
    let win = win.clone();
    win.clone().on_window_event(move |event| {
        let tauri::WindowEvent::DragDrop(tauri::DragDropEvent::Drop { paths, position }) = event
        else {
            return;
        };
        let drop_id = DROP_SEQ.fetch_add(1, Ordering::Relaxed);
        crate::dlog::log(&format!(
            "dragdrop: drop #{drop_id}: {} path(s) at ({:.0},{:.0})",
            paths.len(),
            position.x,
            position.y
        ));
        // Reserve the active conversation before any file bytes are streamed.
        // Escape can then cancel the pending transfer without closing or
        // navigating away from the chat where the drop started.
        let _ = win.eval(drop_msg_reserve(drop_id));
        if paths.is_empty() {
            // Seen on macOS for promise-only drag sources (e.g. dragging straight out
            // of Photos.app): wry reads only NSFilenamesPboardType, so the drop lands
            // with zero paths. Tell the user instead of silently doing nothing.
            let _ = crate::notify::show(
                win.app_handle(),
                "Nothing was attached",
                "That item can't be dropped directly. Drag the file from your file manager, or use the attach (+) button.",
            );
            return;
        }
        let paths = paths.clone();
        let w = win.clone();
        // Read + stream off the UI thread: a large video would otherwise stall the window.
        std::thread::spawn(move || stream_drop(&w, drop_id, &paths));
    });
}

/// Why a file in a drop was skipped. Counters only — never file names (the summary
/// feeds a toast and the no-PII diagnostic log).
#[derive(Default, Debug, PartialEq, Eq)]
struct DropSkips {
    too_large: usize,
    over_budget: usize,
    over_count: usize,
    not_file: usize,
    unreadable: usize,
    changed: usize,
}

impl DropSkips {
    fn total(&self) -> usize {
        self.too_large
            + self.over_budget
            + self.over_count
            + self.not_file
            + self.unreadable
            + self.changed
    }
}

/// One accepted file of a drop, decided by [`plan_drop`] before any bytes move.
struct PlannedFile {
    path: std::path::PathBuf,
    name: String,
    mime: &'static str,
    len: u64,
}

/// Decide which dropped paths are injectable, applying the per-file cap, the batch
/// byte budget, and the file-count cap — counting only files that actually qualify
/// (30 unreadable paths must not starve a valid 31st). Pure planning: no page I/O.
fn plan_drop(paths: &[std::path::PathBuf]) -> (Vec<PlannedFile>, DropSkips) {
    let mut planned = Vec::new();
    let mut skips = DropSkips::default();
    let mut budget = MAX_DROP_TOTAL_BYTES;
    for (idx, p) in paths.iter().enumerate() {
        if planned.len() == MAX_DROP_FILES {
            skips.over_count += 1;
            continue;
        }
        let meta = match std::fs::metadata(p) {
            Ok(m) => m,
            Err(e) => {
                crate::dlog::log(&format!("dragdrop: file {idx}: stat failed: {e}"));
                skips.unreadable += 1;
                continue;
            }
        };
        if !meta.is_file() {
            crate::dlog::log(&format!("dragdrop: file {idx}: skip, not a regular file"));
            skips.not_file += 1;
            continue;
        }
        let len = meta.len();
        if len > MAX_DROP_FILE_BYTES {
            crate::dlog::log(&format!(
                "dragdrop: file {idx}: skip, {len} bytes over the {MAX_DROP_FILE_BYTES} cap"
            ));
            skips.too_large += 1;
            continue;
        }
        if len > budget {
            crate::dlog::log(&format!(
                "dragdrop: file {idx}: skip, {len} bytes over the remaining batch budget"
            ));
            skips.over_budget += 1;
            continue;
        }
        budget -= len;
        // to_string_lossy (not to_str+"file"): a name with invalid Unicode keeps its
        // (usually ASCII) extension, so MIME routing still works.
        let name = p
            .file_name()
            .map(|s| s.to_string_lossy().into_owned())
            .unwrap_or_else(|| "file".into());
        let mime = mime_for(&name);
        planned.push(PlannedFile {
            path: p.clone(),
            name,
            mime,
            len,
        });
    }
    (planned, skips)
}

/// Human summary of skipped files for the toast. Counts and reasons only — no names.
fn summarize_skips(s: &DropSkips) -> String {
    let mut parts: Vec<String> = Vec::new();
    let plural = |n: usize| if n == 1 { "file" } else { "files" };
    if s.too_large > 0 {
        parts.push(format!(
            "{} {} over the 100 MB size limit",
            s.too_large,
            plural(s.too_large)
        ));
    }
    if s.over_budget > 0 {
        parts.push(format!(
            "{} {} over the 300 MB per-drop total",
            s.over_budget,
            plural(s.over_budget)
        ));
    }
    if s.over_count > 0 {
        parts.push(format!(
            "{} {} over the 30-file limit",
            s.over_count,
            plural(s.over_count)
        ));
    }
    if s.not_file > 0 {
        parts.push(format!(
            "{} folder(s) or special {}",
            s.not_file,
            plural(s.not_file)
        ));
    }
    if s.unreadable > 0 {
        parts.push(format!(
            "{} unreadable {}",
            s.unreadable,
            plural(s.unreadable)
        ));
    }
    if s.changed > 0 {
        parts.push(format!(
            "{} {} that changed while reading",
            s.changed,
            plural(s.changed)
        ));
    }
    format!("Not attached: {}.", parts.join(", "))
}

/// Why streaming one file to the page stopped.
enum StreamAbort {
    /// The file could not be read.
    Io(std::io::Error),
    /// The file's size changed between planning and reading (TOCTOU guard) — a
    /// truncated or overgrown snapshot would inject a corrupt file, so it is dropped.
    Changed,
    /// `eval` into the webview failed; the whole drop is abandoned.
    Eval(tauri::Error),
}

// --- page-message builders (pure, unit-tested) ---

fn drop_msg_begin(drop_id: u64, idx: usize, name: &str, mime: &str, len: u64) -> String {
    let name_json = serde_json::to_string(name).unwrap_or_else(|_| "\"file\"".into());
    format!(
        "window.__whatsnowDropFeed&&window.__whatsnowDropFeed({{op:\"begin\",drop:{drop_id},file:{idx},name:{name_json},type:\"{mime}\",size:{len}}});"
    )
}

fn drop_msg_reserve(drop_id: u64) -> String {
    format!(
        "window.__whatsnowDropFeed&&window.__whatsnowDropFeed({{op:\"reserve\",drop:{drop_id}}});"
    )
}

fn drop_msg_chunk_prefix(drop_id: u64, idx: usize) -> String {
    format!(
        "window.__whatsnowDropFeed&&window.__whatsnowDropFeed({{op:\"chunk\",drop:{drop_id},file:{idx},b64:\""
    )
}

const DROP_MSG_CHUNK_SUFFIX: &str = "\"});";

fn drop_msg_end(drop_id: u64, idx: usize) -> String {
    format!(
        "window.__whatsnowDropFeed&&window.__whatsnowDropFeed({{op:\"end\",drop:{drop_id},file:{idx}}});"
    )
}

fn drop_msg_abort(drop_id: u64, idx: usize) -> String {
    format!(
        "window.__whatsnowDropFeed&&window.__whatsnowDropFeed({{op:\"abort\",drop:{drop_id},file:{idx}}});"
    )
}

fn drop_msg_commit(drop_id: u64, files: usize) -> String {
    // Ternary (not &&) so a missing handler yields a distinguishable "NOHANDLER"
    // ack through eval_with_callback instead of silently evaluating to undefined.
    format!(
        "window.__whatsnowDropFeed?window.__whatsnowDropFeed({{op:\"commit\",drop:{drop_id},files:{files}}}):\"NOHANDLER\""
    )
}

/// Read exactly `expected` bytes from `r`, emitting standalone base64 chunks of
/// [`DROP_CHUNK_BYTES`] raw bytes each (final chunk shorter, padded). Returns
/// [`StreamAbort::Changed`] if the stream ends early or still has data past
/// `expected` — the size was validated at plan time, so a mismatch means the file
/// was modified in between and its snapshot cannot be trusted.
fn stream_chunks<R: std::io::Read>(
    r: &mut R,
    expected: u64,
    mut emit: impl FnMut(&str) -> Result<(), StreamAbort>,
) -> Result<(), StreamAbort> {
    let mut buf = [0u8; 48 * 1024];
    let mut chunk: Vec<u8> = Vec::with_capacity(DROP_CHUNK_BYTES.min(expected as usize + 2));
    let mut b64 = String::new();
    let mut total: u64 = 0;
    loop {
        let want = std::cmp::min(buf.len() as u64, expected - total) as usize;
        if want == 0 {
            break;
        }
        let n = r.read(&mut buf[..want]).map_err(StreamAbort::Io)?;
        if n == 0 {
            return Err(StreamAbort::Changed); // shrank below the planned size
        }
        total += n as u64;
        chunk.extend_from_slice(&buf[..n]);
        while chunk.len() >= DROP_CHUNK_BYTES {
            b64.clear();
            base64_encode_into(&mut b64, &chunk[..DROP_CHUNK_BYTES]);
            emit(&b64)?;
            chunk.drain(..DROP_CHUNK_BYTES);
        }
    }
    // One extra read probes for growth past the planned size.
    if r.read(&mut buf[..1]).map_err(StreamAbort::Io)? != 0 {
        return Err(StreamAbort::Changed);
    }
    if !chunk.is_empty() || expected == 0 {
        b64.clear();
        base64_encode_into(&mut b64, &chunk);
        emit(&b64)?;
    }
    Ok(())
}

/// Stream one planned file to the page as begin + chunk(s) + end.
fn stream_one_file(
    w: &WebviewWindow,
    drop_id: u64,
    idx: usize,
    f: &PlannedFile,
) -> Result<(), StreamAbort> {
    let mut file = std::fs::File::open(&f.path).map_err(StreamAbort::Io)?;
    // fstat on the open handle: the authoritative size for the bytes we will read
    // (the plan-time stat raced against renames/writes).
    let len = file.metadata().map_err(StreamAbort::Io)?.len();
    if len != f.len || len > MAX_DROP_FILE_BYTES {
        return Err(StreamAbort::Changed);
    }
    w.eval(drop_msg_begin(drop_id, idx, &f.name, f.mime, len))
        .map_err(StreamAbort::Eval)?;
    let prefix = drop_msg_chunk_prefix(drop_id, idx);
    let result = stream_chunks(&mut file, len, |b64| {
        let mut js = String::with_capacity(prefix.len() + b64.len() + DROP_MSG_CHUNK_SUFFIX.len());
        js.push_str(&prefix);
        js.push_str(b64); // base64 alphabet needs no JS-string escaping
        js.push_str(DROP_MSG_CHUNK_SUFFIX);
        w.eval(js).map_err(StreamAbort::Eval)
    });
    match result {
        Ok(()) => w
            .eval(drop_msg_end(drop_id, idx))
            .map_err(StreamAbort::Eval),
        Err(e) => {
            // Best-effort: tell the page to discard the partial file.
            if !matches!(e, StreamAbort::Eval(_)) {
                let _ = w.eval(drop_msg_abort(drop_id, idx));
            }
            Err(e)
        }
    }
}

/// Plan, stream, and commit one OS drop, then surface the outcome to the user.
fn stream_drop(w: &WebviewWindow, drop_id: u64, paths: &[std::path::PathBuf]) {
    let (planned, mut skips) = plan_drop(paths);
    let mut streamed = 0usize;
    for (idx, f) in planned.iter().enumerate() {
        match stream_one_file(w, drop_id, idx, f) {
            Ok(()) => {
                crate::dlog::log(&format!(
                    "dragdrop: drop #{drop_id} file {idx}: streamed {} bytes ({})",
                    f.len, f.mime
                ));
                streamed += 1;
            }
            Err(StreamAbort::Io(e)) => {
                crate::dlog::log(&format!(
                    "dragdrop: drop #{drop_id} file {idx}: read failed: {e}"
                ));
                skips.unreadable += 1;
            }
            Err(StreamAbort::Changed) => {
                crate::dlog::log(&format!(
                    "dragdrop: drop #{drop_id} file {idx}: skip, changed while reading"
                ));
                skips.changed += 1;
            }
            Err(StreamAbort::Eval(e)) => {
                crate::dlog::log(&format!(
                    "dragdrop: drop #{drop_id}: eval failed, abandoning drop: {e}"
                ));
                let _ = crate::notify::show(
                    w.app_handle(),
                    "Files not attached",
                    "The dropped files couldn't be handed to WhatsApp. Please try again.",
                );
                return;
            }
        }
    }
    if streamed > 0 {
        // eval_with_callback: the ack proves the page-side handler actually ran —
        // a plain eval() Ok only means "queued", which used to be logged as success
        // even when injection never happened.
        let app = w.app_handle().clone();
        let commit = drop_msg_commit(drop_id, streamed);
        let res = w.eval_with_callback(commit, move |ack| {
            let ack = ack.trim().to_string();
            crate::dlog::log(&format!("dragdrop: drop #{drop_id} commit ack: {ack}"));
            // NOHANDLER: bridge.js isn't loaded (page mid-navigation). EMPTY: the
            // page received no complete file (chunks lost). Both mean nothing
            // attached — say so instead of leaving the user staring at nothing.
            if ack.contains("NOHANDLER") || ack.contains("EMPTY") {
                let _ = crate::notify::show(
                    &app,
                    "Files not attached",
                    "WhatsApp wasn't ready to receive the dropped files. Please try again.",
                );
            }
        });
        match res {
            Ok(()) => crate::dlog::log(&format!(
                "dragdrop: drop #{drop_id}: committed {streamed} file(s), awaiting ack"
            )),
            Err(e) => crate::dlog::log(&format!(
                "dragdrop: drop #{drop_id}: commit eval failed: {e}"
            )),
        }
    }
    if skips.total() > 0 {
        let _ = crate::notify::show(
            w.app_handle(),
            "Some files were not attached",
            &summarize_skips(&skips),
        );
    }
}

/// Best-effort MIME from the file extension, so WhatsApp routes images/videos/docs to
/// the right composer. Unknown types fall back to a generic binary type (still sends).
///
/// Why the image list matters: bridge.js routes anything whose MIME starts with `image/`
/// to the Photos & Videos composer (a photo); anything else goes to the Document composer.
/// A modern phone photo (AVIF, HEIF/HEIC) that fell through to `application/octet-stream`
/// was therefore attached as a *file* instead of a *photo* — covering those extensions
/// fixes the routing. We deliberately do NOT route niche raster formats (TIFF, ICO, APNG)
/// as images: WhatsApp's photo composer may reject them, which would be worse than the
/// current behaviour of sending them as a document — so they stay documents. Non-native
/// video containers also still go as a document (only mp4/3gpp/quicktime are accepted by
/// the media input), but get a correct label rather than a generic one.
fn mime_for(name: &str) -> &'static str {
    let ext = name.rsplit('.').next().unwrap_or("").to_ascii_lowercase();
    match ext.as_str() {
        // Images (image/* -> routed to the Photos & Videos composer by bridge.js). Limited to
        // formats WhatsApp's photo composer accepts, so nothing regresses to "not supported".
        "png" => "image/png",
        "jpg" | "jpeg" | "jpe" | "jfif" => "image/jpeg",
        "gif" => "image/gif",
        "webp" => "image/webp",
        "avif" => "image/avif",
        "bmp" => "image/bmp",
        "svg" => "image/svg+xml",
        "heic" => "image/heic",
        "heif" | "hif" => "image/heif",
        // Video. Only mp4/3gpp/quicktime are accepted by WhatsApp's media input (bridge.js
        // NATIVE_VIDEO); the rest still send, as a document, but with a correct label.
        "mp4" | "m4v" => "video/mp4",
        "mov" | "qt" => "video/quicktime",
        "webm" => "video/webm",
        "mkv" => "video/x-matroska",
        "3gp" | "3gpp" => "video/3gpp",
        "3g2" | "3gp2" | "3gpp2" => "video/3gpp2",
        "avi" => "video/x-msvideo",
        "mpeg" | "mpg" => "video/mpeg",
        "mts" | "m2ts" => "video/mp2t",
        "ogv" => "video/ogg",
        "flv" => "video/x-flv",
        // Audio (sent as a document; correct labels help WhatsApp render an audio preview).
        "mp3" => "audio/mpeg",
        "ogg" | "oga" => "audio/ogg",
        "opus" => "audio/opus",
        "wav" => "audio/wav",
        "m4a" => "audio/mp4",
        "flac" => "audio/flac",
        "aac" => "audio/aac",
        "weba" => "audio/webm",
        "amr" => "audio/amr",
        "mid" | "midi" => "audio/midi",
        // Documents / archives / text.
        "pdf" => "application/pdf",
        "doc" => "application/msword",
        "docx" => "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
        "xls" => "application/vnd.ms-excel",
        "xlsx" => "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        "ppt" => "application/vnd.ms-powerpoint",
        "pptx" => "application/vnd.openxmlformats-officedocument.presentationml.presentation",
        "rtf" => "application/rtf",
        "odt" => "application/vnd.oasis.opendocument.text",
        "ods" => "application/vnd.oasis.opendocument.spreadsheet",
        "odp" => "application/vnd.oasis.opendocument.presentation",
        "epub" => "application/epub+zip",
        "txt" | "log" => "text/plain",
        "md" => "text/markdown",
        "csv" => "text/csv",
        "json" => "application/json",
        "xml" => "application/xml",
        "zip" => "application/zip",
        "7z" => "application/x-7z-compressed",
        "rar" => "application/vnd.rar",
        "tar" => "application/x-tar",
        "gz" => "application/gzip",
        "apk" => "application/vnd.android.package-archive",
        _ => "application/octet-stream",
    }
}

/// Append the standard base64 (RFC 4648, with `=` padding) of `data` to `out`. Hand-rolled
/// to avoid pulling a crate into this otherwise lean dependency tree.
///
/// Encodes per 3-byte group, padding only a final partial group. Callers that feed data
/// across multiple calls (streaming) MUST pass whole 3-byte groups on every call except the
/// last — otherwise an interior partial group would be padded mid-stream. [`stream_chunks`]
/// upholds that contract by emitting whole [`DROP_CHUNK_BYTES`] (multiple-of-3) chunks.
fn base64_encode_into(out: &mut String, data: &[u8]) {
    const T: &[u8; 64] = b"ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/";
    out.reserve(data.len().div_ceil(3) * 4);
    for chunk in data.chunks(3) {
        let b0 = chunk[0] as u32;
        let b1 = *chunk.get(1).unwrap_or(&0) as u32;
        let b2 = *chunk.get(2).unwrap_or(&0) as u32;
        let n = (b0 << 16) | (b1 << 8) | b2;
        out.push(T[((n >> 18) & 63) as usize] as char);
        out.push(T[((n >> 12) & 63) as usize] as char);
        out.push(if chunk.len() > 1 {
            T[((n >> 6) & 63) as usize] as char
        } else {
            '='
        });
        out.push(if chunk.len() > 2 {
            T[(n & 63) as usize] as char
        } else {
            '='
        });
    }
}

/// Standard base64 of `data` as an owned `String`. Thin wrapper over [`base64_encode_into`].
/// Only the chunked [`stream_chunks`] is used in production now, so this whole-buffer
/// form is exercised by the tests (as the parity oracle) — hence `cfg(test)`.
#[cfg(test)]
fn base64_encode(data: &[u8]) -> String {
    let mut out = String::with_capacity(data.len().div_ceil(3) * 4);
    base64_encode_into(&mut out, data);
    out
}

/// Make sure a platform-suggested download `destination` is usable: keep an
/// absolute path with a file name as-is; otherwise rebuild it as
/// `<download_dir>/<file name>` (file name defaulting to "download", directory
/// defaulting to the temp dir if the platform can't name a Downloads folder).
fn ensure_download_destination(
    destination: &mut std::path::PathBuf,
    download_dir: Option<std::path::PathBuf>,
) {
    if destination.is_absolute() && destination.file_name().is_some() {
        return;
    }
    let name = destination
        .file_name()
        .map(|n| n.to_os_string())
        .unwrap_or_else(|| "download".into());
    let mut dir = download_dir.unwrap_or_else(std::env::temp_dir);
    dir.push(name);
    *destination = dir;
}

/// Track the last-focused account window in `ActiveAccount`. Registered once per
/// window inside `open_account_window`, so startup *and* dynamically-added
/// windows get it exactly once. Also re-applies the taskbar unread badge when
/// the window regains focus (restore/minimize cycles can drop the overlay).
fn register_focus_listener(app: &AppHandle, win: &WebviewWindow) {
    let app_handle = app.clone();
    let label = win.label().to_string();
    win.on_window_event(move |event| {
        if let tauri::WindowEvent::Focused(true) = event {
            if let Some(active) = app_handle.try_state::<ActiveAccount>() {
                *active.lock().unwrap() = label.clone();
            }
            // Re-assert the taskbar overlay so the count is always visible when
            // the window is restored (hidden-to-tray windows have no taskbar
            // button; the count lives in the tray tooltip until they return).
            crate::tray::refresh_badges(&app_handle);
        }
    });
}

/// True only while a WhatsNow account window is visible, restored, and actively
/// focused. In that state the user can already see incoming activity.
pub fn has_focused_account_window(app: &AppHandle) -> bool {
    app.webview_windows().iter().any(|(label, window)| {
        label.starts_with("wa-")
            && window.is_visible().unwrap_or(false)
            && !window.is_minimized().unwrap_or(false)
            && window.is_focused().unwrap_or(false)
    })
}

/// Apply per-account session isolation to a window builder.
///
/// The `default` account uses the default webview store (no override) so the
/// pre-multi-account login is preserved. Additional accounts get an isolated store:
/// `data_directory` on Linux/Windows, `data_store_identifier` (the persisted v4 UUID)
/// on macOS. `data_directory`/`data_store_identifier` compile on every platform in
/// tauri; only *which* one is called is cfg-gated, with a `compile_error!()` catch-all
/// so a future platform can't silently skip isolation.
fn apply_isolation<'a>(
    builder: WebviewWindowBuilder<'a, tauri::Wry, tauri::AppHandle<tauri::Wry>>,
    account: &Account,
    app: &AppHandle,
) -> WebviewWindowBuilder<'a, tauri::Wry, tauri::AppHandle<tauri::Wry>> {
    // The default account always uses the shared default store.
    if account.id == "default" {
        return builder;
    }

    #[cfg(any(target_os = "linux", windows))]
    {
        let _ = app;
        if let Ok(dir) = accounts::profile_dir(app, &account.id) {
            let _ = std::fs::create_dir_all(&dir);
            return builder.data_directory(dir);
        }
        builder
    }
    #[cfg(target_os = "macos")]
    {
        let _ = app;
        // Non-default accounts carry a persisted, non-nil v4 UUID. Fall back to a
        // freshly generated non-nil UUID rather than risk the nil-UUID exception.
        let uuid = account.store_uuid.unwrap_or_else(accounts::gen_store_uuid);
        builder.data_store_identifier(uuid)
    }
    #[cfg(not(any(target_os = "linux", windows, target_os = "macos")))]
    {
        let _ = (builder, account, app);
        compile_error!("per-account session isolation is not implemented for this platform");
    }
}

/// Whether the platform can isolate additional accounts. macOS needs >= 14 for
/// `data_store_identifier`. Linux/Windows always can. Returns an `Err` message
/// suitable for surfacing in the Accounts UI.
pub fn ensure_isolation_supported() -> Result<(), String> {
    #[cfg(target_os = "macos")]
    {
        use objc2_foundation::{NSOperatingSystemVersion, NSProcessInfo};
        // data_store_identifier requires macOS >= 14.
        let required = NSOperatingSystemVersion {
            majorVersion: 14,
            minorVersion: 0,
            patchVersion: 0,
        };
        let ok = NSProcessInfo::processInfo().isOperatingSystemAtLeastVersion(required);
        if ok {
            Ok(())
        } else {
            Err("Multiple accounts require macOS 14 or newer.".into())
        }
    }
    #[cfg(not(target_os = "macos"))]
    {
        Ok(())
    }
}

/// Clamp a requested default window size to the primary monitor's work area
/// (logical pixels). Keeps 1100x800 chat windows and 760x820 Settings windows
/// from overflowing small laptops (1366x768 at 125%/150% DPI) where the OS
/// would otherwise open them larger than the screen, or with the title bar and
/// bottom controls off-display. Returns the size unchanged when no monitor
/// information is available (headless/test environments).
fn clamped_logical_size(app: &AppHandle, width: f64, height: f64) -> (f64, f64) {
    let Ok(Some(monitor)) = app.primary_monitor() else {
        return (width, height);
    };
    let scale = monitor.scale_factor();
    let work = monitor.work_area();
    // Work area is physical pixels; builders take logical size.
    let available_w = work.size.width as f64 / scale;
    let available_h = work.size.height as f64 / scale;
    // Leave a little breathing room for taskbars that overlap the work area.
    (
        width.min(available_w * 0.96).max(320.0),
        height.min(available_h * 0.96).max(320.0),
    )
}

/// Counter for unique call-window labels. WebRTC media (the actual call)
/// REQUIRES the popup to share the opener's webview environment/session.
static CALL_WINDOW_SEQ: AtomicU64 = AtomicU64::new(0);

/// The REUSE script for an existing content popup: a JSON-quoted
/// `location.replace` wrapped in try/catch. Unit-pinned (see tests) because
/// the emission contract is what broke silently before (IIFE SyntaxError —
/// DEVELOPMENT_LOG §2.10): `navigate()` on an existing webview window is a
/// proven silent no-op inside the new-window handler, so this eval is the
/// only reliable reuse navigation.
fn popup_reuse_replace_script(url: &str) -> String {
    let url_json = serde_json::to_string(url).unwrap_or_else(|_| "\"\"".into());
    format!("try {{ window.location.replace({url_json}); }} catch (e) {{}}")
}

/// Ordinary builder for a content popup that was NOT pre-created (user
/// closed it, or an ultra-early request beat boot). Deliberately environment-
/// free: WebView2 groups webviews of one process by their shared user-data
/// folder, so session isolation/sharing still holds; and the COM environment
/// handle is !Send, so it could not reach this deferred context anyway.
fn build_deferred_content_popup(
    app: AppHandle,
    url: tauri::Url,
    width: f64,
    height: f64,
    position: Option<(f64, f64)>,
    title: &str,
) {
    let label = CONTENT_POPUP_LABEL;
    let mut builder = WebviewWindowBuilder::new(&app, label, WebviewUrl::External(url.clone()))
        .title(title)
        .inner_size(width, height)
        .min_inner_size(320.0, 240.0)
        .resizable(true)
        .maximizable(true)
        .minimizable(true)
        .closable(true)
        .visible(true)
        .focused(true)
        .user_agent(CHROME_UA);
    if let Some((x, y)) = position {
        builder = builder.position(x, y);
    }
    #[cfg(target_os = "macos")]
    {
        let _ = &builder; // macOS configuration requires the opener; not available here.
    }
    #[cfg(target_os = "linux")]
    {
        let _ = &builder; // Linux related-view requires the opener; not available here.
    }
    match builder.build() {
        Ok(window) => {
            #[cfg(target_os = "windows")]
            let _ = window.with_webview(enable_media_windows);
            register_windows_memory_target(&window);
            crate::dlog::log(&format!(
                "content popup: created (deferred) for {}",
                url.host_str().unwrap_or("?"),
            ));
        }
        Err(error) => {
            crate::dlog::log(&format!("content popup: deferred build failed ({error})"));
        }
    }
}

/// Pre-create the reusable content popup HIDDEN at boot. The on_new_window
/// handler then only navigates + shows it (no webview construction inside
/// the NewWindowRequested callback — the 2026-09-17 freeze). Created without
/// a URL change: it loads about:blank silently and is navigated on demand.
pub fn ensure_content_popup(app: &AppHandle) {
    if app.get_webview_window(CONTENT_POPUP_LABEL).is_some() {
        return;
    }
    let builder = WebviewWindowBuilder::new(
        app,
        CONTENT_POPUP_LABEL,
        WebviewUrl::External(tauri::Url::parse("about:blank").expect("valid about:blank")),
    )
    .title("WhatsNow")
    .inner_size(940.0, 640.0)
    .min_inner_size(320.0, 240.0)
    .resizable(true)
    .maximizable(true)
    .minimizable(true)
    .closable(true)
    .visible(false)
    .focused(false)
    .user_agent(CHROME_UA);
    match builder.build() {
        Ok(window) => {
            #[cfg(target_os = "windows")]
            let _ = window.with_webview(enable_media_windows);
            register_windows_memory_target(&window);
            crate::dlog::log("content popup: pre-created hidden (freeze-safe popup path)");
        }
        Err(error) => {
            crate::dlog::log(&format!("content popup: pre-creation failed ({error})"));
        }
    }
}

/// Grant microphone/camera + media settings to WhatsApp Web, and make sure the
/// site actually sees our Chrome UA. The system webview denies getUserMedia by
/// default, which blocks voice messages (the "Allow microphone" prompt). We
/// enable the media settings and auto-approve the webview's permission requests
/// for the WhatsApp window.
///
/// Reality check (verified against webkit2gtk 2.52.3 on this distro): the
/// library is built WITHOUT a WebRTC backend — `RTCPeerConnection` stays
/// undefined even with `enable-webrtc` on (the setting is kept as a harmless
/// forward-compat no-op). Voice/video CALLS therefore cannot work in the Linux
/// system webview no matter what we spoof; WhatsApp's "your browser doesn't
/// support calling" is, on Linux, literally true. Calls can work on Windows
/// (WebView2 is Chromium and ships WebRTC).
fn enable_webview_media(win: &WebviewWindow) {
    #[cfg(target_os = "linux")]
    {
        use webkit2gtk::glib::prelude::ObjectExt;
        use webkit2gtk::{PermissionRequestExt, WebViewExt};
        let _ = win.with_webview(|webview| {
            let wv = webview.inner();
            if let Some(settings) = WebViewExt::settings(&wv) {
                settings.set_property("enable-media-stream", true);
                settings.set_property("enable-mediasource", true);
                settings.set_property("enable-webrtc", true);
                settings.set_property("enable-encrypted-media", true);
                // CRITICAL: WebKitGTK hardcodes per-site UA quirks, and
                // web.whatsapp.com is on the list — with quirks enabled (the
                // default) the engine REPLACES our Chrome UA with a fake macOS
                // Safari string ("... Version/60.5 Safari/605.1.15"), which
                // WhatsApp reads as an ancient Safari and answers by disabling
                // video sending and calling ("please update your browser").
                // Turning quirks off lets CHROME_UA through unmodified.
                settings.set_property("enable-site-specific-quirks", false);
                // Opt-in inspector for live diagnosis: run `WHATSNOW_DEVTOOLS=1
                // whatsnow` and right-click > Inspect Element.
                if std::env::var_os("WHATSNOW_DEVTOOLS").is_some() {
                    settings.set_property("enable-developer-extras", true);
                }
            }
            wv.connect_permission_request(|_wv, req| {
                req.allow();
                true
            });
            // The initial navigation was issued before this callback ran, i.e.
            // with the quirked UA still active. Reload once so the session is
            // consistently Chrome from the very first request WhatsApp sees.
            wv.reload();
            crate::dlog::log(
                "webview: media settings applied, site-specific quirks OFF, reloaded with Chrome UA",
            );
        });
    }
    #[cfg(target_os = "windows")]
    {
        let _ = win.with_webview(enable_media_windows);
    }
    #[cfg(target_os = "macos")]
    {
        // wry already installs a WKUIDelegate that auto-grants requestMediaCapturePermission;
        // mic/camera are gated only by the Info.plist usage-description keys (see src-tauri/Info.plist).
        let _ = win;
    }
}

/// Windows media permissions WhatsNow auto-allows for WhatsApp: microphone +
/// camera (voice/video messages and calls) and WINDOW_MANAGEMENT (the call
/// stage's pop-out/Picture-in-Picture controls). Everything else (geolocation,
/// clipboard-read, sensors, …) keeps WebView2's default prompting. Pure and
/// cfg-gated so the tests can pin the exact set.
#[cfg(target_os = "windows")]
fn windows_permission_allowed(
    kind: webview2_com::Microsoft::Web::WebView2::Win32::COREWEBVIEW2_PERMISSION_KIND,
) -> bool {
    use webview2_com::Microsoft::Web::WebView2::Win32::{
        COREWEBVIEW2_PERMISSION_KIND_CAMERA, COREWEBVIEW2_PERMISSION_KIND_MICROPHONE,
        COREWEBVIEW2_PERMISSION_KIND_WINDOW_MANAGEMENT,
    };
    kind == COREWEBVIEW2_PERMISSION_KIND_MICROPHONE
        || kind == COREWEBVIEW2_PERMISSION_KIND_CAMERA
        || kind == COREWEBVIEW2_PERMISSION_KIND_WINDOW_MANAGEMENT
}

/// Windows (WebView2): auto-allow microphone/camera permission requests so WhatsApp
/// voice messages and calls work without a prompt (and can't be wedged by a prior "Block").
/// 2.6.0 also auto-allows WINDOW_MANAGEMENT (the call stage's Picture-in-Picture /
/// pop-out controls) — both are media features WhatsApp literally supports, and a
/// denial wedges the call UI.
#[cfg(target_os = "windows")]
fn enable_media_windows(webview: tauri::webview::PlatformWebview) {
    use webview2_com::Microsoft::Web::WebView2::Win32::{
        ICoreWebView2, ICoreWebView2PermissionRequestedEventArgs, COREWEBVIEW2_PERMISSION_KIND,
        COREWEBVIEW2_PERMISSION_STATE_ALLOW,
    };
    use webview2_com::PermissionRequestedEventHandler;

    // SAFETY: with_webview runs on the UI thread where the WebView2 controller lives;
    // these are standard WebView2 COM calls.
    unsafe {
        let controller = webview.controller();
        let core: ICoreWebView2 = match controller.CoreWebView2() {
            Ok(c) => c,
            Err(_) => return,
        };
        let handler = PermissionRequestedEventHandler::create(Box::new(
            move |_wv: Option<ICoreWebView2>,
                  args: Option<ICoreWebView2PermissionRequestedEventArgs>|
                  -> windows_core::Result<()> {
                if let Some(args) = args {
                    let mut kind = COREWEBVIEW2_PERMISSION_KIND::default();
                    args.PermissionKind(&mut kind)?;
                    if windows_permission_allowed(kind) {
                        args.SetState(COREWEBVIEW2_PERMISSION_STATE_ALLOW)?;
                    }
                }
                Ok(())
            },
        ));
        let mut token: i64 = 0;
        let _ = core.add_PermissionRequested(&handler, &mut token);
    }
}

/// Windows low-memory build: keep an active chat fully responsive, but ask
/// WebView2 to reclaim inactive renderer memory when the window is genuinely
/// out of sight. Unlike TrySuspend, this preserves WhatsApp's scripts and
/// network connection, so background messages and native notifications keep
/// working.
///
/// Media-audio guard (the "video plays with no sound" bug): the LOW target is
/// a best-effort reclaim that "could potentially cause memory for some WebView
/// browser processes to be swapped out to disk" (ICoreWebView2_19 docs). While
/// a window is VISIBLE and not minimized — focus or not — its media pipeline
/// must stay at NORMAL: clicking play inside a video does not re-raise
/// WindowEvent::Focused (the window was already focused), so a focus-only
/// policy left the webview at LOW and the swapped-out audio graph played
/// silence while the video kept painting (verified live, 2026-09-15). LOW now
/// applies only to windows the user cannot currently watch: minimized, or
/// hidden (tray/another virtual desktop). Pure predicate in
/// [`windows_memory_low`] with a unit test in the tests module.
#[cfg(all(target_os = "windows", feature = "windows-memory"))]
fn register_windows_memory_target(win: &WebviewWindow) {
    use std::sync::{
        atomic::{AtomicBool, Ordering},
        Arc,
    };

    let tracked = win.clone();
    let minimized = Arc::new(AtomicBool::new(win.is_minimized().unwrap_or(false)));
    let minimized_for_event = Arc::clone(&minimized);
    win.on_window_event(move |event| match event {
        tauri::WindowEvent::Focused(_) => sync_account_memory_target(&tracked),
        tauri::WindowEvent::Resized(_) => {
            let now_minimized = tracked.is_minimized().unwrap_or(false);
            if minimized_for_event.swap(now_minimized, Ordering::AcqRel) != now_minimized {
                sync_account_memory_target(&tracked);
            }
        }
        _ => {}
    });

    sync_account_memory_target(win);
}

#[cfg(not(all(target_os = "windows", feature = "windows-memory")))]
fn register_windows_memory_target(_win: &WebviewWindow) {}

/// Re-apply the memory target from the window's CURRENT state. Called on every
/// focus change and on minimize/restore (Resized with a minimized-state flip),
/// and directly from [`show_account`] so a tray-hidden window returning to
/// screen always comes back at NORMAL before the first video plays.
#[cfg(all(target_os = "windows", feature = "windows-memory"))]
fn sync_account_memory_target(win: &WebviewWindow) {
    let low = windows_memory_low(
        win.is_visible().unwrap_or(false),
        win.is_minimized().unwrap_or(false),
        win.is_focused().unwrap_or(false),
    );
    set_windows_memory_target(win, low);
}

/// Pure LOW/NORMAL decision for the Windows memory feature. LOW only when the
/// user cannot currently watch this window (hidden or minimized); visible
/// windows — focused or not — stay NORMAL so video audio never gets reclaimed
/// mid-playback. Ungated (platform-independent logic) so the test suite
/// exercises it on every OS; callers that touch WebView2 remain cfg-gated.
#[cfg_attr(
    not(all(target_os = "windows", feature = "windows-memory")),
    allow(dead_code)
)]
fn windows_memory_low(visible: bool, minimized: bool, _focused: bool) -> bool {
    let _ = _focused;
    !(visible && !minimized)
}

#[cfg(all(target_os = "windows", feature = "windows-memory"))]
fn set_windows_memory_target(win: &WebviewWindow, low: bool) {
    let _ = win.with_webview(move |webview| {
        use webview2_com::Microsoft::Web::WebView2::Win32::{
            ICoreWebView2, ICoreWebView2_19, COREWEBVIEW2_MEMORY_USAGE_TARGET_LEVEL_LOW,
            COREWEBVIEW2_MEMORY_USAGE_TARGET_LEVEL_NORMAL,
        };
        use windows_core::Interface;

        // SAFETY: with_webview runs on the WebView2 UI thread. ICoreWebView2_19
        // is queried at runtime, so older Evergreen runtimes fail gracefully.
        unsafe {
            let result = webview
                .controller()
                .CoreWebView2()
                .and_then(|core: ICoreWebView2| core.cast::<ICoreWebView2_19>())
                .and_then(|core| {
                    core.SetMemoryUsageTargetLevel(if low {
                        COREWEBVIEW2_MEMORY_USAGE_TARGET_LEVEL_LOW
                    } else {
                        COREWEBVIEW2_MEMORY_USAGE_TARGET_LEVEL_NORMAL
                    })
                });
            match result {
                Ok(()) => crate::dlog::log(if low {
                    "webview: Windows 10 memory target LOW"
                } else {
                    "webview: Windows 10 memory target NORMAL"
                }),
                Err(error) => crate::dlog::log(&format!(
                    "webview: Windows 10 memory target unavailable: {error}"
                )),
            }
        }
    });
}

/// Show + unminimize + focus an account window by its `wa-<id>` label.
pub fn show_account(app: &AppHandle, label: &str) {
    if let Some(w) = app.get_webview_window(label) {
        let _ = w.show();
        let _ = w.unminimize();
        let _ = w.set_focus();
        // Returning to screen must restore full media performance immediately
        // (Resized/Focused events can race or be missed across a show+unminimize
        // burst; this re-sync makes the NORMAL target deterministic).
        #[cfg(all(target_os = "windows", feature = "windows-memory"))]
        sync_account_memory_target(&w);
    }
}

/// Queue a toast route for its account window, applying it immediately when
/// the window's page has already finished loading, or deferring it until the
/// first page load (cold-start activations and relaunches that beat the page).
/// An eval against a not-yet-loaded page would find no bridge function and
/// silently do nothing — this is what made toast clicks land on the last chat.
pub fn request_notification_target(
    app: &AppHandle,
    account_id: &str,
    route: &crate::notify::NotificationRoute,
) {
    if let Some(pending) = app.try_state::<PendingNotificationRoutes>() {
        pending
            .0
            .lock()
            .unwrap_or_else(|error| error.into_inner())
            .push((account_id.to_string(), route.clone()));
    }
    let label = accounts::window_label(account_id);
    let ready = app
        .try_state::<LoadedWindows>()
        .map(|loaded| {
            loaded
                .0
                .lock()
                .unwrap_or_else(|error| error.into_inner())
                .contains(&label)
        })
        .unwrap_or(false);
    if ready {
        // Bring the account window forward FIRST: WhatsApp's chat list needs a
        // visible (or at least restored) window for row clicks to register —
        // a tray-hidden window can swallow the routing's clicks, which is why
        // toast clicks used to land on whatever chat was already open.
        if let Some(window) = app.get_webview_window(&label) {
            let _ = window.show();
            let _ = window.set_focus();
            if window.is_minimized().unwrap_or(false) {
                let _ = window.unminimize();
            }
        }
        drain_pending_notification_routes(app, &label);
    }
}

/// Apply every queued toast route for one account window (page is loaded).
fn drain_pending_notification_routes(app: &AppHandle, label: &str) {
    let mut routes = Vec::new();
    if let Some(pending) = app.try_state::<PendingNotificationRoutes>() {
        let mut list = pending.0.lock().unwrap_or_else(|error| error.into_inner());
        let mut index = 0;
        while index < list.len() {
            let (account_id, route) = &list[index];
            if accounts::window_label(account_id) == label {
                routes.push((account_id.clone(), route.clone()));
                list.swap_remove(index);
            } else {
                index += 1;
            }
        }
    }
    for (account_id, route) in routes {
        open_notification_target(app, &account_id, &route);
    }
}

/// Queue a WhatsApp-family URL to be navigated by the active account window
/// once its page has finished loading (cold-start deep links). Bounded: the
/// queue never holds more than 8 URLs.
pub fn queue_pending_navigation(app: &AppHandle, url: &str) {
    if let Some(pending) = app.try_state::<PendingNavigations>() {
        let mut list = pending.0.lock().unwrap_or_else(|error| error.into_inner());
        if list.len() >= 8 {
            list.remove(0);
        }
        list.push(url.to_string());
    }
}

/// Drain queued URLs for one account window (page is loaded). Applied in
/// order; the LAST URL wins if several arrived (the user's newest intent).
fn drain_pending_navigations(app: &AppHandle, label: &str) {
    let urls: Vec<String> = match app.try_state::<PendingNavigations>() {
        Some(pending) => {
            let mut list = pending.0.lock().unwrap_or_else(|error| error.into_inner());
            std::mem::take(&mut *list)
        }
        None => Vec::new(),
    };
    drain_pending_navigations_into(app, label, &urls);
}

/// Navigate one account window through an ordered list of WhatsApp-family
/// URLs (shared by the drain paths). Every URL is re-validated against the
/// family-host allow-list — the queue can only ever contain those, but the
/// window.navigate boundary enforces it anyway.
fn drain_pending_navigations_into(app: &AppHandle, label: &str, urls: &[String]) {
    if urls.is_empty() {
        return;
    }
    if let Some(window) = app.get_webview_window(label) {
        for url in urls {
            let Ok(parsed) = tauri::Url::parse(url) else {
                continue;
            };
            if !whatsapp_family_host(&parsed) {
                continue;
            }
            // DEEP-LINK DELIVERY (2026-09-17 redesign — see DEVELOPMENT_LOG
            // §2.10). The previous soft-route script could never work twice
            // over: (1) its emitted IIFE was a SyntaxError (string literal
            // directly after the function expression — the eval silently
            // failed), and (2) live CDP forensics proved WhatsApp Web keeps
            // chats OUT of the URL entirely — /send?phone has no in-app
            // route, so no in-page navigation trick can open a contact.
            // The delivery now goes through the bridge's
            // __whatsnowOpenChatByPhone: a KNOWN number is opened with a
            // trusted chat-list row click (verified against the header); an
            // UNKNOWN number deliberately does nothing further (revert
            // decision 2026-09-17 — the interstitial popup and search
            // choreography were rejected as "messy second window" quirks,
            // and a direct store-API open is impossible on current
            // WhatsApp Web).
            let phone = parsed
                .query_pairs()
                .find(|(k, _)| k == "phone")
                .map(|(_, v)| v.to_string())
                .unwrap_or_default();
            if phone.is_empty() {
                crate::dlog::log("navigation: deep link without phone param ignored");
                continue;
            }
            let script = deep_link_open_by_phone_script(&phone);
            match window.eval(&script) {
                Ok(()) => crate::dlog::log(
                    "navigation: deep link handed to account window (open by phone)",
                ),
                Err(error) => crate::dlog::log(&format!("navigation: deep link failed: {error}")),
            }
        }
    }
}

/// DEEP-LINK FALLBACK builder. Kept unit-pinned: the emission contract below
/// is the guardrail that caught the 2026-09-17 silent-no-op bug (an IIFE
/// followed by a bare string literal = SyntaxError = the whole delivery
/// never ran). The production drain path uses deep_link_open_by_phone_script
/// (the bridge is always injected by the time queued links drain).
#[cfg(test)]
fn whatsapp_soft_navigation_script(url: &str) -> String {
    let url_json = serde_json::to_string(url).unwrap_or_else(|_| "\"\"".into());
    // DEEP-LINK FALLBACK builder (kept for the unit test that pins the
    // emission contract below; the production drain path uses
    // deep_link_open_by_phone_script). It opens the target through the REAL
    // window.open so the shell's popup host receives
    // it. Live forensics (2026-09-17, DEVELOPMENT_LOG §2.10) proved the
    // in-page route concept impossible: WhatsApp Web keeps chats OUT of the
    // URL (/send?phone always bounces home), so the correct delivery for any
    // family URL — before the bridge exists — is the same mechanism the
    // bridge uses: window.open into the reusable content popup.
    // NOTE on the IIFE: the old emission built `(function(url){...})"url";`
    // — a string literal directly after the function expression = a
    // SyntaxError that made the ENTIRE script a silent no-op. The call
    // operator with parentheses (`)("url");`) is mandatory.
    let mut js = String::new();
    js.push_str("(function(url){");
    js.push_str("try {");
    js.push_str("window.open(url, '_blank');");
    js.push_str("} catch (e) {}");
    js.push_str("})");
    js.push('(');
    js.push_str(&url_json);
    js.push(')');
    js.push(';');
    js
}

/// The script that drives a deep link through the bridge's open-by-phone
/// flow (row match → trusted click; unknown number → deliberately nothing,
/// the app just rose). Kept next to the fallback builder so both delivery
/// contracts stay unit-pinned side by side.
fn deep_link_open_by_phone_script(phone: &str) -> String {
    let phone_json = serde_json::to_string(phone).unwrap_or_else(|_| "\"\"".into());
    format!(
        "Promise.resolve(window.__whatsnowOpenChatByPhone ? \
         window.__whatsnowOpenChatByPhone({phone_json}) : 'no-bridge')\
         .catch(function(){{return 'no-bridge';}});"
    )
}

/// Navigate the ACTIVE account window to a WhatsApp-family URL immediately
/// (single-instance deep links: the window already exists). The window is
/// shown/focused first — a tray-hidden window must not receive a navigation
/// the user cannot see. Falls back to the load-queue when the active window's
/// page has not finished loading yet (the page-load hook drains it later).
pub fn navigate_active_account(app: &AppHandle, url: &str) {
    let Ok(parsed) = tauri::Url::parse(url) else {
        return;
    };
    if !whatsapp_family_host(&parsed) {
        return;
    }
    show_active(app);
    let label = app
        .try_state::<ActiveAccount>()
        .map(|active| active.lock().unwrap_or_else(|e| e.into_inner()).clone())
        .or_else(|| {
            app.webview_windows()
                .keys()
                .find(|l| l.starts_with("wa-"))
                .cloned()
        });
    let Some(label) = label else {
        queue_pending_navigation(app, url);
        return;
    };
    let loaded = app
        .try_state::<LoadedWindows>()
        .map(|loaded| {
            loaded
                .0
                .lock()
                .unwrap_or_else(|error| error.into_inner())
                .contains(&label)
        })
        .unwrap_or(false);
    if loaded {
        drain_pending_navigations_into(app, &label, &[url.to_string()]);
    } else {
        queue_pending_navigation(app, url);
    }
}

/// Focus the account that produced a native toast, then ask its already-injected
/// bridge to select and reveal the originating conversation/message.
pub fn open_notification_target(
    app: &AppHandle,
    account_id: &str,
    route: &crate::notify::NotificationRoute,
) {
    let label = accounts::window_label(account_id);
    let Some(window) = app.get_webview_window(&label) else {
        return;
    };
    let Ok(route_json) = serde_json::to_string(route) else {
        return;
    };
    let Ok(account_id_json) = serde_json::to_string(account_id) else {
        return;
    };
    let script = format!(
        "Promise.resolve(window.__whatsnowOpenNotificationTarget ? \
         window.__whatsnowOpenNotificationTarget({route_json}) : false)\
         .catch(function(){{return false;}})\
         .then(function(){{var inv=(window.__TAURI__&&window.__TAURI__.core&&\
         window.__TAURI__.core.invoke)||(window.__TAURI_INTERNALS__&&\
         window.__TAURI_INTERNALS__.invoke);return inv?inv(\
         \"activate_notification_window\",{{accountId:{account_id_json}}}):false;}});"
    );
    if let Err(error) = window.eval(script) {
        crate::dlog::log(&format!("native toast chat routing failed: {error}"));
        show_account(app, &label);
    }
}

/// Dispatch a TRUSTED mouse click at viewport CSS-pixel coordinates inside the
/// webview, using the WebView2 DevTools Protocol Input domain. WhatsApp Web
/// ignores untrusted page-side .click() on its chat list (verified live:
/// programmatic clicks never navigate, CDP Input events always do), so toast
/// activation routes through this instead. The coordinates come from the
/// bridge's getBoundingClientRect(), which is viewport CSS pixels — the same
/// space CDP Input expects. Fire-and-forget: the bridge verifies the
/// resulting navigation itself and retries if it did not land.
#[cfg(target_os = "windows")]
pub fn dispatch_trusted_click(window: &WebviewWindow, x: i32, y: i32) -> bool {
    use webview2_com::CallDevToolsProtocolMethodCompletedHandler;
    use windows_core::PCWSTR;

    fn wide(value: &str) -> Vec<u16> {
        value.encode_utf16().chain(std::iter::once(0)).collect()
    }

    let dispatched = window.with_webview(move |webview| {
        // SAFETY: with_webview runs on the WebView2 UI thread; the completion
        // handler result is irrelevant for Input events (the bridge verifies).
        unsafe {
            let Ok(core) = webview.controller().CoreWebView2() else {
                crate::dlog::log(
                    "notification routing: trusted click unavailable (no CoreWebView2)",
                );
                return;
            };
            let handler = CallDevToolsProtocolMethodCompletedHandler::create(Box::new(
                |_hr, _json| Ok(()),
            ));
            let method = PCWSTR(wide("Input.dispatchMouseEvent").as_ptr());
            // JSON for the CDP Input domain: inner quotes escaped, {{ }} render
            // as literal braces.
            let pressed = format!(
                "{{ \"type\": \"mousePressed\", \"x\": {x}, \"y\": {y}, \"button\": \"left\", \"clickCount\": 1 }}"
            );
            let released = format!(
                "{{ \"type\": \"mouseReleased\", \"x\": {x}, \"y\": {y}, \"button\": \"left\", \"clickCount\": 1 }}"
            );
            // The call is synchronous; &handler satisfies the Param bound.
            let _ = core.CallDevToolsProtocolMethod(
                method,
                PCWSTR(wide(&pressed).as_ptr()),
                &handler,
            );
            let _ = core.CallDevToolsProtocolMethod(
                method,
                PCWSTR(wide(&released).as_ptr()),
                &handler,
            );
            crate::dlog::log(&format!(
                "notification routing: trusted click at ({x}, {y})"
            ));
        }
    });
    dispatched.is_ok()
}

#[cfg(not(target_os = "windows"))]
pub fn dispatch_trusted_click(_window: &WebviewWindow, _x: i32, _y: i32) -> bool {
    false
}

/// Show the active (last-focused) account window. Falls back to the first existing
/// account window, then the settings window.
pub fn show_active(app: &AppHandle) {
    // If the app is locked, any "reveal" request shows the lock screen, never an
    // account window. Covers tray click, global shortcut, single-instance, macOS Reopen.
    if !crate::lock::is_unlocked(app) {
        crate::lock::show_lock_window(app);
        return;
    }
    if let Some(active) = app.try_state::<ActiveAccount>() {
        let label = active.lock().unwrap().clone();
        if app.get_webview_window(&label).is_some() {
            show_account(app, &label);
            return;
        }
    }
    // Fall back to any account window.
    if let Some(label) = app
        .webview_windows()
        .keys()
        .find(|l| l.starts_with("wa-"))
        .cloned()
    {
        show_account(app, &label);
        return;
    }
    // Last resort: the settings window.
    if let Some(w) = app.get_webview_window("settings") {
        let _ = w.show();
        let _ = w.set_focus();
    }
}

/// Backwards-compatible shim: single-instance + macOS Reopen call this; it now
/// targets the active account.
pub fn show_main(app: &AppHandle) {
    show_active(app);
}

/// What a toggle should do given the active window's visibility.
#[derive(Debug, PartialEq, Eq)]
pub enum ToggleAct {
    Hide,
    Show,
}

/// Pure toggle decision: a visible active window is hidden; anything else (a hidden
/// window, or no active window at all → `None`) is shown.
pub fn toggle_decision(active_visible: Option<bool>) -> ToggleAct {
    match active_visible {
        Some(true) => ToggleAct::Hide,
        _ => ToggleAct::Show,
    }
}

/// Toggle the active account window: hide it if visible, otherwise show + focus it.
/// The "show" path goes through `show_active`, which defers to the lock screen when
/// the app is locked — so a toggle (e.g. an OS-bound `whatsnow --toggle` on Wayland,
/// where in-process global hotkeys can't fire) can NEVER reveal an account window
/// while locked. The "hide" path only triggers when an account window is visible,
/// which cannot happen while locked.
pub fn toggle_active(app: &AppHandle) {
    let label = app
        .try_state::<ActiveAccount>()
        .map(|a| a.lock().unwrap().clone());
    let visible = label
        .as_ref()
        .and_then(|l| app.get_webview_window(l))
        .map(|w| w.is_visible().unwrap_or(false));
    match toggle_decision(visible) {
        ToggleAct::Hide => {
            if let Some(l) = label {
                if let Some(w) = app.get_webview_window(&l) {
                    let _ = w.hide();
                }
            }
        }
        ToggleAct::Show => show_active(app),
    }
}

fn settings_window_background(theme: crate::settings::AppTheme) -> tauri::window::Color {
    use crate::settings::AppTheme;

    match theme {
        AppTheme::Light => tauri::window::Color(0xed, 0xf4, 0xf1, 0xff),
        AppTheme::System | AppTheme::Dark => tauri::window::Color(0x0b, 0x12, 0x10, 0xff),
        AppTheme::Midnight => tauri::window::Color(0x06, 0x10, 0x1d, 0xff),
        AppTheme::Forest => tauri::window::Color(0x06, 0x13, 0x0e, 0xff),
        AppTheme::Graphite => tauri::window::Color(0x0d, 0x10, 0x13, 0xff),
        AppTheme::Ocean => tauri::window::Color(0x06, 0x15, 0x1b, 0xff),
        AppTheme::Blush => tauri::window::Color(0xff, 0xf2, 0xf4, 0xff),
        AppTheme::Lavender => tauri::window::Color(0xf5, 0xf1, 0xfc, 0xff),
        AppTheme::Candy => tauri::window::Color(0xff, 0xf3, 0xf9, 0xff),
        AppTheme::Aurora => tauri::window::Color(0xf7, 0xf3, 0xfb, 0xff),
    }
}

fn settings_theme_bootstrap(theme: crate::settings::AppTheme) -> String {
    let choice = serde_json::to_string(&theme).expect("serialize settings theme");
    format!(
        r#"(() => {{
  const choice = {choice};
  const apply = () => {{
    const root = document.documentElement;
    if (!root) return;
    const resolved = choice === "system" ? "dark" : choice;
    root.dataset.theme = resolved;
    root.dataset.themeChoice = choice;
  }};
  apply();
  document.addEventListener("readystatechange", apply, {{ once: true }});
}})();"#
    )
}

// The Settings page's About card and footer show the app version. It is
// injected here from the compiled package version so the displayed version
// can never drift from the binary again (the hardcoded 2.0.1 label was the
// last stale remnant after the 2.5.0 bump). The script fills every element
// marked with data-version-ref; the HTML ships with a neutral placeholder.
fn settings_version_bootstrap(version: &str) -> String {
    let version = serde_json::to_string(version).expect("serialize settings version");
    format!(
        r#"(() => {{
  const version = {version};
  const apply = () => {{
    const refs = document.querySelectorAll("[data-version-ref]");
    for (const el of refs) {{
      el.textContent = el.textContent.replace(/WhatsNow [0-9.]+/, "WhatsNow " + version);
    }}
  }};
  apply();
  document.addEventListener("readystatechange", apply, {{ once: true }});
}})();"#
    )
}

/// Opens (or focuses) the local settings window.
pub fn open_settings_window(app: &AppHandle) {
    use std::sync::atomic::{AtomicBool, Ordering};

    if let Some(w) = app.get_webview_window("settings") {
        let _ = w.show();
        let _ = w.set_focus();
        return;
    }

    let settings = crate::settings::load(app);
    let reveal_pending = AtomicBool::new(true);
    // Settings is a tall panel (min 640 logical px) — clamp to the work area
    // so 1366x768-class screens do not open it taller than the desktop.
    let (settings_w, settings_h) = clamped_logical_size(app, 760.0, 820.0);
    let builder = WebviewWindowBuilder::new(app, "settings", WebviewUrl::App("index.html".into()))
        .title("WhatsNow — Settings")
        .inner_size(settings_w, settings_h)
        .min_inner_size(560.0, 640.0)
        .resizable(true)
        // Seamless pop-up style: no native titlebar (the Settings page draws
        // its own drag region + close button), soft shadow, no taskbar button
        // (it is a panel of WhatsNow, not a second window), and the theme's
        // background color so the reveal never flashes white.
        .decorations(false)
        .shadow(true)
        .skip_taskbar(true)
        .theme(settings.theme.native_theme())
        .background_color(settings_window_background(settings.theme))
        .initialization_script(format!(
            "{}\n{}",
            settings_theme_bootstrap(settings.theme),
            settings_version_bootstrap(&app.package_info().version.to_string())
        ))
        .visible(false)
        .on_page_load(move |window, payload| {
            // Frameless is a fixed design decision: re-assert it here so a
            // stale window-state (saved by an older build with a native frame)
            // can never re-attach the OS title bar.
            let _ = window.set_decorations(false);
            if payload.event() == PageLoadEvent::Finished
                && reveal_pending.swap(false, Ordering::AcqRel)
            {
                let _ = window.show();
                let _ = window.set_focus();
            }
        });
    if let Err(error) = builder.build() {
        crate::dlog::log(&format!("settings window creation failed: {error}"));
    }
}

#[cfg(test)]
mod tests {
    use super::{
        base64_encode, deep_link_open_by_phone_script, drop_msg_begin, drop_msg_chunk_prefix,
        drop_msg_commit, drop_msg_end, drop_msg_reserve, ensure_download_destination,
        external_web_url, is_whatsapp_call_url, mime_for, plan_drop, settings_theme_bootstrap,
        settings_version_bootstrap, settings_window_background, stream_chunks, summarize_skips,
        toggle_decision, whatsapp_family_host, whatsapp_popup_allowed,
        whatsapp_soft_navigation_script, DropSkips, StreamAbort, ToggleAct, CHROME_UA,
        DROP_CHUNK_BYTES, DROP_MSG_CHUNK_SUFFIX, MAX_DROP_FILES,
    };
    use crate::settings::AppTheme;

    #[test]
    fn settings_window_starts_with_the_saved_palette() {
        assert_eq!(
            settings_window_background(AppTheme::Midnight),
            tauri::window::Color(0x06, 0x10, 0x1d, 0xff)
        );
        assert!(settings_theme_bootstrap(AppTheme::Candy).contains(r#"const choice = "candy";"#));
        assert_eq!(
            settings_window_background(AppTheme::Aurora),
            tauri::window::Color(0xf7, 0xf3, 0xfb, 0xff)
        );
    }

    #[test]
    fn settings_window_injects_the_compiled_version_into_the_about_dialog() {
        // The About card/footer version comes from the compiled package, never
        // from a hardcoded label (the stale 2.0.1 text was the last remnant of
        // the 2.5.0 bump). The injected script must target the data-version-ref
        // elements and rewrite the WhatsNow X.Y.Z token with the real version.
        let script = settings_version_bootstrap("2.6.0");
        assert!(
            script.contains(r#"querySelectorAll("[data-version-ref]")"#),
            "version bootstrap addresses the data-version-ref elements"
        );
        assert!(
            script.contains(r#"WhatsNow " + version"#),
            "version bootstrap rewrites the WhatsNow version token"
        );
        assert!(
            script.contains(r#"const version = "2.6.0";"#),
            "the compiled version reaches the settings page script as a JS string literal"
        );
        // The static HTML must not carry a hardcoded version anymore.
        let html = include_str!("../../settings-ui/index.html");
        assert!(
            html.contains("data-version-ref"),
            "settings HTML marks version slots with data-version-ref"
        );
        assert!(
            !html.contains("WhatsNow 2.0.1") && !html.contains("?v=2.0.1"),
            "no hardcoded 2.0.1 remains in the settings page"
        );
        assert!(
            html.contains("?v=2.6.0"),
            "settings assets cache-bust on 2.6.0"
        );
    }

    #[test]
    fn only_web_links_outside_whatsapp_are_external() {
        let whatsapp = tauri::Url::parse("https://web.whatsapp.com/send/").unwrap();
        let external = tauri::Url::parse("https://example.com/article").unwrap();
        let file = tauri::Url::parse("file:///C:/private.txt").unwrap();
        assert!(!external_web_url(&whatsapp));
        assert!(external_web_url(&external));
        assert!(!external_web_url(&file));
    }

    #[test]
    fn deep_link_fallback_script_is_valid_js_and_opens_the_popup_host() {
        // 2026-09-17 GUARDRAIL: the old script emitted `(function(url){...})
        // "url";` — a string literal directly after a function expression =
        // SyntaxError = the ENTIRE deep-link delivery was a silent no-op
        // (the live CDP session proved it: the eval never ran). The emitted
        // script must be (a) syntactically valid JS and (b) route through
        // the REAL window.open so the shell's popup host receives the URL —
        // /send?phone has NO in-app route (WhatsApp keeps chats out of the
        // URL), so any in-page navigation trick is dead on arrival.
        let script =
            whatsapp_soft_navigation_script("https://web.whatsapp.com/send?phone=6281234567890");
        // Valid JS: the IIFE is CALLED with parentheses around the argument.
        assert!(script.contains("})(\""), "IIFE must be invoked: `)(url);`");
        assert!(script.ends_with(");"));
        // Sanity: balanced parens (a cheap SyntaxError tripwire).
        let open = script.matches('(').count();
        let close = script.matches(')').count();
        assert_eq!(
            open, close,
            "unbalanced parens = SyntaxError = silent no-op"
        );
        // It goes through window.open — the popup host path.
        assert!(script.contains("window.open(url, '_blank')"));
        // No in-page navigation tricks remain (all proven dead live).
        assert!(!script.contains("pushState"));
        assert!(!script.contains("a.click()"));
        assert!(!script.contains("location.href = url"));
        // The URL is embedded JSON-quoted.
        assert!(script.contains("\"https://web.whatsapp.com/send?phone=6281234567890\""));
    }

    #[test]
    fn deep_link_delivery_targets_the_bridge_open_by_phone() {
        // The drain path hands the phone to the bridge's
        // __whatsnowOpenChatByPhone (row match → trusted click; unknown →
        // deliberately nothing). The eval script must call it with the JSON
        // phone.
        let script = deep_link_open_by_phone_script("6281234567890");
        assert!(script.contains("__whatsnowOpenChatByPhone"));
        assert!(script.contains("\"6281234567890\""));
        // Absent bridge degrades to a logged no-op string, not a throw.
        assert!(script.contains("'no-bridge'"));
        // The promise chain swallows rejections (no unhandled rejection).
        assert!(script.contains(".catch("));
    }

    #[test]
    fn popup_reuse_script_is_json_quoted_location_replace() {
        // The content-popup reuse path navigates via `location.replace` eval
        // (navigate() is a proven silent no-op inside the new-window handler).
        // The URL must arrive JSON-quoted so quotes/backslashes in it cannot
        // break out of the string literal (same class of emission bug as the
        // IIFE SyntaxError that silently killed deep links).
        let script = super::popup_reuse_replace_script(
            "https://api.whatsapp.com/send/?phone=6281234567890&text&type=phone_number&app_absent=0",
        );
        assert!(script.starts_with("try { window.location.replace(\""));
        assert!(script.ends_with("\"); } catch (e) {}"));
        assert!(script.contains("app_absent=0\""));
        // A quote-bearing URL stays inside the literal (JSON escaping).
        let evil = super::popup_reuse_replace_script("https://wa.me/");
        assert!(evil.contains("\"https://wa.me/\""));
    }

    #[test]
    fn every_user_listed_whatsapp_host_stays_inside_whatsnow() {
        // The user's list of hosts that must "open WhatsNow, not the browser":
        // every one of them is in the family, on either scheme, in any case.
        for host in [
            "api.whatsapp.com",
            "www.whatsapp.com",
            "event.whatsapp.com",
            "call.whatsapp.com",
            "wa.me",
            "v.whatsapp.com",
            "whatsapp.com",
            "chat.whatsapp.com",
            "web.whatsapp.com",
        ] {
            let https = tauri::Url::parse(&format!("https://{host}/x")).unwrap();
            let http = tauri::Url::parse(&format!("http://{host}/x")).unwrap();
            assert!(whatsapp_family_host(&https), "{host} must be in the family");
            assert!(whatsapp_family_host(&http), "{host} must be in the family");
            assert!(
                !external_web_url(&https),
                "{host} must not go to the browser"
            );
            let upper = tauri::Url::parse(&format!("https://{}/x", host.to_uppercase())).unwrap();
            assert!(
                whatsapp_family_host(&upper),
                "{host} match is case-insensitive"
            );
        }
    }

    #[test]
    fn family_matching_is_exact_and_never_swallows_lookalikes() {
        // Subdomain suffixing is the classic spoof: none of these may match.
        for hostile in [
            "https://web.whatsapp.com.evil.example.com/call",
            "https://wa.me.evil.example.com/x",
            "https://whatsapp.com.example.com/x",
            "https://evilsite.com/?url=wa.me",
            "https://wa.me.evil/x",
        ] {
            let url = tauri::Url::parse(hostile).unwrap();
            assert!(!whatsapp_family_host(&url), "{hostile} must NOT be family");
            assert!(external_web_url(&url), "{hostile} must go to the browser");
        }
        // A path that merely MENTIONS a family host is not the host itself.
        let deep = tauri::Url::parse("https://example.com/redirect?url=https://wa.me/123").unwrap();
        assert!(external_web_url(&deep));
        // Subdomains NOT on the user's list keep today's browser flow.
        let faq = tauri::Url::parse("https://faq.whatsapp.com/x").unwrap();
        assert!(external_web_url(&faq));
    }

    #[test]
    fn call_links_now_open_inside_whatsnow() {
        // The 2.6.0 regression fix narrowed to web.whatsapp.com only; the
        // link-routing extension must let call/invite links spawn/reuse a
        // window instead of falling to the external browser.
        for link in [
            "https://call.whatsapp.com/abc123",
            "https://chat.whatsapp.com/inviteCode",
            "https://wa.me/15551234567",
        ] {
            let url = tauri::Url::parse(link).unwrap();
            assert!(whatsapp_popup_allowed(&url), "{link} may open a window");
            assert!(!external_web_url(&url), "{link} stays inside WhatsNow");
        }
        // Plain-http and non-WhatsApp hosts still never spawn windows.
        assert!(!whatsapp_popup_allowed(
            &tauri::Url::parse("http://wa.me/1").unwrap()
        ));
        assert!(!whatsapp_popup_allowed(
            &tauri::Url::parse("https://example.com/x").unwrap()
        ));
    }

    #[test]
    fn call_urls_keep_their_dedicated_window() {
        // Call stages are the one family URL with special window behavior
        // (always-on-top, dedicated per-call window — the 2.6.0 fix).
        assert!(is_whatsapp_call_url(
            &tauri::Url::parse("https://call.whatsapp.com/abc123").unwrap()
        ));
        assert!(is_whatsapp_call_url(
            &tauri::Url::parse("https://CALL.WHATSAPP.COM/abc").unwrap()
        ));
        // Every other family host is content, not a call stage.
        for link in [
            "https://chat.whatsapp.com/invite",
            "https://wa.me/15551234567",
            "https://www.whatsapp.com/privacy",
            "https://web.whatsapp.com/send?phone=1",
        ] {
            assert!(
                !is_whatsapp_call_url(&tauri::Url::parse(link).unwrap()),
                "{link}"
            );
        }
    }

    #[test]
    fn only_whatsapp_pages_may_spawn_a_call_popup() {
        // The Web Calling call stage arrives as window.open on the SAME origin.
        // Anything else must keep the old behavior (external browser / deny) —
        // a broad allow would let any page spawn app windows.
        let allowed = |s: &str| super::whatsapp_popup_allowed(&tauri::Url::parse(s).unwrap());
        assert!(allowed("https://web.whatsapp.com/call/ABC123"));
        assert!(
            allowed("https://WEB.WHATSAPP.com/"),
            "host match is case-insensitive"
        );
        assert!(
            !allowed("http://web.whatsapp.com/"),
            "plain http never spawns a window"
        );
        assert!(!allowed("https://evil.example.com/call"));
        assert!(!allowed("https://web.whatsapp.com.evil.example.com/"));
        assert!(!allowed("file:///C:/private.txt"));
    }

    #[cfg(windows)]
    #[test]
    fn windows_media_permission_set_is_exactly_mic_camera_window_management() {
        // Pins the auto-allow set: WhatsApp's media features (mic, camera) plus
        // the call stage's window-management controls. Adding anything else
        // here silently broadens what every WhatsApp page may silently access.
        use webview2_com::Microsoft::Web::WebView2::Win32::{
            COREWEBVIEW2_PERMISSION_KIND_CAMERA, COREWEBVIEW2_PERMISSION_KIND_CLIPBOARD_READ,
            COREWEBVIEW2_PERMISSION_KIND_GEOLOCATION, COREWEBVIEW2_PERMISSION_KIND_MICROPHONE,
            COREWEBVIEW2_PERMISSION_KIND_NOTIFICATIONS,
            COREWEBVIEW2_PERMISSION_KIND_WINDOW_MANAGEMENT,
        };
        let allowed = super::windows_permission_allowed;
        assert!(allowed(COREWEBVIEW2_PERMISSION_KIND_MICROPHONE));
        assert!(allowed(COREWEBVIEW2_PERMISSION_KIND_CAMERA));
        assert!(allowed(COREWEBVIEW2_PERMISSION_KIND_WINDOW_MANAGEMENT));
        assert!(!allowed(COREWEBVIEW2_PERMISSION_KIND_GEOLOCATION));
        assert!(!allowed(COREWEBVIEW2_PERMISSION_KIND_CLIPBOARD_READ));
        assert!(!allowed(COREWEBVIEW2_PERMISSION_KIND_NOTIFICATIONS));
    }

    #[test]
    fn call_window_size_clamps_to_the_work_area() {
        // Pure clamp math mirrored from clamped_logical_size (the helper takes
        // an AppHandle, which tests cannot construct): physical work area /
        // scale factor = logical ceiling; never below the 320px floor.
        let clamp = |w: f64, h: f64, work_w: f64, work_h: f64, scale: f64| {
            let aw = work_w / scale * 0.96;
            let ah = work_h / scale * 0.96;
            (w.min(aw).max(320.0), h.min(ah).max(320.0))
        };
        // 1080p at 100%: WhatsApp's typical 940x640 call stage fits untouched.
        assert_eq!(clamp(940.0, 640.0, 1920.0, 1040.0, 1.0), (940.0, 640.0));
        // 1366x768 laptop at 100%: the 1100x800 default chat shrinks to fit.
        let (w, h) = clamp(1100.0, 800.0, 1366.0, 728.0, 1.0);
        assert!(
            w <= 1366.0 * 0.96 && h <= 728.0 * 0.96,
            "must fit the work area"
        );
        // 125% DPI on 1920x1080: logical size is 1536x864 — the old fixed
        // 1100x800 fit, but a maximized-request 1400x900 popup must clamp.
        let (w, h) = clamp(1400.0, 900.0, 1920.0, 1040.0, 1.25);
        assert!(w <= 1920.0 / 1.25 * 0.96 && h <= 1040.0 / 1.25 * 0.96);
        // Absurd tiny monitor: each axis clamps to min(available*0.96, floor
        // 320 reversed: max(available*0.96, 320)) — width 384 = 400*0.96 stays
        // above the floor, height 288 floors up to 320 so it stays usable.
        assert_eq!(clamp(940.0, 640.0, 400.0, 300.0, 1.0), (384.0, 320.0));
    }

    #[test]
    fn chrome_ua_and_bridge_client_hints_agree_on_the_version() {
        // The UA header (Rust) and the client-hints shim (bridge.js) must present the
        // same Chrome major version, or WhatsApp sees an inconsistent browser.
        let major = CHROME_UA
            .split("Chrome/")
            .nth(1)
            .and_then(|s| s.split('.').next())
            .expect("CHROME_UA carries a Chrome/<major> token");
        let bridge = include_str!("../resources/bridge.js");
        assert!(
            bridge.contains(&format!("version: \"{major}\"")),
            "bridge.js client hints must advertise Chrome {major}"
        );
        assert!(
            bridge.contains(&format!("uaFullVersion: \"{major}.0.0.0\"")),
            "bridge.js uaFullVersion must advertise Chrome {major}"
        );
    }

    #[test]
    fn absolute_download_destination_is_kept() {
        // A Unix "/..." path is NOT absolute on Windows (no drive letter), so give
        // each platform a path that is genuinely absolute there.
        #[cfg(windows)]
        let abs = "C:\\Users\\user\\Downloads\\video.mp4";
        #[cfg(not(windows))]
        let abs = "/home/user/Downloads/video.mp4";
        let mut d = std::path::PathBuf::from(abs);
        ensure_download_destination(&mut d, Some(std::path::PathBuf::from("/elsewhere")));
        assert_eq!(d, std::path::PathBuf::from(abs));
    }

    #[test]
    fn empty_download_destination_falls_back_to_download_dir() {
        let mut d = std::path::PathBuf::new();
        ensure_download_destination(&mut d, Some(std::path::PathBuf::from("/dl")));
        assert_eq!(d, std::path::PathBuf::from("/dl/download"));
    }

    #[test]
    fn relative_download_destination_moves_into_download_dir() {
        let mut d = std::path::PathBuf::from("clip.mp4");
        ensure_download_destination(&mut d, Some(std::path::PathBuf::from("/dl")));
        assert_eq!(d, std::path::PathBuf::from("/dl/clip.mp4"));
    }

    #[test]
    fn missing_download_dir_falls_back_to_temp() {
        let mut d = std::path::PathBuf::from("clip.mp4");
        ensure_download_destination(&mut d, None);
        assert_eq!(d, std::env::temp_dir().join("clip.mp4"));
    }

    #[test]
    fn base64_matches_rfc4648_vectors() {
        // The canonical RFC 4648 test vectors, including every padding case.
        assert_eq!(base64_encode(b""), "");
        assert_eq!(base64_encode(b"f"), "Zg==");
        assert_eq!(base64_encode(b"fo"), "Zm8=");
        assert_eq!(base64_encode(b"foo"), "Zm9v");
        assert_eq!(base64_encode(b"foob"), "Zm9vYg==");
        assert_eq!(base64_encode(b"fooba"), "Zm9vYmE=");
        assert_eq!(base64_encode(b"foobar"), "Zm9vYmFy");
    }

    #[test]
    fn base64_handles_high_bytes() {
        assert_eq!(base64_encode(&[0xff, 0xff, 0xff]), "////");
        assert_eq!(base64_encode(&[0x00]), "AA==");
    }

    // Write `bytes` to a unique temp file and return its path. Caller removes it.
    fn write_temp(tag: &str, bytes: &[u8]) -> std::path::PathBuf {
        use std::io::Write;
        let p = std::env::temp_dir().join(format!(
            "whatsnow_test_{}_{}_{tag}",
            std::process::id(),
            bytes.len()
        ));
        std::fs::File::create(&p).unwrap().write_all(bytes).unwrap();
        p
    }

    #[test]
    fn stream_chunks_matches_oneshot_encoding() {
        // Sizes covering: below one chunk (every length-mod-3 case), exactly one
        // chunk, and just past a chunk boundary — chunk concatenation must equal
        // the one-shot base64 of the whole input (non-final chunks are unpadded
        // because DROP_CHUNK_BYTES is a multiple of 3).
        for len in [
            0usize,
            1,
            2,
            3,
            48 * 1024 + 1,
            DROP_CHUNK_BYTES,
            DROP_CHUNK_BYTES + 1,
            DROP_CHUNK_BYTES + 2,
        ] {
            let data: Vec<u8> = (0..len)
                .map(|i| (i.wrapping_mul(31).wrapping_add(7)) as u8)
                .collect();
            let mut got = String::new();
            let mut chunks = 0usize;
            stream_chunks(&mut &data[..], len as u64, |b64| {
                chunks += 1;
                got.push_str(b64);
                Ok(())
            })
            .unwrap_or_else(|_| panic!("stream failed at len={len}"));
            assert_eq!(got, base64_encode(&data), "mismatch at len={len}");
            let expect_chunks = std::cmp::max(1, len.div_ceil(DROP_CHUNK_BYTES));
            assert_eq!(chunks, expect_chunks, "chunk count at len={len}");
        }
    }

    #[test]
    fn stream_chunks_rejects_shrunk_and_grown_files() {
        // The reader enforces the planned size: fewer bytes than promised (file
        // truncated mid-read) or extra bytes past it (file grew) must abort with
        // Changed — the old code silently read to EOF, bypassing the size cap.
        let data = [7u8; 100];
        let shrunk = stream_chunks(&mut &data[..], 200, |_| Ok(()));
        assert!(matches!(shrunk, Err(StreamAbort::Changed)), "shrunk file");
        let grown = stream_chunks(&mut &data[..], 50, |_| Ok(()));
        assert!(matches!(grown, Err(StreamAbort::Changed)), "grown file");
    }

    #[test]
    fn plan_drop_applies_per_file_and_total_caps_with_feedback() {
        let small = write_temp("ok.mp4", &[1u8; 32]);
        let dir = std::env::temp_dir();
        let missing = std::path::PathBuf::from("/nonexistent/whatsnow/gone.bin");
        let (planned, skips) = plan_drop(&[small.clone(), dir, missing]);
        let _ = std::fs::remove_file(&small);
        assert_eq!(planned.len(), 1);
        assert_eq!(planned[0].mime, "video/mp4");
        assert_eq!(planned[0].len, 32);
        assert_eq!(skips.not_file, 1);
        assert_eq!(skips.unreadable, 1);
        assert_eq!(skips.total(), 2);
        // The toast summary names both reasons, never file names.
        let s = summarize_skips(&skips);
        assert!(s.contains("folder"), "{s}");
        assert!(s.contains("unreadable"), "{s}");
        assert!(!s.contains("ok.mp4"), "{s}");
    }

    #[test]
    fn plan_drop_counts_only_valid_files_toward_the_cap() {
        // 30 invalid paths followed by one valid file: the valid file must still be
        // planned (the old `take(30)` burned slots on the invalid entries).
        let valid = write_temp("late.png", &[9u8; 8]);
        let mut paths: Vec<std::path::PathBuf> = (0..MAX_DROP_FILES)
            .map(|i| std::path::PathBuf::from(format!("/nonexistent/whatsnow/{i}.bin")))
            .collect();
        paths.push(valid.clone());
        let (planned, skips) = plan_drop(&paths);
        let _ = std::fs::remove_file(&valid);
        assert_eq!(planned.len(), 1, "valid 31st file must survive");
        assert_eq!(skips.unreadable, MAX_DROP_FILES);
        assert_eq!(skips.over_count, 0);
    }

    #[test]
    fn plan_drop_enforces_the_aggregate_budget() {
        use std::io::Write;
        // Three sparse-ish files of 150 MB nominal size would blow the 300 MB batch
        // budget on the third. Use set_len to avoid writing real gigabytes.
        let mut paths = Vec::new();
        for i in 0..3 {
            let p = std::env::temp_dir().join(format!(
                "whatsnow_test_{}_budget_{i}.bin",
                std::process::id()
            ));
            let f = std::fs::File::create(&p).unwrap();
            f.set_len(90 * 1024 * 1024).unwrap();
            drop(f);
            // touch so metadata is fresh
            std::fs::OpenOptions::new()
                .append(true)
                .open(&p)
                .unwrap()
                .flush()
                .unwrap();
            paths.push(p);
        }
        // 90+90+90 = 270 MB fits; add a 4th to cross 300 MB.
        let extra = std::env::temp_dir().join(format!(
            "whatsnow_test_{}_budget_extra.bin",
            std::process::id()
        ));
        let f = std::fs::File::create(&extra).unwrap();
        f.set_len(90 * 1024 * 1024).unwrap();
        drop(f);
        paths.push(extra.clone());
        let (planned, skips) = plan_drop(&paths);
        for p in &paths {
            let _ = std::fs::remove_file(p);
        }
        assert_eq!(planned.len(), 3, "first 270 MB fit the 300 MB budget");
        assert_eq!(
            skips.over_budget, 1,
            "the 4th file exceeds the batch budget"
        );
    }

    #[test]
    fn drop_messages_are_well_formed_and_guarded() {
        assert!(drop_msg_reserve(7).contains("\"reserve\""));
        let begin = drop_msg_begin(7, 0, "a \"quoted\" name.mp4", "video/mp4", 42);
        assert!(begin.starts_with("window.__whatsnowDropFeed&&"));
        assert!(
            begin.contains("\\\"quoted\\\""),
            "name must be JSON-escaped"
        );
        assert!(begin.contains("size:42"));
        let prefix = drop_msg_chunk_prefix(7, 0);
        assert!(prefix.ends_with("b64:\""));
        assert!(DROP_MSG_CHUNK_SUFFIX.starts_with('"'));
        assert!(drop_msg_end(7, 0).contains("\"end\""));
        // Commit uses a ternary so a missing handler acks "NOHANDLER" instead of
        // silently evaluating to undefined.
        let commit = drop_msg_commit(7, 3);
        assert!(commit.contains("?window.__whatsnowDropFeed("));
        assert!(commit.ends_with(":\"NOHANDLER\""));
    }

    #[test]
    fn skip_summary_reads_naturally_for_single_reasons() {
        let s = summarize_skips(&DropSkips {
            too_large: 1,
            ..Default::default()
        });
        assert_eq!(s, "Not attached: 1 file over the 100 MB size limit.");
    }

    #[test]
    fn mime_is_extension_and_case_insensitive() {
        assert_eq!(mime_for("Photo.JPG"), "image/jpeg");
        assert_eq!(mime_for("clip.mp4"), "video/mp4");
        assert_eq!(mime_for("doc.pdf"), "application/pdf");
        assert_eq!(mime_for("noext"), "application/octet-stream");
        assert_eq!(mime_for("archive.unknownext"), "application/octet-stream");
    }

    #[test]
    fn modern_image_types_resolve_to_image_so_they_route_as_photos() {
        // The routing fix: bridge.js sends anything `image/*` to the Photos composer. These
        // used to fall through to octet-stream and were mis-attached as documents.
        for n in ["pic.avif", "IMG_1.HEIF", "shot.heic"] {
            assert!(
                mime_for(n).starts_with("image/"),
                "{n} should resolve to an image/* type, got {}",
                mime_for(n)
            );
        }
        // Niche raster formats are deliberately NOT routed as photos (WhatsApp's photo
        // composer may reject them) — they stay documents, which always sends.
        for n in ["scan.tiff", "icon.ico", "frames.apng"] {
            assert_eq!(
                mime_for(n),
                "application/octet-stream",
                "{n} should stay a document"
            );
        }
    }

    #[test]
    fn new_av_and_doc_types_have_specific_labels() {
        assert_eq!(mime_for("song.flac"), "audio/flac");
        assert_eq!(mime_for("clip.aac"), "audio/aac");
        assert_eq!(mime_for("movie.mpeg"), "video/mpeg");
        assert_eq!(mime_for("notes.md"), "text/markdown");
        assert_eq!(mime_for("data.json"), "application/json");
        assert_eq!(mime_for("Archive.7Z"), "application/x-7z-compressed");
        assert_eq!(mime_for("book.epub"), "application/epub+zip");
        // Unknown extensions still fall back so the file always sends.
        assert_eq!(mime_for("mystery.qwerty"), "application/octet-stream");
    }

    #[test]
    fn standard_extension_aliases_route_like_their_canonical_forms() {
        // Aliases straight out of the freedesktop MIME database; these used to fall
        // through to octet-stream and mis-route photos/videos as documents.
        assert_eq!(mime_for("shot.jpe"), "image/jpeg");
        assert_eq!(mime_for("clip.3gpp"), "video/3gpp");
        assert_eq!(mime_for("movie.qt"), "video/quicktime");
        assert_eq!(mime_for("pic.hif"), "image/heif");
        assert_eq!(mime_for("clip.3gp2"), "video/3gpp2");
    }

    #[test]
    fn visible_active_window_is_hidden() {
        assert_eq!(toggle_decision(Some(true)), ToggleAct::Hide);
    }

    #[test]
    fn visible_windows_never_drop_to_low_memory_even_unfocused() {
        // The video-audio guard: a VISIBLE window (focused or not, minimized or
        // not) must stay at the NORMAL memory target. The old focus-only policy
        // set LOW the moment focus left, and clicking play inside a video does
        // not re-raise Focused(true) — LOW then swapped the audio graph out and
        // the clip played silently.
        let low = super::windows_memory_low;
        assert!(!low(true, false, true), "visible+focused stays NORMAL");
        assert!(
            !low(true, false, false),
            "visible+unfocused stays NORMAL (media guard)"
        );
        assert!(low(false, false, false), "hidden to tray goes LOW");
        assert!(
            low(false, false, true),
            "hidden but focused (transient) goes LOW"
        );
        assert!(
            low(true, true, true),
            "minimized goes LOW even if visible flag lingers"
        );
        assert!(low(false, true, false), "hidden+minimized goes LOW");
    }

    #[test]
    fn hidden_active_window_is_shown() {
        assert_eq!(toggle_decision(Some(false)), ToggleAct::Show);
    }

    #[test]
    fn no_active_window_is_shown() {
        assert_eq!(toggle_decision(None), ToggleAct::Show);
    }
}
