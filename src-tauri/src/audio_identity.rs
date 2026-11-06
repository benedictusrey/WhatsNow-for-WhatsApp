//! WhatsNow-owned Windows audio identity, maintained by @benedictusrey.
use std::collections::HashMap;
use std::thread::JoinHandle;
use std::time::{Duration, Instant};

fn authorized_owner(
    pid: u32,
    single: bool,
    active: bool,
    birth: Option<u64>,
    members: &HashMap<u32, u64>,
) -> bool {
    single
        && active
        && pid != 0
        && birth.is_some_and(|value| value != 0 && members.get(&pid) == Some(&value))
}

fn captured_birth(birth: u64, query_started: u64) -> Option<u64> {
    (birth != 0 && birth <= query_started).then_some(birth)
}

fn retain_notification(owned: bool, expired: bool, age: Duration) -> bool {
    !expired && (owned || age <= Duration::from_secs(5))
}

fn finish_worker(thread: JoinHandle<()>, budget: Duration) -> bool {
    let until = Instant::now() + budget;
    while !thread.is_finished() && Instant::now() < until {
        std::thread::sleep(Duration::from_millis(1));
    }
    if thread.is_finished() {
        let _ = thread.join();
        true
    } else {
        false
    }
}

#[cfg(windows)]
#[path = "audio_identity_windows.rs"]
mod platform;
#[cfg(windows)]
pub use platform::{AudioProcessRegistrar, AudioSessionIdentityGuard};

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn keeps_owned_notification_only_sessions_until_they_can_play() {
        assert!(retain_notification(true, false, Duration::from_secs(3600)));
        assert!(!retain_notification(true, true, Duration::ZERO));
        assert!(!retain_notification(false, false, Duration::from_secs(6)));
        assert!(retain_notification(false, false, Duration::from_secs(1)));
    }

    #[test]
    fn authoritative_membership_requires_the_same_live_process() {
        let members = HashMap::from([(200, 20)]);
        assert!(authorized_owner(200, true, true, Some(20), &members));
        assert!(!authorized_owner(200, true, true, Some(21), &members));
        assert!(!authorized_owner(201, true, true, Some(20), &members));
        assert!(!authorized_owner(200, false, true, Some(20), &members));
        assert!(!authorized_owner(200, true, false, Some(20), &members));
        assert!(!authorized_owner(200, true, true, None, &members));
        assert!(!authorized_owner(0, true, true, Some(20), &members));
    }

    #[test]
    fn rejects_replacement_between_membership_query_and_handle_lookup() {
        assert_eq!(captured_birth(21, 20), None);
        assert_eq!(captured_birth(0, 20), None);
        assert_eq!(captured_birth(19, 20), Some(19));
    }

    #[test]
    fn shutdown_does_not_wait_forever_for_a_stalled_worker() {
        let (send, receive) = std::sync::mpsc::channel::<()>();
        let worker = std::thread::spawn(move || {
            let _ = receive.recv();
        });
        let started = Instant::now();
        assert!(!finish_worker(worker, Duration::from_millis(10)));
        assert!(started.elapsed() < Duration::from_secs(1));
        let _ = send.send(());
        assert!(finish_worker(
            std::thread::spawn(|| {}),
            Duration::from_secs(1)
        ));
    }
}
