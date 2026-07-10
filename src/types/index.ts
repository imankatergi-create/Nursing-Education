export type Role = 'superadmin' | 'admin' | 'educator' | 'supervisor' | 'nurse' | 'director' | 'it'

export interface Profile {
  id: string
  email: string
  full_name: string
  role: Role
  dept_id?: string
  unit_name?: string
  employee_id?: string
  job_title?: string
  supervisor_name?: string
  hire_date?: string
  license_number?: string
  specialty?: string
  phone?: string
  employment_status?: string
  account_status?: string
  last_login?: string
  must_change_password?: boolean
}

export interface Department {
  id: string
  name: string
  supervisor?: string
  active: boolean
}

export interface Unit {
  id: string
  dept_id: string
  name: string
  supervisor?: string
}

export interface Course {
  id: string
  title: string
  code: string
  category: string
  audience: string
  duration: string
  level: string
  lang: string
  instructor: string
  prerequisites: string
  thumbnail_color: string
  thumbnail_icon: string
  mandatory: boolean
  status: string
  pass_rule: string
  deadline: string
  objectives: string[]
  completion_rules: string[]
  video_url?: string
  video_filename?: string
  video_size_mb?: number
  video_duration_sec?: number
}

export interface CourseModule {
  id: string
  course_id: string
  title: string
  order_index: number
}

export interface Lesson {
  id: string
  module_id: string
  type: 'video' | 'doc' | 'quiz' | 'eval'
  title: string
  duration_text: string
  requirement: string
  locked_note?: string
  order_index: number
}

export interface Program {
  id: string
  title: string
  code: string
  category: string
  objectives: string
  outcomes: string
  audience: string
  dept_scope: string
  mandatory: boolean
  start_date: string
  end_date: string
  deadline: string
  duration: string
  pass_requirements: string
  certificate_enabled: boolean
  assigned_educators: string
  assigned_supervisors: string
  status: string
}

export interface Material {
  id: string
  title: string
  type: string
  course_id: string
  size_text: string
  latest_version: string
  uploaded_by: string
  upload_date: string
  mandatory: boolean
  downloadable: boolean
  tracking_rule: string
  views: number
  avg_time?: string
  completion_pct: number
}

export interface MaterialVersion {
  id: string
  material_id: string
  version: string
  upload_date: string
  uploaded_by: string
  change_notes: string
  is_active: boolean
}

export interface Quiz {
  id: string
  title: string
  course_id: string
  description: string
  pass_score: number
  time_limit_min: number
  max_attempts: number
  randomize_questions: boolean
  randomize_answers: boolean
  result_display_mode: string
  feedback_timing: string
  certificate_eligible: boolean
  mandatory: boolean
}

export interface QuizQuestion {
  id: string
  quiz_id: string
  type: string
  question: string
  options: string[]
  correct_answer: number | number[] | string
  accept_values: string[]
  explanation: string
  points: number
  difficulty: string
  order_index: number
}

export interface Certificate {
  id: string
  cert_no: string
  profile_id: string
  course_name: string
  issued_at: string
  score_pct: string
  expiry_date: string
  status: string
  verify_code: string
  issued_by: string
}

export interface Notification {
  id: string
  profile_id: string
  recipient_name: string
  type: string
  message: string
  channels: string
  sent_at: string
  read: boolean
}

export interface Announcement {
  id: string
  title: string
  body: string
  audience_type: string
  dept_scope?: string
  priority: string
  start_date: string
  end_date: string
  send_email: boolean
  require_confirmation: boolean
  attachment_name?: string
  sent_count: number
  created_by: string
}

export interface AuditLog {
  id: string
  timestamp: string
  user_name: string
  action: string
  affected_record: string
  ip_address: string
  before_value?: string
  after_value?: string
}

export interface Feedback {
  id: string
  course_name: string
  course_rating: number
  instructor_rating: number
  materials_rating: number
  relevance_rating: number
  difficulty: string
  suggestions: string
}

export interface EmailTemplate {
  id: string
  name: string
  subject: string
  trigger_event: string
  body: string
  dynamic_fields: string
  active: boolean
}

export interface ReminderRule {
  id: string
  rule_name: string
  schedule_detail: string
  channels: string
  enabled: boolean
}

export interface NurseRow {
  id: string
  emp: string
  name: string
  dept: string
  unit: string
  title: string
  sup: string
  hire: string
  status: string
  license: string
  specialty: string
  email: string
  phone: string
  assigned: number
  done: number
  overdue: number
  avg: number
  time: string
  lastLogin: string
  lastAct: string
}

export interface VideoTrackingState {
  status: 'todo' | 'inprog' | 'done'
  watched: number
  pos: string
  views: number
  pauses: number
}

export interface DocTrackingState {
  status: 'todo' | 'inprog' | 'done'
  page: number
  opened: boolean
  readSec: number
  ack: boolean
  views: number
  maxPage: number
}

export interface QuizAttemptState {
  status: 'todo' | 'inprog' | 'done' | 'locked'
  attempts: number
  best: number
  history: Array<{ att: number; pct: number; pass: boolean; time: string; date: string }>
}

export type Screen =
  | 'dashboard' | 'users' | 'roles' | 'depts' | 'programs' | 'courses' | 'syllabus'
  | 'materials' | 'quizzes' | 'assignments' | 'progress' | 'reports' | 'notifications'
  | 'announcements' | 'certificates' | 'feedback' | 'audit' | 'settings' | 'coverage'
  | 'cmssearch'
  | 'ndash' | 'ncourses' | 'ncourse' | 'ncerts' | 'nnotifs' | 'nsearch'

export interface AppState {
  screen: Screen
  params: Record<string, string>
}
