// System tests (Test Plan 4.1 "System Testing"): drives the REAL running application in a browser through
// the user interface, following TC-01, TC-02, TC-05, TC-06, TC-07 and the NFR-4 / NFR-8 checks.
// Prerequisites: backend on :4000 and frontend on :5173 running, freshly seeded (npm run test:e2e does the seed).
// Screenshots of each key screen are written to e2e/shots/.
// BROWSER=chromium (default) | firefox | webkit - the same walkthrough runs unchanged in each (NFR-6).
const playwright = require('playwright');
const BROWSER = process.env.BROWSER || 'chromium';
const BASE = process.env.E2E_BASE_URL || 'http://localhost:5173';
const SHOTS = __dirname + '/shots';
require('fs').mkdirSync(SHOTS, { recursive: true });

const results = [];
const check = (name, ok, extra = '') => { results.push({ name, ok }); console.log(`${ok ? 'PASS' : 'FAIL'}  ${name} ${extra}`); };

(async () => {
  const browser = await playwright[BROWSER].launch(BROWSER === 'chromium' && process.env.CHROMIUM_PATH ? { executablePath: process.env.CHROMIUM_PATH } : {});
  console.log(`Browser: ${BROWSER} ${browser.version()}`);
  const ctx = await browser.newContext({ viewport: { width: 1360, height: 900 } });
  const page = await ctx.newPage();
  const consoleErrors = [];
  page.on('console', (m) => { if (m.type() === 'error' && !/401|403|409|400|404/.test(m.text())) consoleErrors.push(m.text()); });
  page.on('pageerror', (e) => consoleErrors.push('pageerror: ' + e.message));

  async function login(u, p) {
    await page.goto(BASE + '/login');
    await page.fill('#username', u);
    await page.fill('#password', p);
    await page.click('button[type=submit]');
  }
  async function logout() {
    await page.click('text=Log out');
    await page.waitForURL('**/login');
  }

  // ---- TC-01 ---------------------------------------------------------------
  await login('admin01', 'Admin@123');
  await page.waitForURL('**/admin');
  await page.waitForSelector('text=Manage Students');
  check('TC-01 admin redirected to /admin', page.url().endsWith('/admin'));
  await page.screenshot({ path: SHOTS + '/01-admin-dashboard.png' });

  // ---- TC-02 create student ------------------------------------------------
  await page.goto(BASE + '/admin/students/new');
  await page.fill('input[name=name]', 'Priya Nair');
  await page.fill('input[name=rollNumber]', 'PES1UG24CS099');
  await page.fill('input[name=department]', 'CSE');
  await page.fill('input[name=batch]', '2024');
  await page.fill('input[name=email]', 'priya.nair@example.com');
  await page.fill('input[name=password]', 'Student@123');
  await page.click('button:has-text("Create student")');
  await page.waitForURL(/\/admin\/students\/\d+$/);
  await page.waitForSelector('text=Contact email');
  const created = await page.textContent('main');
  check('TC-02 student created and shown', created.includes('PES1UG24CS099'));
  await page.screenshot({ path: SHOTS + '/02-student-created.png' });
  const newStudentUrl = page.url();

  // update contact
  await page.goto(newStudentUrl + '/edit');
  await page.fill('input[name=email]', 'priya.n@example.com');
  await page.click('button:has-text("Save changes")');
  await page.waitForURL(/\/admin\/students\/\d+$/);
  await page.waitForSelector('text=priya.n@example.com');
  check('TC-02 contact updated', (await page.textContent('main')).includes('priya.n@example.com'));

  // deactivate (button + optional confirm dialog)
  page.once('dialog', (d) => d.accept());
  const deact = page.locator('button:has-text("Deactivate")').first();
  if (await deact.count()) {
    await deact.click();
    const confirmBtn = page.locator('.modal button:has-text("Deactivate"), [role=dialog] button:has-text("Deactivate")');
    if (await confirmBtn.count()) await confirmBtn.first().click();
    await page.waitForTimeout(800);
  }
  check('TC-02 deactivated -> Inactive shown', /Inactive/i.test(await page.textContent('main')));

  // blank roll number
  await page.goto(BASE + '/admin/students/new');
  await page.fill('input[name=name]', 'Test Blank');
  await page.fill('input[name=department]', 'CSE');
  await page.fill('input[name=batch]', '2024');
  await page.fill('input[name=email]', 'blank@example.com');
  await page.fill('input[name=password]', 'Student@123');
  await page.click('button:has-text("Create student")');
  await page.waitForSelector('.field-error');
  const fieldErr = await page.textContent('.field-error');
  check('TC-02 step 9 blank roll -> clear error, stays on form', /roll number/i.test(fieldErr) && page.url().endsWith('/new'), `"${fieldErr}"`);
  await page.screenshot({ path: SHOTS + '/03-validation-error.png' });

  // logout + back navigation (NFR-8)
  await logout();
  await page.goBack();
  await page.waitForTimeout(800);
  check('NFR-8 back after logout does not show admin screen', page.url().includes('/login') || !(await page.textContent('body')).includes('Manage Students'), page.url());

  // ---- TC-01 student RBAC + wrong password -------------------------------
  await login('stu_pnair', 'Student@123');
  await page.waitForURL('**/student');
  check('TC-01 student redirected to /student', page.url().endsWith('/student'));
  await page.goto(BASE + '/admin/students');
  await page.waitForTimeout(800);
  const body = await page.textContent('body');
  check('TC-01 step 7 student denied Manage Students', !body.includes('PES1UG24CS099') && /denied|not authori|permission/i.test(body), page.url());
  await page.screenshot({ path: SHOTS + '/04-student-denied.png' });
  await page.goto(BASE + '/student');
  await logout();
  await login('stu_pnair', 'WrongPass1');
  await page.waitForSelector('.alert');
  check('TC-01 step 8 wrong password rejected', /invalid username or password/i.test(await page.textContent('.alert')) && page.url().includes('/login'));

  // ---- TC-05 / TC-06 faculty ----------------------------------------------
  await login('fac_krao', 'Faculty@123');
  await page.waitForURL('**/faculty');
  await page.waitForSelector('text=UE24CS205');
  check('TC-01 faculty redirected to /faculty', true);
  await page.screenshot({ path: SHOTS + '/05-faculty-dashboard.png' });

  await page.goto(BASE + '/faculty/courses/1/attendance');
  await page.waitForSelector('#session-date');
  await page.fill('#session-date', '2026-09-10');
  await page.check('input[aria-label="Priya Nair present"]');
  await page.click('button:has-text("Save attendance")');
  await page.waitForSelector('.alert');
  check('TC-05 step 2 attendance saved', /saved|recorded/i.test(await page.textContent('.alert')), await page.textContent('.alert'));
  await page.fill('#session-date', '2026-09-10');
  await page.waitForSelector('text=Editing recorded session');
  await page.check('input[aria-label="Priya Nair absent"]');
  await page.click('button:has-text("Update attendance")');
  await page.waitForTimeout(800);
  check('TC-05 step 3 attendance updated', /updated|saved/i.test(await page.textContent('.alert')), await page.textContent('.alert'));
  await page.screenshot({ path: SHOTS + '/06-attendance.png' });

  await page.goto(BASE + '/faculty/courses/2/attendance');
  await page.waitForTimeout(800);
  check('TC-05 step 4 unassigned course denied', /not authorized for this course/i.test(await page.textContent('main')));

  await page.goto(BASE + '/faculty/courses/1/marks');
  await page.waitForSelector('#component');
  await page.selectOption('#component', { label: /Internal Assessment 1/ }).catch(async () => {
    const opts = await page.$$eval('#component option', (o) => o.map((x) => [x.value, x.textContent]));
    const ia1 = opts.find((o) => o[1].includes('Internal Assessment 1'));
    await page.selectOption('#component', ia1[0]);
  });
  await page.fill('input[aria-label="Marks for Priya Nair"]', '17');
  await page.click('button:has-text("Save marks")');
  await page.waitForTimeout(800);
  check('TC-06 step 2 marks 17 saved', /saved|entered/i.test(await page.textContent('.alert')), await page.textContent('.alert'));
  await page.fill('input[aria-label="Marks for Priya Nair"]', '18');
  await page.click('button:has-text("Save marks")');
  await page.waitForTimeout(800);
  check('TC-06 step 3 marks updated to 18', /saved|updated/i.test(await page.textContent('.alert')), await page.textContent('.alert'));
  // out-of-range
  await page.fill('input[aria-label="Marks for Priya Nair"]', '25');
  await page.click('button:has-text("Save marks")');
  await page.waitForTimeout(800);
  check('NFR-4 marks 25/20 rejected with message', /between 0 and 20/i.test(await page.textContent('main')));
  await page.screenshot({ path: SHOTS + '/07-marks.png' });

  await page.goto(BASE + '/faculty/profile');
  await page.click('button.accordion-head:has-text("UE24CS205")');
  await page.waitForSelector('td:has-text("Priya Nair")');
  await page.screenshot({ path: SHOTS + '/07b-faculty-profile.png' });
  check('TC-07 faculty profile lists roster', true);
  await logout();

  // ---- TC-05/06/07 student views ------------------------------------------
  await login('stu_pnair', 'Student@123');
  await page.waitForURL('**/student');
  await page.waitForSelector('text=UE24CS205');
  await page.screenshot({ path: SHOTS + '/08-student-dashboard.png' });
  await page.goto(BASE + '/student/attendance');
  await page.waitForFunction(() => /%/.test((document.querySelector('main')?.innerText || '')) && (document.querySelector('main')?.innerText || '').includes('UE24CS205'));
  await page.waitForTimeout(500);
  const att = await page.innerText('main');
  const attOptions = await page.$$eval('main select option', (o) => o.map((x) => x.textContent).join('|'));
  check('TC-05 step 6 student sees 10 Sep session + percentage', /10 Sep|2026-09-10|Sep 10/i.test(att) && /%/.test(att));
  await page.screenshot({ path: SHOTS + '/09-student-attendance.png', fullPage: true });
  check('TC-05 step 7 UE24CS210 not offered', !att.includes('UE24CS210') && !attOptions.includes('UE24CS210'), attOptions);
  await page.goto(BASE + '/student/marks');
  await page.waitForFunction(() => (document.querySelector('main')?.innerText || '').includes('Internal Assessment 1'));
  await page.waitForTimeout(500);
  const mk = await page.innerText('main');
  check('TC-06 step 6 student sees IA1 18 of max 20', /Internal\s+Assessment 1\s+18\s+20/.test(mk.split('COMPONENT')[1] || ''));
  await page.screenshot({ path: SHOTS + '/10-student-marks.png', fullPage: true });
  await page.goto(BASE + '/student/profile');
  await page.waitForSelector('text=PES1UG24CS045');
  check('TC-07 student profile shown', true);
  await logout();

  check('No unexpected browser console errors', consoleErrors.length === 0, consoleErrors.join(' | '));
  await browser.close();
  const failed = results.filter((r) => !r.ok).length;
  console.log(`\n${results.length - failed}/${results.length} passed`);
  process.exit(failed ? 1 : 0);
})().catch((e) => { console.error(e); process.exit(2); });
