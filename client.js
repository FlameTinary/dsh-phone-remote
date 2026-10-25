window.__ModuleLoader__.load({
  id: '@flametinary/dsh-phone-remote',
  factory(require) {
    const React = require('react');
    const h = React.createElement;
    const NS = 'settings.phone-remote';
    const API = '/phone-remote/api/config';
    const PACKAGE_NAME = '@flametinary/dsh-phone-remote';

    const MESSAGES = {
      zh: {
        title: '手机远程访问',
        subtitle: '在同一个局域网内，用手机或平板打开这个 DeepSeek Harness 桌面客户端。改动会写入 config.json，并重启网关监听。',
        running: '运行中',
        stopped: '未监听',
        restarting: '正在重启…',
        refresh: '刷新',
        loadFailed: '读取配置失败',
        retry: '重试',
        loading: '正在读取配置…',
        phoneTitle: '手机入口',
        phoneHint: '这些链接包含访问密钥，请只分享给可信设备。',
        copy: '复制',
        copied: '已复制',
        noUrls: '当前没有可用的局域网地址，请确认电脑已连接 Wi-Fi 或有线网络。',
        networkTitle: '网络',
        listenPort: '监听端口',
        listenPortHint: '手机访问使用的端口，默认 58800。',
        upstreamPort: '上游端口',
        upstreamHint: '留空自动发现本机 Harness 端口；一般不需要填写。',
        allowCidrs: '允许访问的网段',
        allowCidrsHint: '每行一个 IPv4 CIDR，例如 192.168.1.0/24。127.0.0.1/32 建议保留。',
        mobileDrawer: '移动端抽屉增强',
        mobileDrawerHint: '在窄屏上把侧边栏变成抽屉，并放大输入框字号，避免 iOS 自动缩放。',
        authTitle: '访问凭据',
        basicUser: 'Basic 用户名',
        basicPass: 'Basic 密码',
        basicHint: '浏览器弹出 Basic 认证时使用；至少 8 位。',
        accessKey: '访问密钥',
        accessKeyHint: '手机链接中的 ?k= 密钥。重新生成后，旧链接会立即失效。',
        show: '显示',
        hide: '隐藏',
        rotate: '重新生成',
        confirmRotate: '确认重新生成？',
        cancel: '取消',
        save: '保存并应用',
        saving: '保存中…',
        saved: '已保存，网关正在重启，稍后会自动刷新。',
        portChanged: '端口已修改，当前页面无法自动跳转。请打开新地址继续：',
        saveFailed: '保存失败',
        server: '上游',
        serverAuto: '自动发现中',
        configPath: '配置文件',
        logPath: '日志',
        cloudflareTitle: '外网访问（Cloudflare）',
        cloudflareHint: '不在同一局域网时，手机通过 Cloudflare 隧道连接；局域网内仍优先直连。',
        cfEnabled: '启用 Cloudflare 外网访问',
        cfMode: '连接方式',
        cfModeQuick: '快速隧道（临时地址，仅连通性测试）',
        cfModeToken: '命名隧道（需 Cloudflare 账号，推荐）',
        cfQuickWarning: 'Cloudflare 快速隧道不支持 SSE（官方限制），Harness 会停在「加载插件…」。要完整使用请改用命名隧道。',
        cfToken: 'Tunnel Token',
        cfTokenHint: 'Cloudflare Zero Trust 创建隧道后复制的 token。只保存在本机 config.json。',
        cfPublicUrl: '公网地址',
        cfPublicUrlHint: '命名隧道在 Cloudflare 绑定的主机名，例如 https://dsh.example.com。',
        cfPath: 'cloudflared 路径',
        cfPathHint: '默认从 PATH 查找；Homebrew 通常是 /opt/homebrew/bin/cloudflared。',
        cfAutoLan: '同一局域网自动切回 LAN',
        cfAutoLanHint: '手机在家庭网络时，Cloudflare 入口会自动跳回局域网地址；外网仍走 Cloudflare。依赖公网 IP 判断，少数网络可能不生效。',
        cfRunning: '已连接',
        cfStopped: '未运行',
        cfDisabled: '未启用',
        cfWaiting: '等待公网地址…',
        cfError: '隧道异常',
        cfRemoteTitle: '外网链接',
        cfRemoteHint: '这个链接带访问密钥，局域网和外网都可用；同一局域网内会自动跳回手机入口。',
        cfNoRemote: '启用并保存后，这里会显示 Cloudflare 公网链接。',
        cfOpen: '打开',
        cfRefresh: '刷新状态',
        cfTokenRequired: '使用命名隧道时请填写 Tunnel Token。',
        cfLog: 'Cloudflare 日志',
        cfNote: '公网入口仅由访问密钥 / Basic 保护。建议在 Cloudflare 侧再加 Access 策略，并定期重新生成访问密钥。',
        footer: '仅适用于 DeepSeek Harness 桌面客户端。不要再把网关端口直接暴露到公网。',
      },
      en: {
        title: 'Phone Remote',
        subtitle: 'Open this DeepSeek Harness desktop client from a phone or tablet on the same LAN. Saving writes config.json and restarts the gateway listener.',
        running: 'Running',
        stopped: 'Not listening',
        restarting: 'Restarting…',
        refresh: 'Refresh',
        loadFailed: 'Could not read the configuration',
        retry: 'Retry',
        loading: 'Loading configuration…',
        phoneTitle: 'Phone entry points',
        phoneHint: 'These URLs contain the access key. Share them only with trusted devices.',
        copy: 'Copy',
        copied: 'Copied',
        noUrls: 'No LAN address is available. Make sure this computer is on Wi-Fi or Ethernet.',
        networkTitle: 'Network',
        listenPort: 'Listen port',
        listenPortHint: 'The port phones connect to. Default: 58800.',
        upstreamPort: 'Upstream port',
        upstreamHint: 'Leave empty to auto-detect the local Harness port. Usually not needed.',
        allowCidrs: 'Allowed networks',
        allowCidrsHint: 'One IPv4 CIDR per line, for example 192.168.1.0/24. Keep 127.0.0.1/32.',
        mobileDrawer: 'Mobile drawer enhancement',
        mobileDrawerHint: 'Turns the sidebar into a drawer on narrow screens and enlarges input text to avoid iOS zoom.',
        authTitle: 'Access credentials',
        basicUser: 'Basic username',
        basicPass: 'Basic password',
        basicHint: 'Used for browser Basic auth. At least 8 characters.',
        accessKey: 'Access key',
        accessKeyHint: 'The ?k= value in phone links. Rotating it invalidates old links immediately.',
        show: 'Show',
        hide: 'Hide',
        rotate: 'Regenerate',
        confirmRotate: 'Regenerate now?',
        cancel: 'Cancel',
        save: 'Save and apply',
        saving: 'Saving…',
        saved: 'Saved. The gateway is restarting and will refresh shortly.',
        portChanged: 'The port changed, so this page cannot reload itself. Open the new address:',
        saveFailed: 'Save failed',
        server: 'Upstream',
        serverAuto: 'Detecting',
        configPath: 'Config file',
        logPath: 'Log',
        cloudflareTitle: 'Remote access (Cloudflare)',
        cloudflareHint: 'When your phone is not on the same LAN, it connects through a Cloudflare tunnel; on the home network the LAN link is still preferred.',
        cfEnabled: 'Enable Cloudflare remote access',
        cfMode: 'Connection mode',
        cfModeQuick: 'Quick tunnel (temporary URL, connectivity test only)',
        cfModeToken: 'Named tunnel (Cloudflare account required, recommended)',
        cfQuickWarning: 'Cloudflare Quick Tunnels do not support SSE, so the Harness UI can stay at “Loading plugins…”. Use a named tunnel for the full app.',
        cfToken: 'Tunnel token',
        cfTokenHint: 'The token Cloudflare Zero Trust shows after creating a tunnel. It is stored only in the local config.json.',
        cfPublicUrl: 'Public URL',
        cfPublicUrlHint: 'The hostname bound to the named tunnel, for example https://dsh.example.com.',
        cfPath: 'cloudflared path',
        cfPathHint: 'Looked up on PATH by default; Homebrew usually installs to /opt/homebrew/bin/cloudflared.',
        cfAutoLan: 'Switch back to LAN on the same network',
        cfAutoLanHint: 'When the phone is on the home network, the Cloudflare entry redirects to the LAN address; outside it stays on Cloudflare. This relies on public-IP detection and can miss some networks.',
        cfRunning: 'Connected',
        cfStopped: 'Not running',
        cfDisabled: 'Not enabled',
        cfWaiting: 'Waiting for a public URL…',
        cfError: 'Tunnel error',
        cfRemoteTitle: 'Public link',
        cfRemoteHint: 'This link carries the access key and works both on the LAN and outside; on the same LAN it redirects back to the phone entry.',
        cfNoRemote: 'Save with Cloudflare enabled to get a public link.',
        cfOpen: 'Open',
        cfRefresh: 'Refresh status',
        cfTokenRequired: 'A tunnel token is required for a named tunnel.',
        cfLog: 'Cloudflare log',
        cfNote: 'The public entry is protected by the access key / Basic auth only. Add a Cloudflare Access policy as well, and rotate the access key regularly.',
        footer: 'Only for the DeepSeek Harness desktop client. Never expose the gateway port directly to the public internet.',
      },
    };

    // Pick a default language before the locale service resolves.
    const fallbackZh = /^zh\b/i.test(String(navigator.language || ''));
    const localT = (key) => (fallbackZh ? MESSAGES.zh[key] : MESSAGES.en[key]) ?? MESSAGES.en[key] ?? key;

    function copyText(text) {
      return (async () => {
        try {
          if (navigator.clipboard?.writeText) {
            await navigator.clipboard.writeText(text);
            return true;
          }
        } catch {
          // Fall through to the selection-based copy.
        }
        try {
          const area = document.createElement('textarea');
          area.value = text;
          area.setAttribute('readonly', '');
          area.style.position = 'fixed';
          area.style.opacity = '0';
          document.body.appendChild(area);
          area.select();
          const ok = document.execCommand('copy');
          area.remove();
          return ok;
        } catch {
          return false;
        }
      })();
    }

    const CSS = `
.dpr-root { display:grid; gap:14px; padding:6px 0 10px; color:var(--dsw-alias-label-primary); font-size:13px; line-height:1.55; }
.dpr-bar { display:flex; align-items:center; justify-content:space-between; gap:12px; min-height:30px; }
.dpr-status { display:flex; align-items:center; gap:8px; flex:none; color:var(--dsw-alias-label-secondary); font-size:12px; }
.dpr-dot { width:7px; height:7px; border-radius:50%; background:var(--dsw-alias-state-idle-primary); }
.dpr-dot.on { background:var(--dsw-alias-state-success-primary); }
.dpr-dot.busy { background:var(--dsw-alias-state-warn-primary); }
.dpr-card { border:1px solid var(--dsw-alias-border-l1); border-radius:12px; padding:14px 16px; background:var(--dsw-alias-bg-layer-2); display:grid; gap:12px; }
.dpr-card h4 { margin:0; font-size:13px; font-weight:600; }
.dpr-grid { display:grid; grid-template-columns:repeat(2,minmax(0,1fr)); gap:12px; }
.dpr-field { display:grid; gap:6px; min-width:0; }
.dpr-field > label { color:var(--dsw-alias-label-secondary); font-size:12px; }
.dpr-input, .dpr-textarea { width:100%; box-sizing:border-box; border:1px solid var(--dsw-alias-border-l2); border-radius:8px; background:var(--dsw-alias-bg-base); color:var(--dsw-alias-label-primary); font:inherit; padding:8px 10px; outline:none; transition:border-color .15s ease; }
.dpr-input { height:38px; }
.dpr-input:focus, .dpr-textarea:focus { border-color:var(--dsw-alias-brand-primary); }
.dpr-textarea { min-height:76px; resize:vertical; font-family:ui-monospace,SFMono-Regular,Menlo,monospace; font-size:12px; }
.dpr-row { display:flex; align-items:center; gap:8px; }
.dpr-row .dpr-input { flex:1; min-width:0; }
.dpr-btn { border:1px solid var(--dsw-alias-border-l2); background:transparent; color:var(--dsw-alias-label-primary); border-radius:8px; padding:7px 11px; font:inherit; font-size:12px; cursor:pointer; white-space:nowrap; }
.dpr-btn:hover:not(:disabled) { border-color:var(--dsw-alias-label-secondary); }
.dpr-btn { text-decoration:none; display:inline-flex; align-items:center; justify-content:center; }
.dpr-cloudflare { display:grid; gap:12px; }
.dpr-select { height:38px; cursor:pointer; }
.dpr-btn.primary { background:var(--dsw-alias-brand-primary); border-color:transparent; color:var(--dsw-alias-bg-base); font-weight:600; }
.dpr-btn.primary:hover:not(:disabled) { filter:brightness(1.06); }
.dpr-btn.danger { color:var(--dsw-alias-state-error-primary); border-color:color-mix(in srgb, var(--dsw-alias-state-error-primary) 45%, transparent); }
.dpr-btn:disabled { opacity:.55; cursor:default; }
.dpr-note { margin:0; color:var(--dsw-alias-label-secondary); font-size:12px; }
.dpr-warn { margin:0; color:var(--dsw-alias-state-warn-primary); font-size:12px; line-height:1.5; }
.dpr-links { display:grid; gap:8px; }
.dpr-check { display:flex; align-items:center; gap:8px; font-size:13px; }
.dpr-check input { width:15px; height:15px; accent-color:var(--dsw-alias-brand-primary); }
.dpr-actions { display:flex; align-items:center; gap:10px; flex-wrap:wrap; }
.dpr-ok { color:var(--dsw-alias-state-success-primary); font-size:12px; }
.dpr-err { color:var(--dsw-alias-state-error-primary); font-size:12px; }
.dpr-meta { color:var(--dsw-alias-label-secondary); font-size:11px; display:grid; gap:2px; word-break:break-all; }
.dpr-meta code { font-size:11px; }
.dpr-moved { color:var(--dsw-alias-label-secondary); font-size:12px; }
.dpr-moved a { color:var(--dsw-alias-label-primary); text-decoration:underline; word-break:break-all; }
.dpr-divider { height:1px; background:var(--dsw-alias-border-l1); }
@media (max-width:760px){ .dpr-grid { grid-template-columns:1fr; } .dpr-bar { flex-wrap:wrap; } }
`;

    function LabeledField(props) {
      return h(
        'div',
        { className: 'dpr-field' },
        h('label', { htmlFor: props.id }, props.label),
        props.children,
        props.hint ? h('p', { className: 'dpr-note' }, props.hint) : null,
      );
    }

    function PhoneRemoteConfig(props) {
      const t = props.t ?? localT;
      const [state, setState] = React.useState(null);
      const [draft, setDraft] = React.useState(null);
      const [error, setError] = React.useState('');
      const [notice, setNotice] = React.useState('');
      const [saving, setSaving] = React.useState(false);
      const [loading, setLoading] = React.useState(true);
      const [showSecret, setShowSecret] = React.useState(false);
      const [showKey, setShowKey] = React.useState(false);
      const [confirmRotate, setConfirmRotate] = React.useState(false);
      const [movedTo, setMovedTo] = React.useState('');
      const [copied, setCopied] = React.useState('');
      const alive = React.useRef(true);
      const rotateTimer = React.useRef(null);

      function adopt(data) {
        if (!alive.current) return;
        setState(data);
        setDraft({
          listenPort: String(data.configuredPort ?? data.port ?? ''),
          upstreamPort: data.upstreamPort == null ? '' : String(data.upstreamPort),
          basicUser: data.basicUser ?? '',
          basicPass: data.basicPass ?? '',
          allowCidrs: (data.allowCidrs ?? []).join('\n'),
          mobileDrawer: data.mobileDrawer !== false,
          cloudflare: {
            enabled: data.cloudflareConfig?.enabled === true,
            mode: data.cloudflareConfig?.mode === 'token' ? 'token' : 'quick',
            token: data.cloudflareConfig?.token ?? '',
            publicUrl: data.cloudflareConfig?.publicUrl ?? '',
            autoLanRedirect: data.cloudflareConfig?.autoLanRedirect !== false,
            cloudflaredPath: data.cloudflareConfig?.cloudflaredPath ?? 'cloudflared',
          },
        });
      }

      async function request(method, body) {
        const headers = {};
        if (method === 'POST') {
          headers['content-type'] = 'application/json';
          headers['x-phone-remote-config'] = '1';
        }
        const response = await fetch(API, {
          method,
          headers,
          body: body ? JSON.stringify(body) : undefined,
          credentials: 'same-origin',
          cache: 'no-store',
        });
        let data;
        try {
          data = await response.json();
        } catch {
          data = { ok: false, error: `HTTP ${response.status}` };
        }
        if (!response.ok || data.ok === false) {
          throw new Error(data.error || `HTTP ${response.status}`);
        }
        return data;
      }

      async function load({ silent = false } = {}) {
        if (!silent) setLoading(true);
        try {
          const data = await request('GET');
          adopt(data);
          setMovedTo('');
          setError('');
        } catch (loadError) {
          if (alive.current) setError(loadError.message);
        } finally {
          if (alive.current) setLoading(false);
        }
      }

      React.useEffect(() => {
        alive.current = true;
        load();
        return () => {
          alive.current = false;
          if (rotateTimer.current) clearTimeout(rotateTimer.current);
        };
      }, []);

      const setField = (key) => (event) => {
        const value = event.target.type === 'checkbox' ? event.target.checked : event.target.value;
        setDraft((current) => ({ ...current, [key]: value }));
      };

      const setCf = (key) => (event) => {
        const value = event.target.type === 'checkbox' ? event.target.checked : event.target.value;
        setDraft((current) => ({
          ...current,
          cloudflare: { ...current.cloudflare, [key]: value },
        }));
      };

      async function copy(value, id) {
        const ok = await copyText(value);
        if (ok) {
          setCopied(id);
          setTimeout(() => {
            if (alive.current) setCopied('');
          }, 1500);
        }
      }

      async function save() {
        if (!draft) return;
        if (draft.cloudflare.enabled && draft.cloudflare.mode === 'token' && !draft.cloudflare.token.trim()) {
          setError(t('cfTokenRequired'));
          return;
        }
        const previousPort = state.port ?? state.configuredPort;
        setSaving(true);
        setError('');
        setNotice('');
        setMovedTo('');
        try {
          const payload = {
            listenPort: Number(draft.listenPort),
            upstreamPort: draft.upstreamPort.trim() === '' ? null : Number(draft.upstreamPort),
            basicUser: draft.basicUser.trim(),
            basicPass: draft.basicPass,
            allowCidrs: draft.allowCidrs.split(/[\n,]+/).map((entry) => entry.trim()).filter(Boolean),
            mobileDrawer: Boolean(draft.mobileDrawer),
            cloudflare: {
              enabled: Boolean(draft.cloudflare.enabled),
              mode: draft.cloudflare.mode,
              token: draft.cloudflare.token,
              publicUrl: draft.cloudflare.publicUrl.trim(),
              autoLanRedirect: Boolean(draft.cloudflare.autoLanRedirect),
              cloudflaredPath: draft.cloudflare.cloudflaredPath.trim() || 'cloudflared',
            },
          };
          const data = await request('POST', payload);
          adopt(data);
          if (Number(payload.listenPort) !== Number(previousPort)) {
            const nextUrl = `${location.protocol}//${location.hostname}:${payload.listenPort}${location.pathname}${location.search}`;
            setMovedTo(nextUrl);
            setNotice(t('portChanged'));
            return;
          }
          setNotice(t('saved'));
          setTimeout(() => load({ silent: true }), 700);
          setTimeout(() => load({ silent: true }), 1700);
          if (payload.cloudflare.enabled && payload.cloudflare.mode === 'quick') {
            setTimeout(() => load({ silent: true }), 4000);
          }
        } catch (saveError) {
          setError(saveError.message);
        } finally {
          setSaving(false);
        }
      }

      async function rotate() {
        if (!confirmRotate) {
          setConfirmRotate(true);
          if (rotateTimer.current) clearTimeout(rotateTimer.current);
          rotateTimer.current = setTimeout(() => {
            if (alive.current) setConfirmRotate(false);
          }, 4000);
          return;
        }
        if (rotateTimer.current) clearTimeout(rotateTimer.current);
        setConfirmRotate(false);
        setSaving(true);
        setError('');
        setNotice('');
        try {
          const data = await request('POST', { rotateAccessKey: true });
          adopt(data);
          setMovedTo('');
          setNotice(t('saved'));
          setTimeout(() => load({ silent: true }), 700);
          setTimeout(() => load({ silent: true }), 1700);
        } catch (rotateError) {
          setError(rotateError.message);
        } finally {
          setSaving(false);
        }
      }

      if (loading && !draft) {
        return h('div', { className: 'dpr-root' }, h('style', null, CSS), h('p', { className: 'dpr-note' }, t('loading')));
      }

      if (error && !draft) {
        return h(
          'div',
          { className: 'dpr-root' },
          h('style', null, CSS),
          h('p', { className: 'dpr-err' }, `${t('loadFailed')}: ${error}`),
          h('div', null, h('button', { className: 'dpr-btn', onClick: () => load() }, t('retry'))),
        );
      }

      if (!state || !draft) return null;

      const urls = state.phoneUrls ?? [];
      const cf = state.cloudflare ?? {};
      const cfUrls = state.remoteUrls ?? [];
      const cfEnabled = draft.cloudflare.enabled;
      const busy = saving || state.restarting;
      const statusText = state.restarting ? t('restarting') : state.listening ? t('running') : t('stopped');
      const cfStatus = !cfEnabled
        ? t('cfDisabled')
        : cf.running
          ? t('cfRunning')
          : cf.error
            ? t('cfError')
            : t('cfWaiting');
      const cfAddress = cf.publicUrl || cf.configuredUrl || '';

      return h(
        'div',
        { className: 'dpr-root', 'data-dpr-build': '2026-10-25c' },
        h('style', null, CSS),
        h(
          'div',
          { className: 'dpr-bar' },
          h(
            'div',
            { className: 'dpr-status' },
            h('span', { className: `dpr-dot ${state.listening ? 'on' : ''} ${state.restarting ? 'busy' : ''}` }),
            h('span', null, statusText),
            h('span', { style: { opacity: 0.5 } }, '·'),
            h('span', null, `${state.listenHost}:${state.port ?? state.configuredPort ?? '—'}`),
          ),
          h('button', { className: 'dpr-btn', disabled: busy, onClick: () => load({ silent: true }) }, t('refresh')),
        ),
        h(
          'div',
          { className: 'dpr-card' },
          h('h4', null, t('phoneTitle')),
          h('p', { className: 'dpr-note' }, t('phoneHint')),
          urls.length === 0
            ? h('p', { className: 'dpr-note' }, t('noUrls'))
            : h(
                'div',
                { className: 'dpr-links' },
                ...urls.map((url, index) => h(
                  'div',
                  { className: 'dpr-row', key: url },
                  h('input', { className: 'dpr-input', readOnly: true, value: url, onFocus: (event) => event.target.select() }),
                  h('button', { className: 'dpr-btn', onClick: () => copy(url, `url-${index}`) }, copied === `url-${index}` ? t('copied') : t('copy')),
                )),
              ),
        ),
        h(
          'div',
          { className: 'dpr-card' },
          h('h4', null, t('cloudflareTitle')),
          h('p', { className: 'dpr-note' }, t('cloudflareHint')),
          h(
            'label',
            { className: 'dpr-check' },
            h('input', { type: 'checkbox', checked: draft.cloudflare.enabled, onChange: setCf('enabled') }),
            h('span', null, t('cfEnabled')),
          ),
          draft.cloudflare.enabled ? h(
            'div',
            { className: 'dpr-cloudflare' },
            h(
              'div',
              { className: 'dpr-status' },
              h('span', { className: `dpr-dot ${cf.running ? 'on' : 'busy'}` }),
              h('span', null, cfStatus),
              cfAddress ? h('span', { style: { opacity: 0.5 } }, '·') : null,
              cfAddress ? h('code', null, cfAddress) : null,
            ),
            h(
              'div',
              { className: 'dpr-grid' },
              h(
                LabeledField,
                { id: 'dpr-cf-mode', label: t('cfMode') },
                h(
                  'select',
                  { id: 'dpr-cf-mode', className: 'dpr-input dpr-select', value: draft.cloudflare.mode, onChange: setCf('mode') },
                  h('option', { value: 'quick' }, t('cfModeQuick')),
                  h('option', { value: 'token' }, t('cfModeToken')),
                ),
              ),
              h(
                LabeledField,
                { id: 'dpr-cf-path', label: t('cfPath'), hint: t('cfPathHint') },
                h('input', {
                  id: 'dpr-cf-path',
                  className: 'dpr-input',
                  value: draft.cloudflare.cloudflaredPath,
                  onChange: setCf('cloudflaredPath'),
                  spellCheck: false,
                }),
              ),
            ),
            draft.cloudflare.mode === 'quick' ? h('p', { className: 'dpr-warn' }, t('cfQuickWarning')) : null,
            draft.cloudflare.mode === 'token' ? h(
              'div',
              { className: 'dpr-grid' },
              h(
                LabeledField,
                { id: 'dpr-cf-token', label: t('cfToken'), hint: t('cfTokenHint') },
                h('input', {
                  id: 'dpr-cf-token',
                  className: 'dpr-input',
                  type: 'password',
                  value: draft.cloudflare.token,
                  onChange: setCf('token'),
                  autoComplete: 'off',
                  spellCheck: false,
                }),
              ),
              h(
                LabeledField,
                { id: 'dpr-cf-public-url', label: t('cfPublicUrl'), hint: t('cfPublicUrlHint') },
                h('input', {
                  id: 'dpr-cf-public-url',
                  className: 'dpr-input',
                  type: 'url',
                  value: draft.cloudflare.publicUrl,
                  onChange: setCf('publicUrl'),
                  placeholder: 'https://dsh.example.com',
                  spellCheck: false,
                }),
              ),
            ) : h(
              'div',
              { className: 'dpr-links' },
              cf.publicUrl
                ? h(
                    'div',
                    { className: 'dpr-row' },
                    h('input', { className: 'dpr-input', readOnly: true, value: cf.publicUrl, onFocus: (event) => event.target.select() }),
                    h('button', { className: 'dpr-btn', onClick: () => copy(cf.publicUrl, 'cf-public') }, copied === 'cf-public' ? t('copied') : t('copy')),
                    h('a', { className: 'dpr-btn', href: cfUrls[0] || cf.publicUrl, target: '_blank', rel: 'noreferrer' }, t('cfOpen')),
                  )
                : h('p', { className: 'dpr-note' }, t('cfWaiting')),
            ),
            h(
              'label',
              { className: 'dpr-check' },
              h('input', { type: 'checkbox', checked: draft.cloudflare.autoLanRedirect, onChange: setCf('autoLanRedirect') }),
              h('span', null, t('cfAutoLan')),
            ),
            h('p', { className: 'dpr-note' }, t('cfAutoLanHint')),
            cf.error ? h('p', { className: 'dpr-err' }, cf.error) : null,
            cfUrls.length ? h(
              LabeledField,
              { id: 'dpr-cf-remote', label: t('cfRemoteTitle'), hint: t('cfRemoteHint') },
              h(
                'div',
                { className: 'dpr-row' },
                h('input', { className: 'dpr-input', readOnly: true, value: cfUrls[0], onFocus: (event) => event.target.select() }),
                h('button', { className: 'dpr-btn', onClick: () => copy(cfUrls[0], 'cf-url') }, copied === 'cf-url' ? t('copied') : t('copy')),
                h('a', { className: 'dpr-btn', href: cfUrls[0], target: '_blank', rel: 'noreferrer' }, t('cfOpen')),
              ),
            ) : null,
            h('p', { className: 'dpr-note' }, t('cfNote')),
          ) : null,
        ),
        h(
          'div',
          { className: 'dpr-card' },
          h('h4', null, t('networkTitle')),
          h(
            'div',
            { className: 'dpr-grid' },
            h(
              LabeledField,
              { id: 'dpr-listen-port', label: t('listenPort'), hint: t('listenPortHint') },
              h('input', {
                id: 'dpr-listen-port',
                className: 'dpr-input',
                type: 'number',
                min: 1,
                max: 65535,
                value: draft.listenPort,
                onChange: setField('listenPort'),
              }),
            ),
            h(
              LabeledField,
              { id: 'dpr-upstream-port', label: t('upstreamPort'), hint: t('upstreamHint') },
              h('input', {
                id: 'dpr-upstream-port',
                className: 'dpr-input',
                type: 'number',
                min: 1,
                max: 65535,
                placeholder: state.upstream?.origin ?? t('serverAuto'),
                value: draft.upstreamPort,
                onChange: setField('upstreamPort'),
              }),
            ),
          ),
          h(
            LabeledField,
            { id: 'dpr-cidrs', label: t('allowCidrs'), hint: t('allowCidrsHint') },
            h('textarea', {
              id: 'dpr-cidrs',
              className: 'dpr-textarea',
              value: draft.allowCidrs,
              onChange: setField('allowCidrs'),
              spellCheck: false,
            }),
          ),
          h(
            'label',
            { className: 'dpr-check' },
            h('input', { type: 'checkbox', checked: draft.mobileDrawer, onChange: setField('mobileDrawer') }),
            h('span', null, t('mobileDrawer')),
          ),
          h('p', { className: 'dpr-note' }, t('mobileDrawerHint')),
        ),
        h(
          'div',
          { className: 'dpr-card' },
          h('h4', null, t('authTitle')),
          h(
            'div',
            { className: 'dpr-grid' },
            h(
              LabeledField,
              { id: 'dpr-basic-user', label: t('basicUser') },
              h('input', {
                id: 'dpr-basic-user',
                className: 'dpr-input',
                value: draft.basicUser,
                onChange: setField('basicUser'),
                autoComplete: 'off',
              }),
            ),
            h(
              LabeledField,
              { id: 'dpr-basic-pass', label: t('basicPass'), hint: t('basicHint') },
              h('input', {
                id: 'dpr-basic-pass',
                className: 'dpr-input',
                type: showSecret ? 'text' : 'password',
                value: draft.basicPass,
                onChange: setField('basicPass'),
                autoComplete: 'new-password',
              }),
            ),
          ),
          h(
            'div',
            { className: 'dpr-row' },
            h('button', { className: 'dpr-btn', onClick: () => setShowSecret((value) => !value) }, showSecret ? t('hide') : t('show')),
            h('button', { className: 'dpr-btn', onClick: () => copy(draft.basicPass, 'basic') }, copied === 'basic' ? t('copied') : t('copy')),
          ),
          h('div', { className: 'dpr-divider' }),
          h(
            LabeledField,
            { id: 'dpr-access-key', label: t('accessKey'), hint: t('accessKeyHint') },
            h(
              'div',
              { className: 'dpr-row' },
              h('input', {
                id: 'dpr-access-key',
                className: 'dpr-input',
                readOnly: true,
                type: showKey ? 'text' : 'password',
                value: state.accessKey ?? '',
                onFocus: (event) => event.target.select(),
              }),
              h('button', { className: 'dpr-btn', onClick: () => setShowKey((value) => !value) }, showKey ? t('hide') : t('show')),
              h('button', { className: 'dpr-btn', onClick: () => copy(state.accessKey ?? '', 'key') }, copied === 'key' ? t('copied') : t('copy')),
              h('button', { className: `dpr-btn ${confirmRotate ? 'danger' : ''}`, disabled: busy, onClick: rotate }, confirmRotate ? t('confirmRotate') : t('rotate')),
            ),
          ),
        ),
        h(
          'div',
          { className: 'dpr-actions' },
          h('button', { className: 'dpr-btn primary', disabled: busy, onClick: save }, saving ? t('saving') : t('save')),
          notice ? h('span', { className: 'dpr-ok' }, notice) : null,
          movedTo ? h('span', { className: 'dpr-moved' }, h('a', { href: movedTo }, movedTo)) : null,
          error ? h('span', { className: 'dpr-err' }, `${t('saveFailed')}: ${error}`) : null,
        ),
        h(
          'div',
          { className: 'dpr-meta' },
          h('div', null, `${t('server')}: `, h('code', null, state.upstream?.origin ?? t('serverAuto'))),
          h('div', null, `${t('configPath')}: `, h('code', null, state.configPath ?? '')),
          h('div', null, `${t('logPath')}: `, h('code', null, state.logFile ?? '')),
          state.cloudflareConfig?.enabled
            ? h('div', null, `${t('cfLog')}: `, h('code', null, state.cloudflareLogFile ?? ''))
            : null,
          h('div', null, t('footer')),
        ),
      );
    }

    return {
      inject: ['slots', 'locale'],
      apply(ctx) {
        const t = ctx.locale.bind(NS);
        ctx.effect(() => ctx.locale.register(NS, MESSAGES), 'phone-remote: dictionaries');
        const Component = (props) => h(PhoneRemoteConfig, { ...props, t });
        ctx.effect(() => ctx.slots.inject('plugins.bundle.config', () => ctx.slots.register({
          name: 'plugins.bundle.config',
          key: PACKAGE_NAME,
          locale: NS,
        }, Component)), 'phone-remote: bundle settings page');
      },
    };
  },
});
