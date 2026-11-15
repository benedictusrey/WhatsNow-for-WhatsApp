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
  overview: ["Overview", "Your accounts, alerts, and focus at a glance."],
  accounts: ["Accounts", "Keep each WhatsApp session separate and easy to reach."],
  focus: ["Focus", "Pause native alerts for a set time without disconnecting chats."],
  appearance: ["Appearance", "Pick a theme for Settings, the lock screen, and your chats."],
  notifications: ["Notifications", "Choose how message activity reaches your desktop."],
  preferences: ["Preferences", "Control how WhatsNow behaves while you work."],
  security: ["Security", "Require a password before any chat is revealed."],
  about: ["About", "Version, authorship, and project identity."],
});
const PANEL_ORDER = Object.keys(PANEL_META);

function $(id) {
  return document.getElementById(id);
}

function errorText(error) {
  const raw = error instanceof Error ? error.message : String(error);
  return raw.charAt(0).toUpperCase() + raw.slice(1);
}

function detectPlatform() {
  const value = navigator.userAgentData?.platform || navigator.platform || navigator.userAgent || "";
  if (/mac/i.test(value)) return "macos";
  if (/win/i.test(value)) return "windows";
  return "linux";
}

function platformDefaultHotkey() {
  return detectPlatform() === "linux" ? "Ctrl+Alt+W" : "Alt+W";
}

// --- Idle auto-close ------------------------------------------------------

function closeWindow() {
  const win = window.__TAURI__?.window?.getCurrentWindow();
  if (win?.close) {
    win.close().catch(() => window.close());
  } else {
    window.close();
  }
}

const idle = window.WhatsNowIdleClose.create({ idleMs: 30000, onIdle: closeWindow });
let busyCount = 0;

// Password and biometric commands can take a while (hashing, OS prompts): the
// window must not close underneath them.
async function withBusy(work) {
  busyCount += 1;
  idle.pause("busy");
  try {
    return await work();
  } finally {
    busyCount -= 1;
    if (busyCount === 0) idle.resume("busy");
  }
}

function wireIdleAndEscape() {
  for (const type of ["pointermove", "pointerdown", "keydown", "wheel", "input", "change"]) {
    window.addEventListener(type, () => idle.activity(), { passive: true });
  }
  document.documentElement.addEventListener("mouseenter", () => idle.pause("pointer"));
  document.documentElement.addEventListener("mouseleave", () => idle.resume("pointer"));
  document.addEventListener("visibilitychange", () => {
    if (document.hidden) idle.pause("hidden");
    else idle.resume("hidden");
  });
  if (document.hidden) idle.pause("hidden");
  idle.activity();

  $("window-close").addEventListener("click", closeWindow);
  window.addEventListener("keydown", (event) => {
    if (event.key !== "Escape" || event.defaultPrevented) return;
    if (recordingHotkey || document.querySelector("dialog[open]")) return;
    closeWindow();
  });
}

// --- Theme ------------------------------------------------------------------

function applyTheme(theme) {
  selectedTheme = window.WhatsNowTheme.apply(document, theme, systemDark.matches);
  const overviewTheme = $("overview_theme");
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
      if (!input.checked) return;
      applyTheme(input.value);
      autosave.queue({ theme: input.value });
    });
  }
  systemDark.addEventListener?.("change", () => {
    if (selectedTheme === "system") applyTheme("system");
  });
}

// --- Notes and the save status pill ---------------------------------------

function showNote(elementId, message, timeoutMs = 2500) {
  const note = $(elementId);
  note.textContent = message;
  if (timeoutMs > 0) {
    setTimeout(() => {
      if (note.textContent === message) note.textContent = "";
    }, timeoutMs);
  }
}

function showInlineError(elementId, message) {
  const element = $(elementId);
  element.textContent = message || "";
  element.hidden = !message;
}

let retryAction = null;
let pillFadeTimer = 0;

function renderSaveStatus(status) {
  const box = $("save_status");
  const text = $("save_status_text");
  const retry = $("save_retry");
  window.clearTimeout(pillFadeTimer);
  box.dataset.state = status.state;
  retry.hidden = status.state !== "error";
  switch (status.state) {
    case "pending":
    case "saving":
      text.textContent = "Saving…";
      box.hidden = false;
      break;
    case "saved":
      text.textContent = status.warning ? "Saved with a warning" : "Saved";
      box.hidden = false;
      break;
    case "error":
      text.textContent = "Couldn't save";
      box.hidden = false;
      break;
    default:
      box.hidden = true;
  }
}

// Saves that do not go through the settings file (app-lock options) share the
// same status pill so every control gives the same feedback.
async function trackSave(work, retry) {
  renderSaveStatus({ state: "saving" });
  try {
    await work();
    renderSaveStatus({ state: "saved" });
    pillFadeTimer = window.setTimeout(() => renderSaveStatus({ state: "idle" }), 1600);
    return true;
  } catch (error) {
    retryAction = retry;
    renderSaveStatus({ state: "error" });
    showNote("note", errorText(error), 6000);
    return false;
  }
}

function onAutosaveStatus(status) {
  if (status.state === "error") {
    retryAction = () => autosave.retry();
    renderSaveStatus(status);
    const patch = status.patch || {};
    if ("hotkey" in patch || "hotkey_enabled" in patch) {
      showInlineError("hotkey_error", errorText(status.message));
    } else {
      showNote("note", errorText(status.message), 6000);
    }
    return;
  }
  renderSaveStatus(status);
  if (status.state !== "saved") return;
  if ("hotkey" in (status.patch || {}) || "hotkey_enabled" in (status.patch || {})) {
    showInlineError("hotkey_error", "");
  }
  if (status.warning) {
    showNote("note", "Saved, with a warning: " + status.warning, 8000);
    if (/shortcut/i.test(status.warning)) {
      showInlineError("hotkey_error", errorText(status.warning));
    }
  }
  pillFadeTimer = window.setTimeout(() => {
    if ($("save_status").dataset.state === "saved") renderSaveStatus({ state: "idle" });
  }, 1600);
}

// --- Load gate: no control may write defaults over unreadable settings ------

let settingsLoaded = false;

function applyControlGate() {
  const controls = document.querySelectorAll(
    ".panel-stage input, .panel-stage button:not([data-jump-panel])",
  );
  for (const control of controls) {
    if (!settingsLoaded) {
      if (!control.disabled) {
        control.dataset.gated = "1";
        control.disabled = true;
      }
    } else if (control.dataset.gated) {
      control.disabled = false;
      delete control.dataset.gated;
    }
  }
}

function onLoadState(state) {
  settingsLoaded = state.ok;
  $("load_error").hidden = state.ok;
  if (!state.ok) {
    $("load_error_text").textContent =
      "Settings could not be loaded, so nothing can be changed. " + errorText(state.error);
  }
  applyControlGate();
  updateShortcutState();
}

const autosave = window.WhatsNowAutosave.create({
  invoke,
  onStatus: onAutosaveStatus,
  onLoadState,
});

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
  return autosave.load(applySettings);
}

let appNotificationsOn = true;

function applySettings(s) {
  selectTheme(s.theme || "system");
  for (const f of BOOLS) {
    const el = $(f);
    if (el) el.checked = !!s[f];
  }
  $("hotkey").value = s.hotkey || platformDefaultHotkey();
  $("notification_preview_duration_secs").value = String(
    Math.min(30, Math.max(2, Number(s.notification_preview_duration_secs) || 2)),
  );
  appNotificationsOn = !!s.notifications;
  updateShortcutState();
  renderHealth();
}

function wireSettingControls() {
  for (const field of BOOLS) {
    $(field).addEventListener("change", (event) => {
      autosave.queue({ [field]: event.target.checked });
      if (field === "hotkey_enabled") updateShortcutState();
      if (field === "notifications") {
        appNotificationsOn = event.target.checked;
        renderHealth();
      }
    });
  }
  const duration = $("notification_preview_duration_secs");
  const clampDuration = () => {
    const value = Number.parseInt(duration.value, 10);
    return Math.min(30, Math.max(2, Number.isFinite(value) ? value : 2));
  };
  duration.addEventListener("input", () => {
    if (duration.value === "") return;
    autosave.queue({ notification_preview_duration_secs: clampDuration() }, { debounce: true });
  });
  duration.addEventListener("change", () => {
    duration.value = String(clampDuration());
    autosave.queue({ notification_preview_duration_secs: clampDuration() });
  });
}

// --- Focus and notification tools ------------------------------------------

function renderFocus(status) {
  const badge = $("focus_status");
  const endButton = $("focus_off");
  endButton.hidden = !status.focus_active;
  const overview = $("overview_focus");
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
  if (overview) overview.textContent = `${label} left`;
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
    showNote("note", minutes === 0 ? "Notifications resumed" : "Focus mode on");
  } catch (e) {
    showNote("note", errorText(e), 5000);
  }
}

async function testNotification() {
  const button = $("test_notification");
  button.disabled = true;
  try {
    const result = await invoke("test_notification");
    showNote("test_notification_note", result || "Test delivered.", 7000);
  } catch (e) {
    showNote("test_notification_note", errorText(e), 5000);
  } finally {
    button.disabled = false;
  }
}

// Notification health: Windows can block WhatsNow's toasts even when every
// in-app switch is on, which looks exactly like a broken app.
let healthStatus = "enabled";

function renderHealth() {
  const windows = detectPlatform() === "windows";
  let tone = "ok";
  let message = "Notifications are allowed for WhatsNow.";
  let fixable = false;
  if (healthStatus === "disabled_by_user") {
    tone = "warn";
    message = "Windows is blocking notifications from WhatsNow, so no alert can appear.";
    fixable = true;
  } else if (healthStatus === "disabled_for_app") {
    tone = "warn";
    message = "Notifications are turned off for WhatsNow in Windows.";
    fixable = true;
  } else if (healthStatus === "group_policy") {
    tone = "warn";
    message = "Your organization's policy blocks notifications from WhatsNow.";
  } else if (healthStatus === "unknown") {
    tone = "neutral";
    message = "WhatsNow could not read the system notification status.";
  } else if (!appNotificationsOn) {
    tone = "neutral";
    message = "Native notifications are switched off in WhatsNow.";
  }
  for (const row of document.querySelectorAll("[data-health-row]")) {
    row.dataset.tone = tone;
    row.querySelector("[data-health-text]").textContent = message;
    row.querySelector("[data-health-fix]").hidden = !(fixable && windows);
  }
}

async function loadHealth() {
  try {
    healthStatus = (await invoke("get_notification_status")) || "enabled";
  } catch (e) {
    healthStatus = "unknown";
  }
  renderHealth();
}

function wireHealth() {
  for (const button of document.querySelectorAll("[data-health-fix]")) {
    button.addEventListener("click", () => {
      invoke("open_os_notification_settings").catch((e) => {
        showNote("note", errorText(e), 6000);
      });
    });
  }
  // The user comes back from Windows settings: refresh the verdict.
  window.addEventListener("focus", loadHealth);
}

// --- Dialogs --------------------------------------------------------------

// One reusable modal for confirmations and short forms. `submit(values)` runs
// when the form is confirmed; throwing keeps the dialog open and shows the
// message inside it. Resolves true when the dialog was confirmed and submit()
// succeeded, false when it was cancelled.
function openDialog({ title, message = "", fields = [], confirmLabel = "Confirm", danger = false, submit }) {
  return new Promise((resolve) => {
    const dialog = $("app_dialog");
    const form = $("dialog_form");
    const confirm = $("dialog_confirm");
    const container = $("dialog_fields");
    $("dialog_title").textContent = title;
    $("dialog_message").textContent = message;
    $("dialog_message").hidden = !message;
    showInlineError("dialog_error", "");
    container.textContent = "";
    for (const field of fields) {
      const label = document.createElement("label");
      label.className = "field";
      const caption = document.createElement("span");
      caption.textContent = field.label;
      const input = document.createElement("input");
      input.type = field.type || "text";
      input.name = field.name;
      input.value = field.value || "";
      if (field.autocomplete) input.autocomplete = field.autocomplete;
      if (field.maxLength) input.maxLength = field.maxLength;
      label.append(caption, input);
      container.append(label);
    }
    confirm.textContent = confirmLabel;
    confirm.className = danger ? "danger" : "btn-primary";

    let confirmed = false;
    const readValues = () => {
      const values = {};
      for (const input of container.querySelectorAll("input")) values[input.name] = input.value;
      return values;
    };
    const onSubmit = async (event) => {
      event.preventDefault();
      confirm.disabled = true;
      showInlineError("dialog_error", "");
      try {
        await withBusy(() => submit(readValues()));
        confirmed = true;
        dialog.close();
      } catch (error) {
        showInlineError("dialog_error", errorText(error));
      } finally {
        confirm.disabled = false;
      }
    };
    const onCancel = () => dialog.close();
    const onClose = () => {
      form.removeEventListener("submit", onSubmit);
      $("dialog_cancel").removeEventListener("click", onCancel);
      container.textContent = "";
      idle.resume("dialog");
      resolve(confirmed);
    };
    form.addEventListener("submit", onSubmit);
    $("dialog_cancel").addEventListener("click", onCancel);
    dialog.addEventListener("close", onClose, { once: true });
    idle.pause("dialog");
    dialog.showModal();
  });
}

// --- Accounts ---------------------------------------------------------------

let accountsCache = [];

function accountRow(account, { manage }) {
  const row = document.createElement("div");
  row.className = manage ? "account-row" : "account-row compact";

  const name = document.createElement("span");
  name.className = "acct-name";
  name.textContent = account.name;
  row.appendChild(name);

  const meta = document.createElement("span");
  meta.className = "acct-meta";
  if (account.unread > 0) {
    const badge = document.createElement("span");
    badge.className = "acct-unread";
    badge.textContent = String(account.unread);
    badge.setAttribute("aria-label", `${account.unread} unread`);
    meta.appendChild(badge);
  }
  const state = document.createElement("span");
  state.className = "acct-state";
  state.textContent = account.notifications_enabled ? "Alerts on" : "Muted";
  meta.appendChild(state);
  row.appendChild(meta);

  const actions = document.createElement("span");
  actions.className = "acct-actions";
  const add = (label, aria, handler, extra = {}) => {
    const button = document.createElement("button");
    button.type = "button";
    button.className = extra.danger ? "danger" : "secondary";
    button.textContent = label;
    button.setAttribute("aria-label", aria);
    if (extra.title) button.title = extra.title;
    if (extra.pressed !== undefined) button.setAttribute("aria-pressed", String(extra.pressed));
    if (extra.disabled) button.disabled = true;
    button.addEventListener("click", handler);
    actions.appendChild(button);
  };

  add("Open", `Open ${account.name}`, async () => {
    try {
      await invoke("open_account", { id: account.id });
    } catch (e) {
      showNote("note", errorText(e), 5000);
    }
  });
  if (manage) {
    add(
      account.notifications_enabled ? "Mute" : "Unmute",
      `${account.notifications_enabled ? "Mute" : "Unmute"} alerts for ${account.name}`,
      async () => {
        try {
          await invoke("set_account_notifications", {
            id: account.id,
            enabled: !account.notifications_enabled,
          });
          await loadAccounts();
        } catch (e) {
          showNote("note", errorText(e), 5000);
        }
      },
      {
        pressed: !account.notifications_enabled,
        title: account.notifications_enabled
          ? "Pause native alerts for this account"
          : "Resume native alerts for this account",
      },
    );
    add("Rename", `Rename ${account.name}`, () => renameAccount(account));
    add("Remove", `Remove ${account.name}`, () => removeAccount(account), {
      disabled: accountsCache.length <= 1,
      danger: true,
    });
  }
  row.appendChild(actions);
  return row;
}

function renderAccounts(accounts) {
  accountsCache = accounts;
  const list = $("accounts-list");
  const overview = $("overview_accounts_list");
  list.textContent = "";
  overview.textContent = "";
  for (const account of accounts) {
    list.appendChild(accountRow(account, { manage: true }));
    overview.appendChild(accountRow(account, { manage: false }));
  }
  applyControlGate();
}

async function loadAccounts() {
  try {
    renderAccounts(await invoke("list_accounts"));
  } catch (e) {
    // listing failed: leave the previous rows in place
  }
}

function renameAccount(account) {
  return openDialog({
    title: "Rename account",
    fields: [{ name: "name", label: "Account name", value: account.name, maxLength: 60 }],
    confirmLabel: "Save name",
    submit: async ({ name }) => {
      const next = name.trim();
      if (!next) throw new Error("Enter a name for this account.");
      if (next === account.name) return;
      await invoke("rename_account", { id: account.id, name: next });
      await loadAccounts();
    },
  });
}

function removeAccount(account) {
  return openDialog({
    title: `Remove “${account.name}”?`,
    message: "Its local WhatsApp session is deleted from this computer. Your chats stay on your phone.",
    confirmLabel: "Remove account",
    danger: true,
    submit: async () => {
      await invoke("remove_account", { id: account.id });
      await loadAccounts();
    },
  });
}

async function addAccount() {
  const input = $("new_account_name");
  const name = input.value.trim();
  showInlineError("add_account_error", "");
  if (!name) {
    showInlineError("add_account_error", "Enter a name for the new account.");
    return;
  }
  try {
    await invoke("add_account", { name });
    input.value = "";
    await loadAccounts();
  } catch (e) {
    const msg = String(e);
    // Only the macOS < 14 case is permanent — disable Add and surface the note.
    // Other failures (disk write, window build) are transient: report and let the user retry.
    if (msg.includes("macOS 14")) {
      const note = $("macos-note");
      note.textContent = msg;
      note.hidden = false;
      $("add_account").disabled = true;
      $("new_account_name").disabled = true;
    } else {
      showInlineError("add_account_error", errorText(e));
    }
  }
}

// --- Panels (tabs) ----------------------------------------------------------

function showPanel(panelName, { focusTab = false } = {}) {
  if (!PANEL_META[panelName]) return;
  for (const panel of document.querySelectorAll("[data-panel]")) {
    const active = panel.dataset.panel === panelName;
    panel.hidden = !active;
    panel.classList.toggle("active", active);
  }
  for (const button of document.querySelectorAll("[data-panel-target]")) {
    const active = button.dataset.panelTarget === panelName;
    button.classList.toggle("active", active);
    button.setAttribute("aria-selected", String(active));
    button.tabIndex = active ? 0 : -1;
    if (active && focusTab) button.focus();
  }
  const [title, description] = PANEL_META[panelName];
  $("panel_title").textContent = title;
  $("panel_description").textContent = description;
  document.querySelector(".panel-stage").scrollTop = 0;
}

function wirePanelNavigation() {
  const tabs = Array.from(document.querySelectorAll("[data-panel-target]"));
  for (const button of tabs) {
    button.addEventListener("click", () => showPanel(button.dataset.panelTarget));
    button.addEventListener("keydown", (event) => {
      const index = PANEL_ORDER.indexOf(button.dataset.panelTarget);
      let next = -1;
      if (event.key === "ArrowDown" || event.key === "ArrowRight") next = (index + 1) % PANEL_ORDER.length;
      else if (event.key === "ArrowUp" || event.key === "ArrowLeft") next = (index - 1 + PANEL_ORDER.length) % PANEL_ORDER.length;
      else if (event.key === "Home") next = 0;
      else if (event.key === "End") next = PANEL_ORDER.length - 1;
      if (next < 0) return;
      event.preventDefault();
      showPanel(PANEL_ORDER[next], { focusTab: true });
    });
  }
  for (const button of document.querySelectorAll("[data-jump-panel]")) {
    button.addEventListener("click", () => showPanel(button.dataset.jumpPanel, { focusTab: true }));
  }
}

function wireFocusControls() {
  for (const button of document.querySelectorAll("[data-focus-minutes]")) {
    button.addEventListener("click", () => setFocus(Number(button.dataset.focusMinutes)));
  }
  $("focus_custom_start").addEventListener("click", () => {
    const value = Number.parseInt($("focus_custom").value, 10);
    setFocus(Math.min(1440, Math.max(1, Number.isFinite(value) ? value : 90)));
  });
  $("focus_off").addEventListener("click", () => setFocus(0));
}

// --- Shortcut ---------------------------------------------------------------

function updateShortcutState() {
  $("shortcut_fields").disabled = !$("hotkey_enabled").checked || !settingsLoaded;
}

function commitHotkey() {
  const value = $("hotkey").value.trim() || platformDefaultHotkey();
  $("hotkey").value = value;
  showInlineError("hotkey_error", "");
  autosave.queue({ hotkey: value });
}

function wireShortcutPresets() {
  const platform = detectPlatform();
  const recommended = platformDefaultHotkey();
  const recommendedButton = document.querySelector('[data-hotkey-preset="platform"]');
  recommendedButton.dataset.hotkeyPreset = recommended;
  recommendedButton.textContent = platform === "macos"
    ? "Use Option + W"
    : `Use ${recommended.replaceAll("+", " + ")}`;

  const note = $("platform_shortcut_note");
  if (platform === "windows") {
    note.textContent = "Alt + W is the Windows default.";
  } else if (platform === "macos") {
    note.textContent =
      "Option + W is the macOS default. Use a preset if another app already owns it.";
  } else {
    note.textContent =
      "Ctrl + Alt + W is the Linux default. On Wayland, bind `whatsnow --toggle` in your desktop's keyboard settings if global shortcuts are blocked.";
  }

  for (const button of document.querySelectorAll("[data-hotkey-preset]")) {
    button.addEventListener("click", () => {
      $("hotkey").value = button.dataset.hotkeyPreset;
      setHotkeyHint("");
      commitHotkey();
    });
  }
  $("hotkey").addEventListener("change", commitHotkey);
}

// --- Start-up wiring --------------------------------------------------------

function applyPlatformHints() {
  const windows = detectPlatform() === "windows";
  for (const element of document.querySelectorAll("[data-windows-only]")) {
    element.hidden = !windows;
  }
}

window.addEventListener("DOMContentLoaded", () => {
  applyControlGate();
  applyPlatformHints();
  wireExternalLinks();
  wireThemePicker();
  wirePanelNavigation();
  wireFocusControls();
  wireShortcutPresets();
  wireSettingControls();
  wireHealth();
  wireIdleAndEscape();
  wireLock();
  $("save_retry").addEventListener("click", () => retryAction?.());
  $("load_retry").addEventListener("click", () => load());
  load();
  Promise.allSettled([loadAccounts(), loadLock(), loadFocus(), loadHealth()]);
  $("add_account").addEventListener("click", addAccount);
  $("new_account_name").addEventListener("keydown", (e) => {
    if (e.key === "Enter") addAccount();
  });
  $("record_hotkey").addEventListener("click", toggleRecording);
  $("test_notification").addEventListener("click", testNotification);
  window.setInterval(loadFocus, 60_000);
});

// --- App lock ---------------------------------------------------------------

async function loadLock() {
  let s;
  try {
    s = await invoke("get_lock_status");
  } catch (e) {
    return;
  }
  const disabled = $("lock-disabled");
  const enabled = $("lock-enabled");
  disabled.hidden = s.enabled;
  enabled.hidden = !s.enabled;

  if (s.enabled) {
    const row = $("biometric_row");
    row.hidden = !s.biometric_available;
    $("biometric_label").textContent = "Use " + s.biometric_label;
    $("biometric_enabled").checked = s.biometric_enabled;
    $("lock_on_launch").checked = s.lock_on_launch;
    $("lock_on_hide").checked = s.lock_on_hide;
    $("idle_min").value = String(Math.round(s.idle_secs / 60));
  }
  applyControlGate();
}

function saveLockOptions() {
  const idleMin = Number.parseInt($("idle_min").value, 10) || 0;
  const work = () =>
    invoke("set_app_lock_options", {
      lockOnLaunch: $("lock_on_launch").checked,
      lockOnHide: $("lock_on_hide").checked,
      idleSecs: Math.max(0, idleMin) * 60,
    });
  showInlineError("lock_options_error", "");
  return trackSave(work, saveLockOptions).then((ok) => {
    if (!ok) showInlineError("lock_options_error", "Lock options could not be saved. Try again.");
    return ok;
  });
}

function changePassword() {
  return openDialog({
    title: "Change app-lock password",
    fields: [
      { name: "current", label: "Current password", type: "password", autocomplete: "current-password" },
      { name: "next", label: "New password (minimum 4 characters)", type: "password", autocomplete: "new-password" },
      { name: "confirm", label: "Confirm new password", type: "password", autocomplete: "new-password" },
    ],
    confirmLabel: "Change password",
    submit: async ({ current, next, confirm }) => {
      if (!current) throw new Error("Enter your current password.");
      if (next.length < 4) throw new Error("The new password needs at least 4 characters.");
      if (next !== confirm) throw new Error("The new passwords don't match.");
      await invoke("change_app_lock_password", { current, new: next, confirm });
    },
  }).then((changed) => {
    if (changed) showNote("note", "Password changed.");
  });
}

function disableLock() {
  return openDialog({
    title: "Disable app lock?",
    message: "Enter your current password to turn the lock off.",
    fields: [
      { name: "current", label: "Current password", type: "password", autocomplete: "current-password" },
    ],
    confirmLabel: "Disable lock",
    danger: true,
    submit: async ({ current }) => {
      if (!current) throw new Error("Enter your current password.");
      await invoke("disable_app_lock", { current });
    },
  }).then(async (done) => {
    if (done) {
      await loadLock();
      showNote("note", "App lock is off.");
    }
  });
}

function wireLock() {
  $("enable_lock").addEventListener("click", async () => {
    const a = $("lock_pw1").value;
    const b = $("lock_pw2").value;
    showInlineError("lock_error", "");
    if (a.length < 4) {
      showInlineError("lock_error", "The password needs at least 4 characters.");
      return;
    }
    if (a !== b) {
      showInlineError("lock_error", "The passwords don't match.");
      return;
    }
    try {
      await withBusy(() => invoke("set_app_lock_password", { new: a, confirm: b }));
      $("lock_pw1").value = "";
      $("lock_pw2").value = "";
      await loadLock();
    } catch (e) {
      showInlineError("lock_error", errorText(e));
    }
  });

  $("lock_now").addEventListener("click", async () => {
    try {
      await invoke("lock_app");
    } catch (e) {
      showNote("note", errorText(e), 5000);
    }
  });

  $("change_pw").addEventListener("click", changePassword);
  $("disable_lock").addEventListener("click", disableLock);

  $("biometric_enabled").addEventListener("change", async (e) => {
    showInlineError("lock_options_error", "");
    try {
      await withBusy(() => invoke("set_biometric_enabled", { enabled: e.target.checked }));
    } catch (err) {
      showInlineError("lock_options_error", errorText(err));
      e.target.checked = !e.target.checked; // revert on failure
    }
    await loadLock();
  });

  for (const id of ["lock_on_launch", "lock_on_hide"]) {
    $(id).addEventListener("change", saveLockOptions);
  }
  let idleTimer = 0;
  $("idle_min").addEventListener("input", () => {
    window.clearTimeout(idleTimer);
    idleTimer = window.setTimeout(saveLockOptions, 400);
  });
  $("idle_min").addEventListener("change", () => {
    window.clearTimeout(idleTimer);
    saveLockOptions();
  });
}

// --- Shortcut recorder ------------------------------------------------------

let recordingHotkey = false;
let hotkeyPrev = "";
const MODIFIER_KEYS = new Set(["Control", "Shift", "Alt", "Meta"]);

function setHotkeyHint(msg) {
  const hint = $("hotkey_hint");
  if (!msg) { hint.hidden = true; hint.textContent = ""; }
  else { hint.textContent = msg; hint.hidden = false; }
}

function stopRecording(restore) {
  if (!recordingHotkey) return;
  recordingHotkey = false;
  window.removeEventListener("keydown", onRecordKeydown, true);
  window.removeEventListener("blur", onRecordBlur, true);
  const btn = $("record_hotkey");
  btn.textContent = "Record";
  btn.classList.remove("recording");
  if (restore) $("hotkey").value = hotkeyPrev;
  idle.resume("recorder");
}

function onRecordBlur() { setHotkeyHint(""); stopRecording(true); }

function onRecordKeydown(e) {
  // Tab moves focus away (cancelling the recording) instead of trapping the
  // keyboard inside the recorder.
  if (e.key === "Tab") { setHotkeyHint(""); stopRecording(true); return; }
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
  $("hotkey").value = accel;
  setHotkeyHint("");
  stopRecording(false);
  commitHotkey();
}

function toggleRecording() {
  if (recordingHotkey) { setHotkeyHint(""); stopRecording(true); return; }
  recordingHotkey = true;
  idle.pause("recorder");
  hotkeyPrev = $("hotkey").value;
  const btn = $("record_hotkey");
  btn.textContent = "Press keys… (Esc to cancel)";
  btn.classList.add("recording");
  setHotkeyHint("");
  window.addEventListener("keydown", onRecordKeydown, true);
  window.addEventListener("blur", onRecordBlur, true);
}
