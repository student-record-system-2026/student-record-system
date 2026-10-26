// TC-08 Performance (NFR-1, GitHub #24) - measures real page load times in a browser.
//
// NFR-1: "The system shall load standard pages (e.g., dashboards, record lists) within 3 seconds
// under normal usage conditions with a class-sized dataset (up to a few hundred student records)."
//
// Follows Test Plan TC-08 steps 1-6: Administrator dashboard and Student record list, Faculty
// dashboard and attendance/marks entry screens, Student dashboard and attendance/marks views.
// Each page is opened with a full browser load RUNS times; the time is measured from the start of
// navigation until the page's data is on screen (page header shown, no loading indicator).
//
// Prerequisites: the dev database seeded with the TC-08 dataset (npm --prefix backend run db:seed:
// 300 students, 20 faculty, 10 courses) and the app running. Recommended target is the production
// build served by the backend (closest to real use):
//   npm --prefix frontend run build && npm --prefix backend start
//   node e2e/performance.test.js --url=http://localhost:4000      (works the same on Windows)
// The Vite dev server (:5173, the default) also works but serves unbundled modules, so it is slower.
//
// Output: console table + docs/Sprint2/TC-08_Performance_Results.md (overwritten on each run).
// Exit code 1 if any page exceeds the 3-second threshold.
const fs = require('fs');
const os = require('os');
const path = require('path');
const playwright = require('playwright');

const arg = (name) => (process.argv.find((a) => a.startsWith(`--${name}=`)) || '').split('=').slice(1).join('=');
const BASE = arg('url') || process.env.E2E_BASE_URL || 'http://localhost:5173';
const BROWSER = arg('browser') || process.env.BROWSER || 'chromium';
const RUNS = Number(arg('runs') || process.env.RUNS) || 3;
const THRESHOLD_MS = 3000;
const OUT = path.resolve(__dirname, '../docs/Sprint2/TC-08_Performance_Results.md');

const ACCOUNTS = {
  admin: ['admin01', 'Admin@123'],
  faculty: ['fac_krao', 'Faculty@123'],
  student: ['stu_pnair', 'Student@123'],
};

// Data is on screen: page header rendered and no loading spinner left.
const READY = () => !!document.querySelector('.page-header h1') && !document.querySelector('.loading');

async function launch() {
  const opts = BROWSER === 'chromium' && process.env.CHROMIUM_PATH ? { executablePath: process.env.CHROMIUM_PATH } : {};
  return playwright[BROWSER].launch(opts);
}

async function loginAs(ctx, role) {
  const page = await ctx.newPage();
  await page.goto(BASE + '/login');
  await page.fill('#username', ACCOUNTS[role][0]);
  await page.fill('#password', ACCOUNTS[role][1]);
  await page.click('button[type=submit]');
  await page.waitForFunction(READY);
  return page;
}

async function measure(page, url, extraReady) {
  const times = [];
  for (let i = 0; i < RUNS; i += 1) {
    const t0 = Date.now();
    await page.goto(BASE + url, { waitUntil: 'commit' });
    await page.waitForFunction(READY, null, { timeout: 15000 });
    if (extraReady) await page.waitForSelector(extraReady, { timeout: 15000 });
    times.push(Date.now() - t0);
  }
  return times;
}

const median = (a) => [...a].sort((x, y) => x - y)[Math.floor(a.length / 2)];

(async () => {
  const browser = await launch();
  const results = [];
  const record = (step, role, pageName, url, times) => {
    const max = Math.max(...times);
    results.push({ step, role, pageName, url, times, median: median(times), max, pass: max <= THRESHOLD_MS });
    console.log(`${max <= THRESHOLD_MS ? 'PASS' : 'FAIL'}  ${role.padEnd(13)} ${pageName.padEnd(28)} median ${median(times)} ms, max ${max} ms`);
  };

  // Steps 1-3: Administrator dashboard and Student record list.
  let ctx = await browser.newContext();
  let page = await loginAs(ctx, 'admin');
  const dataset = await page.evaluate(async () => (await (await fetch('/api/dashboard')).json()).counts);
  record('1-2', 'Administrator', 'Dashboard', '/admin', await measure(page, '/admin'));
  record('3', 'Administrator', 'Student record list', '/admin/students', await measure(page, '/admin/students', 'table tbody tr'));
  await ctx.close();

  // Step 4: Faculty dashboard and an attendance / marks entry screen (first assigned course).
  ctx = await browser.newContext();
  page = await loginAs(ctx, 'faculty');
  record('4', 'Faculty', 'Dashboard', '/faculty', await measure(page, '/faculty'));
  const attendanceUrl = await page.getAttribute('a[href*="/attendance"]', 'href');
  const marksUrl = await page.getAttribute('a[href*="/marks"]', 'href');
  record('4', 'Faculty', 'Attendance entry', attendanceUrl, await measure(page, attendanceUrl));
  record('4', 'Faculty', 'Marks entry', marksUrl, await measure(page, marksUrl));
  await ctx.close();

  // Step 5: Student dashboard and attendance / marks views.
  ctx = await browser.newContext();
  page = await loginAs(ctx, 'student');
  record('5', 'Student', 'Dashboard', '/student', await measure(page, '/student'));
  record('5', 'Student', 'Attendance view', '/student/attendance', await measure(page, '/student/attendance'));
  record('5', 'Student', 'Marks view', '/student/marks', await measure(page, '/student/marks'));
  await ctx.close();

  const version = browser.version();
  await browser.close();

  // Step 6: compare against the 3-second threshold and write the results record.
  const failed = results.filter((r) => !r.pass);
  const now = new Date();
  const ds = dataset
    ? `${dataset.students.total} students, ${dataset.faculty.total} faculty, ${dataset.courses.total} courses`
    : 'unknown';
  const md = [
    '# TC-08 Performance Results (NFR-1)',
    '',
    `Generated by \`e2e/performance.test.js\` on ${now.toISOString().slice(0, 16).replace('T', ' ')} UTC.`,
    '',
    '| Item | Value |',
    '|---|---|',
    '| Requirement | NFR-1: standard pages load within 3 seconds with a class-sized dataset |',
    '| Test case | TC-08 (Test Plan v1.1, Section 12.3), steps 1 to 6 |',
    `| Dataset | ${ds} (seeded by \`backend/db/seed.js\`) |`,
    `| Application URL | ${BASE} |`,
    `| Browser | ${BROWSER} ${version} |`,
    `| Machine | ${os.type()} ${os.release()}, ${os.cpus().length} CPU(s), Node ${process.version} |`,
    `| Method | Full page load, ${RUNS} runs per page; time from navigation start until the page's data is on screen |`,
    `| Threshold | ${THRESHOLD_MS} ms (every run) |`,
    '',
    '| Step | Role | Page | URL | Runs (ms) | Median (ms) | Max (ms) | Result |',
    '|---|---|---|---|---|---|---|---|',
    ...results.map((r) => `| ${r.step} | ${r.role} | ${r.pageName} | \`${r.url}\` | ${r.times.join(', ')} | ${r.median} | ${r.max} | ${r.pass ? 'Pass' : '**Fail**'} |`),
    '',
    `**Outcome:** ${failed.length === 0 ? `**Pass.** All ${results.length} measured pages loaded within 3 seconds (slowest: ${Math.max(...results.map((r) => r.max))} ms).` : `**Fail.** ${failed.length} page(s) exceeded 3 seconds: ${failed.map((r) => r.pageName).join(', ')}.`}`,
    '',
    '| Executed by | Date | Signature |',
    '|---|---|---|',
    '|  |  |  |',
    '',
  ].join('\n');
  fs.mkdirSync(path.dirname(OUT), { recursive: true });
  fs.writeFileSync(OUT, md);
  console.log(`\n${results.length - failed.length}/${results.length} pages within ${THRESHOLD_MS} ms. Results written to docs/Sprint2/TC-08_Performance_Results.md`);
  process.exit(failed.length ? 1 : 0);
})().catch((e) => { console.error(e); process.exit(2); });
