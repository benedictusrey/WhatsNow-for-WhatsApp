//! Isolated native popup handoff/geometry check for WhatsNow, by @benedictusrey.
//! No WhatsApp session, camera, microphone, protocol registration, or tray plugin.
use std::io::{Read, Write};
use std::net::TcpListener;
use std::sync::mpsc;
use std::time::{Duration, Instant};
use tauri::{Manager, WebviewUrl, WebviewWindowBuilder};

fn wait_for(mut predicate: impl FnMut() -> bool) -> bool {
    let start = Instant::now();
    while start.elapsed() < Duration::from_secs(5) {
        if predicate() {
            return true;
        }
        std::thread::sleep(Duration::from_millis(50));
    }
    false
}

fn main() {
    let listener = TcpListener::bind("127.0.0.1:0").expect("fixture listener");
    let address = listener.local_addr().unwrap();
    let (sender, receiver) = mpsc::channel();
    std::thread::spawn(move || {
        for stream in listener.incoming() {
            let Ok(mut stream) = stream else { break };
            let _ = stream.set_read_timeout(Some(Duration::from_secs(3)));
            let mut bytes = [0; 4096];
            let size = stream.read(&mut bytes).unwrap_or(0);
            let request = String::from_utf8_lossy(&bytes[..size]);
            let path = request.split_whitespace().nth(1).unwrap_or("/");
            let body = if path == "/call" {
                "<!doctype html><title>WhatsNow call fixture ready</title><h1>Call handoff ready</h1><script>window.opener.postMessage('child-ready',location.origin)</script>"
            } else if path.starts_with("/result/") {
                let _ = sender.send(path == "/result/pass");
                "ok"
            } else {
                "<!doctype html><title>WhatsNow isolated call test</title><h1>Testing popup handoff</h1><script>var child;addEventListener('message',e=>{if(e.origin===location.origin&&e.source===child&&e.data==='child-ready')fetch('/result/pass')});child=open('/call','call','popup,width=640,height=480');if(!child)fetch('/result/fail')</script>"
            };
            let response = format!(
                "HTTP/1.1 200 OK\r\nContent-Type: text/html\r\nContent-Length: {}\r\nConnection: close\r\n\r\n{}",
                body.len(), body
            );
            let _ = stream.write_all(response.as_bytes());
        }
    });
    let mut context = tauri::generate_context!();
    context.config_mut().identifier = "app.whatsnow.call-smoke".into();
    let profile = std::env::temp_dir().join(format!("WhatsNow-call-smoke-{}", std::process::id()));
    let profile_for_opener = profile.clone();
    let app = tauri::Builder::default()
        .setup(move |app| {
            let handle = app.handle().clone();
            let child_app = handle.clone();
            WebviewWindowBuilder::new(
                app,
                "fixture-opener",
                WebviewUrl::External(format!("http://{address}/").parse().unwrap()),
            )
            .data_directory(profile_for_opener.clone())
            .on_new_window(move |url, features| {
                assert_eq!(url.host_str(), Some("127.0.0.1"));
                let builder = whatsnow_lib::call_window::builder(&child_app, "wa-call-fixture")
                    .window_features(features)
                    .data_directory(profile_for_opener.clone());
                let window = builder.build().expect("call child creation");
                tauri::webview::NewWindowResponse::Create { window }
            })
            .build()?;
            std::thread::spawn(move || {
                let result = (|| -> Result<(), String> {
                    if receiver.recv_timeout(Duration::from_secs(30)) != Ok(true) {
                        return Err("popup WindowProxy/opener handoff failed".into());
                    }
                    let window = handle.get_webview_window("wa-call-fixture").ok_or("child absent")?;
                    if !window.is_resizable().unwrap_or(false) || !window.is_maximizable().unwrap_or(false) {
                        return Err("native resize/maximize capability absent".into());
                    }
                    window.maximize().map_err(|e| e.to_string())?;
                    if !wait_for(|| window.is_maximized().unwrap_or(false)) {
                        return Err("maximize did not take effect".into());
                    }
                    window.unmaximize().map_err(|e| e.to_string())?;
                    if !wait_for(|| !window.is_maximized().unwrap_or(true)) {
                        return Err("restore did not take effect".into());
                    }
                    window.set_size(tauri::LogicalSize::new(800.0, 550.0)).map_err(|e| e.to_string())?;
                    if !wait_for(|| window.inner_size().is_ok_and(|size| {
                        let scale = window.scale_factor().unwrap_or(1.0);
                        ((size.width as f64 / scale) - 800.0).abs() <= 2.0 &&
                        ((size.height as f64 / scale) - 550.0).abs() <= 2.0
                    })) {
                        return Err("resize did not update the client area".into());
                    }
                    println!("PASS: native popup loaded, returned WindowProxy, retained opener, maximized, restored, and resized.");
                    Ok(())
                })();
                if let Err(error) = &result { eprintln!("FAIL: {error}"); }
                handle.exit(if result.is_ok() { 0 } else { 1 });
            });
            Ok(())
        })
        .build(context)
        .expect("isolated native app");
    app.run(|_, _| {});
}
