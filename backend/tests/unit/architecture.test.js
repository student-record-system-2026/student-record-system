'use strict';

/**
 * NFR-5 Maintainability and Modular Codebase (GitHub #28) - automated part of the review.
 *
 * NFR-5: "The system's codebase shall be modular and organized by functional area (e.g.,
 * authentication, student management, attendance, marks) to facilitate independent development,
 * debugging, and future enhancement by different team members."
 *
 * Test Plan 12.4.3 verifies NFR-5 by code and module-organization review. These checks make the
 * structural rules of that review (SADS 3.1 layering, one module per functional area) executable,
 * so CI catches a violation on every PR. The written review is docs/Sprint2/NFR-5_Maintainability_Review_Record.md.
 */
const fs = require('fs');
const path = require('path');

const SRC = path.resolve(__dirname, '../../src');
const MAX_LINES = 300;

function walk(dir) {
  return fs.readdirSync(dir, { withFileTypes: true }).flatMap((e) =>
    e.isDirectory() ? walk(path.join(dir, e.name)) : e.name.endsWith('.js') ? [path.join(dir, e.name)] : []
  );
}
const rel = (f) => path.relative(SRC, f).split(path.sep).join('/');
const layerOf = (f) => (rel(f).includes('/') ? rel(f).split('/')[0] : 'root');

/** Internal requires of a file, resolved to paths relative to src/ (e.g. "services/roles"). */
function internalDeps(file) {
  const code = fs.readFileSync(file, 'utf8');
  return [...code.matchAll(/require\('(\.[^']+)'\)/g)].map((m) =>
    rel(path.resolve(path.dirname(file), m[1])).replace(/\.js$/, '').replace(/\/index$/, '')
  );
}
const externalDeps = (file) =>
  [...fs.readFileSync(file, 'utf8').matchAll(/require\('([^.][^']*)'\)/g)].map((m) => m[1]);

const FILES = walk(SRC);

// SADS 3.1: Presentation -> Controller/API -> Business/Service -> Data Access -> Database.
// Each layer may depend only on the layers listed (plus itself, plus shared errors/config).
const ALLOWED = {
  routes: ['routes', 'controllers', 'middleware', 'utils', 'services/roles'],
  controllers: ['services', 'validation', 'errors', 'config'],
  services: ['services', 'repositories', 'db/unitOfWork', 'errors', 'config'],
  repositories: ['db/pool'],
  middleware: ['errors', 'services/authorizationService', 'services/roles', 'config'],
  validation: ['validation', 'errors'],
  db: ['db', 'errors', 'config'],
  errors: [],
  config: [],
  utils: [],
};
const allowed = (layer, dep) =>
  dep.split('/')[0] === layer || ALLOWED[layer].some((a) => dep === a || dep.startsWith(a + '/'));

describe('NFR-5: layered architecture (SADS 3.1)', () => {
  test('every source file belongs to a known layer', () => {
    const unknown = FILES.filter((f) => layerOf(f) !== 'root' && !(layerOf(f) in ALLOWED)).map(rel);
    expect(unknown).toEqual([]);
  });

  test('each layer depends only on the layers below it', () => {
    const violations = [];
    for (const f of FILES) {
      const layer = layerOf(f);
      if (layer === 'root') continue; // app.js / server.js compose the layers
      for (const dep of internalDeps(f)) if (!allowed(layer, dep)) violations.push(`${rel(f)} -> ${dep}`);
    }
    expect(violations).toEqual([]);
  });

  test('only the Data Access layer (repositories via db/) talks to PostgreSQL', () => {
    const pgUsers = FILES.filter((f) => externalDeps(f).includes('pg')).map(rel);
    expect(pgUsers).toEqual(['db/pool.js']);
    const poolUsers = FILES.filter((f) => internalDeps(f).includes('db/pool')).map(layerOf);
    expect([...new Set(poolUsers)].sort()).toEqual(['db', 'repositories', 'root'].filter((l) => poolUsers.includes(l)));
    expect(poolUsers).not.toContain('services');
    expect(poolUsers).not.toContain('controllers');
  });

  test('HTTP (Express) stays in the Controller/API layer; business logic never sees req/res', () => {
    const expressUsers = FILES.filter((f) => externalDeps(f).some((d) => d.startsWith('express'))).map(layerOf);
    for (const l of expressUsers) expect(['routes', 'root']).toContain(l);
    for (const f of FILES.filter((x) => ['services', 'repositories'].includes(layerOf(x)))) {
      expect(fs.readFileSync(f, 'utf8')).not.toMatch(/\breq\.(body|params|query|session)|\bres\.(json|status|send)\(/);
    }
  });

  test('SQL appears only in the Data Access layer and the database helpers', () => {
    const sql = /\b(SELECT\s+[\w*(]|INSERT\s+INTO|UPDATE\s+\w+\s+SET|DELETE\s+FROM)\b/;
    // server.js may run the startup connectivity probe "SELECT 1"; nothing else outside the DAL.
    const code = (f) => fs.readFileSync(f, 'utf8').replace(/pool\.query\('SELECT 1'\)/g, '');
    const offenders = FILES.filter((f) => !['repositories', 'db'].includes(layerOf(f)) && sql.test(code(f))).map(rel);
    expect(offenders).toEqual([]);
  });
});

describe('NFR-5: organized by functional area', () => {
  const AREAS = {
    authentication: ['controllers/authController', 'services/authService', 'routes/authRoutes'],
    'student management': ['controllers/studentController', 'services/studentService', 'repositories/studentRepository', 'routes/studentRoutes'],
    'faculty management': ['controllers/facultyController', 'services/facultyService', 'repositories/facultyRepository', 'routes/facultyRoutes'],
    'course management': ['controllers/courseController', 'services/courseService', 'repositories/courseRepository', 'routes/courseRoutes'],
    'assignment and enrollment': ['controllers/assignmentEnrollmentController', 'services/assignmentEnrollmentService', 'repositories/assignmentRepository', 'repositories/enrollmentRepository'],
    attendance: ['controllers/attendanceController', 'services/attendanceService', 'repositories/attendanceRepository'],
    marks: ['controllers/marksController', 'services/marksService', 'repositories/marksRepository'],
    'profiles and dashboards': ['controllers/profileDashboardController', 'services/profileDashboardService'],
    authorization: ['services/authorizationService', 'middleware/authenticate', 'middleware/authorize'],
  };

  test.each(Object.entries(AREAS))('%s has its own modules in each layer', (_area, modules) => {
    for (const m of modules) expect(fs.existsSync(path.join(SRC, m + '.js'))).toBe(true);
  });

  test('every controller is reachable from a route and every service from a controller (no dead modules)', () => {
    const deps = new Set(FILES.flatMap(internalDeps));
    const orphans = FILES.filter((f) => ['controllers', 'services', 'repositories'].includes(layerOf(f)))
      .map((f) => rel(f).replace(/\.js$/, ''))
      .filter((m) => !deps.has(m));
    expect(orphans).toEqual([]);
  });

  test(`no source file exceeds ${MAX_LINES} lines (small, focused modules)`, () => {
    const big = FILES.map((f) => [rel(f), fs.readFileSync(f, 'utf8').split('\n').length]).filter(([, n]) => n > MAX_LINES);
    expect(big).toEqual([]);
  });

  test('every module starts with a header comment stating its responsibility', () => {
    const missing = FILES.filter((f) => !/^('use strict';\s*)?\/\*\*?|^('use strict';\s*)?\/\//.test(fs.readFileSync(f, 'utf8').trimStart())).map(rel);
    expect(missing).toEqual([]);
  });
});
