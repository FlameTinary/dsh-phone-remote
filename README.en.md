# dsh-phone-remote

[中文](README.md) · [Install](#install) · [Configuration](#configuration) · [Security](#security-model-read-this) · [Troubleshooting](#troubleshooting)

> [!IMPORTANT]
> **This plugin only works with the DeepSeek Harness desktop client.**
>
> dsh-phone-remote is a **host-only DeepSeek Harness plugin**. It runs inside the DeepSeek Harness client process and mirrors that client's local Web UI onto your LAN. It is **not** a generic reverse proxy, **not** a tunnel, **not** a standalone website, and it **does not work** with Claude Code, Cursor, Codex, VS Code, ChatGPT, or any other AI client. Without DeepSeek Harness, this plugin does nothing.

Turn a phone or tablet into a second screen for DeepSeek Harness: one link on the same LAN opens the live session running in the desktop client. No public internet, no app to install.

```
┌─────────────┐    LAN HTTP / WebSocket     ┌──────────────────────────────────┐
│  Phone      │ ──────────────────────────▶ │  dsh-phone-remote (58800)        │
│  Browser    │ ◀────────────────────────── │  ├─ access key / Basic auth      │
└─────────────┘                             │  ├─ CIDR allowlist                │
                                            │  └─ session-cookie minting       │
                                            └──────────────┬───────────────────┘
                                                           │ 127.0.0.1
                                            ┌──────────────▼───────────────────┐
                                            │ DeepSeek Harness desktop client  │
                                            │ Web UI (webServer) + Agent       │
                                            └──────────────────────────────────┘
```

> Unofficial community plugin. Not affiliated with DeepSeek.

---

## Scope (read first)

| Item | Supported |
| --- | --- |
| DeepSeek Harness desktop client (macOS, tested with `0.2.1-rc.3`) | ✅ |
| Other DeepSeek Harness versions | ⚠️ Should work; may need adaptation if host APIs or cookie format change |
| Phone / tablet browser on the same LAN | ✅ |
| Claude Code / Cursor / Codex / VS Code / ChatGPT / other AI clients | ❌ Not applicable |
| Generic reverse proxy, static server, or tunnel | ❌ Not a design goal |
| Public / cross-network access | ❌ LAN-only by design |

It depends on two DeepSeek Harness host services:

- `webServer` — to discover the real local Web UI origin;
- `credentials` (optional) — to read the `client-connection/browser-session` record and mint a browser session cookie for the phone.

Without them the plugin cannot work, which is why it is **DeepSeek Harness only**.

---

## Features

- **One link in**: `http://<lan-ip>:58800/?k=<access-key>`; the first visit sets a 1-year gateway cookie, then the bare origin works.
- **Full Web UI proxy**: HTTP, streaming/SSE, and WebSocket (`/api/remote.mux`) are forwarded; sessions, tool calls, and approval prompts behave like the desktop UI.
- **Access protection**: `?k=` auto-login, gateway cookie, or optional HTTP Basic.
- **LAN allowlist**: loopback plus configured IPv4 CIDRs; defaults are derived from local interfaces.
- **Automatic Harness session minting**: signs a 30-day browser session cookie in-process, retries once with a fresh credential on upstream 401.
- **Follows the plugin switch**: disabling the plugin in DeepSeek Harness closes the listener immediately; enabling it brings it back.
- **Mobile drawer enhancement**: on narrow screens the built-in sidebar becomes a slide-out drawer with a hamburger button, and iOS input zoom is avoided.
- **Zero third-party dependencies**: Node.js standard library only.
- **Built-in diagnostics**: dashboard, `/__dshgw/status`, logs, `phone-url.txt`, and a CLI.

---

## How it works

1. The plugin starts as a host bundle and creates its own HTTP server on `0.0.0.0:58800` (it does not occupy the Harness listener or register routes on it).
2. The upstream origin comes from `ctx.webServer.getOrigin()`; if that fails it falls back to `ps` + `lsof` discovery of the Harness Web UI port, cached for 8 seconds.
3. Each request is checked against the source CIDR allowlist, then authenticated by access key or Basic.
4. It reads the local `~/.dsh/.credentials.yaml` record `client-connection/browser-session`, mints a Harness browser-session cookie with HMAC-SHA256, and forwards the request.
5. For HTML documents it injects the mobile drawer CSS/JS before `</body>`; everything else is passed through.
6. WebSocket upgrades are authenticated and piped both ways.

The plugin never edits Harness configuration, never registers routes on the Harness web server, and never logs credential values.

---

## Requirements

- **DeepSeek Harness desktop client** (the only supported host), with its Web UI running.
- Phone and computer on the **same LAN** (same Wi-Fi or the same router).
- Port `58800` free (configurable).
- Node.js ≥ 20 for the standalone scripts; the plugin itself uses the client's bundled runtime.
- Tested on macOS. Linux/Windows desktop builds should work but are untested.

---

## Install

### Option A: from DeepSeek Harness settings (recommended)

1. Clone the repository:

   ```bash
   git clone https://github.com/FlameTinary/dsh-phone-remote.git ~/CodeRepo/dsh-phone-remote
   ```

2. In DeepSeek Harness, open the sidebar **Plugins** page (Settings → Plugins) and click **Add plugin**.
3. Enter the **absolute local path** to this directory, e.g. `/Users/sheldon/CodeRepo/dsh-phone-remote`, then click **Install**.
4. Under **Installed plugins**, find **Phone Remote** and make sure its switch is on.

> Installation links the checkout. After `git pull`, restart DeepSeek Harness to load the new JS; no reinstall is needed.

### Option B: plugin manager (automation / remote support)

From a DeepSeek Harness agent session:

```json
{ "action": "install_bundle", "target": "/Users/sheldon/CodeRepo/dsh-phone-remote" }
```

`list_bundles` should then show:

```text
dsh-phone-remote  0.1.0  availability=profile  installed=true  enabled=true
```

Enable or disable with:

```json
{ "action": "set_bundle", "target": "dsh-phone-remote", "enabled": false }
```

### What happens on first start

- Creates `~/.dsh/phone-remote/config.json` (`0600`) with a random access key and Basic password.
- If a legacy skill / launchd gateway config exists at `~/.dsh/remote-gateway/config.json`, it is **migrated automatically** (port, keys, CIDRs, and other settings).
- Starts the listener and writes `~/.dsh/phone-remote/phone-url.txt` (`0600`) with phone URLs and Basic credentials.

> ⚠️ The legacy skill ran a launchd gateway that occupies port `58800`. Stop it before enabling this plugin:
>
> ```bash
> launchctl bootout gui/"$UID"/com.dsh.remote-gateway 2>/dev/null || true
> mv ~/Library/LaunchAgents/com.dsh.remote-gateway.plist \
>    ~/Library/LaunchAgents/com.dsh.remote-gateway.plist.disabled 2>/dev/null || true
> ```

---

## Usage

### Get the phone link

Any of:

- open **`http://127.0.0.1:58800/__dshgw/`** on the computer (Basic or access key required);
- read `~/.dsh/phone-remote/phone-url.txt`;
- run:

  ```bash
  node /path/to/dsh-phone-remote/bin/phone-remote.mjs url
  ```

Example:

```text
Phone URLs (same LAN, contains the access key):
  http://192.168.1.42:58800/?k=xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
Basic auth: dsh / xxxxxxxxxxxxxxxxxx
```

### Open it on the phone

Connect the phone to the same Wi-Fi and open the link. The first visit redirects to `/` (303) and sets a gateway cookie; afterwards `http://192.168.1.42:58800/` works directly.

Bookmark the redirected URL. The `?k=` value only appears in the first URL.

### Check status

```bash
node /path/to/dsh-phone-remote/bin/phone-remote.mjs status
```

Returns JSON with `ok`, `version`, `pid`, `uptimeSeconds`, `upstream`, `listen`, `allowCidrs`, `phoneUrls`, `configPath`.

### Enable / disable in settings

DeepSeek Harness → Plugins → Installed plugins → **Phone Remote**:

- off: the listener closes immediately and the phone can no longer connect;
- on: the listener comes back with the same URL and keys.

---

## Configuration

File: `~/.dsh/phone-remote/config.json` (created on first start, mode `0600`).

```json
{
  "listenHost": "0.0.0.0",
  "listenPort": 58800,
  "allowCidrs": ["127.0.0.1/32", "192.168.1.0/24"],
  "accessKey": "…",
  "basicUser": "dsh",
  "basicPass": "…",
  "upstreamPort": null,
  "uiEnhance": { "mobileDrawer": true },
  "logMaxBytes": 1048576
}
```

| Field | Default | Description |
| --- | --- | --- |
| `listenHost` | `0.0.0.0` | Bind address. Loopback makes the phone unreachable. |
| `listenPort` | `58800` | Gateway port. On conflict the plugin retries every 5 s instead of crashing. |
| `allowCidrs` | loopback + each NIC's `/24` | Allowed IPv4 CIDRs. **Must include the phone's subnet**, otherwise 403. |
| `accessKey` | random 32 chars | Access key (≥ 16 chars). Used by `?k=`, the `dsh-gw` cookie, and the dashboard. |
| `basicUser` / `basicPass` | `dsh` / random | Optional HTTP Basic credentials (password ≥ 8 chars). |
| `upstreamPort` | `null` | Pin the Harness UI port. Leave `null` for automatic discovery. |
| `uiEnhance.mobileDrawer` | `true` | Inject the mobile drawer enhancement. |
| `logMaxBytes` | `1048576` | Log rotation threshold; rotates to `gateway.log.1`. |

After editing, toggle the plugin off/on (or restart DeepSeek Harness).

### Rotate the access key

1. Disable the plugin.
2. Edit `config.json`: delete `accessKey` / `basicPass` (new random values are generated on start) or set your own.
3. Re-enable the plugin and copy the new phone link.

Old links and cookies stop working immediately.

---

## Security model (read this)

The plugin exposes **full control of the DeepSeek Harness client** to any authenticated device.

- **The access key is full access.** Anyone with the link or Basic password can read sessions, send messages, trigger tool calls, and approve permission requests. Protect it like an SSH key.
- **LAN only.** The default allowlist is loopback plus the current `/24`. Do not set `allowCidrs` to `0.0.0.0/0` and do not port-forward it on your router. For remote access, use a VPN (Tailscale, WireGuard, …).
- **No TLS.** Traffic is plain HTTP/WS and can be sniffed on the same Wi-Fi. Use trusted networks only; avoid public/guest Wi-Fi.
- **Cookies last 30 days** and are re-minted per request; they may break after credential rotation or a client upgrade — reopen the `?k=` link.
- **The config contains plaintext secrets** (mode `0600`); `phone-url.txt` also contains keys. Never commit or share them.
- **Logs exclude cookie values** but include paths, source IPs, and errors; review before sharing.
- **Unofficial plugin**: it does not modify client binaries, but it runs with your user privileges inside the client process. Install only from trusted sources and re-check compatibility after DSH upgrades.

If you only use DeepSeek Harness on this computer, leave the plugin disabled.

---

## Mobile enhancement

Only active at viewport width ≤ 768 px:

- injects a hamburger button at the start of the Harness title row (no extra row);
- first triggers the built-in "open sidebar" action, then adds `dsh-drawer-open` on the next frame;
- closes via the overlay or the built-in "collapse sidebar" button;
- raises editable control font size to ≥ 16 px to avoid iOS Safari focus zoom;
- re-adds the button after re-renders with `MutationObserver` + `requestAnimationFrame`.

Set `uiEnhance.mobileDrawer` to `false` to disable; proxying and auth are unaffected.

---

## CLI

Requires Node.js ≥ 20 (or call `bin/phone-remote.mjs` directly).

```bash
dsh-phone-remote url       # phone URLs, Basic credentials, listen address, config path
dsh-phone-remote status    # query /__dshgw/status
dsh-phone-remote config    # print the config path
dsh-phone-remote help
```

`url` works even when the plugin is not running (it may create the config on first use).

---

## Troubleshooting

| Symptom | Cause / fix |
| --- | --- |
| **401 login page** on the phone | Missing/rotated `?k=`. Copy the full link again from `phone-url.txt` or the dashboard; or use Basic. |
| **403 source address not allowed** | Phone subnet missing from `allowCidrs`. Add it (e.g. `192.168.1.0/24`) and restart the plugin. |
| **502 Bad Gateway** | Harness UI unreachable. Make sure the desktop client is running; optionally pin `upstreamPort`. |
| Port **58800 in use / `EADDRINUSE`** | Usually the legacy launchd gateway. Run the `launchctl bootout` command above, or change `listenPort`. |
| Plugin **missing from settings** | Install the directory that contains `package.json` and `cordis.patch.yml`, then restart the client; check `~/.dsh/profiles/<profile>/.plugin-manager/logs/`. |
| Enabled but **nothing listening** | Check `~/.dsh/phone-remote/gateway.log`; common causes are port conflicts or invalid JSON config. |
| Page loads but **keeps disconnecting** | A network device may be blocking WebSocket, or AP isolation is on. |
| **Login breaks after a client upgrade** | Cookie format may have changed. Update the plugin; temporarily reopen the `?k=` link. |
| **iOS zooms on input focus** | Confirm `uiEnhance.mobileDrawer` is `true`. |
| Phone URL shows **127.0.0.1** | `listenHost` is loopback, or no non-loopback IPv4 exists. Set `0.0.0.0`. |

Logs: `~/.dsh/phone-remote/gateway.log` (rotates at 1 MB).

---

## Upgrade, uninstall, migration

### Upgrade

```bash
cd /path/to/dsh-phone-remote
git pull
```

Then **restart DeepSeek Harness** (or uninstall/reinstall the plugin) to load the new JS. The checkout is linked, so no reinstall step is needed.

### Uninstall

1. Settings → Plugins → Installed plugins → Phone Remote → disable;
2. remove it on the same page (or `plugin_manager` `remove_bundle`);
3. optionally delete `~/.dsh/phone-remote/`.

### Migrating from the legacy skill / launchd gateway

```bash
launchctl bootout gui/"$UID"/com.dsh.remote-gateway 2>/dev/null || true
mv ~/Library/LaunchAgents/com.dsh.remote-gateway.plist \
   ~/Library/LaunchAgents/com.dsh.remote-gateway.plist.disabled 2>/dev/null || true
```

Keep `~/.dsh/remote-gateway/config.json` so the new plugin can inherit its keys and port on first start; delete the old directory afterwards if you like.

---

## Development and verification

```bash
cd /path/to/dsh-phone-remote

# 1. Run the gateway standalone on 58801 (avoids the installed plugin on 58800)
PHONE_REMOTE_PORT=58801 node scripts/dev-server.mjs

# 2. In another terminal, run the end-to-end smoke test
PHONE_REMOTE_PORT=58801 node scripts/verify.mjs
```

`scripts/verify.mjs` covers 9 checks: unauthenticated 401, status endpoint, `?k=` 303, dashboard, drawer CSS, proxied Harness page, drawer asset injection, `/api` passthrough (404 fence instead of 401), and WebSocket upgrade (101).

Layout:

```text
index.js              # host entry: apply / inject / ctx.effect
cordis.patch.yml      # bundle patch (row id: phone-remote)
locale/{zh,en}.json   # settings title and description
icon.svg              # settings icon
lib/                  # config, auth, session, upstream, gateway, log, ui
ui/                   # mobile-drawer.css / mobile-drawer.js
bin/phone-remote.mjs  # url / status / config
scripts/              # dev-server.mjs / verify.mjs
```

---

## Known limitations

- **DeepSeek Harness only**; no other clients or generic web apps.
- IPv4 CIDRs only; IPv6 peers are rejected.
- **No TLS**; use a VPN or your own reverse proxy for public access.
- The mobile enhancement depends on the Harness DOM structure (`titleRow`, `aria-label="打开侧边栏"`, …) and may need adaptation after major client UI changes.
- Session cookie signing depends on the client implementation; a DSH upgrade may require a plugin update.
- On port conflict the plugin retries but does not auto-pick another port.
- No visual config editor (the host-only bundle does not export a Config schema); edit the JSON directly.

---

## License

[MIT](LICENSE) © 2026 Sheldon

Unofficial community project, not affiliated with DeepSeek. Read the [security model](#security-model-read-this) before use.
