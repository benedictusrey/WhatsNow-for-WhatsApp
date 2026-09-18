use super::Availability;
use std::collections::HashMap;
use zbus::blocking::Connection;
use zbus_polkit::policykit1::{AuthorityProxyBlocking, CheckAuthorizationFlags, Subject};

const ACTION_ID: &str = "app.whatsnow.desktop.unlock";

pub fn availability() -> Availability {
    // Connection::system() and AuthorityProxyBlocking::new both return zbus::Result,
    // so and_then unifies cleanly here (no Box needed).
    match Connection::system().and_then(|c| AuthorityProxyBlocking::new(&c)) {
        Ok(_) => Availability::Available,
        Err(_) => Availability::NotConfigured,
    }
}

pub fn authenticate(_app: &tauri::AppHandle, _reason: &str) -> Result<bool, String> {
    check_polkit_unlock().map_err(|e| e.to_string())
}

/// Box<dyn Error> so both zbus::Error and zbus_polkit::Error convert via `?`.
fn check_polkit_unlock() -> Result<bool, Box<dyn std::error::Error>> {
    let conn = Connection::system()?;
    // BLOCKING proxy — async AuthorityProxy would require &zbus::Connection + .await.
    let authority = AuthorityProxyBlocking::new(&conn)?;
    // Subject = this process. polkit resolves the action, popping the desktop's polkit
    // agent dialog (fingerprint where pam_fprintd is configured).
    // new_for_owner(pid: u32, start_time: Option<u64>, uid: Option<u32>)
    let subject = Subject::new_for_owner(std::process::id(), None, None)?;
    let details: HashMap<&str, &str> = HashMap::new();
    let result = authority.check_authorization(
        &subject,
        ACTION_ID,
        &details,
        CheckAuthorizationFlags::AllowUserInteraction.into(), // -> BitFlags<CheckAuthorizationFlags>
        "",                                                   // cancellation_id
    )?;
    Ok(result.is_authorized)
}
