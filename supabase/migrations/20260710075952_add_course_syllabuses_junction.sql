/*
# Add course_syllabuses junction and backfill existing modules

## Summary
Creates the course_syllabuses many-to-many junction table so a course can be linked
to multiple syllabuses. Also backfills any course_modules that have a course_id but
no syllabus_id by auto-creating a syllabus named after the course.

## New Tables
- `course_syllabuses`: (course_id, syllabus_id) composite PK junction table

## Data Migration
Any course_modules with course_id set but syllabus_id NULL get a new syllabus
auto-created from the parent course's title, and syllabus_id is backfilled.

## Security
RLS with open anon+authenticated CRUD (admin app, no per-user isolation).
*/

CREATE TABLE IF NOT EXISTS course_syllabuses (
  course_id   uuid NOT NULL REFERENCES courses(id)  ON DELETE CASCADE,
  syllabus_id uuid NOT NULL REFERENCES syllabi(id)   ON DELETE CASCADE,
  PRIMARY KEY (course_id, syllabus_id)
);

ALTER TABLE course_syllabuses ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "sel_course_syllabuses" ON course_syllabuses;
CREATE POLICY "sel_course_syllabuses" ON course_syllabuses FOR SELECT TO anon, authenticated USING (true);

DROP POLICY IF EXISTS "ins_course_syllabuses" ON course_syllabuses;
CREATE POLICY "ins_course_syllabuses" ON course_syllabuses FOR INSERT TO anon, authenticated WITH CHECK (true);

DROP POLICY IF EXISTS "upd_course_syllabuses" ON course_syllabuses;
CREATE POLICY "upd_course_syllabuses" ON course_syllabuses FOR UPDATE TO anon, authenticated USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "del_course_syllabuses" ON course_syllabuses;
CREATE POLICY "del_course_syllabuses" ON course_syllabuses FOR DELETE TO anon, authenticated USING (true);

-- Backfill: for each course that has modules without a syllabus_id, create one
DO $$
DECLARE
  r      RECORD;
  new_id uuid;
BEGIN
  FOR r IN
    SELECT DISTINCT cm.course_id, c.title
    FROM   course_modules cm
    JOIN   courses c ON c.id = cm.course_id
    WHERE  cm.syllabus_id IS NULL
      AND  cm.course_id IS NOT NULL
  LOOP
    INSERT INTO syllabi (title) VALUES (r.title) RETURNING id INTO new_id;
    UPDATE course_modules
    SET    syllabus_id = new_id
    WHERE  course_id = r.course_id
      AND  syllabus_id IS NULL;
  END LOOP;
END $$;
