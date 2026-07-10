/*
# Custom Roles Table + Progress/Reports DB Functions

1. New Tables
   - `custom_roles`: Stores role definitions with permissions for the Roles UI

2. New Functions
   - `get_nurse_progress()`: Aggregates per-nurse training stats from lesson_progress + nurse_enrollments
   - `get_dept_coverage()`: Aggregates per-dept training coverage from lesson_progress + profiles

3. Seed Data
   - Inserts the 7 default roles with their permissions
*/

-- ── Custom Roles Table ─────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS custom_roles (
  id          text PRIMARY KEY,
  name        text NOT NULL,
  description text,
  color       text DEFAULT '#6B7280',
  permissions jsonb DEFAULT '[]',
  created_at  timestamptz DEFAULT now(),
  updated_at  timestamptz DEFAULT now()
);

ALTER TABLE custom_roles ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "auth_select_custom_roles" ON custom_roles;
CREATE POLICY "auth_select_custom_roles" ON custom_roles
  FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS "auth_insert_custom_roles" ON custom_roles;
CREATE POLICY "auth_insert_custom_roles" ON custom_roles
  FOR INSERT TO authenticated WITH CHECK (true);

DROP POLICY IF EXISTS "auth_update_custom_roles" ON custom_roles;
CREATE POLICY "auth_update_custom_roles" ON custom_roles
  FOR UPDATE TO authenticated USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "auth_delete_custom_roles" ON custom_roles;
CREATE POLICY "auth_delete_custom_roles" ON custom_roles
  FOR DELETE TO authenticated USING (true);

-- Seed default roles
INSERT INTO custom_roles (id, name, description, color, permissions) VALUES
  ('superadmin', 'Super Admin', 'Full system access — all modules, all data', '#dc2626',
   '["View Dashboard","Manage Users","Manage Roles","Manage Departments","Create Programs","Edit Programs","Create Courses","Edit Courses","Upload Materials","Create Quizzes","View Reports","Export Reports","Send Notifications","Create Announcements","View Certificates","Issue Certificates","View Audit Log","System Settings"]'),
  ('admin', 'Admin', 'Hospital training administrator', '#ea580c',
   '["View Dashboard","Manage Users","Manage Departments","Create Programs","Edit Programs","Create Courses","Edit Courses","Upload Materials","Create Quizzes","View Reports","Export Reports","Send Notifications","Create Announcements","View Certificates","Issue Certificates"]'),
  ('educator', 'Educator', 'Course creator and instructor', '#2563eb',
   '["View Dashboard","Create Courses","Edit Courses","Upload Materials","Create Quizzes","View Reports","View Certificates"]'),
  ('supervisor', 'Supervisor', 'Unit supervisor monitoring team progress', '#0891b2',
   '["View Dashboard","View Reports","Send Notifications","View Certificates"]'),
  ('nurse', 'Nurse', 'Clinical staff learner', '#059669',
   '["View Dashboard","View Certificates"]'),
  ('director', 'Director', 'Department director — strategic view', '#7c3aed',
   '["View Dashboard","View Reports","Export Reports","View Certificates"]'),
  ('it', 'IT Admin', 'System and infrastructure management', '#6b7280',
   '["View Dashboard","Manage Users","Manage Roles","System Settings","View Audit Log"]')
ON CONFLICT (id) DO NOTHING;

-- ── Progress Aggregation Function ──────────────────────────────────────────
CREATE OR REPLACE FUNCTION get_nurse_progress()
RETURNS TABLE(
  profile_id    uuid,
  full_name     text,
  email         text,
  dept_id       text,
  unit_name     text,
  job_title     text,
  assigned      int,
  done          int,
  overdue       int,
  avg_score     int,
  last_activity timestamptz
) LANGUAGE SQL SECURITY DEFINER STABLE AS $$
  SELECT
    p.id,
    p.full_name,
    p.email,
    p.dept_id,
    p.unit_name,
    p.job_title,
    COALESCE(enr.assigned, 0)::int,
    COALESCE(lp.done, 0)::int,
    COALESCE(enr.overdue, 0)::int,
    COALESCE(lp.avg_score, 0)::int,
    COALESCE(lp.last_activity, p.updated_at)
  FROM profiles p
  LEFT JOIN (
    SELECT
      profile_id,
      COUNT(*)::int                                                                          AS assigned,
      COUNT(CASE WHEN due_date < CURRENT_DATE AND status <> 'completed' THEN 1 END)::int   AS overdue
    FROM nurse_enrollments
    GROUP BY profile_id
  ) enr ON enr.profile_id = p.id
  LEFT JOIN (
    SELECT
      profile_id,
      COUNT(DISTINCT CASE WHEN course_pct = 100 THEN course_key END)::int  AS done,
      COALESCE(ROUND(AVG(NULLIF(max_qs, 0)))::int, 0)                      AS avg_score,
      MAX(last_upd)                                                         AS last_activity
    FROM (
      SELECT
        profile_id,
        course_key,
        ROUND(
          COUNT(CASE WHEN completed THEN 1 END)::numeric /
          GREATEST(COUNT(*), 1) * 100
        )::int          AS course_pct,
        MAX(quiz_score) AS max_qs,
        MAX(updated_at) AS last_upd
      FROM lesson_progress
      GROUP BY profile_id, course_key
    ) cs
    GROUP BY profile_id
  ) lp ON lp.profile_id = p.id
  WHERE p.role = 'nurse'
  ORDER BY p.full_name;
$$;

-- ── Department Coverage Function ────────────────────────────────────────────
CREATE OR REPLACE FUNCTION get_dept_coverage()
RETURNS TABLE(
  dept_id    text,
  nurse_count int,
  courses_done int,
  total_possible int,
  coverage_pct int
) LANGUAGE SQL SECURITY DEFINER STABLE AS $$
  SELECT
    p.dept_id,
    COUNT(DISTINCT p.id)::int AS nurse_count,
    COUNT(DISTINCT CASE WHEN lp.completed THEN lp.profile_id || '_' || lp.lesson_key END)::int AS courses_done,
    (COUNT(DISTINCT p.id) * 6)::int AS total_possible,
    CASE
      WHEN COUNT(DISTINCT p.id) = 0 THEN 0
      ELSE ROUND(
        COUNT(DISTINCT CASE WHEN lp.completed THEN lp.profile_id || '_' || lp.lesson_key END)::numeric /
        GREATEST(COUNT(DISTINCT p.id) * 6, 1) * 100
      )::int
    END AS coverage_pct
  FROM profiles p
  LEFT JOIN lesson_progress lp ON lp.profile_id = p.id
  WHERE p.role = 'nurse' AND p.dept_id IS NOT NULL
  GROUP BY p.dept_id;
$$;

-- ── Reports Aggregation Function ────────────────────────────────────────────
CREATE OR REPLACE FUNCTION get_course_completion_stats()
RETURNS TABLE(
  course_id   uuid,
  course_title text,
  enrolled    int,
  completed   int,
  pct         int
) LANGUAGE SQL SECURITY DEFINER STABLE AS $$
  SELECT
    c.id,
    c.title,
    COUNT(DISTINCT ne.profile_id)::int AS enrolled,
    COUNT(DISTINCT CASE WHEN ne.status = 'completed' THEN ne.profile_id END)::int AS completed,
    CASE
      WHEN COUNT(DISTINCT ne.profile_id) = 0 THEN 0
      ELSE ROUND(
        COUNT(DISTINCT CASE WHEN ne.status = 'completed' THEN ne.profile_id END)::numeric /
        GREATEST(COUNT(DISTINCT ne.profile_id), 1) * 100
      )::int
    END AS pct
  FROM courses c
  LEFT JOIN nurse_enrollments ne ON ne.course_id = c.id
  WHERE c.status = 'active'
  GROUP BY c.id, c.title
  ORDER BY enrolled DESC;
$$;
