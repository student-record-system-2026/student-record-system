# Student Record System v1.0

[![CI](https://github.com/student-record-system-2026/student-record-system/actions/workflows/ci.yml/badge.svg)](https://github.com/student-record-system-2026/student-record-system/actions/workflows/ci.yml)
[![E2E](https://github.com/student-record-system-2026/student-record-system/actions/workflows/e2e.yml/badge.svg)](https://github.com/student-record-system-2026/student-record-system/actions/workflows/e2e.yml)

Web application for managing students, faculty, courses, attendance and marks. It implements SRS v1.1 and follows the architecture in SADS v1.0 and the tests in Test Plan v1.1.

PES University · Software Engineering (UE24CS341A) mini project

## Project status

| Sprint | Dates | Status |
|---|---|---|
| Sprint 1 | 19–20 Oct 2026 | **Complete:** 17 issues closed through 27 merged pull requests (#37–#63); CI green |
| Sprint 2 | 26–30 Oct 2026 | **Complete:** 5 issues closed (#23, #24, #26, #28, #29); all ten Test Plan test cases executed |

**Sprint 1 scope:** FR-1 to FR-13, NFR-2, NFR-4, NFR-7, NFR-8 (GitHub issues #10–#22, #25, #27, #30, #31), plus FR-14 Logout, which NFR-8 depends on.

**Sprint 2 scope:** FR-14 session lifecycle (#23), NFR-1 Performance (#24, TC-08), NFR-3 Usability (#26, TC-09 steps 1–3), NFR-5 Maintainability (#28, review record), NFR-6 Browser Portability (#29, TC-09 steps 4–5), and the Test Summary Report.

All 22 requirements (FR-1 to FR-14, NFR-1 to NFR-8) are implemented and verified; see the [Test Summary Report](docs/Sprint2/Test_Summary_Report.md).

**Documentation (`docs/`):**

| Document | Location |
|---|---|
| Software Requirements Specification v1.1 | [`docs/SRS/`](docs/SRS) |
| Software Architecture & Design Specification v1.0 | [`docs/SADS/`](docs/SADS) |
| Test Plan v1.1 | [`docs/Test_Cases/`](docs/Test_Cases) |
| Issue → requirement → files → tests mapping | [`docs/TRACEABILITY.md`](docs/TRACEABILITY.md) |
| Sprint 1 modifications and deviations | [`docs/Sprint1_Modifications.docx`](docs/Sprint1_Modifications.docx) |
| Test Summary Report (all ten test cases) | [`docs/Sprint2/Test_Summary_Report.md`](docs/Sprint2/Test_Summary_Report.md) |
| TC-08 performance results (NFR-1) | [`docs/Sprint2/TC-08_Performance_Results.md`](docs/Sprint2/TC-08_Performance_Results.md) |
| TC-09 usability walkthrough (NFR-3) | [`docs/Sprint2/TC-09_Usability_Walkthrough.md`](docs/Sprint2/TC-09_Usability_Walkthrough.md) |
| TC-09 browser compatibility results (NFR-6) | [`docs/Sprint2/TC-09_Browser_Results.md`](docs/Sprint2/TC-09_Browser_Results.md) |
| Maintainability Review Record (NFR-5) | [`docs/Sprint2/NFR-5_Maintainability_Review_Record.md`](docs/Sprint2/NFR-5_Maintainability_Review_Record.md) |

## Team

| Member | SRN | GitHub | Sprint 1 issues | Sprint 2 issues |
|---|---|---|---|---|
| Aakash Desai (repository owner) | PES1UG24CS006 | [@Aakash-Desai-0103](https://github.com/Aakash-Desai-0103) | #10 Login, #20 #21 Profiles, #22 Dashboards | #23 Logout, #29 Browser portability, Test Summary Report |
| Abhiraam Adiga | PES1UG24CS015 | [@abhiraamadiga](https://github.com/abhiraamadiga) | #11 Student records, #16 #17 Attendance, #27 Error handling, #31 Sessions | #26 Usability |
| Aashlesh P | PES1UG24CS011 | [@Ashu71771](https://github.com/Ashu71771) | #12 Faculty records, #18 #19 Marks, #25 Password security, #30 Authorization | #28 Maintainability |
| Aadhavan Muthusamy | PES1UG24CS002 | [@paya5am](https://github.com/paya5am) | #13 Courses, #14 Faculty assignment, #15 Enrollment | #24 Performance |

## How we work

- **One branch per change**, named after its issue (e.g. `feature/10-login-api`, `test/13-14-15-tests`).
- **Pull request into `main`.** The description names the requirement and ends with `Closes #N`, so the issue closes when the PR merges.
- **Peer review:** a team member who is not the author reviews and approves every PR.
- **CI gate:** two GitHub Actions workflows run on every push and PR to `main`. [`ci.yml`](.github/workflows/ci.yml) runs the backend tests against PostgreSQL 16 and the frontend tests, then builds the UI. [`e2e.yml`](.github/workflows/e2e.yml) starts the real application and runs the browser walkthrough and compatibility checks in Chromium and Firefox. A PR is merged only when both are green.
- **The author merges** once the PR is approved and CI is green.
- **Project board:** issues move from Todo to In Progress to Done.

## Architecture (SADS §2–3)

A layered monolith with a single server and a single relational database:

```
Browser (React UI)  frontend/src/pages, components, auth, api/client.js
      │  HTTP/JSON (REST, SADS §4.3); same-origin session cookie
Controller / API    backend/src/routes  +  backend/src/controllers  +  backend/src/validation
      │                    (authentication + role gate on every request — middleware/)
Business / Service  backend/src/services        (business rules SRS 5.5, record-level authorization)
      │
Data Access (DAL)   backend/src/repositories    (one repository per entity; only layer issuing SQL)
      │
PostgreSQL          backend/db/schema.sql       (FKs, UNIQUE/CHECK constraints, status flags)
```

Cross-cutting security: `backend/src/services/authorizationService.js` and `backend/src/middleware/`.
Errors use the SADS §4.4 envelope `{ "error": { "code", "message", "details" } }`.

## Technology stack

The SRS (TBD-1), SADS (§3.9) and Test Plan (§3.2) leave the stack to the team. This implementation uses:

| Layer | Choice |
|---|---|
| Frontend | React 18 + React Router 6, built with Vite 5 |
| Backend | Node.js + Express 4, express-session (sessions stored in PostgreSQL) |
| Database | PostgreSQL 13 or newer (developed and tested on 16) |
| Password hashing | bcryptjs |
| Tests | Jest + Supertest (backend), Vitest + Testing Library (frontend), Playwright (optional browser system tests) |
| CI | GitHub Actions (Node 20, PostgreSQL 16 service) |

## Prerequisites

- **Node.js 18+** (CI uses Node 20) and npm
- **PostgreSQL 13+** running locally, with a user that can create databases (default `postgres` / `postgres` on `localhost:5432`)

## 1. Install dependencies

```bash
cd student-record-system
npm --prefix backend install
npm --prefix frontend install
```
(Or `npm run install:all`.)

Run every command in this README from the repository root, not from inside `backend/` or `frontend/`.

## 2. Configure the database

```bash
cp backend/.env.example backend/.env      # Windows: copy backend\.env.example backend\.env
# Edit backend/.env if your PostgreSQL user, password or port differ.

npm --prefix backend run db:setup
```

`db:setup` does three things:
1. Creates `student_record_system` (app) and `student_record_system_test` (automated tests only) if they don't exist.
2. Applies `backend/db/schema.sql`. This drops and recreates the tables.
3. Seeds the demo/test dataset from `backend/db/seed.js`: 1 admin, 20 faculty, 300 students, 10 courses, enrollments, attendance and marks.

Run `npm --prefix backend run db:seed` at any time to reset the data to the seeded state.

If you'd rather use `psql`, the same schema can be applied with `psql -U postgres -d student_record_system -f backend/db/schema.sql`. Then run `npm --prefix backend run db:seed`.

## 3. Start the backend (API on http://localhost:4000)

```bash
npm --prefix backend start        # or: npm --prefix backend run dev   (auto-restart on change)
```

## 4. Start the frontend (UI on http://localhost:5173)

In a second terminal:

```bash
npm --prefix frontend run dev
```

Open **http://localhost:5173**. The Vite dev server proxies `/api` to port 4000, so the session cookie stays same-origin.

*Single-server option:* run `npm --prefix frontend run build`, then `npm --prefix backend start`. The backend serves the built UI at http://localhost:4000.

## Sample logins (Test Plan §12.1)

| Role | Username | Password | Notes |
|---|---|---|---|
| Administrator | `admin01` | `Admin@123` | |
| Faculty | `fac_krao` | `Faculty@123` | Dr. Kavita Rao — assigned UE24CS205, UE24CS220 (not UE24CS210) |
| Faculty | `fac_smenon` | `Faculty@123` | Dr. Suresh Menon — assigned UE24CS210 |
| Student | `stu_pnair` | `Student@123` | Priya Nair (PES1UG24CS045) — enrolled UE24CS205, UE24CS220, UE24CS230 |
| Student (generated) | e.g. `pes1ug24cs101` | `Student@123` | lower-case roll number |
| Faculty (generated) | e.g. `fac003` | `Faculty@123` | |

You can also log in with the account's email instead of the username (FR-1).

## 5. Run the tests

```bash
npm --prefix backend test         # 171 tests: unit + integration (TC-01–TC-08, TC-10, NFR-5 structure); needs PostgreSQL
npm --prefix frontend test        # 36 UI tests incl. usability and structure checks (no server needed)
```
(Or `npm test` from the root to run both.) The same suites run in CI on every pull request.

Backend integration tests use the separate `student_record_system_test` database. Its schema is reapplied at the start of each run and its data re-seeded for each test file, so your demo data is never touched.

**Browser tests** drive the real running app (Test Plan §4.1 "System Testing"). They also run in CI (`e2e.yml`) in Chromium and Firefox. To run them locally, start the backend and frontend first:

```bash
npm --prefix e2e install
npm --prefix e2e run browsers -- firefox   # one-time download of Chromium + Firefox
npm run test:e2e                  # re-seeds the DEV database, then runs the UI walkthrough (22 checks)
```
Set `BROWSER=firefox` to run the walkthrough in Firefox. Screenshots of each key screen are saved to `e2e/shots/`.

**Sprint 2 measurements.** Each script writes its results file to `docs/Sprint2/`. They give the most realistic numbers against the production build served by the backend:

```bash
npm --prefix backend run db:seed                 # TC-08 dataset: 300 students, 20 faculty, 10 courses
npm --prefix frontend run build
npm --prefix backend start                       # serves API + UI on http://localhost:4000
```
Then, in a second terminal (same commands on Windows, macOS and Linux):
```bash
node e2e/performance.test.js --url=http://localhost:4000                              # TC-08 / NFR-1 page load times
node e2e/portability.test.js --url=http://localhost:4000 --browsers=chrome,firefox    # TC-09 steps 4-5 / NFR-6
```
`chrome` uses your installed Google Chrome. Firefox uses Playwright's Firefox build.

### Test case coverage

| Test case | Requirement | Automated in |
|---|---|---|
| TC-01 Login and role-based access | FR-1, SO-3, NFR-2 | `backend/tests/integration/tc01.auth-rbac.test.js`, e2e |
| TC-02 Student records | FR-2, NFR-4 | `tc02.student-records.test.js`, e2e |
| TC-03 Faculty and course records | FR-3, FR-4 | `tc03.faculty-course.test.js` |
| TC-04 Assignment and enrollment | FR-5, FR-6 | `tc04.assignment-enrollment.test.js` |
| TC-05 Attendance | FR-7, FR-8 | `tc05.attendance.test.js`, e2e |
| TC-06 Marks | FR-9, FR-10 | `tc06.marks.test.js`, e2e |
| TC-07 Profiles, dashboards and logout | FR-11–FR-14 | `tc07.profile-dashboard.test.js`, `frontend/tests/logout.test.jsx`, e2e |
| TC-08 Performance | NFR-1 | `tc08.performance.test.js` (API timing, CI), `e2e/performance.test.js` (page load times) |
| TC-09 Usability and browser compatibility | NFR-3, NFR-6 | `frontend/tests/usability.test.jsx` + walkthrough with 3 first-time users; `e2e/portability.test.js` (Chrome, Firefox) |
| TC-10 Security and session protection | NFR-2, NFR-7, NFR-8 | `tc10.security-session.test.js`, `tc10.logout-lifecycle.test.js` |
| NFR-5 review (no test case) | NFR-5 | `backend/tests/unit/architecture.test.js`, `frontend/tests/architecture.test.js` + review record |

Actual results for every test case are in the [Test Summary Report](docs/Sprint2/Test_Summary_Report.md).

## Implementation decisions where the documents are silent

The full list, with document references and reasons, is in the [Sprint 1 modifications document](docs/Sprint1_Modifications.docx).

1. **Stack:** not specified by any document (TBD-1). See the table above.
2. **FR-14 Logout** is implemented even though it isn't a Sprint 1 issue: NFR-8 (#31) and TC-01/07/10 depend on it.
3. **Restoring a deactivated record** (needed by TC-03 step 9 and TC-04 step 8) uses the existing `PUT` update endpoint with `status: "ACTIVE"`. No new endpoint was invented.
4. **Account provisioning:** creating a student or faculty record also creates their login (SRS 2.7: accounts are created by the Administrator). The username defaults to the roll number (students) or the email's local part (faculty).
5. **Removing an enrollment** marks it `REMOVED` rather than deleting the row. This keeps historical attendance and marks intact (SRS 5.5, SADS 3.5), and re-enrolling reactivates it.
6. **Course `DELETE` with associations** deactivates the course and responds `409 COURSE_DEACTIVATED_INSTEAD`, per SADS §4.4 ("Invalid state transition … the system deactivates instead").
7. **Assessment components** (name + maximum marks) are configured per course on the course form (SRS 2.7 / TBD-2, SADS 4.6). The seed gives every course IA1 (20), IA2 (20) and Assignment (10).
8. **Deactivated users can still log in** and see their existing data. The SRS only excludes them from *new* enrollments/assignments and never asks for login to be blocked.
9. **Session dates** for attendance cannot be in the future.
10. **Supporting endpoints:** `GET /api/auth/session` (restores the logged-in user after a page reload) and `GET /api/health` (health check).

## Project layout

```
.github/workflows/ci.yml          CI: backend + frontend tests, UI build
.github/workflows/e2e.yml         CI: browser walkthrough + compatibility checks (Chromium, Firefox)
backend/
  db/schema.sql, db/seed.js       database schema and seed data
  scripts/                        db-create / db-schema / db-seed
  src/app.js, server.js           Express app (monolith entry point)
  src/config/                     environment configuration
  src/routes/                     REST endpoints + role gates (SADS 4.3)
  src/controllers/                request parsing/validation, HTTP mapping
  src/validation/                 request schemas + validator (NFR-4)
  src/middleware/                 authenticate (401), authorize (403), error handler
  src/services/                   business rules + authorization (one per feature area)
  src/repositories/               data access (one per entity)
  src/db/                         connection pool + transactions
  src/errors/                     typed errors -> SADS 4.4 status codes
  tests/unit, tests/integration   Jest suites (integration files named tcXX.*)
frontend/
  src/api/client.js               the only module that talks to the API
  src/auth/                       session context + protected routes
  src/components/                 layout and shared UI
  src/pages/{admin,faculty,student}/  role-specific screens
  tests/                          Vitest + Testing Library
e2e/
  system.test.js                  browser UI walkthrough (Playwright; BROWSER=chromium|firefox)
  performance.test.js             TC-08 page load times (NFR-1)
  portability.test.js             TC-09 steps 4-5 browser compatibility (NFR-6)
docs/
  SRS/, SADS/, Test_Cases/        submitted specification documents
  Sprint1_Modifications.docx      Sprint 1 modifications and deviations
  Sprint2/                        test results, usability walkthrough, NFR-5 review, Test Summary Report
  TRACEABILITY.md                 GitHub issue -> requirement -> files -> tests
```
