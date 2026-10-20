'use strict';

/**
 * Course Service (FR-4) including per-course assessment component configuration (SADS 4.6).
 * Delete rule (SRS 5.5): physically delete only when the course has no faculty assignment
 * and no student enrollment; otherwise deactivate instead.
 */
const { withTransaction } = require('../db/unitOfWork');
const courseRepository = require('../repositories/courseRepository');
const authz = require('./authorizationService');
const { ROLES } = require('./roles');
const { NotFoundError, ConflictError, ValidationError } = require('../errors/AppError');

async function requireCourse(id, tx) {
  const course = await courseRepository.findById(id, tx);
  if (!course) throw new NotFoundError('Course not found.');
  return course;
}

/** Reject duplicate component names within one course (case-insensitive). */
function assertUniqueComponentNames(components) {
  const seen = new Set();
  components.forEach((c, i) => {
    const key = c.name.toLowerCase();
    if (seen.has(key)) {
      throw new ValidationError(`Assessment component "${c.name}" is listed more than once.`, [
        { field: `components[${i}].name`, issue: 'duplicate', message: 'Component names must be unique within a course.' },
      ]);
    }
    seen.add(key);
  });
}

/** List courses, scoped by role (SO-1): Admin all; Faculty assigned; Student enrolled. */
async function list(actor, filters = {}) {
  authz.assertAuthenticated(actor);
  const scoped = { ...filters };
  if (actor.role === ROLES.FACULTY) scoped.facultyId = actor.facultyId;
  if (actor.role === ROLES.STUDENT) scoped.studentId = actor.studentId;
  return courseRepository.list(scoped);
}

async function get(actor, id) {
  const course = await requireCourse(id);
  await authz.assertCourseReadable(actor, id);
  const components = await courseRepository.listComponents(id);
  return { ...course, components };
}

async function create(actor, data, components = []) {
  authz.assertRole(actor, ROLES.ADMIN);
  assertUniqueComponentNames(components);
  const id = await withTransaction(async (tx) => {
    if (await courseRepository.codeExists(data.code, null, tx)) {
      throw new ConflictError(`A course with code ${data.code} already exists.`, 'DUPLICATE_COURSE_CODE');
    }
    const courseId = await courseRepository.create(data, tx);
    for (const [i, c] of components.entries()) {
      await courseRepository.insertComponent(courseId, { ...c, position: i }, tx);
    }
    return courseId;
  });
  return get(actor, id);
}

/**
 * Update course details, and (if `components` is provided) synchronise the component list:
 * entries with an id are updated, entries without an id are added, and omitted components
 * are removed - unless marks have already been recorded against them.
 */
async function update(actor, id, data, components) {
  authz.assertRole(actor, ROLES.ADMIN);
  if (components) assertUniqueComponentNames(components);

  await withTransaction(async (tx) => {
    const existing = await requireCourse(id, tx);
    if (await courseRepository.codeExists(data.code, id, tx)) {
      throw new ConflictError(`A course with code ${data.code} already exists.`, 'DUPLICATE_COURSE_CODE');
    }
    await courseRepository.update(id, { ...data, status: data.status || existing.status }, tx);

    if (!components) return;
    const current = await courseRepository.listComponents(id, tx);
    const currentById = new Map(current.map((c) => [c.id, c]));
    const keptIds = new Set();

    for (const [i, c] of components.entries()) {
      if (c.id) {
        const prev = currentById.get(c.id);
        if (!prev) {
          throw new ValidationError('An assessment component does not belong to this course.', [
            { field: `components[${i}].id`, issue: 'invalid_value', message: 'Unknown component for this course.' },
          ]);
        }
        const stats = await courseRepository.componentMarkStats(c.id, tx);
        if (stats.count > 0 && c.maxMarks < stats.maxRecorded) {
          throw new ConflictError(
            `Maximum marks for "${prev.name}" cannot be lowered below ${stats.maxRecorded}, the highest mark already recorded.`,
            'COMPONENT_MAX_BELOW_RECORDED'
          );
        }
        await courseRepository.updateComponent(c.id, { ...c, position: i }, tx);
        keptIds.add(c.id);
      } else {
        await courseRepository.insertComponent(id, { ...c, position: i }, tx);
      }
    }
    for (const prev of current) {
      if (keptIds.has(prev.id)) continue;
      const stats = await courseRepository.componentMarkStats(prev.id, tx);
      if (stats.count > 0) {
        throw new ConflictError(
          `Assessment component "${prev.name}" already has marks recorded and cannot be removed.`,
          'COMPONENT_HAS_MARKS'
        );
      }
      await courseRepository.deleteComponent(prev.id, tx);
    }
  });
  return get(actor, id);
}

/**
 * DELETE /api/courses/:id (FR-4, SRS 5.5, SADS 4.4):
 *  - no assignment/enrollment -> permanently deleted, returns { deleted: true }
 *  - otherwise -> deactivated, and a 409 Conflict is reported (SADS 4.4 "invalid state transition").
 */
async function remove(actor, id) {
  authz.assertRole(actor, ROLES.ADMIN);
  const outcome = await withTransaction(async (tx) => {
    await requireCourse(id, tx);
    const counts = await courseRepository.countAssociations(id, tx);
    if (counts.assignments === 0 && counts.enrollments === 0) {
      await courseRepository.remove(id, tx);
      return { deleted: true };
    }
    await courseRepository.setStatus(id, 'INACTIVE', tx);
    return { deleted: false, counts };
  });
  if (!outcome.deleted) {
    // Thrown after the deactivation has been committed.
    throw new ConflictError(
      'This course has a faculty assignment or student enrollment, so it cannot be permanently deleted. It has been deactivated instead.',
      'COURSE_DEACTIVATED_INSTEAD',
      { status: 'INACTIVE', ...outcome.counts }
    );
  }
  return outcome;
}

module.exports = { list, get, create, update, remove, requireCourse };
