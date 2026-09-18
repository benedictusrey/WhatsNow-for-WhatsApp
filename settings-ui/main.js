// WhatsNow — authored and maintained solely by @benedictusrey.
const invoke = window.__TAURI__?.core?.invoke ?? (async () => {
  throw new Error("WhatsNow settings require the desktop runtime.");
});
const BOOLS = [
  "close_to_tray",
  "start_minimized",
  "autostart",
  "notifications",
  "notification_previews",
  "always_on_top",
  "hotkey_enabled",
];
const systemDark = window.matchMedia("(prefers-color-scheme: dark)");
let selectedTheme = "system";
const THEME_LABELS = Object.freeze({
  system: "Dark",
  light: "Light",
  dark: "Dark",
  midnight: "Midnight",
  forest: "Forest",
  graphite: "Graphite",
  ocean: "Ocean",
  blush: "Blush",
  lavender: "Lavender",
  candy: "Candy",
  aurora: "Aurora",
});
const PANEL_META = Object.freeze({
  overview: ["Overview", "Your accounts, attention, and personal style at a glance."],
  accounts: ["Accounts", "Keep each WhatsApp session separate and easy to reach."],
  focus: ["Focus mode", "Quiet interruptions without disconnecting your conversations."],
  appearance: ["Appearance", "Personalize Settings, app lock, and the chatting workspace."],
  notifications: ["Notifications", "Choose how message activity reaches your desktop."],
  preferences: ["Preferences", "Tune how WhatsNow behaves around your workflow."],
  security: ["Security", "Control access to your WhatsNow conversations."],
  about: ["About", "Version, authorship, and project identity."],
});

function detectPlatform() {
  const value = navigator.userAgentData?.platform || navigator.platform || navigator.userAgent || "";
  if (/mac/i.test(value)) return "macos";
  if (/win/i.test(value)) return "windows";
  return "linux";
}

function platformDefaultHotkey() {
  return detectPlatform() === "linux" ? "Ctrl+Alt+W" : "Alt+W";
}

function applyTheme(theme) {
  selectedTheme = window.WhatsNowTheme.apply(document, theme, systemDark.matches);
  const overviewTheme = document.getElementById("overview_theme");
  if (overviewTheme) overviewTheme.textContent = THEME_LABELS[selectedTheme] || "Dark";
}

function selectTheme(theme) {
  const normalized = window.WhatsNowTheme.normalize(theme);
  const input = document.querySelector(`input[name="theme"][value="${normalized}"]`);
  if (input) input.checked = true;
  applyTheme(normalized);
}

function wireThemePicker() {
  selectTheme("system");
  for (const input of document.querySelectorAll('input[name="theme"]')) {
    input.addEventListener("change", () => {
      if (input.checked) applyTheme(input.value);
    });
  }
  systemDark.addEventListener?.("change", () => {
    if (selectedTheme === "system") applyTheme("system");
  });
}

function showNote(elementId, message, timeoutMs = 2500) {
  const note = document.getElementById(elementId);
  note.textContent = message;
  if (timeoutMs > 0) {
    setTimeout(() => {
      if (note.textContent === message) note.textContent = "";
    }, timeoutMs);
  }
}

function wireExternalLinks() {
  document.addEventListener("click", (event) => {
    const link = event.target.closest?.('a[href^="http://"], a[href^="https://"]');
    if (!link) return;
    event.preventDefault();
    invoke("open_external_url", { url: link.href }).catch((error) => {
      showNote("note", "Choose a browser to open this link: " + String(error), 6000);
    });
  });
}

async function load() {
  const s = await invoke("get_settings");
  selectTheme(s.theme || "system");
  for (const f of BOOLS) {
    const el = document.getElementById(f);
    if (el) el.checked = !!s[f];
  }
  document.getElementById("hotkey").value = s.hotkey || platformDefaultHotkey();
  document.getElementById("notification_preview_duration_secs").value = String(
    Math.min(30, Math.max(2, Number(s.notification_preview_duration_secs) || 2)),
  );
}

async function save() {
  const button = document.getElementById("save");
  const note = document.getElementById("note");
  button.disabled = true;
  showNote("note", "Saving changes…", 0);
  try {
    const s = await invoke("get_settings");
    s.theme = selectedTheme;
    for (const f of BOOLS) {
      const el = document.getElementById(f);
      if (el) s[f] = el.checked;
    }
    const hk = document.getElementById("hotkey").value.trim();
    s.hotkey = hk || platformDefaultHotkey();
    const previewDuration = Number.parseInt(
      document.getElementById("notification_preview_duration_secs").value,
      10,
    );
    s.notification_preview_duration_secs = Math.min(
      30,
      Math.max(2, Number.isFinite(previewDuration) ? previewDuration : 2),
    );
    const warn = await invoke("set_settings", { settings: s });
    await load();
    if (warn) {
      showNote("note", "Saved, with a warning: " + warn, 7000);
    } else {
      showNote("note", "All changes saved and applied.");
    }
  } catch (e) {
    note.textContent = "Could not save changes: " + String(e);
  } finally {
    button.disabled = false;
  }
}

// --- Focus and notification tools ---

function renderFocus(status) {
  const badge = document.getElementById("focus_status");
  const endButton = document.getElementById("focus_off");
  endButton.hidden = !status.focus_active;
  const overview = document.getElementById("overview_focus");
  if (!status.focus_active) {
    badge.textContent = "Ready";
    if (overview) overview.textContent = "Ready";
    return;
  }
  const totalMinutes = Math.max(1, Math.ceil(status.focus_remaining_secs / 60));
  const label = totalMinutes >= 60
    ? `${Math.floor(totalMinutes / 60)}h ${totalMinutes % 60}m`
    : `${totalMinutes}m`;
  badge.textContent = `Focus · ${label}`;
  if (overview) overview.textContent = label;
}

async function loadFocus() {
  try {
    renderFocus(await invoke("get_productivity_status"));
  } catch (e) {
    renderFocus({ focus_active: false, focus_remaining_secs: 0 });
  }
}

async function setFocus(minutes) {
  try {
    const status = await invoke("set_focus_mode", { minutes });
    renderFocus(status);
    showNote("note", minutes === 0 ? "Notifications resumed" : "Focus mode enabled");
  } catch (e) {
    showNote("note", String(e), 5000);
  }
}

async function testNotification() {
  const button = document.getElementById("test_notification");
  button.disabled = true;
  try {
    const result = await invoke("test_notification");
    showNote("test_notification_note", result || "Test delivered.", 7000);
  } catch (e) {
    showNote("test_notification_note", String(e), 5000);
  } finally {
    button.disabled = false;
  }
}

// --- Accounts ---

function renderAccounts(accounts) {
  const list = document.getElementById("accounts-list");
  list.textContent = "";
  const canRemove = accounts.length > 1;
  const overviewAccounts = document.getElementById("overview_accounts");
  if (overviewAccounts) {
    overviewAccounts.textContent =
      `${accounts.length} ${accounts.length === 1 ? "account" : "accounts"}`;
  }

  for (const a of accounts) {
    const row = document.createElement("div");
    row.className = "account-row";

    const name = document.createElement("span");
    name.className = "acct-name";
    name.textContent = a.name;
    row.appendChild(name);

    if (a.unread > 0) {
      const badge = document.createElement("span");
      badge.className = "acct-unread";
      badge.textContent = String(a.unread);
      row.appendChild(badge);
    }

    const openBtn = document.createElement("button");
    openBtn.className = "secondary";
    openBtn.textContent = "Open";
    openBtn.addEventListener("click", async () => {
      await invoke("open_account", { id: a.id });
    });
    row.appendChild(openBtn);

    const muteBtn = document.createElement("button");
    muteBtn.className = "secondary";
    muteBtn.textContent = a.notifications_enabled ? "Mute" : "Unmute";
    muteBtn.setAttribute("aria-pressed", String(!a.notifications_enabled));
    muteBtn.title = a.notifications_enabled
      ? "Pause native alerts for this account"
      : "Resume native alerts for this account";
    muteBtn.addEventListener("click", async () => {
      try {
        await invoke("set_account_notifications", {
          id: a.id,
          enabled: !a.notifications_enabled,
        });
        await loadAccounts();
      } catch (e) {
        alert(String(e));
      }
    });
    row.appendChild(muteBtn);

    const renameBtn = document.createElement("button");
    renameBtn.className = "secondary";
    renameBtn.textContent = "Rename";
    renameBtn.addEventListener("click", async () => {
      const next = prompt("Rename account", a.name);
      if (next && next.trim() && next.trim() !== a.name) {
        try {
          await invoke("rename_account", { id: a.id, name: next.trim() });
        } catch (e) {
          alert(String(e));
        }
        await loadAccounts();
      }
    });
    row.appendChild(renameBtn);

    const removeBtn = document.createElement("button");
    removeBtn.className = "secondary";
    removeBtn.textContent = "Remove";
    removeBtn.disabled = !canRemove;
    removeBtn.addEventListener("click", async () => {
      if (!confirm(`Remove account "${a.name}"? Its local session will be deleted.`)) return;
      try {
        await invoke("remove_account", { id: a.id });
      } catch (e) {
        alert(String(e));
      }
      await loadAccounts();
    });
    row.appendChild(removeBtn);

    list.appendChild(row);
  }
}

async function loadAccounts() {
  try {
    const accounts = await invoke("list_accounts");
    renderAccounts(accounts);
  } catch (e) {
    // ignore — listing failed
  }
}

async function addAccount() {
  const input = document.getElementById("new_account_name");
  const name = input.value.trim();
  if (!name) return;
  try {
    await invoke("add_account", { name });
    input.value = "";
    await loadAccounts();
  } catch (e) {
    const msg = String(e);
    // Only the macOS < 14 case is permanent — disable Add and surface the note.
    // Other failures (disk write, window build) are transient: report and let the user retry.
    if (msg.includes("macOS 14")) {
      const note = document.getElementById("macos-note");
      note.textContent = msg;
      note.hidden = false;
      document.getElementById("add_account").disabled = true;
      document.getElementById("new_account_name").disabled = true;
    } else {
      alert(msg);
    }
  }
}

function showPanel(panelName) {
  if (!PANEL_META[panelName]) return;
  for (const panel of document.querySelectorAll("[data-panel]")) {
    const active = panel.dataset.panel === panelName;
    panel.hidden = !active;
    panel.classList.toggle("active", active);
  }
  for (const button of document.querySelectorAll("[data-panel-target]")) {
    const active = button.dataset.panelTarget === panelName;
    button.classList.toggle("active", active);
    button.setAttribute("aria-current", active ? "page" : "false");
  }
  const [title, description] = PANEL_META[panelName];
  document.getElementById("panel_title").textContent = title;
  document.getElementById("panel_description").textContent = description;
  document.getElementById("save").hidden = panelName === "about";
  document.querySelector(".panel-stage").scrollTop = 0;
}

function wirePanelNavigation() {
  for (const button of document.querySelectorAll("[data-panel-target]")) {
    button.addEventListener("click", () => showPanel(button.dataset.panelTarget));
  }
  for (const button of document.querySelectorAll("[data-jump-panel]")) {
    button.addEventListener("click", () => showPanel(button.dataset.jumpPanel));
  }
}

function wireFocusControls() {
  for (const button of document.querySelectorAll("[data-focus-minutes]")) {
    button.addEventListener("click", () => setFocus(Number(button.dataset.focusMinutes)));
  }
  document.getElementById("focus_custom_start").addEventListener("click", () => {
    const value = Number.parseInt(document.getElementById("focus_custom").value, 10);
    setFocus(Math.min(1440, Math.max(1, Number.isFinite(value) ? value : 90)));
  });
  document.getElementById("focus_off").addEventListener("click", () => setFocus(0));
}

function wireShortcutPresets() {
  const platform = detectPlatform();
  const recommended = platformDefaultHotkey();
  const recommendedButton = document.querySelector('[data-hotkey-preset="platform"]');
  recommendedButton.dataset.hotkeyPreset = recommended;
  recommendedButton.textContent = platform === "macos"
    ? "Use Option + W"
    : `Use ${recommended.replaceAll("+", " + ")}`;

  const note = document.getElementById("platform_shortcut_note");
  if (platform === "windows") {
    note.textContent =
      "Alt + W is the Windows default and is placed next to Record for quick restoration.";
  } else if (platform === "macos") {
    note.textContent =
      "Option + W is the macOS default. Use the adjacent presets if another app already owns it.";
  } else {
    note.textContent =
      "Ctrl + Alt + W is the Linux default. On Wayland, bind `whatsnow --toggle` in desktop keyboard settings if global shortcuts are blocked.";
  }

  for (const button of document.querySelectorAll("[data-hotkey-preset]")) {
    button.addEventListener("click", () => {
      document.getElementById("hotkey").value = button.dataset.hotkeyPreset;
      setHotkeyHint("");
    });
  }
}

window.addEventListener("DOMContentLoaded", () => {
  wireExternalLinks();
  wireThemePicker();
  wirePanelNavigation();
  wireFocusControls();
  wireShortcutPresets();
  load().catch((error) => {
    showNote("note", "Settings could not be loaded: " + String(error), 0);
  });
  Promise.allSettled([loadAccounts(), loadLock(), loadFocus()]);
  wireLock();
  document.getElementById("save").addEventListener("click", save);
  document.getElementById("add_account").addEventListener("click", addAccount);
  document.getElementById("new_account_name").addEventListener("keydown", (e) => {
    if (e.key === "Enter") addAccount();
  });
  document.getElementById("record_hotkey").addEventListener("click", toggleRecording);
  document.getElementById("test_notification").addEventListener("click", testNotification);
  window.setInterval(loadFocus, 60_000);
});

// --- App lock ---

async function loadLock() {
  let s;
  try {
    s = await invoke("get_lock_status");
  } catch (e) {
    return;
  }
  const disabled = document.getElementById("lock-disabled");
  const enabled = document.getElementById("lock-enabled");
  disabled.hidden = s.enabled;
  enabled.hidden = !s.enabled;

  if (s.enabled) {
    const row = document.getElementById("biometric_row");
    row.hidden = !s.biometric_available;
    document.getElementById("biometric_label").textContent = "Use " + s.biometric_label;
    document.getElementById("biometric_enabled").checked = s.biometric_enabled;
    document.getElementById("lock_on_launch").checked = s.lock_on_launch;
    document.getElementById("lock_on_hide").checked = s.lock_on_hide;
    document.getElementById("idle_min").value = String(Math.round(s.idle_secs / 60));
  }
}

async function saveLockOptions() {
  const idleMin = parseInt(document.getElementById("idle_min").value, 10) || 0;
  await invoke("set_app_lock_options", {
    lockOnLaunch: document.getElementById("lock_on_launch").checked,
    lockOnHide: document.getElementById("lock_on_hide").checked,
    idleSecs: Math.max(0, idleMin) * 60,
  });
}

function wireLock() {
  document.getElementById("enable_lock").addEventListener("click", async () => {
    const a = document.getElementById("lock_pw1").value;
    const b = document.getElementById("lock_pw2").value;
    try {
      await invoke("set_app_lock_password", { new: a, confirm: b });
      document.getElementById("lock_pw1").value = "";
      document.getElementById("lock_pw2").value = "";
      await loadLock();
    } catch (e) { alert(String(e)); }
  });

  document.getElementById("lock_now").addEventListener("click", async () => {
    try { await invoke("lock_app"); } catch (e) { alert(String(e)); }
  });

  document.getElementById("change_pw").addEventListener("click", async () => {
    const current = prompt("Current password:");
    if (current === null) return;
    const next = prompt("New password (min 4):");
    if (!next) return;
    try {
      await invoke("change_app_lock_password", { current, new: next, confirm: next });
      alert("Password changed.");
    } catch (e) { alert(String(e)); }
  });

  document.getElementById("disable_lock").addEventListener("click", async () => {
    const current = prompt("Enter your current password to disable the lock:");
    if (current === null) return;
    try {
      await invoke("disable_app_lock", { current });
      await loadLock();
    } catch (e) { alert(String(e)); }
  });

  document.getElementById("biometric_enabled").addEventListener("change", async (e) => {
    try {
      await invoke("set_biometric_enabled", { enabled: e.target.checked });
    } catch (err) {
      alert(String(err));
      e.target.checked = !e.target.checked; // revert on failure
    }
    await loadLock();
  });

  for (const id of ["lock_on_launch", "lock_on_hide"]) {
    document.getElementById(id).addEventListener("change", () => saveLockOptions().catch((e) => alert(String(e))));
  }
  document.getElementById("idle_min").addEventListener("change", () => saveLockOptions().catch((e) => alert(String(e))));
}

// --- Shortcut recorder ---

let recordingHotkey = false;
let hotkeyPrev = "";
const MODIFIER_KEYS = new Set(["Control", "Shift", "Alt", "Meta"]);

function setHotkeyHint(msg) {
  const hint = document.getElementById("hotkey_hint");
  if (!msg) { hint.hidden = true; hint.textContent = ""; }
  else { hint.textContent = msg; hint.hidden = false; }
}

function stopRecording(restore) {
  if (!recordingHotkey) return;
  recordingHotkey = false;
  window.removeEventListener("keydown", onRecordKeydown, true);
  window.removeEventListener("blur", onRecordBlur, true);
  const btn = document.getElementById("record_hotkey");
  btn.textContent = "Record";
  btn.classList.remove("recording");
  if (restore) document.getElementById("hotkey").value = hotkeyPrev;
}

function onRecordBlur() { setHotkeyHint(""); stopRecording(true); }

function onRecordKeydown(e) {
  e.preventDefault();
  e.stopPropagation();
  if (MODIFIER_KEYS.has(e.key)) return;            // ignore bare modifiers
  if (e.key === "Escape") { setHotkeyHint(""); stopRecording(true); return; }
  const mods = { ctrl: e.ctrlKey, alt: e.altKey, shift: e.shiftKey, meta: e.metaKey };
  const accel = window.HotkeyFmt.comboToAccelerator(mods, e.code);
  if (accel === null) { setHotkeyHint("Unsupported key — try another."); return; }
  if (!window.HotkeyFmt.isValidCombo(mods, e.code)) {
    setHotkeyHint("Add a modifier (Ctrl / Alt / Shift).");
    return;
  }
  document.getElementById("hotkey").value = accel;
  setHotkeyHint("");
  stopRecording(false);
}

function toggleRecording() {
  if (recordingHotkey) { setHotkeyHint(""); stopRecording(true); return; }
  recordingHotkey = true;
  hotkeyPrev = document.getElementById("hotkey").value;
  const btn = document.getElementById("record_hotkey");
  btn.textContent = "Press keys… (Esc to cancel)";
  btn.classList.add("recording");
  setHotkeyHint("");
  window.addEventListener("keydown", onRecordKeydown, true);
  window.addEventListener("blur", onRecordBlur, true);
}
