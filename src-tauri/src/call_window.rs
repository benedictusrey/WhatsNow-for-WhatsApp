//! WhatsNow call child construction, maintained by @benedictusrey.
//! Shared with the isolated native WebView2 smoke fixture.
use tauri::{AppHandle, WebviewUrl, WebviewWindowBuilder, Wry};

pub fn initial_url() -> tauri::Url {
    tauri::Url::parse("about:blank").expect("valid blank popup URL")
}

/// Preserve the engine's pending popup navigation and permit native sizing.
/// The caller must attach the opener's environment before building the child.
pub fn builder<'a>(app: &'a AppHandle, label: &str) -> WebviewWindowBuilder<'a, Wry, AppHandle> {
    let make = || {
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
