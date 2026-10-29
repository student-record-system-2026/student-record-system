# Maintainability Review Record (NFR-5)

Deliverable required by Test Plan v1.1, Section 6 ("Maintainability Review Record: documents the review date, reviewer, findings, and outcome of the codebase review against NFR-5"). The method is the code and module-organization review in Section 12.4.3.

| Item | Value |
|---|---|
| Requirement | NFR-5 (SRS 5.4): the codebase shall be modular and organized by functional area (e.g. authentication, student management, attendance, marks) to facilitate independent development, debugging, and future enhancement by different team members |
| GitHub issue | #28 |
| Review method | Checklist-based code and module-organization review (Test Plan 4.2), supported by automated structure checks |
| Automated checks | `backend/tests/unit/architecture.test.js` (17 checks), `frontend/tests/architecture.test.js` (6 checks); both run in CI on every pull request |
| Code reviewed | `main` at commit 3a962a4 (fill in with `git rev-parse --short HEAD`) |
| Reviewer | Aashlesh P (PES1UG24CS011) |
| Review date | 29/10/2026 |

---

## 1. Module inventory

**Backend (`backend/src`, 2,822 lines in 43 files, including the `app.js` and `server.js` entry points), layered as in SADS 3.1**

| Layer (SADS 3.1) | Folder | Files | Lines | Responsibility |
|---|---|---|---|---|
| Controller / API | `routes/` | 5 | 133 | Endpoints and role gate per route (SADS 4.3) |
| Controller / API | `controllers/` | 8 | 357 | Parse and validate requests, map results to HTTP |
| Controller / API | `validation/` | 2 | 318 | Request schemas and validator (NFR-4) |
| Controller / API | `middleware/` | 3 | 93 | Authentication (401), authorization (403), error envelope |
| Business / Service | `services/` | 10 | 1,026 | Business rules (SRS 5.5) and record-level authorization |
| Data Access | `repositories/` | 8 | 610 | One repository per entity; only place SQL is written |
| Data Access | `db/` | 2 | 85 | Connection pool and transaction helper |
| Shared | `errors/`, `config/`, `utils/` | 3 | 104 | Typed errors, configuration, async wrapper |

**Backend: one module per functional area in every layer**

| Functional area | Route | Controller | Service | Repository |
|---|---|---|---|---|
| Authentication (FR-1, FR-14) | authRoutes | authController | authService | accountRepository |
| Student management (FR-2) | studentRoutes | studentController | studentService | studentRepository |
| Faculty management (FR-3) | facultyRoutes | facultyController | facultyService | facultyRepository |
| Course management (FR-4) | courseRoutes | courseController | courseService | courseRepository |
| Assignment and enrollment (FR-5, FR-6) | courseRoutes | assignmentEnrollmentController | assignmentEnrollmentService | assignmentRepository, enrollmentRepository |
| Attendance (FR-7, FR-8) | courseRoutes, studentRoutes | attendanceController | attendanceService | attendanceRepository |
| Marks (FR-9, FR-10) | courseRoutes, studentRoutes | marksController | marksService | marksRepository |
| Profiles and dashboards (FR-11 to FR-13) | routes/index | profileDashboardController | profileDashboardService | (uses the repositories above) |
| Authorization (NFR-7, SO-1 to SO-3) | middleware/authenticate, authorize | — | authorizationService, roles | — |

**Frontend (`frontend/src`, 2,622 lines in 33 files, including `App.jsx` and `main.jsx`)**

| Folder | Files | Lines | Responsibility |
|---|---|---|---|
| `api/` | 1 | 127 | The only module that calls the backend |
| `auth/` | 2 | 91 | Session state and protected routes |
| `components/` | 5 | 370 | Shared layout, form fields, tables |
| `pages/` (shared) | 3 | 106 | Login, access denied, not found |
| `pages/admin/` | 12 | 1,214 | Administrator screens (FR-2 to FR-6, FR-13) |
| `pages/faculty/` | 4 | 401 | Faculty screens (FR-7, FR-9, FR-12, FR-13) |
| `pages/student/` | 4 | 214 | Student screens (FR-8, FR-10, FR-11, FR-13) |

## 2. Review checklist

| # | Check | Evidence | Result |
|---|---|---|---|
| 1 | Code is organized by functional area | Tables above; automated check "has its own modules in each layer" for 9 areas | Met |
| 2 | Layers depend only on the layer below (SADS 3.1) | Automated dependency check across all backend layer files: 0 violations | Met |
| 3 | Only the Data Access layer issues SQL or uses the database driver | Automated checks: `pg` used only in `db/pool.js`; SQL only in `repositories/` and `db/` | Met |
| 4 | Business logic is independent of HTTP | Automated check: no `req`/`res` use in services or repositories; Express only in routes | Met |
| 5 | The UI reaches the backend through one module | Automated check: `fetch` only in `api/client.js`; no hard-coded `/api/` URLs in screens | Met |
| 6 | Screens are separated by role | Automated check: no admin/faculty/student screen imports another role's screen | Met |
| 7 | Modules are small and focused | Largest source file 230 lines (EnrollmentsPage.jsx); limit enforced at 300 | Met |
| 8 | No dead modules | Automated check: every controller, service and repository is used | Met |
| 9 | Each module states its responsibility | Header comment on every backend module (automated check) | Met after fix F-01 |
| 10 | Each area can be tested on its own | Unit tests per service; one integration file per test case (`tc01` to `tc10`); UI tests per role area | Met |
| 11 | Team members could develop areas independently | Sprint 1: 27 pull requests by 4 members, each owning separate areas, merged in dependency order with CI green at every step | Met |
| 12 | Configuration is separate from code | All settings in `backend/.env` read by `config/index.js`; `.env.example` documents each one | Met |

## 3. Findings

| ID | Finding | Severity | Action | Status |
|---|---|---|---|---|
| F-01 | `backend/src/server.js` had no header comment describing its responsibility | Low | Header comment added (Sprint 2 PR for #28) | Closed |
| F-02 | `backend`, `frontend` and `e2e` package.json each list a stray `"student-record-system": "file:.."` dependency, left over from an `npm install` run in the wrong folder | Low | No functional effect. Remove in a later clean-up together with the lockfiles | Open (deferred) |
| F-03 | Required-field markers (*) are visual only and are not announced by screen readers | Low | Outside NFR-5. Noted for the usability walkthrough (NFR-3) | Open (deferred) |
| F-04 | Development dependencies have known advisories (Dependabot) | Low | Outside NFR-5. Upgrade tested in Sprint 2 and listed in the Test Summary Report | Open (deferred) |

(The reviewer adds any further findings from reading the code here.)

## 4. Outcome

| Item | Value |
|---|---|
| Result | **Satisfied** / Not satisfied (reviewer to confirm) |
| Summary | The codebase follows the SADS layered architecture with one module per functional area in each layer, enforced by automated checks in CI. No finding affects modularity. |

| Reviewer | Signature | Date |
|---|---|---|
| Aashlesh P (PES1UG24CS011) | Aashlesh P | 29/10/2026 |
