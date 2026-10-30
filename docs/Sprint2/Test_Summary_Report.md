# Test Summary Report – Student Record System v1.0

Test execution and summary report required by Test Plan v1.1, Section 6. It records the actual result of all ten test cases (Section 12.3) after Sprint 2. The Test Plan itself is not modified; this report is where its "Actual Result" and "Pass / Fail" fields are filled in.

| Item | Value |
|---|---|
| Build | `main` at commit ________ (fill in with `git rev-parse --short HEAD`) |
| Test period | Sprint 1 (19–20 Oct 2026) and Sprint 2 (26–30 Oct 2026) |
| Environment | Node.js 20, PostgreSQL 16, Chrome and Firefox; CI on GitHub Actions (ubuntu-latest) |
| Test data | `backend/db/seed.js`: Test Plan 12.1 accounts plus 300 students, 20 faculty, 10 courses (TC-08 dataset) |
| Prepared by | Aakash Desai (PES1UG24CS006) |

## 1. Test case results

| Test case | Title | Requirements | How executed | Evidence | Actual result | Pass / Fail |
|---|---|---|---|---|---|---|
| TC-01 | Authentication and role-based access control | FR-1, SO-3, NFR-2 | Automated (integration, UI, browser) | `tc01.auth-rbac.test.js`, `auth.test.jsx`, `e2e/system.test.js` | Each role is redirected to its own dashboard; invalid credentials are rejected; restricted screens and APIs are refused | Pass |
| TC-02 | Student record management | FR-2, NFR-4 | Automated | `tc02.student-records.test.js`, `forms.test.jsx`, `e2e/system.test.js` | Create, view, search, update, deactivate and restore work; invalid input is rejected with field messages | Pass |
| TC-03 | Faculty and course management | FR-3, FR-4 | Automated | `tc03.faculty-course.test.js` | Faculty and course create, view, update and deactivate work; deleting a course with links deactivates it (409) | Pass |
| TC-04 | Faculty-course assignment and student enrollment | FR-5, FR-6 | Automated | `tc04.assignment-enrollment.test.js` | Assign and reassign faculty; enroll and remove students; duplicates rejected (409); Faculty and Students cannot change associations | Pass |
| TC-05 | Attendance recording and viewing | FR-7, FR-8 | Automated | `tc05.attendance.test.js`, `academics.test.jsx`, `e2e/system.test.js` | Faculty records and updates sessions for assigned courses only; students see their own attendance and percentage | Pass |
| TC-06 | Marks entry and viewing | FR-9, FR-10 | Automated | `tc06.marks.test.js`, `academics.test.jsx`, `e2e/system.test.js` | Faculty enters and updates marks within the maximum; students see their own marks | Pass |
| TC-07 | Profiles, dashboards and logout | FR-11 to FR-14 | Automated | `tc07.profile-dashboard.test.js`, `logout.test.jsx`, `e2e/system.test.js` | Each role sees the correct profile and dashboard; logout returns to the login screen | Pass |
| TC-08 | Performance | NFR-1 | Automated measurement in a browser + API timing in CI | [`TC-08_Performance_Results.md`](TC-08_Performance_Results.md), `tc08.performance.test.js` | All 8 TC-08 pages loaded within 3 seconds with 300 students, 20 faculty, 10 courses; slowest: Student record list, 163 ms | Pass |
| TC-09 | Usability and browser compatibility | NFR-3, NFR-6 | Walkthrough with 3 first-time users (steps 1–3); Chrome and Firefox runs (steps 4–5) | [`TC-09_Usability_Walkthrough.md`](TC-09_Usability_Walkthrough.md), [`TC-09_Browser_Results.md`](TC-09_Browser_Results.md), `usability.test.jsx`, `e2e/portability.test.js` | 3/3 first-time users completed their core task on the first attempt without help (01:02, 00:25, 00:19; all rated 5/5); 56/56 browser checks passed in Chrome 156 and Firefox 157 | Pass |
| TC-10 | Security, authorization and session protection | NFR-2, NFR-7, NFR-8, SO-1 to SO-3 | Automated | `tc10.security-session.test.js`, `tc10.logout-lifecycle.test.js`, `auth.test.jsx` | Passwords stored as bcrypt hashes; unauthorized operations refused with no data change; logged-out and expired sessions rejected | Pass |

**NFR-5 Maintainability** (not a test case, Test Plan 12.4.3): reviewed in [`NFR-5_Maintainability_Review_Record.md`](NFR-5_Maintainability_Review_Record.md). Outcome: Satisfied (see the review record).

## 2. Metrics

| Metric | Value |
|---|---|
| Test cases planned / executed / passed | 10 / 10 / 10 |
| Requirements covered (FR-1 to FR-14, NFR-1 to NFR-8) | 22 / 22 (NFR-5 by review) |
| Backend automated tests (unit + integration) | 171 in 15 files |
| Frontend automated tests | 36 in 6 files |
| Browser system walkthrough | 22 checks, run in Chromium and Firefox in CI |
| Browser compatibility checks | 28 per browser |
| Pages timed for NFR-1 | 8 (all TC-08 steps) |
| Open critical or high defects | 0 |

## 3. Defect log

| ID | Found in | Description | Severity | Resolution | Status |
|---|---|---|---|---|---|
| DEF-01 | NFR-5 review | `server.js` lacked a module header comment | Low | Header added (Sprint 2, #28) | Closed |
| DEF-02 | Dependabot | Advisories in development tools (Vite, Vitest, esbuild) and React Router; none affect the production backend | Low | Upgrade path tested (all tests pass); scheduled after the course submission | Open (deferred) |
| DEF-03 | CI (frontend tests) | `academics.test.jsx` "editing previously entered marks uses PUT" failed intermittently: it checked the input before the page had loaded the saved value | Low (test only, no app defect) | Test now waits for the value to load | Closed |

## 4. Pass/fail and exit criteria (Test Plan 5.3)

| Criterion | Status |
|---|---|
| All planned test cases executed | Yes (10 / 10) |
| All High-priority test cases passed (TC-01 to TC-06, TC-10) | Yes |
| No open Critical or High defects | Yes |
| Results recorded and traceable to requirements | Yes (this report and `docs/TRACEABILITY.md`) |

## 5. Sign-off

| Role | Name | Signature / Date |
|---|---|---|
| Team member | Aadhavan Muthusamy (PES1UG24CS002) |  |
| Team member | Aakash Desai (PES1UG24CS006) |  |
| Team member | Aashlesh P (PES1UG24CS011) |  |
| Team member | Abhiraam Adiga (PES1UG24CS015) |  |
