// WhatsNow is authored and maintained solely by @benedictusrey.
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const commandPattern = /invoke\("([a-z0-9_]+)"/g;

async function invokedCommands(fileName) {
  const source = await readFile(new URL(fileName, import.meta.url), "utf8");
  return new Set(Array.from(source.matchAll(commandPattern), (match) => match[1]));
}

async function capabilityPermissions(fileName) {
  const text = await readFile(
    new URL(`../src-tauri/capabilities/${fileName}`, import.meta.url),
    "utf8",
  );
  return new Set(JSON.parse(text).permissions);
}

function permissionFor(command) {
  return `allow-${command.replaceAll("_", "-")}`;
}

const settingsCommands = await invokedCommands("main.js");
const settingsPermissions = await capabilityPermissions("settings.json");
for (const command of settingsCommands) {
  assert.ok(
    settingsPermissions.has(permissionFor(command)),
    `settings.json must permit ${command}`,
  );
}

const lockCommands = await invokedCommands("lock.js");
const lockPermissions = await capabilityPermissions("lock.json");
for (const command of lockCommands) {
  assert.ok(
    lockPermissions.has(permissionFor(command)),
    `lock.json must permit ${command}`,
  );
}

const buildScript = await readFile(
  new URL("../src-tauri/build.rs", import.meta.url),
  "utf8",
);
for (const command of new Set([...settingsCommands, ...lockCommands])) {
  assert.match(
    buildScript,
    new RegExp(`"${command}"`),
    `build.rs must generate a permission for ${command}`,
  );
}

const windowSource = await readFile(
  new URL("../src-tauri/src/window.rs", import.meta.url),
  "utf8",
);
const remotePermissions = await capabilityPermissions("main-remote.json");
assert.ok(
  windowSource.includes("activate_notification_window"),
  "toast routing must request the scoped activation command",
);
assert.ok(
  remotePermissions.has("allow-activate-notification-window"),
  "main-remote.json must permit scoped toast activation",
);

// The trusted-click routing command (toast click -> sender's chat) must be
// registered in BOTH the build.rs command list (generates the permission) and
// main-remote.json (grants it to the remote WhatsApp page). It was missing from
// both in 2.0.1, which made Tauri reject the bridge's click request ("Command
// notification_click not allowed by ACL") so toast clicks never opened the
// sender's chat. LOCKED: keep both assertions.
assert.ok(
  buildScript.includes('"notification_click"'),
  "build.rs must generate a permission for notification_click",
);
assert.ok(
  remotePermissions.has("allow-notification-click"),
  "main-remote.json must permit the trusted-click routing command",
);
const commandsSource = await readFile(
  new URL("../src-tauri/src/commands.rs", import.meta.url),
  "utf8",
);
assert.ok(
  commandsSource.includes("pub fn notification_click"),
  "commands.rs must define the trusted-click command",
);
assert.ok(
  windowSource.includes("dispatch_trusted_click"),
  "window.rs must dispatch the trusted CDP click",
);

// 2.7.0: the remote page may no longer call the notification plugin directly
// (it would skip the lock, mute and preview-privacy checks in commands::notify),
// and every command the bridge invokes must still be granted to it.
assert.ok(
  !remotePermissions.has("notification:default"),
  "main-remote.json must not grant the raw notification plugin to the web page",
);
const bridgeSource = await readFile(
  new URL("../src-tauri/resources/bridge.js", import.meta.url),
  "utf8",
);
assert.ok(
  !bridgeSource.includes("plugin:notification"),
  "bridge.js must only notify through the guarded notify command",
);
const bridgeCommands = new Set(
  Array.from(bridgeSource.matchAll(/invoke(?:Checked)?\("([a-z0-9_]+)"/g), (m) => m[1]),
);
for (const command of bridgeCommands) {
  assert.ok(
    remotePermissions.has(permissionFor(command)),
    `main-remote.json must permit the bridge command ${command}`,
  );
}
assert.ok(
  bridgeCommands.has("clear_chat_notifications") &&
    buildScript.includes('"clear_chat_notifications"'),
  "Action Center clearing is invoked by the bridge and registered in build.rs",
);

// Notification health is a Settings-only surface: granted to settings.json,
// never to the remote WhatsApp page.
for (const command of ["get_notification_status", "open_os_notification_settings", "settings_ready"]) {
  assert.ok(buildScript.includes(`"${command}"`), `build.rs registers ${command}`);
  assert.ok(
    settingsPermissions.has(permissionFor(command)),
    `settings.json permits ${command}`,
  );
  assert.ok(
    !remotePermissions.has(permissionFor(command)),
    `main-remote.json must not permit ${command}`,
  );
}

// The WhatsNow button in WhatsApp's chat-list header opens Settings through one
// argument-less command: registered, granted to the page, never to Settings.
assert.ok(buildScript.includes('"open_whatsnow_settings"'), "build.rs registers open_whatsnow_settings");
assert.ok(
  remotePermissions.has(permissionFor("open_whatsnow_settings")),
  "main-remote.json grants open_whatsnow_settings to the WhatsApp page",
);
assert.ok(
  !settingsPermissions.has(permissionFor("open_whatsnow_settings")),
  "Settings never needs the page shortcut",
);
assert.match(
  await readFile(new URL("../src-tauri/src/commands.rs", import.meta.url), "utf8"),
  /pub async fn open_whatsnow_settings\(\s*window: tauri::Window,\s*app: tauri::AppHandle,\s*\) -> Result<\(\), String>/,
  "the shortcut takes no page-controlled arguments",
);

// Dead commands removed in 2.7.0 stay removed.
for (const command of ["set_unread", "open_settings"]) {
  assert.ok(!buildScript.includes(`"${command}"`), `${command} is no longer registered`);
}

console.log("all Settings ACL tests passed");
