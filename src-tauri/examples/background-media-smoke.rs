//! Native WebView2 lifecycle/media check for WhatsNow, by @benedictusrey.
//! Uses an isolated profile, synthetic audio/video, and no device permissions.
#[cfg(windows)]
fn main() {
    use std::io::{Read, Write};
    use std::net::TcpListener;
    use std::sync::mpsc;
    use std::time::Duration;
    use tauri::{WebviewUrl, WebviewWindow, WebviewWindowBuilder};
    use webview2_com::Microsoft::Web::WebView2::Win32::{
        ICoreWebView2_19, ICoreWebView2_8, COREWEBVIEW2_MEMORY_USAGE_TARGET_LEVEL_LOW,
        COREWEBVIEW2_MEMORY_USAGE_TARGET_LEVEL_NORMAL,
    };
    use windows_core::Interface;

    fn native_state(window: &WebviewWindow, low: bool) -> Result<(bool, bool), String> {
        let (sender, receiver) = mpsc::channel();
        window
            .with_webview(move |webview| {
                let result = (|| {
                    // SAFETY: with_webview executes on this controller's UI thread.
                    unsafe {
                        let core = webview
                            .controller()
                            .CoreWebView2()
                            .map_err(|e| e.to_string())?;
                        let memory = core.cast::<ICoreWebView2_19>().map_err(|e| e.to_string())?;
                        if low {
                            memory
                                .SetMemoryUsageTargetLevel(
                                    COREWEBVIEW2_MEMORY_USAGE_TARGET_LEVEL_LOW,
                                )
                                .map_err(|e| e.to_string())?;
                        }
                        let mut level = COREWEBVIEW2_MEMORY_USAGE_TARGET_LEVEL_LOW;
                        memory
                            .MemoryUsageTargetLevel(&mut level)
                            .map_err(|e| e.to_string())?;
                        let mut playing = windows_core::BOOL::default();
                        core.cast::<ICoreWebView2_8>()
                            .map_err(|e| e.to_string())?
                            .IsDocumentPlayingAudio(&mut playing)
                            .map_err(|e| e.to_string())?;
                        Ok((
                            level == COREWEBVIEW2_MEMORY_USAGE_TARGET_LEVEL_NORMAL,
                            playing.as_bool(),
                        ))
                    }
                })();
                let _ = sender.send(result);
            })
            .map_err(|e| e.to_string())?;
        receiver
            .recv_timeout(Duration::from_secs(10))
            .map_err(|e| e.to_string())?
    }

    let _identity = if std::env::args().any(|arg| arg == "--audio-identity") {
        Some(
            whatsnow_lib::audio_identity::AudioSessionIdentityGuard::start()
                .expect("audio identity worker"),
        )
    } else {
        None
    };
    let registrar = _identity.as_ref().map(|identity| identity.registrar());
    let listener = TcpListener::bind("127.0.0.1:0").expect("fixture listener");
    let address = listener.local_addr().unwrap();
    std::thread::spawn(move || {
        for stream in listener.incoming() {
            let Ok(mut stream) = stream else { break };
            let _ = stream.set_read_timeout(Some(Duration::from_secs(3)));
            let mut request = [0; 4096];
            let _ = stream.read(&mut request);
            let body = include_str!("background-media.html");
            let _ = write!(stream, "HTTP/1.1 200 OK\r\nContent-Type: text/html\r\nContent-Length: {}\r\nConnection: close\r\n\r\n{}", body.len(), body);
        }
    });
    let baseline = std::env::args().any(|arg| arg == "--baseline-low");
    let status = std::sync::Arc::new(std::sync::atomic::AtomicI32::new(1));
    let result_status = status.clone();
    let (sender, receiver) = mpsc::channel::<serde_json::Value>();
    let mut context = tauri::generate_context!();
    context.config_mut().identifier = "app.whatsnow.background-media-smoke".into();
    let app = tauri::Builder::default().setup(move |app| {
        let window = WebviewWindowBuilder::new(app, "media-fixture",
            WebviewUrl::External(format!("http://{address}/").parse().unwrap()))
            .title("WhatsNow isolated background media test")
            .data_directory(std::env::temp_dir().join(format!("WhatsNow-media-smoke-{}", std::process::id())))
            // Fixture-only autoplay, never applied to the production app.
            .additional_browser_args("--autoplay-policy=no-user-gesture-required")
            .on_document_title_changed(move |_, title| {
                if let Ok(value) = serde_json::from_str(&title) { let _ = sender.send(value); }
            }).build()?;
        window.with_webview(move |webview| {
            if let Some(registrar) = registrar { registrar.attach(&webview).expect("authoritative environment registration"); }
            // SAFETY: this callback owns the controller's UI thread. Seed LOW
            // so a missing/no-op production configuration cannot pass by default.
            unsafe {
                webview.controller().CoreWebView2().unwrap()
                    .cast::<ICoreWebView2_19>().unwrap()
                    .SetMemoryUsageTargetLevel(COREWEBVIEW2_MEMORY_USAGE_TARGET_LEVEL_LOW).unwrap();
            }
            whatsnow_lib::background_media::configure(&webview).expect("NORMAL media priority");
        })?;
        let handle = app.handle().clone();
        std::thread::spawn(move || {
            let result = (|| -> Result<(), String> {
                let first = receiver.recv_timeout(Duration::from_secs(30)).map_err(|e| e.to_string())?;
                if first.get("error").is_some() { return Err(first.to_string()); }
                let snapshot = || -> Result<serde_json::Value, String> {
                    while receiver.try_recv().is_ok() {}
                    window.eval("window.snapshot()").map_err(|e| e.to_string())?;
                    receiver.recv_timeout(Duration::from_secs(10)).map_err(|e| e.to_string())
                };
                for state in ["visible", "minimized", "hidden", "restored", "hidden", "restored"] {
                    match state {
                        "minimized" => window.minimize(),
                        "hidden" => window.hide(),
                        _ => window.show().and_then(|_| window.unminimize()),
                    }.map_err(|e| e.to_string())?;
                    let low = baseline && matches!(state, "minimized" | "hidden");
                    let _ = native_state(&window, low)?;
                    let before = snapshot()?;
                    std::thread::sleep(Duration::from_secs(8));
                    if (state == "minimized" && !window.is_minimized().unwrap_or(false)) ||
                        (state == "hidden" && window.is_visible().unwrap_or(true)) ||
                        (state == "restored" && (!window.is_visible().unwrap_or(false) || window.is_minimized().unwrap_or(true))) {
                        return Err(format!("{state}: requested native window state not reached"));
                    }
                    let after = snapshot()?;
                    let (normal, playing) = native_state(&window, low)?;
                    println!("{state}: normal={normal} playing={playing} before={before} after={after}");
                    if !normal { return Err(format!("{state}: LOW priority violates background media policy")); }
                    if !playing || after["paused"] != false || after["videoPaused"] != false ||
                        after["time"].as_f64().unwrap_or(0.0) - before["time"].as_f64().unwrap_or(0.0) < 6.0 ||
                        after["videoTime"].as_f64().unwrap_or(0.0) <= before["videoTime"].as_f64().unwrap_or(0.0) {
                        return Err(format!("{state}: synthetic media stopped"));
                    }
                }
                window.eval("audio.pause();audio.muted=true").map_err(|e| e.to_string())?;
                std::thread::sleep(Duration::from_secs(1));
                let before = snapshot()?;
                window.hide().and_then(|_| window.show()).map_err(|e| e.to_string())?;
                let _ = native_state(&window, false)?;
                std::thread::sleep(Duration::from_secs(2));
                let after = snapshot()?;
                if after["paused"] != true || after["muted"] != true ||
                    (after["time"].as_f64().unwrap() - before["time"].as_f64().unwrap()).abs() > 0.1 {
                    return Err("manual pause/mute was overridden".into());
                }
                println!("PASS: playback survived lifecycle transitions; manual pause/mute remained in force.");
                Ok(())
            })();
            if let Err(error) = &result { eprintln!("FAIL: {error}"); }
            result_status.store(if result.is_ok() { 0 } else { 1 }, std::sync::atomic::Ordering::Release);
            handle.exit(if result.is_ok() { 0 } else { 1 });
        });
        Ok(())
    }).build(context).expect("isolated native app");
    app.run_return(|_, _| {});
    drop(_identity);
    std::process::exit(status.load(std::sync::atomic::Ordering::Acquire));
}

#[cfg(not(windows))]
fn main() {
    eprintln!("This fixture requires Windows/WebView2.");
}
