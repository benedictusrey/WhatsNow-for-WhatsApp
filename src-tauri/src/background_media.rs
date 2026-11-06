//! Background media priority for WhatsNow, maintained by @benedictusrey.
#[cfg(windows)]
pub fn configure(webview: &tauri::webview::PlatformWebview) -> Result<(), String> {
    use webview2_com::Microsoft::Web::WebView2::Win32::{
        ICoreWebView2_19, COREWEBVIEW2_MEMORY_USAGE_TARGET_LEVEL_NORMAL,
    };
    use windows_core::Interface;
    // SAFETY: callers use with_webview on the controller's owning UI thread.
    unsafe {
        webview
            .controller()
            .CoreWebView2()
            .and_then(|core| core.cast::<ICoreWebView2_19>())
            .and_then(|core| {
                core.SetMemoryUsageTargetLevel(COREWEBVIEW2_MEMORY_USAGE_TARGET_LEVEL_NORMAL)
            })
            .map_err(|error| error.to_string())
    }
}
