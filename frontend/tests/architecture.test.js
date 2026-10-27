/**
 * NFR-5 Maintainability and Modular Codebase (GitHub #28) - Presentation Layer structure.
 * Executable part of the NFR-5 code and module-organization review (Test Plan 12.4.3);
 * see docs/Sprint2/NFR-5_Maintainability_Review_Record.md.
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, test } from 'vitest';

const SRC = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../src');
const MAX_LINES = 300;

function walk(dir) {
  return fs.readdirSync(dir, { withFileTypes: true }).flatMap((e) =>
    e.isDirectory() ? walk(path.join(dir, e.name)) : /\.jsx?$/.test(e.name) ? [path.join(dir, e.name)] : []
  );
}
const rel = (f) => path.relative(SRC, f).split(path.sep).join('/');
const FILES = walk(SRC);
const read = (f) => fs.readFileSync(f, 'utf8');
const imports = (f) =>
  [...read(f).matchAll(/from '(\.[^']+)'/g)].map((m) => rel(path.resolve(path.dirname(f), m[1])));

describe('NFR-5: Presentation Layer talks to the API through one module (SADS 3.1)', () => {
  test('only src/api/client.js calls fetch / XMLHttpRequest', () => {
    const callers = FILES.filter((f) => /\bfetch\(|XMLHttpRequest/.test(read(f))).map(rel);
    expect(callers).toEqual(['api/client.js']);
  });

  test('no screen hard-codes an API URL; all requests go through the api client', () => {
    const offenders = FILES.filter((f) => rel(f) !== 'api/client.js' && /['"`]\/api\//.test(read(f))).map(rel);
    expect(offenders).toEqual([]);
  });
});

describe('NFR-5: screens organized by role and functional area', () => {
  test('role folders exist for each user role', () => {
    for (const role of ['admin', 'faculty', 'student']) expect(fs.existsSync(path.join(SRC, 'pages', role))).toBe(true);
  });

  test('a role\'s screens never import another role\'s screens', () => {
    const violations = [];
    for (const f of FILES.filter((x) => /^pages\/(admin|faculty|student)\//.test(rel(x)))) {
      const role = rel(f).split('/')[1];
      for (const dep of imports(f)) {
        const m = dep.match(/^pages\/(admin|faculty|student)\//);
        if (m && m[1] !== role) violations.push(`${rel(f)} -> ${dep}`);
      }
    }
    expect(violations).toEqual([]);
  });

  test('shared components never depend on screens (components are reusable building blocks)', () => {
    const violations = FILES.filter((f) => rel(f).startsWith('components/'))
      .flatMap((f) => imports(f).filter((d) => d.startsWith('pages/')).map((d) => `${rel(f)} -> ${d}`));
    expect(violations).toEqual([]);
  });

  test(`no source file exceeds ${MAX_LINES} lines`, () => {
    const big = FILES.map((f) => [rel(f), read(f).split('\n').length]).filter(([, n]) => n > MAX_LINES);
    expect(big).toEqual([]);
  });
});
