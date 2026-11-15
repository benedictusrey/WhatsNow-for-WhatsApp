//! WhatsNow call child construction, maintained by @benedictusrey.
//! Shared with the isolated native WebView2 smoke fixture.
use std::time::Instant;
use tauri::webview::PageLoadEvent;
use tauri::{AppHandle, WebviewUrl, WebviewWindowBuilder, Wry};

pub fn initial_url() -> tauri::Url {
    tauri::Url::parse("about:blank").expect("valid blank popup URL")
}

/// WebView2 destroys only its inner container when the page calls
/// `window.close()`, which is exactly what WhatsApp's call page does at hang-up:
/// the native frame stayed behind as an empty dark window. Close the whole window
/// when its page asks to close.
#[cfg(target_os = "windows")]
pub fn close_window_with_page(window: &tauri::WebviewWindow) {
    use tauri::Manager;
    use webview2_com::WindowCloseRequestedEventHandler;

    let app = window.app_handle().clone();
    let label = window.label().to_string();
    let _ = window.with_webview(move |webview| {
        // SAFETY: with_webview runs on the UI thread that owns the controller;
        // these are standard WebView2 COM calls.
        unsafe {
            let Ok(core) = webview.controller().CoreWebView2() else {
                return;
            };
            let handler = WindowCloseRequestedEventHandler::create(Box::new(move |_, _| {
                crate::dlog::log("call window: page closed, closing the window");
                let app_for_close = app.clone();
                let label = label.clone();
                // Never destroy a window from inside the engine's event callback.
                let _ = app.run_on_main_thread(move || {
                    if let Some(window) = app_for_close.get_webview_window(&label) {
                        let _ = window.destroy();
                    }
                });
                Ok(())
            }));
            let mut token: i64 = 0;
            let _ = core.add_WindowCloseRequested(&handler, &mut token);
        }
    });
}

#[cfg(not(target_os = "windows"))]
pub fn close_window_with_page(_window: &tauri::WebviewWindow) {}

/// Preserve the engine's pending popup navigation and permit native sizing.
/// The caller must attach the opener's environment before building the child.
pub fn builder<'a>(app: &'a AppHandle, label: &str) -> WebviewWindowBuilder<'a, Wry, AppHandle> {
    let created = Instant::now();
    let make = || {
        let load_label = label.to_string();
        WebviewWindowBuilder::new(app, label, WebviewUrl::External(initial_url()))
            .title("WhatsNow — Call")
            .min_inner_size(320.0, 240.0)
            .resizable(true)
            .maximizable(true)
            .minimizable(true)
            .closable(true)
            .decorations(true)
            // Dark client area so the window never flashes white before the
            // call page paints (matches the dark call UI).
            .background_color(tauri::window::Color(0x0b, 0x12, 0x10, 0xff))
            .visible(true)
            .focused(true)
            .initialization_script(include_str!("../resources/call-media.js"))
            // Connecting frame + close-when-the-call-ends (call hosts only).
            .initialization_script(include_str!("../resources/call-lifecycle.js"))
            // Timing only (no URLs or content): how long the call window takes
            // to show its page, so a slow open is measurable in release builds.
            .on_page_load(move |_window, payload| {
                if payload.event() == PageLoadEvent::Finished {
                    crate::dlog::log(&format!(
                        "call window {load_label}: page loaded {} ms after creation",
                        created.elapsed().as_millis()
                    ));
                }
            })
    };
    // The call window carries the WhatsNow icon like every other window; a
    // missing or unreadable icon must never stop a call from opening.
    match tauri::image::Image::from_bytes(crate::window::APP_ICON)
        .and_then(|icon| make().icon(icon))
    {
        Ok(builder) => builder,
        Err(_) => make(),
    }
}
