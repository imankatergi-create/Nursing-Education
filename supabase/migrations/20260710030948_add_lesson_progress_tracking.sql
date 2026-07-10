/*
# Add lesson_progress tracking table

Tracks per-nurse, per-lesson progress for video watch percentage,
document reading, and quiz scores. Also updates nurse_enrollments
completion percentage for admin reporting.

1. New Tables
  - `lesson_progress`
    - `profile_id` (uuid, FK → profiles) - the nurse
    - `course_key` (text) - the course UUID (matches courses.id)
    - `lesson_key` (text) - the lesson key (e.g. 'l1', 'l2', ...)
    - `type` (text) - video | doc | quiz | eval
    - `watch_pct` (int) - video: percentage watched (0–100)
    - `doc_page` (int) - doc: last page reached
    - `doc_total_pages` (int) - doc: total pages
    - `doc_acked` (bool) - doc: nurse acknowledged the document
    - `quiz_score` (int) - quiz: best score percentage
    - `quiz_passed` (bool) - quiz: whether it was passed
    - `completed` (bool) - lesson marked complete
    - `updated_at` (timestamptz)
    - PRIMARY KEY: (profile_id, course_key, lesson_key)

2. Security
  - RLS enabled
  - SELECT: any authenticated user (admins need to read for reports)
  - INSERT/UPDATE/DELETE: own rows only (auth.uid() = profile_id)
*/

CREATE TABLE IF NOT EXISTS lesson_progress (
  profile_id      uuid    NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  course_key      text    NOT NULL,
  lesson_key      text    NOT NULL,
  type            text    NOT NULL DEFAULT 'video',
  watch_pct       int     NOT NULL DEFAULT 0,
  doc_page        int     NOT NULL DEFAULT 1,
  doc_total_pages int     NOT NULL DEFAULT 6,
  doc_acked       boolean NOT NULL DEFAULT false,
  quiz_score      int,
  quiz_passed     boolean,
  completed       boolean NOT NULL DEFAULT false,
  updated_at      timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (profile_id, course_key, lesson_key)
);

CREATE INDEX IF NOT EXISTS idx_lesson_progress_profile ON lesson_progress(profile_id);
CREATE INDEX IF NOT EXISTS idx_lesson_progress_course  ON lesson_progress(profile_id, course_key);

ALTER TABLE lesson_progress ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "select_lesson_progress" ON lesson_progress;
CREATE POLICY "select_lesson_progress" ON lesson_progress
  FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS "insert_lesson_progress" ON lesson_progress;
CREATE POLICY "insert_lesson_progress" ON lesson_progress
  FOR INSERT TO authenticated WITH CHECK (auth.uid() = profile_id);

DROP POLICY IF EXISTS "update_lesson_progress" ON lesson_progress;
CREATE POLICY "update_lesson_progress" ON lesson_progress
  FOR UPDATE TO authenticated
  USING (auth.uid() = profile_id)
  WITH CHECK (auth.uid() = profile_id);

DROP POLICY IF EXISTS "delete_lesson_progress" ON lesson_progress;
CREATE POLICY "delete_lesson_progress" ON lesson_progress
  FOR DELETE TO authenticated USING (auth.uid() = profile_id);
