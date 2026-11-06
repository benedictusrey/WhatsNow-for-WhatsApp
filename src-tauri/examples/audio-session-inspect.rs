//! Read-only Windows audio metadata diagnostic for WhatsNow by @benedictusrey.
#[cfg(windows)]
fn main() -> windows::core::Result<()> {
    use windows::core::Interface;
    use windows::Win32::Media::Audio::*;
    use windows::Win32::System::Com::*;
    unsafe {
        CoInitializeEx(None, COINIT_MULTITHREADED).ok()?;
    }
    let result = (|| -> windows::core::Result<()> {
        unsafe {
            let enumerator: IMMDeviceEnumerator =
                CoCreateInstance(&MMDeviceEnumerator, None, CLSCTX_ALL)?;
            let devices = enumerator.EnumAudioEndpoints(eRender, DEVICE_STATE_ACTIVE)?;
            let mut rows = Vec::new();
            let mut errors = Vec::new();
            for index in 0..devices.GetCount()? {
                let device = devices.Item(index)?;
                let id = device.GetId()?;
                let endpoint = id.to_string()?;
                CoTaskMemFree(Some(id.0.cast()));
                let manager: IAudioSessionManager2 = match device.Activate(CLSCTX_ALL, None) {
                    Ok(manager) => manager,
                    Err(error) => {
                        errors.push(serde_json::json!({"endpoint": endpoint, "error": format!("{error:?}")}));
                        continue;
                    }
                };
                let sessions = match manager.GetSessionEnumerator() {
                    Ok(sessions) => sessions,
                    Err(error) => {
                        errors.push(serde_json::json!({"endpoint": endpoint, "error": format!("{error:?}")}));
                        continue;
                    }
                };
                for i in 0..sessions.GetCount()? {
                    let session = sessions.GetSession(i)?;
                    let control: IAudioSessionControl2 = session.cast()?;
                    let volume: ISimpleAudioVolume = session.cast()?;
                    let mut pid = 0;
                    let ownership = (Interface::vtable(&control).GetProcessId)(
                        Interface::as_raw(&control),
                        &mut pid,
                    );
                    let name = session.GetDisplayName()?;
                    let display_name = name.to_string()?;
                    CoTaskMemFree(Some(name.0.cast()));
                    let instance = control.GetSessionInstanceIdentifier()?;
                    let instance_id = instance.to_string()?;
                    CoTaskMemFree(Some(instance.0.cast()));
                    let icon = session.GetIconPath()?;
                    let icon_path = icon.to_string()?;
                    CoTaskMemFree(Some(icon.0.cast()));
                    rows.push(serde_json::json!({
                        "endpoint": endpoint, "pid": pid, "ownership_status": ownership.0,
                        "display_name": display_name, "group": format!("{:?}", session.GetGroupingParam()?),
                        "muted": volume.GetMute()?.as_bool(), "volume": volume.GetMasterVolume()?,
                        "state": session.GetState()?.0,
                        "instance": instance_id, "icon": icon_path,
                    }));
                }
            }
            println!(
                "{}",
                serde_json::json!({"sessions": rows, "endpoint_errors": errors})
            );
        }
        Ok(())
    })();
    unsafe {
        CoUninitialize();
    }
    result
}

#[cfg(not(windows))]
fn main() {
    eprintln!("Windows Core Audio is required for this diagnostic.");
}
