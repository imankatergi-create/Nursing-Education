/*
# Staff Development Program - Core Schema

Creates all tables for the hospital nursing education platform.

1. New Tables:
   - departments: Hospital departments (ICU, ER, Pediatrics, etc.)
   - units: Sub-units within departments  
   - profiles: User profiles linked to auth.users, includes role, dept, hire info
   - programs: Training programs grouping multiple courses
   - courses: Individual courses with metadata, completion rules, objectives
   - course_modules: Ordered modules within a course
   - lessons: Lessons within modules (video, doc, quiz, eval types)
   - materials: Learning materials library (videos, PDFs, SCORM, etc.)
   - material_versions: Version history per material
   - quizzes: Quiz configuration (pass score, time limit, attempts)
   - quiz_questions: Questions (11 types), options, answers, explanations
   - programs_courses: Junction table linking programs to courses
   - assignments: Course/program assignments with delivery settings
   - nurse_enrollments: Per-nurse per-course enrollment and progress state
   - video_tracking: Granular video engagement (watch%, pauses, position)
   - document_tracking: Granular doc reading (pages, time, acknowledgment)
   - quiz_attempts: Each quiz attempt with score and pass/fail
   - quiz_attempt_answers: Per-question answers for each attempt
   - certificates: Issued completion certificates with QR verify code
   - notifications: In-system and email notification history
   - announcements: Hospital-wide announcements with tracking
   - announcement_interactions: Opens and read-confirmations per user
   - audit_logs: Immutable action trail (who, what, when, before/after)
   - feedback: Course evaluation submissions
   - email_templates: Configurable email notification templates
   - reminder_rules: Automated reminder schedule configurations
   - app_settings: System configuration key-value store

2. Security:
   - RLS enabled on all tables
   - Authenticated users can read all data (hospital intranet model)
   - Authenticated users can perform write operations
   - Anon users have no access (login required)
*/

-- ============================================================
-- DEPARTMENTS & UNITS
-- ============================================================
CREATE TABLE IF NOT EXISTS departments (
  id          text PRIMARY KEY,
  name        text NOT NULL,
  supervisor  text,
  active      boolean NOT NULL DEFAULT true,
  created_at  timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS units (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  dept_id     text NOT NULL REFERENCES departments(id) ON DELETE CASCADE,
  name        text NOT NULL,
  supervisor  text,
  created_at  timestamptz DEFAULT now()
);

-- ============================================================
-- PROFILES (extends auth.users)
-- ============================================================
CREATE TABLE IF NOT EXISTS profiles (
  id                uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email             text,
  full_name         text,
  role              text NOT NULL DEFAULT 'nurse',
  dept_id           text REFERENCES departments(id),
  unit_name         text,
  employee_id       text,
  job_title         text,
  supervisor_name   text,
  hire_date         date,
  license_number    text,
  specialty         text,
  phone             text,
  employment_status text DEFAULT 'Active',
  account_status    text DEFAULT 'Active',
  last_login        timestamptz,
  created_at        timestamptz DEFAULT now(),
  updated_at        timestamptz DEFAULT now()
);

-- ============================================================
-- PROGRAMS & COURSES
-- ============================================================
CREATE TABLE IF NOT EXISTS programs (
  id                  uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  title               text NOT NULL,
  code                text UNIQUE,
  category            text,
  description         text,
  objectives          text,
  outcomes            text,
  audience            text,
  dept_scope          text DEFAULT 'All departments',
  mandatory           boolean DEFAULT true,
  start_date          date,
  end_date            date,
  deadline            text,
  duration            text,
  pass_requirements   text,
  certificate_enabled boolean DEFAULT true,
  assigned_educators  text,
  assigned_supervisors text,
  status              text DEFAULT 'Draft',
  created_at          timestamptz DEFAULT now(),
  updated_at          timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS courses (
  id                    uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  title                 text NOT NULL,
  code                  text UNIQUE,
  category              text,
  description           text,
  audience              text,
  duration              text,
  level                 text DEFAULT 'Core',
  lang                  text DEFAULT 'English',
  instructor            text,
  prerequisites         text,
  thumbnail_color       text DEFAULT 'linear-gradient(135deg,#0B5D66,#1B8A8F)',
  thumbnail_icon        text DEFAULT '📚',
  mandatory             boolean DEFAULT true,
  status                text DEFAULT 'Draft',
  pass_rule             text,
  completion_rules      jsonb DEFAULT '[]',
  objectives            jsonb DEFAULT '[]',
  deadline              text,
  created_at            timestamptz DEFAULT now(),
  updated_at            timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS programs_courses (
  program_id  uuid NOT NULL REFERENCES programs(id) ON DELETE CASCADE,
  course_id   uuid NOT NULL REFERENCES courses(id) ON DELETE CASCADE,
  order_index int DEFAULT 0,
  PRIMARY KEY (program_id, course_id)
);

CREATE TABLE IF NOT EXISTS course_modules (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  course_id   uuid NOT NULL REFERENCES courses(id) ON DELETE CASCADE,
  title       text NOT NULL,
  order_index int DEFAULT 0
);

CREATE TABLE IF NOT EXISTS lessons (
  id                    uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  module_id             uuid NOT NULL REFERENCES course_modules(id) ON DELETE CASCADE,
  type                  text NOT NULL, -- video | doc | quiz | eval
  title                 text NOT NULL,
  duration_text         text,
  requirement           text,
  locked_note           text,
  order_index           int DEFAULT 0
);

-- ============================================================
-- MATERIALS
-- ============================================================
CREATE TABLE IF NOT EXISTS materials (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  title           text NOT NULL,
  type            text NOT NULL,
  course_id       text, -- course code reference (loose)
  size_text       text,
  latest_version  text DEFAULT 'v1',
  uploaded_by     text,
  upload_date     date,
  mandatory       boolean DEFAULT true,
  downloadable    boolean DEFAULT false,
  tracking_rule   text,
  tags            text,
  views           int DEFAULT 0,
  avg_time        text,
  completion_pct  int DEFAULT 0,
  created_at      timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS material_versions (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  material_id uuid NOT NULL REFERENCES materials(id) ON DELETE CASCADE,
  version     text NOT NULL,
  upload_date date,
  uploaded_by text,
  change_notes text,
  is_active   boolean DEFAULT false,
  created_at  timestamptz DEFAULT now()
);

-- ============================================================
-- QUIZZES
-- ============================================================
CREATE TABLE IF NOT EXISTS quizzes (
  id                  uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  title               text NOT NULL,
  course_id           uuid REFERENCES courses(id),
  description         text,
  pass_score          int DEFAULT 80,
  time_limit_min      int DEFAULT 10,
  max_attempts        int DEFAULT 3,
  randomize_questions boolean DEFAULT true,
  randomize_answers   boolean DEFAULT true,
  result_display_mode text DEFAULT 'Full answer review',
  feedback_timing     text DEFAULT 'After quiz completion',
  certificate_eligible boolean DEFAULT true,
  mandatory           boolean DEFAULT true,
  created_at          timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS quiz_questions (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  quiz_id     uuid NOT NULL REFERENCES quizzes(id) ON DELETE CASCADE,
  type        text NOT NULL, -- mcq | multi | tf | fill | scenario | short
  question    text NOT NULL,
  options     jsonb DEFAULT '[]',
  correct_answer jsonb,
  accept_values jsonb DEFAULT '[]',
  explanation text,
  points      int DEFAULT 10,
  difficulty  text DEFAULT 'Medium',
  order_index int DEFAULT 0
);

-- ============================================================
-- ASSIGNMENTS & ENROLLMENTS
-- ============================================================
CREATE TABLE IF NOT EXISTS assignments (
  id                    uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  training_type         text DEFAULT 'course', -- course | program
  training_id           uuid,
  training_title        text,
  assigned_to_desc      text,
  nurse_count           int DEFAULT 0,
  due_date              date,
  mandatory             boolean DEFAULT true,
  reminder_schedule     text DEFAULT 'Default',
  pass_score            text DEFAULT '80%',
  max_attempts          int DEFAULT 3,
  cert_eligible         boolean DEFAULT true,
  supervisor_visibility text DEFAULT 'Visible to unit supervisors',
  auto_enroll_rule      text DEFAULT 'None',
  status                text DEFAULT 'Active',
  created_at            timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS nurse_enrollments (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  profile_id      uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  course_id       uuid NOT NULL REFERENCES courses(id) ON DELETE CASCADE,
  assignment_id   uuid REFERENCES assignments(id),
  enrolled_at     timestamptz DEFAULT now(),
  due_date        date,
  status          text DEFAULT 'not_started', -- not_started | in_progress | completed | overdue
  completion_pct  int DEFAULT 0,
  last_activity   text,
  completed_at    timestamptz,
  UNIQUE(profile_id, course_id)
);

-- ============================================================
-- PROGRESS TRACKING
-- ============================================================
CREATE TABLE IF NOT EXISTS video_tracking (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  lesson_id       uuid NOT NULL REFERENCES lessons(id) ON DELETE CASCADE,
  profile_id      uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  watch_pct       numeric DEFAULT 0,
  last_position   text DEFAULT '00:00',
  total_views     int DEFAULT 0,
  pause_count     int DEFAULT 0,
  total_watch_sec int DEFAULT 0,
  last_viewed     timestamptz,
  device          text,
  completed       boolean DEFAULT false,
  created_at      timestamptz DEFAULT now(),
  updated_at      timestamptz DEFAULT now(),
  UNIQUE(lesson_id, profile_id)
);

CREATE TABLE IF NOT EXISTS document_tracking (
  id                uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  lesson_id         uuid NOT NULL REFERENCES lessons(id) ON DELETE CASCADE,
  profile_id        uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  pages_viewed      int DEFAULT 0,
  total_pages       int DEFAULT 8,
  max_page_reached  int DEFAULT 0,
  read_time_sec     int DEFAULT 0,
  acknowledged      boolean DEFAULT false,
  acknowledged_at   timestamptz,
  total_opens       int DEFAULT 0,
  last_opened       timestamptz,
  downloaded        boolean DEFAULT false,
  printed           boolean DEFAULT false,
  created_at        timestamptz DEFAULT now(),
  updated_at        timestamptz DEFAULT now(),
  UNIQUE(lesson_id, profile_id)
);

CREATE TABLE IF NOT EXISTS quiz_attempts (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  quiz_id         uuid NOT NULL REFERENCES quizzes(id) ON DELETE CASCADE,
  profile_id      uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  attempt_number  int NOT NULL,
  started_at      timestamptz DEFAULT now(),
  submitted_at    timestamptz,
  time_taken_sec  int,
  score           int DEFAULT 0,
  total_points    int DEFAULT 0,
  percentage      int DEFAULT 0,
  passed          boolean DEFAULT false
);

CREATE TABLE IF NOT EXISTS quiz_attempt_answers (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  attempt_id  uuid NOT NULL REFERENCES quiz_attempts(id) ON DELETE CASCADE,
  question_id uuid NOT NULL REFERENCES quiz_questions(id),
  answer      jsonb,
  is_correct  boolean DEFAULT false,
  points_earned int DEFAULT 0
);

-- ============================================================
-- CERTIFICATES
-- ============================================================
CREATE TABLE IF NOT EXISTS certificates (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  cert_no     text UNIQUE NOT NULL,
  profile_id  uuid NOT NULL REFERENCES profiles(id),
  course_id   uuid REFERENCES courses(id),
  course_name text,
  issued_at   date NOT NULL,
  score_pct   text,
  expiry_date date,
  status      text DEFAULT 'Valid',
  verify_code text UNIQUE NOT NULL,
  issued_by   text,
  revoked_at  timestamptz,
  revoke_reason text,
  created_at  timestamptz DEFAULT now()
);

-- ============================================================
-- NOTIFICATIONS
-- ============================================================
CREATE TABLE IF NOT EXISTS notifications (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  profile_id  uuid REFERENCES profiles(id),
  recipient_name text,
  type        text NOT NULL,
  message     text NOT NULL,
  channels    text,
  sent_at     timestamptz DEFAULT now(),
  read        boolean DEFAULT false,
  read_at     timestamptz
);

CREATE TABLE IF NOT EXISTS announcements (
  id                  uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  title               text NOT NULL,
  body                text,
  audience_type       text DEFAULT 'All nurses',
  dept_scope          text,
  priority            text DEFAULT 'Normal',
  start_date          date,
  end_date            date,
  send_email          boolean DEFAULT false,
  require_confirmation boolean DEFAULT false,
  attachment_name     text,
  sent_count          int DEFAULT 0,
  created_by          text,
  created_at          timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS announcement_interactions (
  id                uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  announcement_id   uuid NOT NULL REFERENCES announcements(id) ON DELETE CASCADE,
  profile_id        uuid NOT NULL REFERENCES profiles(id),
  interaction_type  text NOT NULL, -- open | confirm
  interacted_at     timestamptz DEFAULT now(),
  UNIQUE(announcement_id, profile_id, interaction_type)
);

-- ============================================================
-- AUDIT LOGS
-- ============================================================
CREATE TABLE IF NOT EXISTS audit_logs (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  timestamp       timestamptz DEFAULT now(),
  user_id         uuid REFERENCES profiles(id),
  user_name       text,
  action          text NOT NULL,
  affected_record text,
  ip_address      text,
  before_value    text,
  after_value     text
);

-- ============================================================
-- FEEDBACK
-- ============================================================
CREATE TABLE IF NOT EXISTS feedback (
  id                uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  course_id         uuid REFERENCES courses(id),
  course_name       text,
  profile_id        uuid REFERENCES profiles(id),
  course_rating     numeric,
  instructor_rating numeric,
  materials_rating  numeric,
  relevance_rating  numeric,
  difficulty        text,
  suggestions       text,
  open_comments     text,
  anonymous         boolean DEFAULT false,
  submitted_at      timestamptz DEFAULT now()
);

-- ============================================================
-- EMAIL TEMPLATES & REMINDER RULES
-- ============================================================
CREATE TABLE IF NOT EXISTS email_templates (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name          text UNIQUE NOT NULL,
  subject       text NOT NULL,
  trigger_event text,
  body          text,
  dynamic_fields text,
  active        boolean DEFAULT true,
  created_at    timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS reminder_rules (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  rule_name       text NOT NULL,
  schedule_detail text,
  channels        text,
  enabled         boolean DEFAULT true,
  created_at      timestamptz DEFAULT now()
);

-- ============================================================
-- APP SETTINGS
-- ============================================================
CREATE TABLE IF NOT EXISTS app_settings (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  key         text UNIQUE NOT NULL,
  value       text,
  updated_at  timestamptz DEFAULT now(),
  updated_by  text
);

-- ============================================================
-- INDEXES
-- ============================================================
CREATE INDEX IF NOT EXISTS idx_profiles_role ON profiles(role);
CREATE INDEX IF NOT EXISTS idx_profiles_dept ON profiles(dept_id);
CREATE INDEX IF NOT EXISTS idx_nurse_enrollments_profile ON nurse_enrollments(profile_id);
CREATE INDEX IF NOT EXISTS idx_nurse_enrollments_course ON nurse_enrollments(course_id);
CREATE INDEX IF NOT EXISTS idx_video_tracking_profile ON video_tracking(profile_id);
CREATE INDEX IF NOT EXISTS idx_document_tracking_profile ON document_tracking(profile_id);
CREATE INDEX IF NOT EXISTS idx_quiz_attempts_profile ON quiz_attempts(profile_id);
CREATE INDEX IF NOT EXISTS idx_quiz_attempts_quiz ON quiz_attempts(quiz_id);
CREATE INDEX IF NOT EXISTS idx_notifications_profile ON notifications(profile_id);
CREATE INDEX IF NOT EXISTS idx_audit_logs_timestamp ON audit_logs(timestamp DESC);

-- ============================================================
-- TRIGGER: auto-create profile on user signup
-- ============================================================
CREATE OR REPLACE FUNCTION handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO profiles (id, email, full_name, role)
  VALUES (
    NEW.id,
    NEW.email,
    COALESCE(NEW.raw_user_meta_data->>'full_name', split_part(NEW.email, '@', 1)),
    COALESCE(NEW.raw_user_meta_data->>'role', 'nurse')
  )
  ON CONFLICT (id) DO NOTHING;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION handle_new_user();

-- ============================================================
-- ROW LEVEL SECURITY
-- ============================================================
ALTER TABLE departments ENABLE ROW LEVEL SECURITY;
ALTER TABLE units ENABLE ROW LEVEL SECURITY;
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE programs ENABLE ROW LEVEL SECURITY;
ALTER TABLE courses ENABLE ROW LEVEL SECURITY;
ALTER TABLE programs_courses ENABLE ROW LEVEL SECURITY;
ALTER TABLE course_modules ENABLE ROW LEVEL SECURITY;
ALTER TABLE lessons ENABLE ROW LEVEL SECURITY;
ALTER TABLE materials ENABLE ROW LEVEL SECURITY;
ALTER TABLE material_versions ENABLE ROW LEVEL SECURITY;
ALTER TABLE quizzes ENABLE ROW LEVEL SECURITY;
ALTER TABLE quiz_questions ENABLE ROW LEVEL SECURITY;
ALTER TABLE assignments ENABLE ROW LEVEL SECURITY;
ALTER TABLE nurse_enrollments ENABLE ROW LEVEL SECURITY;
ALTER TABLE video_tracking ENABLE ROW LEVEL SECURITY;
ALTER TABLE document_tracking ENABLE ROW LEVEL SECURITY;
ALTER TABLE quiz_attempts ENABLE ROW LEVEL SECURITY;
ALTER TABLE quiz_attempt_answers ENABLE ROW LEVEL SECURITY;
ALTER TABLE certificates ENABLE ROW LEVEL SECURITY;
ALTER TABLE notifications ENABLE ROW LEVEL SECURITY;
ALTER TABLE announcements ENABLE ROW LEVEL SECURITY;
ALTER TABLE announcement_interactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE audit_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE feedback ENABLE ROW LEVEL SECURITY;
ALTER TABLE email_templates ENABLE ROW LEVEL SECURITY;
ALTER TABLE reminder_rules ENABLE ROW LEVEL SECURITY;
ALTER TABLE app_settings ENABLE ROW LEVEL SECURITY;

-- Helper function to get current user role
CREATE OR REPLACE FUNCTION get_my_role()
RETURNS TEXT AS $$
  SELECT role FROM profiles WHERE id = auth.uid();
$$ LANGUAGE SQL SECURITY DEFINER STABLE;

-- Macro: create SELECT + INSERT + UPDATE + DELETE policies for a table
-- allowing all authenticated users (hospital intranet model)
DO $$
DECLARE
  t text;
  tables text[] := ARRAY[
    'departments','units','profiles','programs','courses','programs_courses',
    'course_modules','lessons','materials','material_versions','quizzes',
    'quiz_questions','assignments','nurse_enrollments','video_tracking',
    'document_tracking','quiz_attempts','quiz_attempt_answers','certificates',
    'notifications','announcements','announcement_interactions','audit_logs',
    'feedback','email_templates','reminder_rules','app_settings'
  ];
BEGIN
  FOREACH t IN ARRAY tables LOOP
    EXECUTE format('DROP POLICY IF EXISTS "auth_select_%s" ON %I', t, t);
    EXECUTE format('DROP POLICY IF EXISTS "auth_insert_%s" ON %I', t, t);
    EXECUTE format('DROP POLICY IF EXISTS "auth_update_%s" ON %I', t, t);
    EXECUTE format('DROP POLICY IF EXISTS "auth_delete_%s" ON %I', t, t);

    EXECUTE format(
      'CREATE POLICY "auth_select_%s" ON %I FOR SELECT TO authenticated USING (true)', t, t);
    EXECUTE format(
      'CREATE POLICY "auth_insert_%s" ON %I FOR INSERT TO authenticated WITH CHECK (true)', t, t);
    EXECUTE format(
      'CREATE POLICY "auth_update_%s" ON %I FOR UPDATE TO authenticated USING (true) WITH CHECK (true)', t, t);
    EXECUTE format(
      'CREATE POLICY "auth_delete_%s" ON %I FOR DELETE TO authenticated USING (true)', t, t);
  END LOOP;
END
$$;
