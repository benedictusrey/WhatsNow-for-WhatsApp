// WhatsNow — authored and maintained solely by @benedictusrey.
const invoke = window.__TAURI__?.core?.invoke ?? (async (command) => {
  if (command === "get_theme") return "system";
  if (command === "get_lock_status") {
    return { biometric_enabled: false, biometric_label: "" };
  }
  throw new Error("WhatsNow lock controls require the desktop runtime.");
});
const pwd = document.getElementById("password");
const errEl = document.getElementById("error");

let busy = false;
const systemDark = window.matchMedia("(prefers-color-scheme: dark)");

function applyTheme(theme) {
  window.WhatsNowTheme.apply(document, theme, systemDark.matches);
}

async function tryUnlock() {
  if (busy) return;
  const password = pwd.value;
  if (!password) { errEl.textContent = "Enter your password."; return; }
  busy = true;
  document.getElementById("unlock").disabled = true;
  document.getElementById("biometric").disabled = true;
  errEl.textContent = "";
  try {
    const ok = await invoke("unlock_password", { password });
    if (!ok) {
      errEl.textContent = "Wrong password.";
      pwd.value = "";
      pwd.focus();
    }
  } catch (e) {
    errEl.textContent = String(e);
  } finally {
    busy = false;
    document.getElementById("unlock").disabled = false;
    document.getElementById("biometric").disabled = false;
  }
}

async function tryBiometric() {
  if (busy) return;
  busy = true;
  document.getElementById("unlock").disabled = true;
  document.getElementById("biometric").disabled = true;
  errEl.textContent = "";
  try {
    const ok = await invoke("unlock_biometric");
    if (!ok) errEl.textContent = "Biometric authentication failed — enter your password.";
  } catch (e) {
    errEl.textContent = String(e);
  } finally {
    busy = false;
    document.getElementById("unlock").disabled = false;
    document.getElementById("biometric").disabled = false;
  }
}

async function init() {
  try {
    applyTheme(await invoke("get_theme"));
  } catch (_) {
    applyTheme("system");
  }
  document.getElementById("unlock").addEventListener("click", tryUnlock);
  pwd.addEventListener("keydown", (e) => { if (e.key === "Enter") tryUnlock(); });

  const bio = document.getElementById("biometric");
  bio.addEventListener("click", tryBiometric);

  document.getElementById("reset").addEventListener("click", async (e) => {
    e.preventDefault();
    const ok = confirm(
      "Reset WhatsNow?\n\nThis logs out ALL accounts and removes the app lock. " +
      "You will need to re-scan the WhatsApp QR code. Your chats stay on your phone."
    );
    if (!ok) return;
    try {
      await invoke("reset_app_lock");
    } catch (err) {
      errEl.textContent = String(err);
    }
  });

  try {
    const s = await invoke("get_lock_status");
    if (s.biometric_enabled) {
      bio.textContent = "Use " + (s.biometric_label || "biometrics");
      bio.hidden = false;
      tryBiometric(); // auto-prompt on load
    }
  } catch (_) {
    // status unavailable — password still works
  }
  pwd.focus();
}

window.addEventListener("DOMContentLoaded", init);
