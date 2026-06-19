const { chromium } = require('playwright');
const fs = require('fs');
const path = require('path');

const BASE = 'https://braik.io';

const routes = [
  { name: 'landing', path: '/' },
  { name: 'login', path: '/login' },
  { name: 'signup-role', path: '/signup/role' },
  { name: 'signup', path: '/signup' },
  { name: 'pricing', path: '/pricing' },
  { name: 'privacy', path: '/privacy' },
  { name: 'terms', path: '/terms' },
  { name: 'features', path: '/features' },
  { name: 'about', path: '/about' },
  { name: 'faq', path: '/faq' },
  { name: 'why-braik', path: '/why-braik' },
  { name: 'enter-player-code', path: '/enter-player-code' },
  { name: 'parent-join', path: '/parent/join' },
  { name: 'join', path: '/join' },
  { name: 'request-access', path: '/request-access' },
  { name: 'onboarding', path: '/onboarding' },
  { name: 'dashboard-protected', path: '/dashboard' },
  { name: 'player-protected', path: '/player/demo' },
];

const viewports = [
  { folder: 'desktop', width: 1440, height: 900 },
  { folder: 'tablet', width: 768, height: 1024 },
  { folder: 'mobile', width: 390, height: 844 },
];

const outRoot = 'audit/deployed-screenshots';
const manifest = [];

(async () => {
  const browser = await chromium.launch();
  for (const vp of viewports) {
    const context = await browser.newContext({
      viewport: { width: vp.width, height: vp.height },
      userAgent: vp.folder === 'mobile'
        ? 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1'
        : undefined,
    });
    const page = await context.newPage();
    for (const route of routes) {
      const url = `${BASE}${route.path}`;
      const shot = path.join(outRoot, vp.folder, `${route.name}.png`);
      const meta = { route: route.path, name: route.name, viewport: vp.folder, url, screenshot: shot.replace(/\\/g, '/'), finalUrl: null, status: 'ok', title: null, redirected: false };
      try {
        const resp = await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 45000 });
        await page.waitForTimeout(2500);
        meta.status = resp ? resp.status() : 'unknown';
        meta.finalUrl = page.url();
        meta.title = await page.title();
        meta.redirected = meta.finalUrl !== url && !meta.finalUrl.endsWith(route.path);
        await page.screenshot({ path: shot, fullPage: true });
        console.log(`saved ${vp.folder}/${route.name} -> ${meta.finalUrl}`);
      } catch (e) {
        meta.status = 'error';
        meta.error = e.message;
        try { await page.screenshot({ path: shot, fullPage: true }); } catch (_) {}
        console.error(`failed ${vp.folder}/${route.name}:`, e.message);
      }
      manifest.push(meta);
    }
    await context.close();
  }
  await browser.close();
  fs.writeFileSync(path.join(outRoot, 'manifest.json'), JSON.stringify(manifest, null, 2));
})();
