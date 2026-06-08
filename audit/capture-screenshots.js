const { chromium } = require('playwright');

const routes = [
  { name: 'landing', path: '/' },
  { name: 'login', path: '/login' },
  { name: 'signup-role', path: '/signup/role' },
  { name: 'onboarding', path: '/onboarding' },
  { name: 'coach-dashboard', path: '/dashboard' },
  { name: 'roster', path: '/dashboard/roster' },
  { name: 'schedule', path: '/dashboard/schedule' },
  { name: 'messages', path: '/dashboard/messages' },
  { name: 'settings', path: '/dashboard/settings' },
  { name: 'documents', path: '/dashboard/documents' },
  { name: 'game-video', path: '/dashboard/game-video' },
  { name: 'enter-player-code', path: '/enter-player-code' },
  { name: 'parent-join', path: '/parent/join' },
];

(async () => {
  const browser = await chromium.launch();
  const viewports = [
    { folder: 'desktop', width: 1440, height: 900 },
    { folder: 'mobile', width: 390, height: 844 },
  ];
  for (const vp of viewports) {
    const context = await browser.newContext({ viewport: { width: vp.width, height: vp.height } });
    const page = await context.newPage();
    for (const route of routes) {
      try {
        await page.goto(`http://localhost:3000${route.path}`, { waitUntil: 'networkidle', timeout: 60000 });
        await page.waitForTimeout(1500);
        await page.screenshot({ path: `audit/screenshots/${vp.folder}/${route.name}.png`, fullPage: true });
        console.log(`saved ${vp.folder}/${route.name}`);
      } catch (e) {
        console.error(`failed ${vp.folder}/${route.name}:`, e.message);
      }
    }
    await context.close();
  }
  await browser.close();
})();
