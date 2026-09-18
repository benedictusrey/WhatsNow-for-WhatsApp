use tauri::AppHandle;
#[cfg(not(target_os = "windows"))]
use tauri_plugin_notification::NotificationExt;

#[derive(Debug, Clone, Default, PartialEq, Eq, serde::Deserialize, serde::Serialize)]
#[serde(rename_all = "camelCase")]
pub struct NotificationRoute {
    pub chat_title: String,
    pub chat_id: String,
    pub message_id: String,
    pub message_text: String,
}

/// Compact launch payload embedded in the native toast's `launch` attribute.
///
/// Windows delivers this string to the app in TWO situations:
///  1. The process is running: the toast `Activated` event fires with the
///     launch string as its argument.
///  2. The process is NOT running (unpackaged app): Windows relaunches the app
///     via the AUMID Start-menu shortcut and appends the launch string to the
///     command line, where the single-instance handler picks it up.
///
/// Either way the sender's chat can be opened directly instead of falling back
/// to whatever conversation happens to be on screen.
#[derive(Debug, Clone, Default, serde::Deserialize, serde::Serialize)]
#[serde(default)]
struct RoutePayload {
    a: String, // account id
    t: String, // chat title
    c: String, // chat id (jid)
    m: String, // message id
    x: String, // message text
}

/// Content-carrying fields of a route (title/id/text). Blanked when the user
/// disabled message previews so private message content never reaches the toast
/// XML or the process command line.
const ROUTE_PAYLOAD_TEXT_CAP: usize = 140;

fn truncate(value: &str, cap: usize) -> String {
    value.chars().take(cap).collect()
}

/// Build the `launch` attribute value for a toast: a percent-encoded JSON
/// payload under the `whatsnow:route?` scheme. Percent-encoding keeps the
/// payload XML-safe (no `<`, `>`, `&`, `"`) and unambiguous on the command
/// line. Content fields are truncated so a long preview cannot bloat the toast
/// XML or the process command line.
pub fn route_payload(account_id: &str, route: &NotificationRoute) -> String {
    let payload = RoutePayload {
        a: account_id.to_string(),
        t: truncate(&route.chat_title, ROUTE_PAYLOAD_TEXT_CAP),
        c: truncate(&route.chat_id, ROUTE_PAYLOAD_TEXT_CAP),
        m: truncate(&route.message_id, ROUTE_PAYLOAD_TEXT_CAP),
        x: truncate(&route.message_text, ROUTE_PAYLOAD_TEXT_CAP),
    };
    let json = serde_json::to_string(&payload).unwrap_or_else(|_| "{}".into());
    let mut encoded = String::with_capacity(json.len());
    for byte in json.bytes() {
        match byte {
            b'A'..=b'Z' | b'a'..=b'z' | b'0'..=b'9' | b'-' | b'_' | b'.' | b'~' => {
                encoded.push(byte as char)
            }
            _ => encoded.push_str(&format!("%{byte:02X}")),
        }
    }
    format!("whatsnow:route?{encoded}")
}

/// Decode a toast launch payload back into its account id + route. Returns
/// `None` for anything that is not a valid WhatsNow route payload, so foreign
/// or corrupted command-line arguments are simply ignored.
pub fn decode_route_payload(value: &str) -> Option<(String, NotificationRoute)> {
    let encoded = value.strip_prefix("whatsnow:route?")?;
    let mut bytes = Vec::with_capacity(encoded.len());
    let mut iter = encoded.bytes();
    while let Some(byte) = iter.next() {
        if byte == b'%' {
            let hi = iter.next()?;
            let lo = iter.next()?;
            let hi = (hi as char).to_digit(16)?;
            let lo = (lo as char).to_digit(16)?;
            bytes.push((hi * 16 + lo) as u8);
        } else {
            bytes.push(byte);
        }
    }
    let json = std::str::from_utf8(&bytes).ok()?;
    let payload: RoutePayload = serde_json::from_str(json).ok()?;
    Some((
        payload.a,
        NotificationRoute {
            chat_title: payload.t,
            chat_id: payload.c,
            message_id: payload.m,
            message_text: payload.x,
        },
    ))
}

/// Find a route payload among process command-line arguments (the way Windows
/// delivers toast activation to an unpackaged app that was not running).
pub fn route_payload_in_args(args: &[String]) -> Option<(String, NotificationRoute)> {
    args.iter().find_map(|arg| decode_route_payload(arg))
}

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum Delivery {
    Native,
}

pub fn show(app: &AppHandle, title: &str, body: &str) -> Result<Delivery, String> {
    #[cfg(target_os = "windows")]
    {
        // Call notify-rust directly on Windows. The Tauri plugin dispatches this
        // on a detached task and drops the real WinRT error, making a missing
        // Start-menu AUMID look like success. The direct call returns the actual
        // result so Settings can show useful feedback.
        let identifier = app.config().identifier.clone();
        let result = notify_rust::Notification::new()
            .summary(title)
            .body(body)
            .auto_icon()
            .app_id(&identifier)
            .show()
            .map(|_| Delivery::Native)
            .map_err(|error| format!("Windows could not display the notification: {error}"));
        match &result {
            Ok(Delivery::Native) => {
                crate::dlog::log("notify::show confirmed by Windows notification API")
            }
            Err(error) => {
                crate::dlog::log(&format!("notify::show native FAILED: {error}"));
            }
        }
        result
    }

    #[cfg(not(target_os = "windows"))]
    {
        let result = app
            .notification()
            .builder()
            .title(title)
            .body(body)
            .show()
            .map(|_| Delivery::Native)
            .map_err(|error| error.to_string());
        crate::dlog::log(&format!("notify::show dispatched: {result:?}"));
        result
    }
}

#[cfg(target_os = "windows")]
fn escape_toast_xml(value: &str) -> String {
    value
        .chars()
        .filter(|character| matches!(*character, '\t' | '\n' | '\r') || !character.is_control())
        .fold(String::new(), |mut escaped, character| {
            match character {
                '&' => escaped.push_str("&amp;"),
                '<' => escaped.push_str("&lt;"),
                '>' => escaped.push_str("&gt;"),
                '"' => escaped.push_str("&quot;"),
                '\'' => escaped.push_str("&apos;"),
                _ => escaped.push(character),
            }
            escaped
        })
}

#[cfg(target_os = "windows")]
/// The app identity icon, embedded so the toast and the notification center
/// always carry the WhatsNow logo even when the AUMID shortcut icon is
/// missing or stale. WinRT notification identity icons accept PNG; written to
/// the per-user icons folder and referenced by the AUMID registry IconUri.
// The exact app artwork at 48x48 — the identity-icon slot size. There is
// deliberately NO per-toast appLogoOverride image in the toast XML: Windows
// renders a toast that carries appLogoOverride with the LARGE square app
// icon on the left (verified live across both toast styles), while a toast
// without it uses the compact layout — small identity icon next to the app
// name. The user requires the compact layout for EVERY toast.
const TOAST_ICON_PNG: &[u8] = include_bytes!("../icons/toast-icon.png");
const TOAST_ICON_RELATIVE: &str = "icons/whatsnow-toast.png";

/// The per-user path the toast icon PNG is materialized to. Same directory
/// the AUMID registration uses for its versioned .ico.
#[cfg(target_os = "windows")]
pub fn toast_icon_path() -> Option<std::path::PathBuf> {
    std::env::var_os("LOCALAPPDATA").map(|dir| {
        std::path::PathBuf::from(dir)
            .join("WhatsNow")
            .join(TOAST_ICON_RELATIVE)
    })
}

/// Best-effort: write the toast icon PNG if it is missing or stale and return
/// its path. This file is the AUMID registry identity (IconUri) source —
/// Windows' notification platform needs the identity icon to be a real image
/// FILE (the Spotify pattern), not an exe path. The compact toast layout
/// shows it as the small icon next to the app name; the notification center
/// uses it too. There is NO appLogoOverride in the toast XML.
/// LOCKED BEHAVIOR (user-confirmed 2026-08-08, updated 2026-08-11, see
/// AGENTS.md §3): every toast must show the small WhatsNow icon — this file
/// is the single icon source (the identity IconUri). Do not change the file
/// name or location. The byte content is 48x48 (NOT the old 512x512).
#[cfg(target_os = "windows")]
pub fn ensure_toast_icon_file() -> Option<std::path::PathBuf> {
    let path = toast_icon_path()?;
    if let Some(parent) = path.parent() {
        let _ = std::fs::create_dir_all(parent);
    }
    let fresh = std::fs::read(&path)
        .map(|bytes| bytes == TOAST_ICON_PNG)
        .unwrap_or(false);
    if !fresh {
        let _ = std::fs::write(&path, TOAST_ICON_PNG);
    }
    Some(path)
}

#[cfg(target_os = "windows")]
fn show_windows_message(
    app: &AppHandle,
    title: &str,
    body: &str,
    duration_secs: u32,
    account_id: &str,
    route: NotificationRoute,
) -> Result<Delivery, String> {
    use windows::{
        core::{IInspectable, Interface, HSTRING},
        Data::Xml::Dom::XmlDocument,
        Foundation::TypedEventHandler,
        UI::Notifications::{ToastActivatedEventArgs, ToastNotification, ToastNotificationManager},
    };

    // Windows only offers "short" (~7s) and "long" (~25s) banners; the user's
    // preview duration maps onto those. The banner auto-dismisses after that
    // time, while the notification REMAINS in the Action Center history (the
    // WinRT Hide() call removes it from history too, so it is never used).
    let banner = if duration_secs.clamp(2, 30) >= 15 {
        "long"
    } else {
        "short"
    };
    let launch = route_payload(account_id, &route);
    let xml = build_toast_xml(banner, &launch, title, body);
    let document = XmlDocument::new().map_err(|error| error.to_string())?;
    document
        .LoadXml(&HSTRING::from(xml.as_str()))
        .map_err(|error| error.to_string())?;
    let toast = ToastNotification::CreateToastNotification(&document).map_err(|error| {
        // Diagnostic-only: on failure, record the XML structure with attribute
        // values stripped (message content must never reach the log).
        let redacted = xml
            .split('"')
            .enumerate()
            .map(|(index, part)| if index % 2 == 1 { "\"...\"" } else { part })
            .collect::<String>();
        crate::dlog::log(&format!("notify: failing toast XML: {redacted}"));
        format!("toast creation failed: {error}")
    })?;
    crate::dlog::log("notify: ToastNotification created");
    let notifier = ToastNotificationManager::CreateToastNotifierWithId(&HSTRING::from(
        app.config().identifier.clone(),
    ))
    .map_err(|error| error.to_string())?;

    let activation_app = app.clone();
    let activation_account_id = account_id.to_string();
    let activation_route = route.clone();
    let activated =
        TypedEventHandler::<ToastNotification, IInspectable>::new(move |_toast, arguments| {
            let mut account_id = activation_account_id.clone();
            let mut route = activation_route.clone();
            // Prefer the launch-payload route when Windows delivered one (it is
            // the freshest data the toast carries). Fall back to the route
            // captured when the toast was shown.
            if let Some(args) = arguments.as_ref() {
                if let Ok(event_args) = args.cast::<ToastActivatedEventArgs>() {
                    if let Ok(args_string) = event_args.Arguments() {
                        let args_string = args_string.to_string();
                        if let Some((payload_account, payload_route)) =
                            decode_route_payload(&args_string)
                        {
                            account_id = payload_account;
                            route = payload_route;
                        }
                    }
                }
            }
            let app = activation_app.clone();
            let ui_app = app.clone();
            if let Err(error) = app.run_on_main_thread(move || {
                if crate::lock::is_unlocked(&ui_app) {
                    crate::window::request_notification_target(&ui_app, &account_id, &route);
                } else {
                    crate::lock::show_lock_window(&ui_app);
                }
            }) {
                crate::dlog::log(&format!(
                    "native toast activation could not reach the UI thread: {error}"
                ));
            }
            Ok(())
        });
    toast
        .Activated(&activated)
        .map_err(|error| error.to_string())?;
    notifier.Show(&toast).map_err(|error| error.to_string())?;

    // The toast is intentionally NOT hidden after the preview duration: it stays
    // in the Windows Action Center (taskbar notification history) so a missed
    // message can be re-opened later. `duration="short"` keeps the on-screen
    // banner brief; Windows retains the entry in the notification history.
    crate::dlog::log("notify::show_message dispatched clickable native Windows toast");
    Ok(Delivery::Native)
}

/// Build the toast XML. Deliberately NO appLogoOverride image: Windows
/// renders a toast that carries one with the LARGE app icon on the left, and
/// the compact layout (small identity icon next to the app name) is what the
/// user requires for every toast. The identity icon comes from the AUMID
/// IconUri. LOCKED (AGENTS.md §3, docs/TROUBLESHOOTING.md) — keep this
/// function free of any `<image placement="appLogoOverride">` element.
#[cfg(target_os = "windows")]
fn build_toast_xml(banner: &str, launch: &str, title: &str, body: &str) -> String {
    format!(
        "<toast duration=\"{banner}\" launch=\"{}\"><visual><binding template=\"ToastGeneric\">\
         <text>{}</text><text>{}</text>\
         <text placement=\"attribution\">WhatsNow</text></binding></visual></toast>",
        escape_toast_xml(launch),
        escape_toast_xml(title),
        escape_toast_xml(body)
    )
}

/// Display an incoming-message preview through the platform's native notification
/// service. On Windows the toast itself handles activation, and is explicitly
/// hidden at the configured on-screen duration.
pub fn show_message(
    app: &AppHandle,
    title: &str,
    body: &str,
    duration_secs: u32,
    account_id: &str,
    route: NotificationRoute,
) -> Result<Delivery, String> {
    #[cfg(target_os = "windows")]
    {
        show_windows_message(app, title, body, duration_secs, account_id, route)
    }

    #[cfg(not(target_os = "windows"))]
    {
        let _ = (duration_secs, account_id, route);
        show(app, title, body)
    }
}

#[cfg(test)]
mod tests {
    use super::{decode_route_payload, route_payload, route_payload_in_args, NotificationRoute};

    #[cfg(target_os = "windows")]
    #[test]
    fn toast_xml_never_carries_app_logo_override() {
        let xml = super::build_toast_xml("short", "whatsnow:route?payload", "Alice", "hi");
        assert!(
            !xml.contains("appLogoOverride"),
            "toast XML must not embed an appLogoOverride image (big-banner bug): {xml}"
        );
        assert!(
            !xml.contains("<image"),
            "toast XML must carry no image elements: {xml}"
        );
        assert!(
            xml.contains("placement=\"attribution\""),
            "toast keeps the attribution line"
        );
    }

    #[cfg(target_os = "windows")]
    #[test]
    fn toast_xml_text_is_escaped_and_controls_are_removed() {
        assert_eq!(
            super::escape_toast_xml("<A&B> \"hello\"\u{0007}"),
            "&lt;A&amp;B&gt; &quot;hello&quot;"
        );
    }

    #[test]
    fn route_payload_roundtrips_through_percent_encoding() {
        let route = NotificationRoute {
            chat_title: "Alice & Bob <family>".into(),
            chat_id: "true_6281234567890@s.whatsapp.net".into(),
            message_id: "3EB0ABC1D2E3F4".into(),
            message_text: "Hey! 😀 — 100% ready".into(),
        };
        let payload = route_payload("default", &route);
        // Percent-encoding keeps the payload XML-safe: no raw <, >, & or quotes.
        for forbidden in ['<', '>', '&', '"', '\''] {
            assert!(
                !payload.contains(forbidden),
                "payload must be XML-safe: {payload}"
            );
        }
        assert!(payload.starts_with("whatsnow:route?"));
        let (account, decoded) = decode_route_payload(&payload).expect("payload decodes");
        assert_eq!(account, "default");
        assert_eq!(decoded, route);
    }

    #[test]
    fn route_payload_truncates_long_content() {
        let route = NotificationRoute {
            chat_title: "A very long group name".into(),
            chat_id: String::new(),
            message_id: String::new(),
            message_text: "x".repeat(5_000),
        };
        let payload = route_payload("default", &route);
        let (_, decoded) = decode_route_payload(&payload).unwrap();
        assert!(decoded.message_text.len() <= 140);
        assert_eq!(decoded.chat_title, "A very long group name");
    }

    #[test]
    fn route_payload_rejects_foreign_or_corrupt_values() {
        assert!(decode_route_payload("").is_none());
        assert!(decode_route_payload("https://example.com").is_none());
        assert!(decode_route_payload("whatsnow:route?%ZZ").is_none());
        assert!(decode_route_payload("whatsnow:route?not-json").is_none());
        assert!(decode_route_payload("whatsnow:route?%7B%22a%22%3A%22x%22%7D").is_some());
    }

    #[test]
    fn route_payload_is_found_among_command_line_arguments() {
        let route = NotificationRoute {
            chat_title: "Pinned Chat".into(),
            ..Default::default()
        };
        let payload = route_payload("acct-2", &route);
        let args = vec![
            "C:\\WhatsNow.exe".to_string(),
            "--minimized".to_string(),
            payload,
        ];
        let (account, decoded) = route_payload_in_args(&args).expect("payload in args");
        assert_eq!(account, "acct-2");
        assert_eq!(decoded.chat_title, "Pinned Chat");

        let plain = vec!["C:\\WhatsNow.exe".to_string(), "--toggle".to_string()];
        assert!(route_payload_in_args(&plain).is_none());
    }
}
