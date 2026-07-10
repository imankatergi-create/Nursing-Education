
/*
# Extend quiz_attempts and add course_locks

1. Modified Tables
   - `quiz_attempts`: Add course_id, lesson_id, answers columns for tracking
     which course/lesson the attempt belongs to and the nurse's submitted answers.

2. New Tables
   - `course_locks`: Tracks locked courses per nurse.
     - profile_id + course_id: UNIQUE pair (allows upsert)
     - is_locked: current lock state
     - locked_by / unlocked_by: who triggered the change
     - unlocked_at: used to filter "fresh" attempts after an unlock

3. Security
   - RLS enabled on both tables with anon + authenticated access.
*/

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='quiz_attempts' AND column_name='course_id') THEN
    ALTER TABLE quiz_attempts ADD COLUMN course_id uuid REFERENCES courses(id) ON DELETE CASCADE;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='quiz_attempts' AND column_name='lesson_id') THEN
    ALTER TABLE quiz_attempts ADD COLUMN lesson_id uuid REFERENCES lessons(id) ON DELETE CASCADE;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='quiz_attempts' AND column_name='answers') THEN
    ALTER TABLE quiz_attempts ADD COLUMN answers jsonb NOT NULL DEFAULT '[]';
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS quiz_attempts_profile_course ON quiz_attempts(profile_id, course_id);

ALTER TABLE quiz_attempts ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "anon_select_quiz_attempts" ON quiz_attempts;
CREATE POLICY "anon_select_quiz_attempts" ON quiz_attempts FOR SELECT
  TO anon, authenticated USING (true);

DROP POLICY IF EXISTS "anon_insert_quiz_attempts" ON quiz_attempts;
CREATE POLICY "anon_insert_quiz_attempts" ON quiz_attempts FOR INSERT
  TO anon, authenticated WITH CHECK (true);

DROP POLICY IF EXISTS "anon_update_quiz_attempts" ON quiz_attempts;
CREATE POLICY "anon_update_quiz_attempts" ON quiz_attempts FOR UPDATE
  TO anon, authenticated USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "anon_delete_quiz_attempts" ON quiz_attempts;
CREATE POLICY "anon_delete_quiz_attempts" ON quiz_attempts FOR DELETE
  TO anon, authenticated USING (true);

CREATE TABLE IF NOT EXISTS course_locks (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  profile_id uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  course_id uuid NOT NULL REFERENCES courses(id) ON DELETE CASCADE,
  reason text NOT NULL DEFAULT 'Exceeded maximum quiz attempts',
  locked_at timestamptz NOT NULL DEFAULT now(),
  locked_by text NOT NULL DEFAULT 'system',
  unlocked_at timestamptz,
  unlocked_by text,
  is_locked boolean NOT NULL DEFAULT true,
  UNIQUE(profile_id, course_id)
);

CREATE INDEX IF NOT EXISTS course_locks_is_locked ON course_locks(is_locked) WHERE is_locked = true;

ALTER TABLE course_locks ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "anon_select_course_locks" ON course_locks;
CREATE POLICY "anon_select_course_locks" ON course_locks FOR SELECT
  TO anon, authenticated USING (true);

DROP POLICY IF EXISTS "anon_insert_course_locks" ON course_locks;
CREATE POLICY "anon_insert_course_locks" ON course_locks FOR INSERT
  TO anon, authenticated WITH CHECK (true);

DROP POLICY IF EXISTS "anon_update_course_locks" ON course_locks;
CREATE POLICY "anon_update_course_locks" ON course_locks FOR UPDATE
  TO anon, authenticated USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "anon_delete_course_locks" ON course_locks;
CREATE POLICY "anon_delete_course_locks" ON course_locks FOR DELETE
  TO anon, authenticated USING (true);
