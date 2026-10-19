# Student Record System v1.0 — Sprint 1

Web application for managing students, faculty, courses, attendance and marks. It implements SRS v1.1 and follows the architecture in SADS v1.0 and the tests in Test Plan v1.1.

**Sprint 1 scope:** FR-1 to FR-13, NFR-2, NFR-4, NFR-7, NFR-8 (GitHub issues #10–#22, #25, #27, #30, #31), plus FR-14 Logout, which NFR-8 depends on.
The full **issue → requirement → files → tests** mapping is in [`docs/TRACEABILITY.md`](docs/TRACEABILITY.md).

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
| Backend | Node.js (18 or newer) + Express 4, express-session (sessions stored in PostgreSQL) |
| Database | PostgreSQL 13 or newer (developed on 16) |
| Password hashing | bcryptjs |
| Tests | Jest + Supertest (backend), Vitest + Testing Library (frontend), Playwright (optional browser system tests) |

## Prerequisites

- **Node.js 18+** and npm
- **PostgreSQL 13+** running locally, with a user that can create databases (default `postgres` / `postgres` on `localhost:5432`)

## 1. Install dependencies

```bash
cd student-record-system
npm --prefix backend install
npm --prefix frontend install
```
(Or `npm run install:all`.)

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
npm --prefix backend test         # 143 tests: unit + integration (TC-01–TC-07, TC-10); needs PostgreSQL
npm --prefix frontend test        # 20 UI component tests (no server needed)
```
(Or `npm test` from the root to run both.)

Backend integration tests use the separate `student_record_system_test` database. Its schema is reapplied at the start of each run and its data re-seeded for each test file, so your demo data is never touched.

**Optional — browser system tests** drive the real running app in Chromium (Test Plan §4.1 "System Testing"). With the backend and frontend both running:

```bash
npm --prefix e2e install
npm --prefix e2e run browsers     # one-time Chromium download
npm run test:e2e                  # re-seeds the DEV database, then runs the UI walkthrough
```

Screenshots of each key screen are saved to `e2e/shots/`.

## Implementation decisions where the documents are silent

1. **Stack:** not specified by any document (TBD-1). See the table above.
2. **FR-14 Logout** is implemented even though it isn't a Sprint 1 issue: NFR-8 (#31) and TC-01/07/10 depend on it.
3. **Restoring a deactivated record** (needed by TC-03 step 9 and TC-04 step 8) uses the existing `PUT` update endpoint with `status: "ACTIVE"`. No new endpoint was invented.
4. **Account provisioning:** creating a student or faculty record also creates their login (SRS 2.7: accounts are created by the Administrator). The username defaults to the roll number (students) or the email's local part (faculty).
5. **Removing an enrollment** marks it `REMOVED` rather than deleting the row. This keeps historical attendance and marks intact (SRS 5.5, SADS 3.5), and re-enrolling reactivates it.
6. **Course `DELETE` with associations** deactivates the course and responds `409 COURSE_DEACTIVATED_INSTEAD`, per SADS §4.4 ("Invalid state transition … the system deactivates instead").
7. **Assessment components** (name + maximum marks) are configured per course on the course form (SRS 2.7 / TBD-2, SADS 4.6). The seed gives every course IA1 (20), IA2 (20) and Assignment (10).
8. **Deactivated users can still log in** and see their existing data. The SRS only excludes them from *new* enrollments/assignments and never asks for login to be blocked.
9. **Session dates** for attendance cannot be in the future.

## Project layout

```
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
e2e/system.test.js                optional browser system tests (Playwright)
docs/TRACEABILITY.md              GitHub issue -> requirement -> files -> tests
```
