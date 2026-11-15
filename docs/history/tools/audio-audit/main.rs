//! Read-only audio-session audit for WhatsNow by @benedictusrey.
use windows::core::Interface;
use windows::Win32::Media::Audio::{
    eRender, IAudioSessionControl2, IAudioSessionManager2, IMMDeviceEnumerator,
    ISimpleAudioVolume, MMDeviceEnumerator, DEVICE_STATE_ACTIVE,
};
use windows::Win32::System::Com::{
    CoCreateInstance, CoInitializeEx, CoTaskMemFree, CoUninitialize,
    CLSCTX_ALL, COINIT_MULTITHREADED,
};

fn main() -> windows::core::Result<()> {
    // SAFETY: this diagnostic owns an MTA; all COM handles stay on this thread.
    unsafe { CoInitializeEx(None, COINIT_MULTITHREADED).ok()?; }
    let result = read();
    unsafe { CoUninitialize(); }
    result
}

fn read() -> windows::core::Result<()> {
    unsafe {
        let enumerator: IMMDeviceEnumerator = CoCreateInstance(&MMDeviceEnumerator, None, CLSCTX_ALL)
            .map_err(|error| { eprintln!("API: CoCreateInstance(MMDeviceEnumerator)"); error })?;
        let devices = enumerator.EnumAudioEndpoints(eRender, DEVICE_STATE_ACTIVE)
            .map_err(|error| { eprintln!("API: EnumAudioEndpoints"); error })?;
        let mut rows = Vec::new();
        let mut endpoint_errors = Vec::new();
        for device_index in 0..devices.GetCount()? {
            let device = devices.Item(device_index)?;
            let endpoint = device.GetId()?;
            let endpoint_id = endpoint.to_string()?;
            CoTaskMemFree(Some(endpoint.0.cast()));
            let manager: IAudioSessionManager2 = device.Activate(CLSCTX_ALL, None)
                .map_err(|error| { eprintln!("API: IMMDevice.Activate(IAudioSessionManager2)"); error })?;
            let sessions = match manager.GetSessionEnumerator() {
                Ok(sessions) => sessions,
                Err(error) => {
                    endpoint_errors.push(serde_json::json!({"endpoint": endpoint_id, "api": "GetSessionEnumerator", "error": format!("{error:?}")}));
                    continue;
                }
            };
            for index in 0..sessions.GetCount()? {
                let session = sessions.GetSession(index)?;
                let control: IAudioSessionControl2 = session.cast()?;
                let volume: ISimpleAudioVolume = session.cast()?;
                let identifier = control.GetSessionIdentifier()?;
                let session_id = identifier.to_string()?;
                CoTaskMemFree(Some(identifier.0.cast()));
                let name = session.GetDisplayName()?;
                let display_name = name.to_string()?;
                CoTaskMemFree(Some(name.0.cast()));
                rows.push(serde_json::json!({
                    "endpoint": endpoint_id,
                    "pid": control.GetProcessId()?,
                    "muted": volume.GetMute()?.as_bool(),
                    "volume": volume.GetMasterVolume()?,
                    "state": session.GetState()?.0,
                    "display_name": display_name,
                    "group": format!("{:?}", session.GetGroupingParam()?),
                    "session": session_id,
                }));
            }
        }
        println!("{}", serde_json::to_string_pretty(&serde_json::json!({"sessions": rows, "endpoint_errors": endpoint_errors})).unwrap());
    }
    Ok(())
}
