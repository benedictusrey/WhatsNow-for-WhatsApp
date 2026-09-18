//! The `whatsapp://` URI scheme handler (Windows).
//!
//! WhatsApp's own apps and web share sheets emit deep links in the
//! `whatsapp://send?phone=...&text=...` form. Registering the scheme lets
//! WhatsNow receive those links: Windows launches (or focuses) WhatsNow with
//! the raw URI on the command line, the URI is normalized to a
//! `web.whatsapp.com` URL, and the chat window is shown and navigated in
//! place — the same path as the user's listed wa.me/chat.whatsapp.com links.
//!
//! Design constraints (mirroring `aumid.rs`):
//! - Per-user HKCU registration only: never needs elevation, mirrors how the
//!   toast AUMID is already registered at every launch.
//! - `portable-mode` builds skip registration entirely: a portable executable
//!   must not modify the system's protocol associations (and its exe path may
//!   live on removable media).
//! - Every launch re-writes the command, so a moved/updated executable is
//!   picked up automatically; nothing stale survives an uninstall except a
//!   single HKCU key (documented in TROUBLESHOOTING.md).
//!
//! Windows gives non-browser applications no way to claim per-host `https://`
//! routing, so `https://wa.me/...` links clicked in OTHER apps keep flowing
//! to the default browser; only `whatsapp://` URIs reach WhatsNow from
//! outside. Inside WhatsNow, all eight listed hosts are handled by
//! `window.rs` (`whatsapp_family_host`).

/// The URI scheme WhatsNow claims on Windows.
pub const SCHEME: &str = "whatsapp";

/// Detect a `whatsapp://` deep link among command-line arguments.
///
/// Windows passes the URI as one argument (quoted, so it stays a single
/// `argv` entry). Returns the raw URI. Pure and unit-tested.
pub fn deep_link_in_args(args: &[String]) -> Option<String> {
    let prefix = format!("{SCHEME}://");
    args.iter()
        .find(|arg| arg.to_ascii_lowercase().starts_with(&prefix))
        .cloned()
}

/// Convert a `whatsapp://` deep link into the equivalent
/// `https://web.whatsapp.com/...` URL the chat webview can navigate to.
///
/// Only the documented deep-link host (`send`) is accepted, and only
/// `phone` / `text` / `type` / `body` parameters survive: everything else
/// (including an unexpected host) is dropped, so a crafted link can never
/// smuggle extra query parameters or an arbitrary page past the webview's
/// navigation policy. Returns `None` for anything that cannot be converted.
///
/// The trailing slash matters: Windows normalizes every URI it launches —
/// `whatsapp://send?phone=…` reaches the handler as
/// `whatsapp://send/?phone=…` (capture-verified against the real browser→
/// ShellExecute flow) — so a `send/` host (the RFC 3986 authority path for
/// opaque hierarchical schemes) must be accepted as `send`, not refused.
/// Pure and unit-tested with the OS-normalized shape.
pub fn deep_link_url(raw: &str) -> Option<String> {
    let rest = raw
        .strip_prefix("whatsapp://")
        .or_else(|| raw.strip_prefix("WHATSAPP://"))
        .or_else(|| raw.strip_prefix("WhatsApp://"))?;
    if rest.is_empty() {
        return None;
    }
    let (host, query) = match rest.split_once('?') {
        Some((host, query)) => (host, Some(query)),
        None => (rest, None),
    };
    // Length bound: refuse absurd links before doing any work.
    if raw.len() > 2_048 {
        return None;
    }
    // Windows/Chromium hand the handler `send/` (trailing slash); the spec
    // shape is `send`. Trim the slash, but only one: `send//` stays refused.
    let host = host.strip_suffix('/').unwrap_or(host);
    if !host.eq_ignore_ascii_case("send") {
        return None;
    }
    let mut out = String::from("https://web.whatsapp.com/send");
    let mut first = true;
    if let Some(query) = query {
        for pair in query.split('&') {
            if pair.is_empty() {
                continue;
            }
            let key = pair.split('=').next().unwrap_or("");
            if !matches!(
                key.to_ascii_lowercase().as_str(),
                "phone" | "text" | "type" | "body"
            ) {
                continue;
            }
            out.push(if first { '?' } else { '&' });
            first = false;
            out.push_str(pair);
        }
    }
    Some(out)
}

/// Register (or refresh) the `whatsapp://` protocol handler for the current
/// user. Windows-only; a no-op on every other platform. Portable builds skip
/// registration by design (see the module docs).
pub fn register() {
    #[cfg(all(windows, not(feature = "portable-mode")))]
    win::register();
}

#[cfg(all(windows, not(feature = "portable-mode")))]
mod win {
    use windows::core::PCWSTR;
    use windows::Win32::System::Registry::{
        HKEY, HKEY_CURRENT_USER, KEY_WRITE, REG_OPTION_NON_VOLATILE, REG_SZ,
    };

    /// UTF-16, NUL-terminated — suitable for `PCWSTR` args and `REG_SZ` data.
    fn wide(s: &str) -> Vec<u16> {
        s.encode_utf16().chain(std::iter::once(0)).collect()
    }

    /// Registry values under `HKCU\Software\Classes\whatsapp`:
    /// - `(Default)  = URL:WhatsNow Protocol`
    /// - `URL Protocol = ""` (empty REG_SZ marks this key as a protocol handler)
    /// - `shell\open\command (Default) = "...WhatsNow.exe" "%1"`
    ///
    /// `%1` is replaced by Windows with the full URI, which
    /// `deep_link_in_args` picks up in both the single-instance and the
    /// cold-start paths (lib.rs).
    pub fn register() {
        let exe = match std::env::current_exe() {
            Ok(exe) => exe,
            Err(error) => {
                crate::dlog::log(&format!("protocol: current_exe unavailable: {error}"));
                return;
            }
        };
        // Quote the executable path: spaces (e.g. "Program Files") would
        // otherwise split the command. `%1` must stay unquoted-by-us and
        // quoted in the template so Windows passes one argument.
        let command = format!("\"{}\" \"%1\"", exe.display());
        if let Err(error) = write_protocol_key(&command) {
            crate::dlog::log(&format!(
                "protocol: whatsapp:// registration FAILED: {error:?}"
            ));
            return;
        }
        crate::dlog::log(&format!(
            "protocol: whatsapp:// registered for {}",
            exe.display()
        ));
    }

    fn write_protocol_key(command: &str) -> windows::core::Result<()> {
        unsafe {
            let key = create_key("Software\\Classes\\whatsapp")?;
            set_string(&key, None, "URL:WhatsNow Protocol")?;
            set_string(&key, Some("URL Protocol"), "")?;
            let _ = windows::Win32::System::Registry::RegCloseKey(key);

            let shell = create_key("Software\\Classes\\whatsapp\\shell")?;
            let _ = windows::Win32::System::Registry::RegCloseKey(shell);
            let open = create_key("Software\\Classes\\whatsapp\\shell\\open")?;
            let _ = windows::Win32::System::Registry::RegCloseKey(open);

            let cmd = create_key("Software\\Classes\\whatsapp\\shell\\open\\command")?;
            let result = set_string(&cmd, None, command);
            let _ = windows::Win32::System::Registry::RegCloseKey(cmd);
            result
        }
    }

    unsafe fn create_key(subkey: &str) -> windows::core::Result<HKEY> {
        let subkey_wide = wide(subkey);
        let mut key = HKEY::default();
        let status = windows::Win32::System::Registry::RegCreateKeyExW(
            HKEY_CURRENT_USER,
            PCWSTR(subkey_wide.as_ptr()),
            None,
            None,
            REG_OPTION_NON_VOLATILE,
            KEY_WRITE,
            None,
            &mut key,
            None,
        );
        if status.is_err() {
            return Err(windows::core::Error::from_win32());
        }
        Ok(key)
    }

    unsafe fn set_string(
        key: &HKEY,
        value_name: Option<&str>,
        data: &str,
    ) -> windows::core::Result<()> {
        let name_wide = value_name.map(wide).unwrap_or_default();
        let data_wide = wide(data);
        let status = windows::Win32::System::Registry::RegSetValueExW(
            *key,
            PCWSTR(if name_wide.is_empty() {
                std::ptr::null()
            } else {
                name_wide.as_ptr()
            }),
            None,
            REG_SZ,
            Some(std::slice::from_raw_parts(
                data_wide.as_ptr() as *const u8,
                data_wide.len() * std::mem::size_of::<u16>(),
            )),
        );
        if status.is_err() {
            return Err(windows::core::Error::from_win32());
        }
        Ok(())
    }
}

#[cfg(test)]
mod tests {
    use super::{deep_link_in_args, deep_link_url, SCHEME};

    #[test]
    fn deep_link_is_found_among_command_line_arguments() {
        assert_eq!(
            deep_link_in_args(&[
                "C:\\Program Files\\WhatsNow\\WhatsNow.exe".to_string(),
                "whatsapp://send?phone=15551234567".to_string(),
            ]),
            Some("whatsapp://send?phone=15551234567".to_string())
        );
        // A bare executable invocation (autostart) finds nothing.
        assert_eq!(deep_link_in_args(&["WhatsNow.exe".to_string()]), None);
        // An https link is NOT a deep link (default-browser flow, never ours).
        assert_eq!(
            deep_link_in_args(&["https://wa.me/15551234567".to_string()]),
            None
        );
        assert_eq!(deep_link_in_args(&[]), None);
    }

    #[test]
    fn send_links_convert_to_web_whatsapp_com() {
        assert_eq!(
            deep_link_url("whatsapp://send?phone=15551234567").as_deref(),
            Some("https://web.whatsapp.com/send?phone=15551234567")
        );
        assert_eq!(
            deep_link_url("whatsapp://send?phone=15551234567&text=Hello%20there").as_deref(),
            Some("https://web.whatsapp.com/send?phone=15551234567&text=Hello%20there")
        );
        // Case-insensitive scheme; phone/text/type/body survive, junk drops.
        assert_eq!(
            deep_link_url("WHATSAPP://send?PHONE=1&text=hi&junk=x").as_deref(),
            Some("https://web.whatsapp.com/send?PHONE=1&text=hi")
        );
        // A bare send link (no query) still lands on the composer.
        assert_eq!(
            deep_link_url("whatsapp://send").as_deref(),
            Some("https://web.whatsapp.com/send")
        );
        // THE REAL-WORLD SHAPE: Windows normalizes every URI it launches, so
        // browsers hand the handler `whatsapp://send/?phone=…` (trailing
        // slash after the host). Captured live from the actual ShellExecute
        // flow — this exact shape used to be refused, silently dropping
        // every browser-originated wa.me click (app raised, nothing else).
        assert_eq!(
            deep_link_url("whatsapp://send/?phone=6281234567890").as_deref(),
            Some("https://web.whatsapp.com/send?phone=6281234567890")
        );
        assert_eq!(
            deep_link_url(
                "whatsapp://send/?phone=6281234567890&text=Hi&type=phone_number&app_absent=0"
            )
            .as_deref(),
            // app_absent (wa.me's redirect decoration) is deliberately NOT on
            // the allow-list — the composer needs only phone/text/type/body.
            Some("https://web.whatsapp.com/send?phone=6281234567890&text=Hi&type=phone_number")
        );
        // Scheme case-insensitivity combines with the trailing slash.
        assert_eq!(
            deep_link_url("WHATSAPP://SEND/?phone=15551234567").as_deref(),
            Some("https://web.whatsapp.com/send?phone=15551234567")
        );
    }

    #[test]
    fn foreign_or_malformed_deep_links_are_rejected() {
        assert!(deep_link_url("").is_none());
        assert!(deep_link_url("whatsapp://").is_none());
        // Only the documented `send` host converts; unknown hosts are refused
        // so a crafted URI can never navigate the chat webview off-policy.
        assert!(deep_link_url("whatsapp://chat?id=123").is_none());
        assert!(deep_link_url("whatsapp://evil.example.com/send").is_none());
        assert!(deep_link_url("https://wa.me/15551234567").is_none());
        // The slash is trimmed once: a doubled slash stays refused, and a
        // path under `send/` is not the send host either.
        assert!(deep_link_url("whatsapp://send//?phone=15551234567").is_none());
        assert!(deep_link_url("whatsapp://send/extra?phone=15551234567").is_none());
        // Absurd length is refused before any parsing work.
        let long = format!("whatsapp://send?phone={}", "1".repeat(4_096));
        assert!(deep_link_url(&long).is_none());
    }

    #[test]
    fn scheme_constant_is_the_documented_one() {
        assert_eq!(SCHEME, "whatsapp");
    }
}
