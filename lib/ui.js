import fs from 'node:fs';
import path from 'node:path';

export const UI_ROUTES = new Map([
  ['/__dshgw/ui/mobile-drawer.css', { file: 'mobile-drawer.css', type: 'text/css; charset=utf-8' }],
  ['/__dshgw/ui/mobile-drawer.js', { file: 'mobile-drawer.js', type: 'text/javascript; charset=utf-8' }],
]);

export const UI_TAGS = '<link rel="stylesheet" href="/__dshgw/ui/mobile-drawer.css"><script defer src="/__dshgw/ui/mobile-drawer.js"></script>';

/** True when every patched asset exists on disk. */
export function uiAssetsAvailable(uiDir) {
  return [...UI_ROUTES.values()].every((asset) => fs.existsSync(path.join(uiDir, asset.file)));
}

/** Read one allowlisted asset, or null for an unknown path. */
export function readUiAsset(uiDir, pathname) {
  const asset = UI_ROUTES.get(pathname);
  if (!asset) return null;
  const file = path.join(uiDir, asset.file);
  if (!fs.existsSync(file)) return null;
  return { body: fs.readFileSync(file), type: asset.type };
}

/** Inject the mobile drawer assets once, before </body>. */
export function injectUiTags(html) {
  if (typeof html !== 'string' || html.length === 0) return html;
  if (html.includes('/__dshgw/ui/mobile-drawer.js')) return html;
  const index = html.toLowerCase().lastIndexOf('</body>');
  if (index >= 0) return `${html.slice(0, index)}${UI_TAGS}${html.slice(index)}`;
  return html + UI_TAGS;
}
