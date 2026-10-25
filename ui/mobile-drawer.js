/* 手机端抽屉：内容全宽 + 顶栏汉堡按钮 + 从左侧滑出的抽屉。
 * - 仅窄屏（<=768px）生效；桌面端零改动
 * - 无持久侧栏：抽屉默认藏在屏幕外
 * - 点汉堡打开 / 点遮罩、Esc、抽屉内点会话关闭 / 用侧栏自带收起按钮也会同步
 */
(() => {
  if (window.__dshMobileDrawer) return;
  window.__dshMobileDrawer = true;

  const narrow = window.matchMedia('(max-width: 768px)');
  const ROOT = document.documentElement;
  const OPEN_BUTTON = 'button[aria-label="打开侧边栏"]';
  const CLOSE_BUTTON = 'button[aria-label="收起侧边栏"]';
  const TITLE_ROW = '[class*="titleRow"]';
  const HAMBURGER_ICON = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" aria-hidden="true"><path d="M4 7h16M4 12h16M4 17h16"/></svg>';

  let backdrop = null;
  let frameRecheck = null;

  function ensureBackdrop() {
    if (backdrop && backdrop.isConnected) return backdrop;
    backdrop = document.createElement('div');
    backdrop.className = 'dsh-drawer-backdrop';
    backdrop.setAttribute('aria-hidden', 'true');
    backdrop.addEventListener('click', close);
    document.body.appendChild(backdrop);
    return backdrop;
  }

  function open() {
    if (!narrow.matches) return;
    ensureBackdrop();
    const button = document.querySelector(OPEN_BUTTON);
    if (button) button.click();
    // 等 React 把侧栏换成展开态再上类，滑动才连贯
    requestAnimationFrame(() => ROOT.classList.add('dsh-drawer-open'));
  }

  function close() {
    ROOT.classList.remove('dsh-drawer-open');
  }

  function toggle() {
    if (ROOT.classList.contains('dsh-drawer-open')) close();
    else open();
  }

  function placeHamburger(button) {
    // 顶栏本身是 CSS grid：把按钮直接插进 <header> 会多占一个网格行，
    // 表现为「汉堡单独一行 + 上方一条空白」——所以优先放进标题行，
    // 与会话标题同一行、位于最左侧。
    const titleRow = document.querySelector(TITLE_ROW);
    if (titleRow) {
      if (titleRow.firstElementChild !== button) titleRow.insertBefore(button, titleRow.firstElementChild);
      button.classList.remove('dsh-hamburger-floating');
      return;
    }
    const header = document.querySelector('header');
    if (header) {
      if (button.parentElement !== header) header.insertBefore(button, header.firstChild);
      button.classList.remove('dsh-hamburger-floating');
      return;
    }
    if (button.parentElement !== document.body) document.body.appendChild(button);
    button.classList.add('dsh-hamburger-floating');
  }

  function ensureHamburger() {
    let button = document.querySelector('.dsh-hamburger');
    if (!button) {
      button = document.createElement('button');
      button.type = 'button';
      button.className = 'dsh-hamburger';
      button.setAttribute('aria-label', '打开侧边栏');
      button.innerHTML = HAMBURGER_ICON;
      button.addEventListener('click', (event) => {
        event.preventDefault();
        event.stopPropagation();
        toggle();
      });
    }
    placeHamburger(button);
    return button;
  }

  function boot() {
    ensureHamburger();
    ensureBackdrop();

    // React 重渲染可能清掉按钮或顶栏：用 rAF 合并后的观察器补回
    const observer = new MutationObserver(() => {
      if (frameRecheck) return;
      frameRecheck = requestAnimationFrame(() => {
        frameRecheck = null;
        ensureHamburger();
      });
    });
    observer.observe(document.body, { childList: true, subtree: true });

    narrow.addEventListener('change', () => {
      if (!narrow.matches) close();
      else ensureHamburger();
    });

    document.addEventListener('keydown', (event) => {
      if (event.key === 'Escape' && ROOT.classList.contains('dsh-drawer-open')) close();
    });

    // 用侧栏自带的收起按钮时，同步关掉抽屉
    document.addEventListener('click', (event) => {
      if (!(event.target instanceof Element)) return;
      if (event.target.closest(CLOSE_BUTTON)) {
        close();
        return;
      }
      if (!ROOT.classList.contains('dsh-drawer-open')) return;

      // 抽屉里点了会话 / 新会话 / 导航行：等应用先跳转，再收起
      const nav = event.target.closest('[data-row-key^="session:"], [aria-label="新建会话"], [class*="panelRow"]');
      if (nav) {
        setTimeout(() => close(), 200);
        return;
      }

      // 兜底：点击导致顶栏标题变化（= 真的导航了）才收起，展开/搜索类操作不收起
      const header = document.querySelector('header');
      if (!header) return;
      const before = header.textContent;
      setTimeout(() => {
        const after = document.querySelector('header')?.textContent;
        if (after !== undefined && after !== before) close();
      }, 450);
    }, true);
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', boot, { once: true });
  } else {
    boot();
  }
})();
