// TC-09 steps 4-5 Browser Compatibility (NFR-6, GitHub #29).
//
// NFR-6: "The system's web-based front end shall function correctly on current versions of at least
// two major web browsers (e.g., Chrome and Firefox) without requiring browser-specific modifications."
//
// For every browser in BROWSERS (default: chromium,firefox) and every role, this repeats the
// login-and-dashboard workflow of TC-09 steps 4-5 and checks that the role's core screen renders
// and works: correct dashboard, role navigation, core screen data, no horizontal overflow at common
// laptop widths, no browser console errors, and logout. The same unmodified build is used for all
// browsers (no browser-specific code exists in frontend/src).
//
// Prerequisites: app running and seeded (npm --prefix backend run db:seed), browsers installed once:
//   npm --prefix e2e run browsers -- firefox
// Run:  node e2e/portability.test.js --url=http://localhost:4000
//       ... --browsers=chrome,firefox   uses your installed Google Chrome plus Playwright Firefox
//       ... --browsers=firefox          runs one browser   (env vars E2E_BASE_URL / BROWSERS also work)
// Output: console + docs/Sprint2/TC-09_Browser_Results.md and screenshots in e2e/shots/<browser>/.
// Exit code 1 if any check fails in any browser.
const fs = require('fs');
const path = require('path');
const playwright = require('playwright');

const arg = (name) => (process.argv.find((a) => a.startsWith(`--${name}=`)) || '').split('=').slice(1).join('=');
const BASE = arg('url') || process.env.E2E_BASE_URL || 'http://localhost:5173';
const BROWSERS = (arg('browsers') || process.env.BROWSERS || 'chromium,firefox').split(',').map((b) => b.trim()).filter(Boolean);
const OUT = path.resolve(__dirname, '../docs/Sprint2/TC-09_Browser_Results.md');
const WIDTHS = [1366, 1024];

const ROLES = [
  {
    role: 'Administrator', user: 'admin01', pass: 'Admin@123', dashboard: '/admin', heading: 'Administrator Dashboard',
    nav: ['Dashboard', 'Students', 'Faculty', 'Courses', 'Assignments', 'Enrollments'],
    core: { name: 'Student record list', url: '/admin/students', ready: 'table tbody tr' },
  },
  {
    role: 'Faculty', user: 'fac_krao', pass: 'Faculty@123', dashboard: '/faculty', heading: 'Welcome, Dr. Kavita Rao',
    nav: ['Dashboard', 'My Profile & Courses'],
    core: { name: 'Attendance entry', linkSelector: 'a[href*="/attendance"]', ready: 'table tbody tr' },
  },
  {
    role: 'Student', user: 'stu_pnair', pass: 'Student@123', dashboard: '/student', heading: 'Welcome, Priya Nair',
    nav: ['Dashboard', 'My Profile', 'Attendance', 'Marks'],
    core: { name: 'Attendance and marks views', url: '/student/attendance', ready: '.page-header h1', next: '/student/marks' },
  },
];

const READY = () => !!document.querySelector('.page-header h1') && !document.querySelector('.loading');
const IGNORED_CONSOLE = /401|403|409|400|404/; // expected API refusals are logged by the browser

// chromium / firefox / webkit are Playwright's bundled engines; chrome and msedge use the
// installed Google Chrome / Microsoft Edge on this machine (e.g. BROWSERS=chrome,firefox).
async function launch(name) {
  if (name === 'chrome' || name === 'msedge') return playwright.chromium.launch({ channel: name });
  const opts = name === 'chromium' && process.env.CHROMIUM_PATH ? { executablePath: process.env.CHROMIUM_PATH } : {};
  return playwright[name].launch(opts);
}

async function runBrowser(name) {
  const browser = await launch(name);
  const version = browser.version();
  const shots = path.join(__dirname, 'shots', name);
  fs.mkdirSync(shots, { recursive: true });
  const rows = [];

  for (const r of ROLES) {
    const checks = [];
    const check = (label, ok, extra = '') => {
      checks.push({ label, ok });
      console.log(`${ok ? 'PASS' : 'FAIL'}  [${name}] ${r.role}: ${label} ${ok ? '' : extra}`);
    };
    const ctx = await browser.newContext({ viewport: { width: WIDTHS[0], height: 900 } });
    const page = await ctx.newPage();
    const errors = [];
    page.on('console', (m) => { if (m.type() === 'error' && !IGNORED_CONSOLE.test(m.text())) errors.push(m.text()); });
    page.on('pageerror', (e) => errors.push('pageerror: ' + e.message));

    try {
      // Login screen renders and accepts input.
      await page.goto(BASE + '/login');
      check('login screen renders', await page.isVisible('#username') && await page.isVisible('#password'));
      await page.fill('#username', r.user);
      await page.fill('#password', r.pass);
      await page.click('button[type=submit]');
      await page.waitForURL('**' + r.dashboard, { timeout: 15000 });
      await page.waitForFunction(READY);
      check('redirected to role dashboard', page.url().endsWith(r.dashboard));
      check('dashboard heading shown', (await page.textContent('.page-header h1')).trim() === r.heading);

      const navText = await page.textContent('nav[aria-label="Main"]');
      check('role navigation shown', r.nav.every((n) => navText.includes(n)), navText);

      for (const w of WIDTHS) {
        await page.setViewportSize({ width: w, height: 900 });
        const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
        check(`no horizontal overflow at ${w}px`, overflow <= 1, `overflow ${overflow}px`);
      }
      await page.setViewportSize({ width: WIDTHS[0], height: 900 });
      await page.screenshot({ path: path.join(shots, `${r.role.toLowerCase()}-dashboard.png`) });

      // Core screen for the role.
      const url = r.core.url || await page.getAttribute(r.core.linkSelector, 'href');
      await page.goto(BASE + url);
      await page.waitForFunction(READY);
      await page.waitForSelector(r.core.ready, { timeout: 15000 });
      check(`${r.core.name} renders with data`, true);
      if (r.core.next) {
        await page.goto(BASE + r.core.next);
        await page.waitForFunction(READY);
        check('marks view renders', (await page.textContent('.page-header h1')).includes('Marks'));
      }
      await page.screenshot({ path: path.join(shots, `${r.role.toLowerCase()}-core.png`) });

      // Logout returns to the login screen (FR-14) in this browser too.
      await page.click('header button:has-text("Log out")');
      await page.waitForURL('**/login', { timeout: 15000 });
      await page.waitForSelector('#username', { timeout: 15000 });
      check('logout returns to login screen', await page.isVisible('#username'));

      check('no browser console errors', errors.length === 0, errors.join(' | '));
    } catch (e) {
      check('workflow completed without errors', false, e.message.split('\n')[0]);
    }
    await ctx.close();
    rows.push({ role: r.role, checks });
  }
  await browser.close();
  return { name, version, rows };
}

(async () => {
  const runs = [];
  for (const b of BROWSERS) runs.push(await runBrowser(b));

  const total = runs.flatMap((r) => r.rows.flatMap((x) => x.checks));
  const failed = total.filter((c) => !c.ok);
  const md = [
    '# TC-09 Browser Compatibility Results (NFR-6)',
    '',
    `Generated by \`e2e/portability.test.js\` on ${new Date().toISOString().slice(0, 16).replace('T', ' ')} UTC against ${BASE}.`,
    '',
    'TC-09 steps 4 and 5: the login-and-dashboard workflow for each role, plus the role\'s core screen, repeated in each browser with the same unmodified build.',
    '',
    '| Browser | Version | Role | Checks passed | Result |',
    '|---|---|---|---|---|',
    ...runs.flatMap((run) => run.rows.map((x) => {
      const ok = x.checks.filter((c) => c.ok).length;
      return `| ${run.name} | ${run.version} | ${x.role} | ${ok}/${x.checks.length} | ${ok === x.checks.length ? 'Pass' : '**Fail**'} |`;
    })),
    '',
    'Checks per role: login screen renders; redirect to the role dashboard; dashboard heading; role navigation; no horizontal overflow at 1366 px and 1024 px; core screen renders with data; logout returns to the login screen; no browser console errors.',
    '',
    ...(failed.length ? ['**Failed checks:**', '', ...runs.flatMap((run) => run.rows.flatMap((x) => x.checks.filter((c) => !c.ok).map((c) => `- ${run.name} / ${x.role}: ${c.label}`))), ''] : []),
    `**Outcome:** ${failed.length === 0 ? `**Pass.** All ${total.length} checks passed in ${runs.map((r) => r.name).join(' and ')}.` : `**Fail.** ${failed.length} of ${total.length} checks failed.`}`,
    '',
    'Screenshots: `e2e/shots/<browser>/` (not committed).',
    '',
  ].join('\n');
  fs.mkdirSync(path.dirname(OUT), { recursive: true });
  fs.writeFileSync(OUT, md);
  console.log(`\n${total.length - failed.length}/${total.length} checks passed across ${runs.length} browser(s). Results written to docs/Sprint2/TC-09_Browser_Results.md`);
  process.exit(failed.length ? 1 : 0);
})().catch((e) => { console.error(e); process.exit(2); });
