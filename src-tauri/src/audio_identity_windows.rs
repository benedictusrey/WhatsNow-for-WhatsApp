//! Native audio-session metadata for WhatsNow by @benedictusrey.
use super::{authorized_owner, captured_birth, finish_worker, retain_notification};
use std::collections::{HashMap, VecDeque};
use std::sync::{
    atomic::{AtomicBool, Ordering},
    mpsc, Arc, Mutex,
};
use std::thread::JoinHandle;
use std::time::{Duration, Instant, SystemTime, UNIX_EPOCH};
use webview2_com::Microsoft::Web::WebView2::Win32::{
    ICoreWebView2, ICoreWebView2Environment8, ICoreWebView2_2, ICoreWebView2_8,
    COREWEBVIEW2_PROCESS_KIND_BROWSER, COREWEBVIEW2_PROCESS_KIND_RENDERER,
    COREWEBVIEW2_PROCESS_KIND_UTILITY,
};
use windows::core::{implement, Interface, Ref, GUID, PCWSTR};
use windows::Win32::Foundation::{CloseHandle, FILETIME, HANDLE, PROPERTYKEY, S_OK};
use windows::Win32::Media::Audio::*;
use windows::Win32::System::Com::*;
use windows::Win32::System::Threading::{
    GetExitCodeProcess, GetProcessTimes, OpenProcess, PROCESS_QUERY_LIMITED_INFORMATION,
};

const AUDIO_GROUP: GUID = GUID::from_u128(0x17cd4924_c1f4_4df7_9de1_b1d95f293640);
const EVENT_CONTEXT: GUID = GUID::from_u128(0x59142fe5_0554_4940_91b9_c72c4b98cf3b);
const GLOBAL_TABLE: GUID = GUID::from_u128(0x00000323_0000_0000_c000_000000000046);

struct Handle(HANDLE);
impl Drop for Handle {
    fn drop(&mut self) {
        unsafe {
            let _ = CloseHandle(self.0);
        }
    }
}
fn process(pid: u32) -> windows::core::Result<(Handle, u64)> {
    unsafe {
        let handle = Handle(OpenProcess(PROCESS_QUERY_LIMITED_INFORMATION, false, pid)?);
        let (mut birth, mut exit, mut kernel, mut user) = (
            FILETIME::default(),
            FILETIME::default(),
            FILETIME::default(),
            FILETIME::default(),
        );
        GetProcessTimes(handle.0, &mut birth, &mut exit, &mut kernel, &mut user)?;
        let mut code = 0;
        GetExitCodeProcess(handle.0, &mut code)?;
        if code != 259 {
            return Err(windows::core::Error::from_hresult(
                windows::Win32::Foundation::E_FAIL,
            ));
        }
        Ok((
            handle,
            ((birth.dwHighDateTime as u64) << 32) | birth.dwLowDateTime as u64,
        ))
    }
}
fn filetime_now() -> u64 {
    let elapsed = SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .unwrap_or_default();
    (elapsed.as_secs() + 11_644_473_600) * 10_000_000 + u64::from(elapsed.subsec_nanos()) / 100
}
enum Work {
    Refresh,
    Session(NotifiedSession),
}

struct NotifiedSession {
    cookie: u32,
    git: IGlobalInterfaceTable,
}
// SAFETY: only the standard process-wide, thread-safe GIT crosses apartments;
// the session itself is marshalled by cookie. Send/drop sites are COM-initialized.
unsafe impl Send for NotifiedSession {}
impl Drop for NotifiedSession {
    fn drop(&mut self) {
        unsafe {
            let _ = self.git.RevokeInterfaceFromGlobal(self.cookie);
        }
    }
}

/// Membership comes only from a trusted, owned WebView2 environment, never filenames or ancestry guesses.
#[derive(Clone)]
pub struct AudioProcessRegistrar {
    members: Arc<Mutex<HashMap<u32, u64>>>,
    wired: Arc<Mutex<HashMap<u32, u64>>>,
    send: mpsc::SyncSender<Work>,
}
impl AudioProcessRegistrar {
    pub fn attach(&self, webview: &tauri::webview::PlatformWebview) -> Result<(), String> {
        unsafe {
            let core = webview
                .controller()
                .CoreWebView2()
                .map_err(|e| e.to_string())?;
            self.capture(&core).map_err(|e| e.to_string())?;
            let registrar = self.clone();
            let audio = webview2_com::IsDocumentPlayingAudioChangedEventHandler::create(Box::new(
                move |sender, _| {
                    if let Some(core) = sender {
                        let _ = registrar.capture(&core);
                    }
                    Ok(())
                },
            ));
            let mut token = 0;
            core.cast::<ICoreWebView2_8>()
                .and_then(|c| c.add_IsDocumentPlayingAudioChanged(&audio, &mut token))
                .map_err(|e| e.to_string())?;
            let mut browser = 0;
            core.BrowserProcessId(&mut browser)
                .map_err(|e| e.to_string())?;
            let (_, birth) = process(browser).map_err(|e| e.to_string())?;
            let wire = if let Ok(mut wired) = self.wired.lock() {
                wired.retain(|pid, time| process(*pid).is_ok_and(|(_, current)| current == *time));
                if wired.get(&browser) == Some(&birth) {
                    false
                } else {
                    wired.insert(browser, birth);
                    true
                }
            } else {
                false
            };
            if wire {
                let env = core
                    .cast::<ICoreWebView2_2>()
                    .and_then(|c| c.Environment())
                    .map_err(|e| e.to_string())?;
                let registrar = self.clone();
                let changed = webview2_com::ProcessInfosChangedEventHandler::create(Box::new(
                    move |sender, _| {
                        if let Some(env) = sender {
                            if let Ok(env) = env.cast::<ICoreWebView2Environment8>() {
                                let _ = registrar.capture_environment(&env);
                            }
                        }
                        Ok(())
                    },
                ));
                env.cast::<ICoreWebView2Environment8>()
                    .and_then(|e| e.add_ProcessInfosChanged(&changed, &mut token))
                    .map_err(|e| e.to_string())?;
            }
        }
        Ok(())
    }
    unsafe fn capture(&self, core: &ICoreWebView2) -> windows::core::Result<()> {
        self.capture_environment(
            &core
                .cast::<ICoreWebView2_2>()?
                .Environment()?
                .cast::<ICoreWebView2Environment8>()?,
        )
    }
    unsafe fn capture_environment(
        &self,
        env: &ICoreWebView2Environment8,
    ) -> windows::core::Result<()> {
        let started = filetime_now();
        let infos = env.GetProcessInfos()?;
        let mut count = 0;
        infos.Count(&mut count)?;
        let mut current = HashMap::new();
        for index in 0..count {
            let Ok(info) = infos.GetValueAtIndex(index) else {
                continue;
            };
            let (mut pid, mut kind) = (0, COREWEBVIEW2_PROCESS_KIND_BROWSER);
            if info.ProcessId(&mut pid).is_err() || info.Kind(&mut kind).is_err() || pid <= 0 {
                continue;
            }
            if kind != COREWEBVIEW2_PROCESS_KIND_BROWSER
                && kind != COREWEBVIEW2_PROCESS_KIND_RENDERER
                && kind != COREWEBVIEW2_PROCESS_KIND_UTILITY
            {
                continue;
            }
            if let Ok((_handle, birth)) = process(pid as u32) {
                if let Some(birth) = captured_birth(birth, started) {
                    current.insert(pid as u32, birth);
                }
            }
        }
        if let Ok(mut members) = self.members.lock() {
            members.retain(|pid, time| process(*pid).is_ok_and(|(_, current)| current == *time));
            members.extend(current);
        }
        let _ = self.send.try_send(Work::Refresh);
        Ok(())
    }
}

#[implement(IAudioSessionNotification, IMMNotificationClient)]
struct Changed {
    send: mpsc::SyncSender<Work>,
    git: IGlobalInterfaceTable,
}
impl Changed_Impl {
    fn wake(&self) {
        let _ = self.send.try_send(Work::Refresh);
    }
}
impl IAudioSessionNotification_Impl for Changed_Impl {
    fn OnSessionCreated(
        &self,
        session: Ref<'_, IAudioSessionControl>,
    ) -> windows::core::Result<()> {
        if let Some(session) = session.as_ref() {
            // GIT cookies marshal this exact notification, including sessions omitted by enumeration.
            unsafe {
                let cookie = self
                    .git
                    .RegisterInterfaceInGlobal(session, &IAudioSessionControl::IID)?;
                let _ = self.send.try_send(Work::Session(NotifiedSession {
                    cookie,
                    git: self.git.clone(),
                }));
            }
        }
        Ok(())
    }
}
impl IMMNotificationClient_Impl for Changed_Impl {
    fn OnDeviceStateChanged(&self, _: &PCWSTR, _: DEVICE_STATE) -> windows::core::Result<()> {
        self.wake();
        Ok(())
    }
    fn OnDeviceAdded(&self, _: &PCWSTR) -> windows::core::Result<()> {
        self.wake();
        Ok(())
    }
    fn OnDeviceRemoved(&self, _: &PCWSTR) -> windows::core::Result<()> {
        self.wake();
        Ok(())
    }
    fn OnDefaultDeviceChanged(
        &self,
        _: EDataFlow,
        _: ERole,
        _: &PCWSTR,
    ) -> windows::core::Result<()> {
        self.wake();
        Ok(())
    }
    fn OnPropertyValueChanged(&self, _: &PCWSTR, _: &PROPERTYKEY) -> windows::core::Result<()> {
        self.wake();
        Ok(())
    }
}
struct Registration {
    manager: IAudioSessionManager2,
    callback: IAudioSessionNotification,
}
impl Drop for Registration {
    fn drop(&mut self) {
        unsafe {
            let _ = self.manager.UnregisterSessionNotification(&self.callback);
        }
    }
}
struct Devices {
    enumerator: IMMDeviceEnumerator,
    callback: IMMNotificationClient,
}
impl Drop for Devices {
    fn drop(&mut self) {
        unsafe {
            let _ = self
                .enumerator
                .UnregisterEndpointNotificationCallback(&self.callback);
        }
    }
}
struct Apartment;
impl Drop for Apartment {
    fn drop(&mut self) {
        unsafe {
            CoUninitialize();
        }
    }
}

pub struct AudioSessionIdentityGuard {
    stop: Arc<AtomicBool>,
    registrar: AudioProcessRegistrar,
    thread: Mutex<Option<JoinHandle<()>>>,
}
impl AudioSessionIdentityGuard {
    pub fn start() -> Result<Self, String> {
        let icon: Vec<u16> = std::env::current_exe()
            .map_err(|e| e.to_string())?
            .to_string_lossy()
            .encode_utf16()
            .chain(Some(0))
            .collect();
        let (send, receive) = mpsc::sync_channel(32);
        let registrar = AudioProcessRegistrar {
            members: Arc::new(Mutex::new(HashMap::new())),
            wired: Arc::new(Mutex::new(HashMap::new())),
            send,
        };
        let stop = Arc::new(AtomicBool::new(false));
        let (stopping, worker) = (stop.clone(), registrar.clone());
        let thread = std::thread::Builder::new()
            .name("whatsnow-audio-identity".into())
            .spawn(move || {
                if let Err(error) = run(&icon, &worker, receive, &stopping) {
                    crate::dlog::log(&format!("audio identity: unavailable ({error})"));
                }
            })
            .map_err(|e| e.to_string())?;
        Ok(Self {
            stop,
            registrar,
            thread: Mutex::new(Some(thread)),
        })
    }
    pub fn registrar(&self) -> AudioProcessRegistrar {
        self.registrar.clone()
    }
    pub fn stop(&self) {
        self.stop.store(true, Ordering::Release);
        let _ = self.registrar.send.try_send(Work::Refresh);
        if let Ok(mut thread) = self.thread.lock() {
            if let Some(thread) = thread.take() {
                if !finish_worker(thread, Duration::from_millis(100)) {
                    crate::dlog::log("audio identity: shutdown detached a pending native call");
                }
            }
        }
    }
}
impl Drop for AudioSessionIdentityGuard {
    fn drop(&mut self) {
        self.stop();
    }
}

unsafe fn take_session(notification: NotifiedSession) -> Option<IAudioSessionControl> {
    let mut ptr = std::ptr::null_mut();
    let result = notification.git.GetInterfaceFromGlobal(
        notification.cookie,
        &IAudioSessionControl::IID,
        &mut ptr,
    );
    result.ok()?;
    Some(IAudioSessionControl::from_raw(ptr))
}
fn run(
    icon: &[u16],
    registrar: &AudioProcessRegistrar,
    receive: mpsc::Receiver<Work>,
    stop: &AtomicBool,
) -> windows::core::Result<()> {
    unsafe {
        CoInitializeEx(None, COINIT_MULTITHREADED).ok()?;
    }
    let _apartment = Apartment;
    unsafe {
        let git: IGlobalInterfaceTable = CoCreateInstance(&GLOBAL_TABLE, None, CLSCTX_ALL)?;
        let mut pending: VecDeque<(Instant, IAudioSessionControl)> = VecDeque::new();
        while !stop.load(Ordering::Acquire) {
            // Service restart recovery creates fresh registrations; a bad endpoint is local.
            if let Ok(enumerator) =
                CoCreateInstance::<_, IMMDeviceEnumerator>(&MMDeviceEnumerator, None, CLSCTX_ALL)
            {
                let callback: IMMNotificationClient = Changed {
                    send: registrar.send.clone(),
                    git: git.clone(),
                }
                .into();
                if enumerator
                    .RegisterEndpointNotificationCallback(&callback)
                    .is_ok()
                {
                    let registration = Devices {
                        enumerator,
                        callback,
                    };
                    watch(
                        &registration.enumerator,
                        &git,
                        icon,
                        registrar,
                        &receive,
                        stop,
                        &mut pending,
                    );
                }
            }
            if !stop.load(Ordering::Acquire) {
                let _ = receive.recv_timeout(Duration::from_secs(30));
            }
        }
        // Release marshalled notifications on the owning MTA, before apartment teardown.
        while receive.try_recv().is_ok() {}
        drop(pending);
    }
    // A callback already in flight can still enqueue during teardown.
    drop(receive);
    Ok(())
}

unsafe fn watch(
    enumerator: &IMMDeviceEnumerator,
    git: &IGlobalInterfaceTable,
    icon: &[u16],
    registrar: &AudioProcessRegistrar,
    receive: &mpsc::Receiver<Work>,
    stop: &AtomicBool,
    pending: &mut VecDeque<(Instant, IAudioSessionControl)>,
) {
    while !stop.load(Ordering::Acquire) {
        let mut registrations = Vec::new();
        if let Ok(devices) = enumerator.EnumAudioEndpoints(eRender, DEVICE_STATE_ACTIVE) {
            for index in 0..devices.GetCount().unwrap_or(0) {
                let Ok(device) = devices.Item(index) else {
                    continue;
                };
                let Ok(manager) = device.Activate::<IAudioSessionManager2>(CLSCTX_ALL, None) else {
                    continue;
                };
                let callback: IAudioSessionNotification = Changed {
                    send: registrar.send.clone(),
                    git: git.clone(),
                }
                .into();
                if manager.RegisterSessionNotification(&callback).is_err() {
                    continue;
                }
                if let Ok(sessions) = manager.GetSessionEnumerator() {
                    for index in 0..sessions.GetCount().unwrap_or(0) {
                        if let Ok(session) = sessions.GetSession(index) {
                            // Debug fixture proves the notification path even when enumeration misses it.
                            #[cfg(debug_assertions)]
                            if std::env::var_os("WHATSNOW_IDENTITY_TEST_NOTIFICATIONS_ONLY")
                                .is_some()
                            {
                                continue;
                            }
                            let _ = identify(&session, icon, &registrar.members, stop);
                        }
                    }
                }
                registrations.push(Registration { manager, callback });
            }
        }
        pending.retain(|(since, session)| {
            let expired = session
                .GetState()
                .map_or(true, |state| state == AudioSessionStateExpired);
            let owned = notification_owned(session, &registrar.members);
            if !retain_notification(owned, expired, since.elapsed()) {
                return false;
            }
            !identify(session, icon, &registrar.members, stop).unwrap_or(false)
        });
        let timeout = if pending
            .iter()
            .any(|(since, _)| since.elapsed() <= Duration::from_secs(5))
        {
            Duration::from_millis(200)
        } else {
            Duration::from_secs(30)
        };
        if let Ok(work) = receive.recv_timeout(timeout) {
            let mut work = Some(work);
            while let Some(event) = work.take() {
                if let Work::Session(cookie) = event {
                    if let Some(session) = take_session(cookie) {
                        if pending.len() >= 64 {
                            pending.pop_front();
                        }
                        pending.push_back((Instant::now(), session));
                    }
                }
                work = receive.try_recv().ok();
            }
            if !stop.load(Ordering::Acquire) {
                std::thread::sleep(Duration::from_millis(50));
            }
        }
        drop(registrations);
    }
}

unsafe fn identify(
    session: &IAudioSessionControl,
    icon: &[u16],
    members: &Mutex<HashMap<u32, u64>>,
    stop: &AtomicBool,
) -> windows::core::Result<bool> {
    let control: IAudioSessionControl2 = session.cast()?;
    let mut pid = 0;
    let status = (Interface::vtable(&control).GetProcessId)(Interface::as_raw(&control), &mut pid);
    let Ok((_owner_handle, birth)) = process(pid) else {
        return Ok(false);
    };
    // Retain the process handle until all metadata writes finish, preventing PID recycling.
    let active = session
        .GetState()
        .is_ok_and(|state| state == AudioSessionStateActive);
    let owned = members
        .lock()
        .is_ok_and(|members| authorized_owner(pid, status == S_OK, active, Some(birth), &members));
    if !owned || stop.load(Ordering::Acquire) {
        return Ok(false);
    }
    let name: Vec<u16> = "WhatsNow\0".encode_utf16().collect();
    let current = session.GetDisplayName()?;
    let matches = current.to_string().is_ok_and(|value| value == "WhatsNow");
    CoTaskMemFree(Some(current.0.cast()));
    if !matches {
        session.SetDisplayName(PCWSTR(name.as_ptr()), &EVENT_CONTEXT)?;
    }
    let current = session.GetIconPath()?;
    let matches = current.to_string().is_ok_and(|value| {
        value
            .encode_utf16()
            .eq(icon.iter().copied().take(icon.len() - 1))
    });
    CoTaskMemFree(Some(current.0.cast()));
    if !matches {
        session.SetIconPath(PCWSTR(icon.as_ptr()), &EVENT_CONTEXT)?;
    }
    if session.GetGroupingParam()? != AUDIO_GROUP {
        session.SetGroupingParam(&AUDIO_GROUP, &EVENT_CONTEXT)?;
    }
    Ok(true)
}

unsafe fn notification_owned(
    session: &IAudioSessionControl,
    members: &Mutex<HashMap<u32, u64>>,
) -> bool {
    let Ok(control) = session.cast::<IAudioSessionControl2>() else {
        return false;
    };
    let mut pid = 0;
    let status = (Interface::vtable(&control).GetProcessId)(Interface::as_raw(&control), &mut pid);
    let Ok((_handle, birth)) = process(pid) else {
        return false;
    };
    members
        .lock()
        .is_ok_and(|members| authorized_owner(pid, status == S_OK, true, Some(birth), &members))
}
