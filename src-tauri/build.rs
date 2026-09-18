fn main() {
    let app_manifest = tauri_build::AppManifest::new().commands(&[
        "add_account",
        "activate_notification_window",
        "change_app_lock_password",
        "disable_app_lock",
        "dlog",
        "get_lock_status",
        "get_productivity_status",
        "get_settings",
        "get_theme",
        "list_accounts",
        "lock_app",
        "notification_click",
        "notify",
        "open_external_url",
        "open_account",
        "open_settings",
        "remove_account",
        "rename_account",
        "reset_app_lock",
        "set_app_lock_options",
        "set_app_lock_password",
        "set_account_notifications",
        "set_biometric_enabled",
        "set_focus_mode",
        "set_profile_name",
        "set_settings",
        "set_unread",
        "set_unread_count",
        "test_notification",
        "unlock_biometric",
        "unlock_password",
    ]);
    let attributes = tauri_build::Attributes::new().app_manifest(app_manifest);
    tauri_build::try_build(attributes).expect("failed to prepare the WhatsNow desktop build");

    refine_windows_resource();
}

#[cfg(windows)]
fn refine_windows_resource() {
    if std::env::var("CARGO_CFG_TARGET_OS").as_deref() != Ok("windows") {
        return;
    }

    // Tauri intentionally uses productName for FileDescription. Refine its
    // generated resource and recompile it in place, preserving the one resource
    // link directive that tauri-build already emitted.
    let output_dir = std::path::PathBuf::from(
        std::env::var_os("OUT_DIR").expect("Cargo did not provide OUT_DIR"),
    );
    let resource_path = output_dir.join("resource.rc");
    let library_path = output_dir.join("resource.lib");
    let resource = std::fs::read_to_string(&resource_path)
        .expect("failed to read Tauri's generated Windows resource");
    let refined = resource
        .replace(
            "VALUE \"FileDescription\", \"WhatsNow\"",
            concat!(
                "VALUE \"Comments\", \"Private, multi-account WhatsApp Web client with productivity, notification, app-lock, and personalized theme tools.\"\n",
                "VALUE \"FileDescription\", \"WhatsNow\"\n",
                "VALUE \"InternalName\", \"WhatsNow\"\n",
                "VALUE \"OriginalFilename\", \"WhatsNow.exe\""
            ),
        );
    assert_ne!(
        refined, resource,
        "Tauri's Windows resource format changed; FileDescription was not refined"
    );
    std::fs::write(&resource_path, refined)
        .expect("failed to write refined WhatsNow Windows resource");
    let _ = std::fs::remove_file(&library_path);

    let target = std::env::var("TARGET").expect("Cargo did not provide TARGET");
    let compiler = cc::windows_registry::find_tool(&target, "rc.exe")
        .expect("Windows SDK rc.exe was not found");
    let status = compiler
        .to_command()
        .arg("/fo")
        .arg(&library_path)
        .arg("/I")
        .arg(&output_dir)
        .arg(&resource_path)
        .status()
        .expect("failed to run Windows SDK rc.exe");
    assert!(status.success(), "rc.exe rejected the refined resource");
}

#[cfg(not(windows))]
fn refine_windows_resource() {
    if std::env::var("CARGO_CFG_TARGET_OS").as_deref() == Ok("windows") {
        println!(
            "cargo:warning=Cross-compiled Windows builds keep Tauri's default FileDescription; build on Windows for refined Explorer metadata."
        );
    }
}
