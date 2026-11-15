//! WhatsNow call child construction, maintained by @benedictusrey.
//! Shared with the isolated native WebView2 smoke fixture.
use std::sync::atomic::{AtomicBool, Ordering};
use std::sync::Arc;
use std::time::Instant;
use tauri::webview::PageLoadEvent;
use tauri::{AppHandle, Manager, WebviewUrl, WebviewWindowBuilder, Wry};

pub fn initial_url() -> tauri::Url {
    tauri::Url::parse("about:blank").expect("valid blank popup URL")
}

/// What to do when a call window is about to navigate.
#[derive(Debug, PartialEq, Eq)]
pub enum CallNavigation {
    /// Not a call concern: let the page go there (unchanged behavior).
    Allow,
    /// A call stage page: allow it and remember that the call UI was shown.
    AllowCallPage,
    /// The call page was replaced by an empty/home page: the call is over.
    Close,
}

/// Backstop for the in-page watcher (`call-lifecycle.js`). Once a call stage has
/// loaded, a navigation to a blank page or the web.whatsapp.com home page means
/// the call ended and would otherwise leave an empty window behind. Anything
/// else (help pages, links) is allowed, so a live call is never cut off.
pub fn classify_navigation(seen_call_page: bool, url: &tauri::Url) -> CallNavigation {
    if crate::window::is_whatsapp_call_url(url) {
        return CallNavigation::AllowCallPage;
    }
    if !seen_call_page {
        return CallNavigation::Allow;
    }
    let blank = url.as_str() == "about:blank";
    let home = url.scheme() == "https"
        && url
            .host_str()
            .is_some_and(|host| host.eq_ignore_ascii_case("web.whatsapp.com"))
        && url.path() == "/";
    if blank || home {
        CallNavigation::Close
    } else {
        CallNavigation::Allow
    }
}

/// Preserve the engine's pending popup navigation and permit native sizing.
/// The caller must attach the opener's environment before building the child.
pub fn builder<'a>(app: &'a AppHandle, label: &str) -> WebviewWindowBuilder<'a, Wry, AppHandle> {
    let created = Instant::now();
    let make = || {
        let seen_call_page = Arc::new(AtomicBool::new(false));
        let nav_app = app.clone();
        let nav_label = label.to_string();
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
            .on_navigation(move |url| match classify_navigation(
                seen_call_page.load(Ordering::Relaxed),
                url,
            ) {
                CallNavigation::Allow => true,
                CallNavigation::AllowCallPage => {
                    seen_call_page.store(true, Ordering::Relaxed);
                    true
                }
                CallNavigation::Close => {
                    crate::dlog::log("call window: closed after the call page was replaced");
                    let app = nav_app.clone();
                    let label = nav_label.clone();
                    let _ = nav_app.run_on_main_thread(move || {
                        if let Some(window) = app.get_webview_window(&label) {
                            let _ = window.destroy();
                        }
                    });
                    false
                }
            })
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

#[cfg(test)]
mod tests {
    use super::{classify_navigation, CallNavigation};

    fn url(value: &str) -> tauri::Url {
        tauri::Url::parse(value).unwrap()
    }

    #[test]
    fn call_pages_are_allowed_and_remembered() {
        for link in [
            "https://call.whatsapp.com/video/abc",
            "https://web.whatsapp.com/call/abc",
            "https://web.whatsapp.com/call",
        ] {
            assert_eq!(classify_navigation(false, &url(link)), CallNavigation::AllowCallPage);
            assert_eq!(classify_navigation(true, &url(link)), CallNavigation::AllowCallPage);
        }
    }

    #[test]
    fn before_a_call_page_loaded_nothing_closes_the_window() {
        // The engine first loads about:blank into a new popup, then supplies the
        // call URL: the initial blank must never close it.
        assert_eq!(classify_navigation(false, &url("about:blank")), CallNavigation::Allow);
        assert_eq!(
            classify_navigation(false, &url("https://web.whatsapp.com/")),
            CallNavigation::Allow
        );
    }

    #[test]
    fn a_blank_or_home_page_after_the_call_closes_the_window() {
        assert_eq!(classify_navigation(true, &url("about:blank")), CallNavigation::Close);
        assert_eq!(
            classify_navigation(true, &url("https://web.whatsapp.com/")),
            CallNavigation::Close
        );
    }

    #[test]
    fn other_navigations_never_cut_a_call_off() {
        for link in [
            "https://faq.whatsapp.com/help",
            "https://web.whatsapp.com/send?phone=1",
            "https://web.whatsapp.com.evil.example/",
            "https://example.com/",
        ] {
            assert_eq!(classify_navigation(true, &url(link)), CallNavigation::Allow, "{link}");
        }
    }
}
