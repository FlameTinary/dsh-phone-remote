# dsh-phone-remote

[English](README.en.md) · [安装](#安装) · [配置](#配置) · [安全](#安全模型必读) · [排障](#故障排查)

> [!IMPORTANT]
> **本插件只适用于 DeepSeek Harness 桌面客户端。**
>
> dsh-phone-remote 是一个 **DeepSeek Harness Host 插件**，它运行在 DeepSeek Harness 客户端进程内部，只把本机正在运行的 Harness Web UI 镜像到局域网。它**不是**通用反向代理、**不是**内网穿透、**不是**独立网站，也**不能**用于 Claude Code、Cursor、Codex、VS Code、ChatGPT 或其他 AI 客户端。没有 DeepSeek Harness 客户端，这个插件没有任何作用。
>
> **DSH only.** This is a host-only plugin for the **DeepSeek Harness desktop client**. It mirrors the client's local Web UI over your LAN. It is not a generic reverse proxy, tunnel, or standalone server, and it does not work with any other AI client.

把手机或平板变成 DeepSeek Harness 的第二块屏幕：同一个局域网、一个链接，直接打开桌面客户端里正在进行的会话，不需要公网、不需要安装 App。

```
┌─────────────┐    LAN HTTP / WebSocket     ┌──────────────────────────────────┐
│  手机/平板   │ ──────────────────────────▶ │  dsh-phone-remote (58800)        │
│  浏览器      │ ◀────────────────────────── │  ├─ 访问密钥 / Basic 鉴权         │
└─────────────┘                             │  ├─ 网段白名单                    │
                                            │  └─ 代签 Harness 会话 Cookie     │
                                            └──────────────┬───────────────────┘
                                                           │ 127.0.0.1
                                            ┌──────────────▼───────────────────┐
                                            │ DeepSeek Harness 桌面客户端       │
                                            │ Web UI (webServer) + Agent       │
                                            └──────────────────────────────────┘
```

> 本项目是非官方社区插件，与 DeepSeek 官方无隶属关系。

---

## 目录

- [适用范围（先读）](#适用范围先读)
- [功能](#功能)
- [工作原理](#工作原理)
- [环境要求](#环境要求)
- [安装](#安装)
- [使用](#使用)
- [配置](#配置)
- [安全模型（必读）](#安全模型必读)
- [移动端增强](#移动端增强)
- [命令行](#命令行)
- [故障排查](#故障排查)
- [升级、卸载与迁移](#升级卸载与迁移)
- [开发与验证](#开发与验证)
- [已知限制](#已知限制)
- [License](#license)

---

## 适用范围（先读）

| 项目 | 是否支持 |
| --- | --- |
| DeepSeek Harness 桌面客户端（macOS，`0.2.1-rc.3` 实测） | ✅ |
| DeepSeek Harness 的其他版本 | ⚠️ 理论可用；宿主 API 或 Cookie 格式变化时可能需要适配 |
| 手机 / 平板浏览器（同一局域网） | ✅ |
| Claude Code / Cursor / Codex / VS Code / ChatGPT / 其他 AI 客户端 | ❌ 完全不适用 |
| 作为通用反向代理、静态服务器或内网穿透工具 | ❌ 不设计用于这些场景 |
| 公网访问、跨网络访问 | ❌ 默认且有意只支持局域网 |

它依赖 DeepSeek Harness 客户端的两个 Host 服务：

- `webServer`：拿到本机 Web UI 的真实监听地址；
- `credentials`（可选）：读取 `client-connection/browser-session` 凭据并为手机代签浏览器会话 Cookie。

没有这两样东西，插件无法工作。因此**请只在 DeepSeek Harness 客户端中使用它**。

---

## 功能

- **一条链接进入**：`http://<电脑局域网 IP>:58800/?k=<访问密钥>`，首次打开后写入 1 年有效的网关 Cookie，之后直接访问即可。
- **完整代理 Harness Web UI**：HTTP、SSE/流式响应和 WebSocket（`/api/remote.mux`）都会转发，会话、工具调用和审批界面与桌面端一致。
- **访问密钥保护**：入口支持 `?k=` 自动登录、网关 Cookie 和可选 HTTP Basic，三种方式任选其一。
- **局域网白名单**：只接受回环地址与配置中的 IPv4 CIDR，默认根据本机网卡生成 `/24` 白名单。
- **自动代签 Harness 会话**：在客户端进程内用本机凭据为浏览器签发 30 天有效的会话 Cookie，上游返回 401 时自动换一次凭据重试。
- **随插件启停**：在 DeepSeek Harness 的插件设置里关闭插件，监听端口立即关闭；重新打开即可恢复。
- **移动端抽屉增强**：窄屏下把 Harness 自带的侧边栏变成滑出抽屉，补一个汉堡按钮，并避免 iOS 输入框自动放大。
- **零第三方依赖**：只用 Node.js 标准库。
- **自带诊断**：仪表盘、`/__dshgw/status`、日志、`phone-url.txt`、`dsh-phone-remote status`。

---

## 工作原理

1. 插件作为 DeepSeek Harness 的 Host bundle 启动，在 `0.0.0.0:58800` 上创建自己的 HTTP 服务器（不占用 Harness 原监听端口，也不向其挂路由）。
2. 上游地址优先通过 `ctx.webServer.getOrigin()` 获取；失败时回退到 `ps` + `lsof` 探测 Harness Web UI 的 `127.0.0.1` 端口，结果缓存 8 秒。
3. 每个请求先做来源网段检查，再做访问密钥 / Basic 鉴权。
4. 通过鉴权后，插件读取本机 `~/.dsh/.credentials.yaml` 里的 `client-connection/browser-session` secret，用 HMAC-SHA256 代签 Harness 浏览器会话 Cookie，再转发请求。
5. 对 HTML 文档请求，插件把移动端抽屉的 CSS/JS 注入到 `</body>` 前；其余资源原样透传。
6. WebSocket 升级请求在鉴权后透传到上游，双向 pipe。

插件**不会**修改 Harness 的配置、不会在 Harness Web 服务器上注册路由，也不会把凭据写进日志。

---

## 环境要求

- **DeepSeek Harness 桌面客户端**（本插件唯一的运行宿主），且 Web UI 正在运行。
- 电脑与手机在**同一局域网**（同一 Wi-Fi / 同一路由器下的有线与无线均可）。
- 端口 `58800` 未被占用（可在配置中修改）。
- 插件安装器使用客户端内置的 Node 运行时；手动运行脚本需要 Node.js ≥ 20。
- 已在 macOS 上测试；Linux/Windows 的 DSH 桌面版理论可用，但未实测。

---

## 安装

### 方式 A：在 DeepSeek Harness 设置中安装（推荐）

1. 把本仓库克隆或下载到本机，例如：

   ```bash
   git clone https://github.com/FlameTinary/dsh-phone-remote.git ~/CodeRepo/dsh-phone-remote
   ```

2. 打开 DeepSeek Harness，点击侧边栏的 **「插件」**（即 设置 → 插件），选择 **「添加插件」**。
3. 在安装源中填入**本地目录的绝对路径**，例如 `/Users/sheldon/CodeRepo/dsh-phone-remote`，点击「安装」。
4. 安装完成后，在 **「已安装插件」** 中找到 **「手机远程访问」（Phone Remote）**，确认开关为开启状态。

> 插件安装是「链接目录」方式：之后 `git pull` 更新代码，重启 DeepSeek Harness 即可加载新版本，无需重复安装。

### 方式 B：通过插件管理工具安装（自动化 / 远程排障）

在 DeepSeek Harness 的 Agent 会话中调用 `plugin_manager`：

```json
{ "action": "install_bundle", "target": "/Users/sheldon/CodeRepo/dsh-phone-remote" }
```

安装成功后用 `list_bundles` 应能看到：

```text
dsh-phone-remote  0.1.0  availability=profile  installed=true  enabled=true
```

启用 / 停用：

```json
{ "action": "set_bundle", "target": "dsh-phone-remote", "enabled": false }
```

### 首次启动做了什么

- 创建 `~/.dsh/phone-remote/config.json`（权限 `0600`），随机生成访问密钥与 Basic 密码。
- 如果发现旧版 skill / launchd 网关的配置 `~/.dsh/remote-gateway/config.json`，会**自动迁移**其中的端口、密钥、网段等设置。
- 启动监听，并写入 `~/.dsh/phone-remote/phone-url.txt`（包含手机链接与 Basic 凭据，权限 `0600`）。

> ⚠️ 旧版 `dsh-phone-remote` skill 通过 launchd 常驻网关，会占用 `58800` 端口。安装本插件前请先停掉它：
>
> ```bash
> launchctl bootout gui/"$UID"/com.dsh.remote-gateway 2>/dev/null || true
> mv ~/Library/LaunchAgents/com.dsh.remote-gateway.plist \
>    ~/Library/LaunchAgents/com.dsh.remote-gateway.plist.disabled 2>/dev/null || true
> ```

---

## 使用

### 1. 拿到手机链接

任选一种：

- 在电脑上打开 **`http://127.0.0.1:58800/__dshgw/`**（需要 Basic 或访问密钥），页面会列出所有可用的手机链接；
- 读取 `~/.dsh/phone-remote/phone-url.txt`；
- 运行：

  ```bash
  node /path/to/dsh-phone-remote/bin/phone-remote.mjs url
  ```

输出类似：

```text
Phone URLs (same LAN, contains the access key):
  http://192.168.1.42:58800/?k=xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
Basic auth: dsh / xxxxxxxxxxxxxxxxxx
```

### 2. 手机打开链接

手机与电脑连同一个 Wi-Fi，用浏览器打开上面的链接即可。首次打开会 303 跳转到 `/` 并写入网关 Cookie；之后可直接访问 `http://192.168.1.42:58800/`。

可以把跳转后的地址保存为书签。`?k=` 只出现在第一次打开的 URL 里。

### 3. 检查运行状态

```bash
node /path/to/dsh-phone-remote/bin/phone-remote.mjs status
```

返回 JSON：`ok`、`version`、`pid`、`uptimeSeconds`、`upstream`、`listen`、`allowCidrs`、`phoneUrls`、`configPath` 等。

### 4. 在设置中启停

DeepSeek Harness → 插件 → 已安装插件 → **手机远程访问**：

- 关闭开关：网关立即停止监听，手机无法再连接；
- 打开开关：重新监听，链接与密钥不变。

---

## 配置

配置文件：`~/.dsh/phone-remote/config.json`（首次启动自动生成，`0600`）。

```json
{
  "listenHost": "0.0.0.0",
  "listenPort": 58800,
  "allowCidrs": ["127.0.0.1/32", "192.168.1.0/24"],
  "accessKey": "……",
  "basicUser": "dsh",
  "basicPass": "……",
  "upstreamPort": null,
  "uiEnhance": { "mobileDrawer": true },
  "logMaxBytes": 1048576
}
```

| 字段 | 默认值 | 说明 |
| --- | --- | --- |
| `listenHost` | `0.0.0.0` | 网关监听地址。改成 `127.0.0.1` 后手机将无法连接；也可填本机具体局域网 IP。 |
| `listenPort` | `58800` | 网关端口。被占用时插件每 5 秒重试，不会导致客户端崩溃。 |
| `allowCidrs` | 回环 + 各网卡的 `/24` | 允许访问的 IPv4 网段。**必须包含手机所在网段**，否则返回 403。 |
| `accessKey` | 随机 32 字符 | 访问密钥，至少 16 字符。`?k=`、`dsh-gw` Cookie、仪表盘登录都用它。 |
| `basicUser` / `basicPass` | `dsh` / 随机 | 可选 HTTP Basic 凭据；密码至少 8 字符。 |
| `upstreamPort` | `null` | 上游 Harness 端口。一般留 `null` 自动发现；有多个 Harness 实例时可钉死。 |
| `uiEnhance.mobileDrawer` | `true` | 是否注入移动端抽屉增强。关掉后手机仍可用，但侧边栏体验退化为桌面布局。 |
| `logMaxBytes` | `1048576` | 日志轮转阈值；超过后轮转为 `gateway.log.1`。 |

修改配置后，在插件设置里**关闭再打开**插件（或重启 DeepSeek Harness）使其生效。

### 轮换访问密钥

1. 在设置中关闭插件；
2. 编辑 `config.json`，删除 `accessKey` / `basicPass` 字段（下次启动会重新随机生成），或写入你自己的新值；
3. 重新打开插件，重新获取手机链接。

旧链接与旧 Cookie 会立即失效。

---

## 安全模型（必读）

这个插件把**整个 DeepSeek Harness 客户端的控制权**暴露给通过鉴权的设备。请认真阅读：

- **访问密钥 = 完整权限。** 拿到链接或 Basic 密码的人可以读取会话、发消息、触发工具调用、审批权限请求。请像保护 SSH 私钥一样保护访问密钥。
- **仅限局域网。** 默认白名单为本机 + 当前网卡的 `/24`，不要为了「在外面也能用」把 `allowCidrs` 改成 `0.0.0.0/0` 或在路由器上做端口映射。需要公网访问请使用 VPN（如 Tailscale / WireGuard），不要把本插件直接暴露到公网。
- **没有 TLS。** 网关使用 HTTP/WS 明文传输，同一 Wi-Fi 下的其他人可能嗅探流量。只在你信任的网络中使用；不要在公共 Wi-Fi、酒店网络或公司访客网络启用。
- **Cookie 有效期为 30 天**，每次请求都会重新签发；凭据轮换或客户端升级后可能失效，重新打开 `?k=` 链接即可。
- **配置文件含明文密钥**，权限为 `0600`；`phone-url.txt` 同样含密钥与 Basic 密码，请不要提交到 Git、不要发到群聊。
- **日志不记录 Cookie 值**，但会记录请求路径、来源 IP 与错误信息；分享日志前请自行检查。
- **非官方插件**：它不修改客户端二进制，但以你的用户权限在客户端进程内运行。请只从可信来源安装，并在升级 DeepSeek Harness 后确认兼容性。

如果你只需要「电脑上自己用」，请不要启用本插件。

---

## 移动端增强

仅在视口宽度 ≤ 768px 时生效：

- 在 Harness 顶部标题行（`titleRow`）最左侧注入汉堡按钮，不额外占用一行；
- 点击汉堡时先触发 Harness 自带的「打开侧边栏」，再添加 `dsh-drawer-open` 类完成滑出动画；
- 侧边栏支持点击遮罩或「收起侧边栏」关闭；
- 窄屏下可编辑控件字号提升到 ≥ 16px，避免 iOS Safari 聚焦时自动放大页面；
- 使用 `MutationObserver` + `requestAnimationFrame` 在界面重渲染后补回按钮。

若不需要这层增强，把 `uiEnhance.mobileDrawer` 设为 `false` 即可，代理与鉴权不受影响。

---

## 命令行

需要本机有 Node.js ≥ 20。也可以直接用绝对路径调用仓库内的 `bin/phone-remote.mjs`。

```bash
dsh-phone-remote url       # 打印手机链接、Basic 凭据、监听地址、配置路径
dsh-phone-remote status    # 请求 /__dshgw/status，检查网关是否在运行
dsh-phone-remote config    # 打印配置文件路径
dsh-phone-remote help      # 帮助
```

`url` 在插件未启动时也可以运行（首次运行可能创建配置文件）。

---

## 故障排查

| 现象 | 原因与处理 |
| --- | --- |
| 手机打开显示 **401 登录页** | 链接里的 `?k=` 缺失或密钥已轮换。重新从 `phone-url.txt` / 仪表盘复制完整链接；或使用 Basic 登录。 |
| 手机打开显示 **403 source address not allowed** | 手机网段不在 `allowCidrs` 中。查看手机 IP，把对应网段（如 `192.168.1.0/24`）加入配置并重启插件。 |
| **502 Bad Gateway** | 上游 Harness Web UI 不可达。确认桌面客户端正在运行、Web UI 已加载；可在配置中把 `upstreamPort` 钉死为实际端口。 |
| 端口 **58800 被占用 / `EADDRINUSE`** | 多半是旧 launchd 网关仍在运行。执行[安装](#安装)中的 `launchctl bootout`；或修改 `listenPort`。 |
| 设置里**看不到插件** | 确认安装源是插件根目录（含 `package.json` 与 `cordis.patch.yml`），并在安装后重启客户端；查看 `~/.dsh/profiles/<profile>/.plugin-manager/logs/` 下的安装日志。 |
| 插件显示已启用但**端口没监听** | 查看 `~/.dsh/phone-remote/gateway.log`；常见原因是端口冲突或配置 JSON 语法错误。 |
| 手机能打开页面但**一直转圈/断线** | 检查 WebSocket 是否被网络设备拦截；确认手机与电脑在同一子网且未开启 AP 隔离。 |
| 客户端升级后**登录失效** | 会话 Cookie 格式可能变化。先更新插件；临时可在手机重新打开 `?k=` 链接。 |
| **iOS 输入时页面放大** | 确认 `uiEnhance.mobileDrawer` 为 `true`；或升级到最新版本。 |
| 仪表盘能开，但**手机链接是 127.0.0.1** | `listenHost` 被设成了回环地址，或本机没有非回环 IPv4。改回 `0.0.0.0`。 |

日志：`~/.dsh/phone-remote/gateway.log`（超过 1 MB 自动轮转）。

---

## 升级、卸载与迁移

### 升级

```bash
cd /path/to/dsh-phone-remote
git pull
```

然后在 DeepSeek Harness 中**重启客户端**（或卸载后重装插件），以加载新的 JS。插件是目录链接安装，不需要重新执行安装步骤。

### 卸载

1. 设置 → 插件 → 已安装插件 → 手机远程访问 → 关闭；
2. 在同一页面选择卸载（或调用 `plugin_manager` 的 `remove_bundle`）；
3. 可选：删除数据目录 `~/.dsh/phone-remote/`（含配置、日志、手机链接）。

### 从旧版 skill / launchd 网关迁移

旧版通过 `install.sh` 写入 `~/Library/LaunchAgents/com.dsh.remote-gateway.plist` 并常驻。迁移步骤：

```bash
launchctl bootout gui/"$UID"/com.dsh.remote-gateway 2>/dev/null || true
mv ~/Library/LaunchAgents/com.dsh.remote-gateway.plist \
   ~/Library/LaunchAgents/com.dsh.remote-gateway.plist.disabled 2>/dev/null || true
```

保留 `~/.dsh/remote-gateway/config.json` 即可让新插件首次启动时自动继承密钥与端口；确认迁移成功后，可自行删除旧目录。

---

## 开发与验证

```bash
cd /path/to/dsh-phone-remote

# 1. 在 58801 端口单独启动网关（避开已安装插件的 58800）
PHONE_REMOTE_PORT=58801 node scripts/dev-server.mjs

# 2. 另开终端跑端到端冒烟测试
PHONE_REMOTE_PORT=58801 node scripts/verify.mjs
```

`scripts/verify.mjs` 覆盖 9 项检查：

1. 未鉴权页面被拒绝（401）；
2. `/__dshgw/status` 可用；
3. `?k=` 登录 303；
4. 仪表盘渲染手机链接；
5. 抽屉 CSS 可访问；
6. Harness 首页可代理；
7. HTML 中注入了抽屉资源；
8. `/api` 请求到达上游（用 404 栅栏判断，而不是 401）；
9. WebSocket 升级到达上游（101）。

目录结构：

```text
index.js              # Host 插件入口：apply / inject / ctx.effect
cordis.patch.yml      # DSH bundle patch（row id: phone-remote）
locale/{zh,en}.json   # 设置页显示名与描述
icon.svg              # 设置页图标
lib/
  config.js           # 配置加载、迁移、默认值、手机 URL
  auth.js             # Basic / Cookie 鉴权、CIDR 判断
  session.js          # Harness 会话 Cookie 代签与凭据缓存
  upstream.js         # getOrigin → ps/lsof 回退发现
  gateway.js          # HTTP/WS 代理、注入、内置路由
  log.js              # 1 MB 轮转日志
  ui.js               # 抽屉资源读取与注入
ui/                   # mobile-drawer.css / mobile-drawer.js
bin/phone-remote.mjs  # url / status / config 命令行
scripts/              # dev-server.mjs / verify.mjs
```

---

## 已知限制

- **只支持 DeepSeek Harness**，不支持任何其他客户端或普通 Web 应用。
- 仅支持 **IPv4 CIDR** 白名单；IPv6 来源会被拒绝。
- **没有 TLS**，也不内置证书管理；公网访问请自行套 VPN 或反向代理。
- 移动端增强依赖 Harness Web UI 的 DOM 结构（`titleRow`、`aria-label="打开侧边栏"` 等），客户端大改版后可能需要适配。
- 会话 Cookie 的签名格式依赖客户端实现；DSH 升级后若鉴权失败，需要更新插件。
- 端口占用时只重试、不自动改端口；需要手动修改 `listenPort`。
- 无法在插件设置页里可视化编辑配置（Host-only 插件未导出 Config schema），请直接编辑 JSON。

---

## License

[MIT](LICENSE) © 2026 Sheldon

本项目为非官方社区项目，与 DeepSeek 官方无隶属关系；使用前请阅读[安全模型](#安全模型必读)。
