-- =====================================================================
-- Student Record System v1.0 - Relational schema (PostgreSQL)
-- SADS 3.5 (Data/Storage Architecture) and 4.6 (Database Design):
--   * surrogate primary keys + foreign keys for referential integrity
--   * status flag (ACTIVE/INACTIVE) instead of deleting Student/Faculty/Course
--   * assessment components configured per course (SRS TBD-2)
--   * unique constraints backing the 409 Conflict responses (SADS 4.4)
-- This script is idempotent: it drops and recreates all application tables.
-- =====================================================================

DROP TABLE IF EXISTS marks CASCADE;
DROP TABLE IF EXISTS attendance CASCADE;
DROP TABLE IF EXISTS enrollments CASCADE;
DROP TABLE IF EXISTS course_assignments CASCADE;
DROP TABLE IF EXISTS assessment_components CASCADE;
DROP TABLE IF EXISTS courses CASCADE;
DROP TABLE IF EXISTS faculty CASCADE;
DROP TABLE IF EXISTS students CASCADE;
DROP TABLE IF EXISTS accounts CASCADE;
DROP TABLE IF EXISTS user_sessions CASCADE;

-- One account per Administrator, Faculty or Student user (NFR-2: hashed password only).
CREATE TABLE accounts (
  id             SERIAL PRIMARY KEY,
  username       VARCHAR(50)  NOT NULL,
  email          VARCHAR(120),
  password_hash  VARCHAR(100) NOT NULL,
  role           VARCHAR(10)  NOT NULL CHECK (role IN ('ADMIN', 'FACULTY', 'STUDENT')),
  created_at     TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);
CREATE UNIQUE INDEX accounts_username_uq ON accounts (LOWER(username));
CREATE UNIQUE INDEX accounts_email_uq    ON accounts (LOWER(email)) WHERE email IS NOT NULL;

-- FR-2: student master record.
CREATE TABLE students (
  id           SERIAL PRIMARY KEY,
  account_id   INTEGER      NOT NULL UNIQUE REFERENCES accounts(id) ON DELETE RESTRICT,
  roll_number  VARCHAR(20)  NOT NULL,
  name         VARCHAR(100) NOT NULL,
  email        VARCHAR(120) NOT NULL,
  phone        VARCHAR(20),
  department   VARCHAR(50)  NOT NULL,
  batch        VARCHAR(4)   NOT NULL,
  status       VARCHAR(8)   NOT NULL DEFAULT 'ACTIVE' CHECK (status IN ('ACTIVE', 'INACTIVE')),
  created_at   TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
  updated_at   TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);
CREATE UNIQUE INDEX students_roll_uq ON students (UPPER(roll_number));

-- FR-3: faculty master record.
CREATE TABLE faculty (
  id           SERIAL PRIMARY KEY,
  account_id   INTEGER      NOT NULL UNIQUE REFERENCES accounts(id) ON DELETE RESTRICT,
  name         VARCHAR(100) NOT NULL,
  email        VARCHAR(120) NOT NULL,
  phone        VARCHAR(20),
  department   VARCHAR(50)  NOT NULL,
  designation  VARCHAR(50),
  status       VARCHAR(8)   NOT NULL DEFAULT 'ACTIVE' CHECK (status IN ('ACTIVE', 'INACTIVE')),
  created_at   TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
  updated_at   TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);

-- FR-4: course catalogue.
CREATE TABLE courses (
  id          SERIAL PRIMARY KEY,
  code        VARCHAR(20)  NOT NULL,
  name        VARCHAR(120) NOT NULL,
  credits     SMALLINT     NOT NULL CHECK (credits BETWEEN 1 AND 10),
  status      VARCHAR(8)   NOT NULL DEFAULT 'ACTIVE' CHECK (status IN ('ACTIVE', 'INACTIVE')),
  created_at  TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
  updated_at  TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);
CREATE UNIQUE INDEX courses_code_uq ON courses (UPPER(code));

-- SRS 2.7 / TBD-2 / SADS 4.6: assessment components and maximum marks, configured per course.
CREATE TABLE assessment_components (
  id          SERIAL PRIMARY KEY,
  course_id   INTEGER      NOT NULL REFERENCES courses(id) ON DELETE CASCADE,
  name        VARCHAR(60)  NOT NULL,
  max_marks   NUMERIC(6,2) NOT NULL CHECK (max_marks > 0),
  position    SMALLINT     NOT NULL DEFAULT 0
);
CREATE UNIQUE INDEX components_course_name_uq ON assessment_components (course_id, LOWER(name));

-- FR-5: faculty-course assignment. SRS 2.7: each course is taught by a single faculty member.
CREATE TABLE course_assignments (
  id           SERIAL PRIMARY KEY,
  course_id    INTEGER     NOT NULL UNIQUE REFERENCES courses(id) ON DELETE RESTRICT,
  faculty_id   INTEGER     NOT NULL REFERENCES faculty(id) ON DELETE RESTRICT,
  assigned_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX course_assignments_faculty_idx ON course_assignments (faculty_id);

-- FR-6: student-course enrollment. Removal is a status change so that historical
-- attendance/marks that reference the enrollment are preserved (SRS 5.5).
CREATE TABLE enrollments (
  id           SERIAL PRIMARY KEY,
  student_id   INTEGER     NOT NULL REFERENCES students(id) ON DELETE RESTRICT,
  course_id    INTEGER     NOT NULL REFERENCES courses(id) ON DELETE RESTRICT,
  status       VARCHAR(8)  NOT NULL DEFAULT 'ACTIVE' CHECK (status IN ('ACTIVE', 'REMOVED')),
  enrolled_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT enrollments_student_course_uq UNIQUE (student_id, course_id)
);
CREATE INDEX enrollments_course_idx ON enrollments (course_id);

-- FR-7 / FR-8: per-session, per-enrollment present/absent record.
CREATE TABLE attendance (
  id             SERIAL PRIMARY KEY,
  enrollment_id  INTEGER     NOT NULL REFERENCES enrollments(id) ON DELETE RESTRICT,
  session_date   DATE        NOT NULL,
  status         VARCHAR(7)  NOT NULL CHECK (status IN ('PRESENT', 'ABSENT')),
  recorded_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT attendance_enrollment_date_uq UNIQUE (enrollment_id, session_date)
);

-- FR-9 / FR-10: per-component, per-enrollment marks.
CREATE TABLE marks (
  id              SERIAL PRIMARY KEY,
  enrollment_id   INTEGER      NOT NULL REFERENCES enrollments(id) ON DELETE RESTRICT,
  component_id    INTEGER      NOT NULL REFERENCES assessment_components(id) ON DELETE RESTRICT,
  marks_obtained  NUMERIC(6,2) NOT NULL CHECK (marks_obtained >= 0),
  recorded_at     TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
  CONSTRAINT marks_enrollment_component_uq UNIQUE (enrollment_id, component_id)
);

-- Server-side session store (NFR-8: a destroyed session row can never be reused).
-- Layout required by connect-pg-simple.
CREATE TABLE user_sessions (
  sid     VARCHAR      NOT NULL PRIMARY KEY,
  sess    JSON         NOT NULL,
  expire  TIMESTAMP(6) NOT NULL
);
CREATE INDEX user_sessions_expire_idx ON user_sessions (expire);
