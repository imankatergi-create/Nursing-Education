-- 1. Create standalone syllabi table
CREATE TABLE IF NOT EXISTS syllabi (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  title text NOT NULL,
  description text DEFAULT '',
  created_at timestamptz DEFAULT now()
);

ALTER TABLE syllabi ENABLE ROW LEVEL SECURITY;
CREATE POLICY "select_syllabi" ON syllabi FOR SELECT TO authenticated, anon USING (true);
CREATE POLICY "insert_syllabi" ON syllabi FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "update_syllabi" ON syllabi FOR UPDATE TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "delete_syllabi" ON syllabi FOR DELETE TO authenticated USING (true);

-- 2. Allow course_modules to belong to a syllabus OR a course
ALTER TABLE course_modules ADD COLUMN IF NOT EXISTS syllabus_id uuid REFERENCES syllabi(id) ON DELETE CASCADE;
ALTER TABLE course_modules ALTER COLUMN course_id DROP NOT NULL;

-- 3. Courses can optionally link to a syllabus
ALTER TABLE courses ADD COLUMN IF NOT EXISTS syllabus_id uuid REFERENCES syllabi(id) ON DELETE SET NULL;

-- 4. Program ↔ Course join table
CREATE TABLE IF NOT EXISTS program_courses (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  program_id uuid NOT NULL REFERENCES programs(id) ON DELETE CASCADE,
  course_id uuid NOT NULL REFERENCES courses(id) ON DELETE CASCADE,
  order_index integer DEFAULT 0,
  UNIQUE(program_id, course_id)
);

ALTER TABLE program_courses ENABLE ROW LEVEL SECURITY;
CREATE POLICY "select_program_courses" ON program_courses FOR SELECT TO authenticated, anon USING (true);
CREATE POLICY "insert_program_courses" ON program_courses FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "update_program_courses" ON program_courses FOR UPDATE TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "delete_program_courses" ON program_courses FOR DELETE TO authenticated USING (true);
