//! Windows-only: register the app's AppUserModelID (AUMID) at runtime so WinRT
//! toast notifications actually render for the installed app (issue #3).
//!
//! On an installed build `tauri-plugin-notification` sets the toast's
//! `System.AppUserModel.ID` to the bundle identifier (`app.whatsnow.desktop`).
//! Windows only renders a toast whose AUMID is *registered* on the system. The
//! NSIS/MSI installers do tag their Start-Menu shortcut with the AUMID, but
//! that registration is fragile: the Desktop shortcut carries no AUMID, a
//! per-user vs per-machine path mismatch or a regenerated shortcut can drop the
//! property, and a raw-exe run has none at all. When the AUMID is unregistered
//! the WinRT call fails *silently* — and WhatsNow discards the error (see
//! `notify.rs`), so no notification ever appears.
//!
//! Registering the AUMID under HKCU on every launch makes toast delivery
//! self-sufficient regardless of installer or launch path. Both steps below are
//! per-user (no admin), idempotent, and best-effort: a failure only means
//! toasts may not render, so we log and never panic or block startup.
//!
//! The AUMID is read from the live Tauri config `identifier`, i.e. the exact
//! value the notification plugin passes to `app_id()`, so the two can never
//! drift apart.

use tauri::AppHandle;

#[cfg(all(windows, feature = "portable-mode"))]
const PORTABLE_MODE_MARKER: &str = "WHATSNOW_PORTABLE_MODE_V1";

/// No-op on every platform except Windows.
#[allow(unused_variables)]
pub fn register(app: &AppHandle) {
    #[cfg(windows)]
    {
        // Native Windows toasts require a registered AppUserModelID. Register it
        // for installed and portable editions alike; no application-window
        // fallback is created when toast delivery is unavailable.
        let config = app.config();
        let aumid = &config.identifier;
        let display = config.product_name.as_deref().unwrap_or("WhatsNow");
        win::register(aumid, display, &app.package_info().version.to_string());
        #[cfg(feature = "portable-mode")]
        crate::dlog::log(PORTABLE_MODE_MARKER);
    }
}

#[cfg(windows)]
mod win {
    use std::os::windows::ffi::OsStrExt;
    use windows::core::{Interface, PCWSTR};
    use windows::Win32::Foundation::PROPERTYKEY;
    use windows::Win32::System::Com::StructuredStorage::PROPVARIANT;
    use windows::Win32::System::Com::{
        CoCreateInstance, CoInitializeEx, CoUninitialize, IPersistFile, CLSCTX_INPROC_SERVER,
        COINIT_APARTMENTTHREADED,
    };
    use windows::Win32::System::Registry::{
        RegCloseKey, RegCreateKeyExW, RegSetValueExW, HKEY, HKEY_CURRENT_USER, KEY_WRITE,
        REG_OPTION_NON_VOLATILE, REG_SZ,
    };
    use windows::Win32::System::Variant::VARIANT;
    use windows::Win32::UI::Shell::PropertiesSystem::IPropertyStore;
    use windows::Win32::UI::Shell::{
        IShellLinkW, SHChangeNotify, SetCurrentProcessExplicitAppUserModelID, ShellLink,
        SHCNE_ASSOCCHANGED, SHCNF_IDLIST,
    };

    const ICON_ICO: &[u8] = include_bytes!("../icons/icon.ico");

    /// UTF-16, NUL-terminated — suitable for `PCWSTR` args and `REG_SZ` data.
    fn wide(s: &str) -> Vec<u16> {
        s.encode_utf16().chain(std::iter::once(0)).collect()
    }

    pub fn register(aumid: &str, display_name: &str, version: &str) {
        // Step 1 — the registry entry is what makes the Action Center render
        // the toast for an unpackaged desktop app.
        match write_registry(aumid, display_name) {
            Ok(()) => crate::dlog::log(&format!(
                "aumid: HKCU\\Software\\Classes\\AppUserModelId\\{aumid} registered"
            )),
            Err(e) => crate::dlog::log(&format!("aumid: registry registration FAILED: {e:?}")),
        }
        // Step 2 — pin this process to the AUMID (taskbar grouping + toast
        // attribution). Harmless if it fails; we just log.
        let id = wide(aumid);
        match unsafe { SetCurrentProcessExplicitAppUserModelID(PCWSTR(id.as_ptr())) } {
            Ok(()) => crate::dlog::log(&format!(
                "aumid: SetCurrentProcessExplicitAppUserModelID({aumid}) ok"
            )),
            Err(e) => crate::dlog::log(&format!(
                "aumid: SetCurrentProcessExplicitAppUserModelID FAILED: {e:?}"
            )),
        }
        match ensure_start_menu_shortcut(aumid, display_name, version) {
            Ok(path) => crate::dlog::log(&format!(
                "aumid: notification shortcut ready ({})",
                path.display()
            )),
            Err(e) => crate::dlog::log(&format!(
                "aumid: notification shortcut registration FAILED: {e:?}"
            )),
        }
    }

    /// Create the per-user Start-menu shortcut Windows requires for unpackaged
    /// desktop notifications, and stamp it with System.AppUserModel.ID.
    fn ensure_start_menu_shortcut(
        aumid: &str,
        display_name: &str,
        version: &str,
    ) -> windows::core::Result<std::path::PathBuf> {
        let exe = std::env::current_exe().map_err(windows::core::Error::from)?;
        let icon = ensure_versioned_icon(version).map_err(windows::core::Error::from)?;
        let app_data = std::env::var_os("APPDATA").ok_or_else(|| {
            windows::core::Error::new(
                windows::core::HRESULT(0x80070002_u32 as i32),
                "APPDATA is unavailable",
            )
        })?;
        let shortcut = std::path::PathBuf::from(app_data)
            .join("Microsoft")
            .join("Windows")
            .join("Start Menu")
            .join("Programs")
            .join("WhatsNow.lnk");
        if let Some(parent) = shortcut.parent() {
            std::fs::create_dir_all(parent).map_err(windows::core::Error::from)?;
        }

        // Tauri/WebView2 normally initializes COM already. We initialize it for
        // portable launches before the first webview and only uninitialize when
        // this call acquired the apartment itself.
        let initialized_here = unsafe { CoInitializeEx(None, COINIT_APARTMENTTHREADED) }.is_ok();
        let result = unsafe {
            let link: IShellLinkW = CoCreateInstance(&ShellLink, None, CLSCTX_INPROC_SERVER)?;
            let exe_wide = os_wide(exe.as_os_str());
            let icon_wide = os_wide(icon.as_os_str());
            let description = wide("WhatsNow — focused WhatsApp productivity desktop client");
            link.SetPath(PCWSTR(exe_wide.as_ptr()))?;
            link.SetDescription(PCWSTR(description.as_ptr()))?;
            link.SetIconLocation(PCWSTR(icon_wide.as_ptr()), 0)?;
            if let Some(parent) = exe.parent() {
                let parent_wide = os_wide(parent.as_os_str());
                link.SetWorkingDirectory(PCWSTR(parent_wide.as_ptr()))?;
            }

            let store: IPropertyStore = link.cast()?;
            let variant = VARIANT::from(aumid);
            let prop_variant = PROPVARIANT::try_from(&variant)?;
            store.SetValue(&PKEY_APP_USER_MODEL_ID, &prop_variant)?;
            store.Commit()?;

            let persist: IPersistFile = link.cast()?;
            let shortcut_wide = os_wide(shortcut.as_os_str());
            persist.Save(PCWSTR(shortcut_wide.as_ptr()), true)?;
            windows::core::Result::Ok(())
        };
        if initialized_here {
            unsafe { CoUninitialize() };
        }
        result?;
        // A versioned icon path plus this association notification invalidates
        // stale taskbar/Start-menu cache entries left by earlier WhatsNow builds.
        unsafe {
            SHChangeNotify(SHCNE_ASSOCCHANGED, SHCNF_IDLIST, None, None);
        }
        let _ = display_name;
        Ok(shortcut)
    }

    fn ensure_versioned_icon(version: &str) -> std::io::Result<std::path::PathBuf> {
        let local_app_data = std::env::var_os("LOCALAPPDATA")
            .map(std::path::PathBuf::from)
            .unwrap_or_else(std::env::temp_dir);
        let directory = local_app_data.join("WhatsNow").join("icons");
        std::fs::create_dir_all(&directory)?;
        let safe_version: String = version
            .chars()
            .filter(|character| character.is_ascii_alphanumeric() || matches!(character, '.' | '-'))
            .collect();
        let path = directory.join(format!("WhatsNow-{safe_version}.ico"));
        let current_matches = std::fs::read(&path)
            .map(|bytes| bytes == ICON_ICO)
            .unwrap_or(false);
        if !current_matches {
            std::fs::write(&path, ICON_ICO)?;
        }
        Ok(path)
    }

    fn os_wide(value: &std::ffi::OsStr) -> Vec<u16> {
        value.encode_wide().chain(std::iter::once(0)).collect()
    }

    // System.AppUserModel.ID: {9F4C2855-9F79-4B39-A8D0-E1D42DE1D5F3}, PID 5.
    const PKEY_APP_USER_MODEL_ID: PROPERTYKEY = PROPERTYKEY {
        fmtid: windows::core::GUID::from_u128(0x9f4c2855_9f79_4b39_a8d0_e1d42de1d5f3),
        pid: 5,
    };

    /// Writes `HKCU\Software\Classes\AppUserModelId\<AUMID>` with a `DisplayName`
    /// and an `IconUri` (both REG_SZ). Overwritten on every launch, which also
    /// self-heals a Start-Menu shortcut that lost its AUMID property and — the
    /// important part — keeps the Action Center / toast identity icon pointing
    /// at the CURRENT executable. A stale IconUri (e.g. the app was moved or
    /// the portable edition runs from a new folder) makes Windows render
    /// notifications with NO icon after the first one, because the identity
    /// icon path no longer exists. Refreshing it every launch fixes that for
    /// installed and portable editions alike.
    ///
    /// LOCKED BEHAVIOR (user-confirmed 2026-08-08, see AGENTS.md §3): the
    /// IconUri MUST point at the toast PNG file with an ALL-BACKSLASH path.
    /// An exe path renders blank after the first toast, and mixed separators
    /// make the shell's image loader fail. Do not change either rule.
    fn write_registry(aumid: &str, display_name: &str) -> windows::core::Result<()> {
        let subkey = wide(&format!("Software\\Classes\\AppUserModelId\\{aumid}"));
        let mut hkey = HKEY(std::ptr::null_mut());
        unsafe {
            RegCreateKeyExW(
                HKEY_CURRENT_USER,
                PCWSTR(subkey.as_ptr()),
                None,
                PCWSTR::null(),
                REG_OPTION_NON_VOLATILE,
                KEY_WRITE,
                None,
                &mut hkey,
                None,
            )
            .ok()?;
        }

        // REG_SZ data is the NUL-terminated UTF-16 bytes of the value.
        let set = write_reg_value(hkey, "DisplayName", &wide(display_name)).and_then(|_| {
            // Identity icon = the toast PNG FILE (the Spotify pattern). The
            // notification platform needs a real image file here; an exe path
            // renders blank in the Action Center after the first toast. The
            // path MUST be all-backslash: mixed separators (the relative path
            // is stored with '/') make the shell's image loader fail.
            let icon = crate::notify::ensure_toast_icon_file().ok_or_else(|| {
                windows::core::Error::new(
                    windows::core::HRESULT(0x80070002_u32 as i32),
                    "toast icon file unavailable",
                )
            })?;
            let icon_uri = icon.to_string_lossy().replace('/', "\\").to_string();
            crate::dlog::log(&format!("aumid: IconUri set to {icon_uri}"));
            write_reg_value(hkey, "IconUri", &wide(&icon_uri))
        });
        // Always close the key, then surface any set error.
        unsafe {
            let _ = RegCloseKey(hkey);
        }
        set
    }

    /// Set one REG_SZ value on the open key.
    fn write_reg_value(hkey: HKEY, name: &str, data: &[u16]) -> windows::core::Result<()> {
        let name = wide(name);
        let bytes = unsafe {
            std::slice::from_raw_parts(data.as_ptr() as *const u8, std::mem::size_of_val(data))
        };
        unsafe { RegSetValueExW(hkey, PCWSTR(name.as_ptr()), None, REG_SZ, Some(bytes)) }.ok()
    }
}
