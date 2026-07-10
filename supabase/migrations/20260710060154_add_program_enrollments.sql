-- Program enrollments: staff assigned to a program
CREATE TABLE IF NOT EXISTS program_enrollments (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  profile_id   uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  program_id   uuid NOT NULL REFERENCES programs(id) ON DELETE CASCADE,
  enrolled_at  timestamptz DEFAULT now(),
  due_date     date,
  status       text DEFAULT 'not_started',
  completion_pct int DEFAULT 0,
  completed_at timestamptz,
  UNIQUE(profile_id, program_id)
);

ALTER TABLE program_enrollments ENABLE ROW LEVEL SECURITY;
CREATE POLICY "auth_select_program_enrollments" ON program_enrollments FOR SELECT TO authenticated USING (true);
CREATE POLICY "auth_insert_program_enrollments" ON program_enrollments FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "auth_update_program_enrollments" ON program_enrollments FOR UPDATE TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "auth_delete_program_enrollments" ON program_enrollments FOR DELETE TO authenticated USING (true);

CREATE INDEX IF NOT EXISTS idx_program_enrollments_program ON program_enrollments(program_id);
CREATE INDEX IF NOT EXISTS idx_program_enrollments_profile ON program_enrollments(profile_id);

-- Add program_id to certificates so we can track program-level certs
ALTER TABLE certificates ADD COLUMN IF NOT EXISTS program_id uuid REFERENCES programs(id);
ALTER TABLE certificates ADD COLUMN IF NOT EXISTS program_name text;
