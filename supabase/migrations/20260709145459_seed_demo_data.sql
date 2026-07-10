/*
# Staff Development Program - Demo Data Seed (corrected UUIDs)

Seeds all demo data. All UUIDs use valid hex characters only.
Demo password for all accounts: Demo1234!
*/

-- ============================================================
-- DEMO AUTH USERS
-- ============================================================
DO $$
DECLARE
  uid_superadmin uuid := '11111111-1111-1111-1111-111111111111';
  uid_admin      uuid := '22222222-2222-2222-2222-222222222222';
  uid_educator   uuid := '33333333-3333-3333-3333-333333333333';
  uid_supervisor uuid := '44444444-4444-4444-4444-444444444444';
  uid_nurse      uuid := '55555555-5555-5555-5555-555555555555';
  uid_director   uuid := '66666666-6666-6666-6666-666666666666';
  uid_it         uuid := '77777777-7777-7777-7777-777777777777';
BEGIN
  INSERT INTO auth.users (instance_id, id, aud, role, email, encrypted_password,
    email_confirmed_at, raw_app_meta_data, raw_user_meta_data,
    is_super_admin, created_at, updated_at, confirmation_token,
    email_change, email_change_token_new, recovery_token)
  SELECT '00000000-0000-0000-0000-000000000000', u.id, 'authenticated', 'authenticated',
    u.email, crypt('Demo1234!', gen_salt('bf', 10)), now(),
    '{"provider":"email","providers":["email"]}'::jsonb, u.meta::jsonb,
    false, now(), now(), '', '', '', ''
  FROM (VALUES
    (uid_superadmin::uuid, 's.haddad@hospital.org',   '{"full_name":"Sami Haddad","role":"superadmin"}'::text),
    (uid_admin::uuid,      'f.nassar@hospital.org',    '{"full_name":"Farah Nassar","role":"admin"}'),
    (uid_educator::uuid,   'l.khoury@hospital.org',    '{"full_name":"Dr. Lina Khoury","role":"educator"}'),
    (uid_supervisor::uuid, 'h.mansour@hospital.org',   '{"full_name":"Hala Mansour","role":"supervisor"}'),
    (uid_nurse::uuid,      'r.khalil@hospital.org',    '{"full_name":"Rana Khalil","role":"nurse"}'),
    (uid_director::uuid,   'm.arnaout@hospital.org',   '{"full_name":"Mona Arnaout","role":"director"}'),
    (uid_it::uuid,         'o.sleiman@hospital.org',   '{"full_name":"Omar Sleiman","role":"it"}')
  ) AS u(id, email, meta)
  WHERE NOT EXISTS (SELECT 1 FROM auth.users au WHERE au.id = u.id);

  INSERT INTO auth.identities (id, provider_id, user_id, identity_data, provider, last_sign_in_at, created_at, updated_at)
  SELECT gen_random_uuid(), u.email, u.id,
    jsonb_build_object('sub', u.id::text, 'email', u.email), 'email', now(), now(), now()
  FROM (VALUES
    (uid_superadmin::uuid, 's.haddad@hospital.org'),
    (uid_admin::uuid,      'f.nassar@hospital.org'),
    (uid_educator::uuid,   'l.khoury@hospital.org'),
    (uid_supervisor::uuid, 'h.mansour@hospital.org'),
    (uid_nurse::uuid,      'r.khalil@hospital.org'),
    (uid_director::uuid,   'm.arnaout@hospital.org'),
    (uid_it::uuid,         'o.sleiman@hospital.org')
  ) AS u(id, email)
  WHERE NOT EXISTS (SELECT 1 FROM auth.identities ai WHERE ai.user_id = u.id AND ai.provider = 'email');
END $$;

-- ============================================================
-- DEPARTMENTS
-- ============================================================
INSERT INTO departments (id, name, supervisor) VALUES
  ('ICU','Intensive Care Unit','Hala Mansour'),
  ('ER','Emergency Room','Samer Itani'),
  ('PED','Pediatrics','Dana Hoteit'),
  ('OR','Operating Room','Rima Saad'),
  ('MED','Medical Ward','Nour Fakih'),
  ('SUR','Surgical Ward','Ali Zein'),
  ('OPD','Outpatient Department','Maya Chami'),
  ('IC','Infection Control','Dr. Lina Khoury')
ON CONFLICT (id) DO NOTHING;

-- ============================================================
-- UNITS
-- ============================================================
INSERT INTO units (dept_id, name) VALUES
  ('ICU','ICU-A'), ('ICU','ICU-B'),
  ('ER','ER Triage'), ('ER','ER Observation'),
  ('PED','Peds Ward'), ('PED','NICU'),
  ('OR','OR Main'), ('OR','Recovery'),
  ('MED','Med 3F'), ('MED','Med 4F'),
  ('SUR','Surg 5F'), ('OPD','OPD Clinics'), ('IC','IC Office')
ON CONFLICT DO NOTHING;

-- ============================================================
-- PROFILES
-- ============================================================
INSERT INTO profiles (id, email, full_name, role, dept_id, unit_name, employee_id, job_title, supervisor_name, hire_date, license_number, specialty, phone, employment_status)
VALUES
  ('11111111-1111-1111-1111-111111111111','s.haddad@hospital.org','Sami Haddad','superadmin',NULL,NULL,'U-001','System Owner',NULL,NULL,NULL,NULL,NULL,'Active'),
  ('22222222-2222-2222-2222-222222222222','f.nassar@hospital.org','Farah Nassar','admin',NULL,NULL,'U-002','SDP Coordinator',NULL,NULL,NULL,NULL,NULL,'Active'),
  ('33333333-3333-3333-3333-333333333333','l.khoury@hospital.org','Dr. Lina Khoury','educator','IC','IC Office','U-003','Staff Development Educator',NULL,NULL,NULL,NULL,NULL,'Active'),
  ('44444444-4444-4444-4444-444444444444','h.mansour@hospital.org','Hala Mansour','supervisor','ICU','ICU-A','U-004','Head Nurse — ICU',NULL,NULL,NULL,NULL,NULL,'Active'),
  ('55555555-5555-5555-5555-555555555555','r.khalil@hospital.org','Rana Khalil','nurse','ICU','ICU-A','N-1042','Staff Nurse','Hala Mansour','2023-05-14','RN-88231','Critical Care','+961 3 555 210','Active'),
  ('66666666-6666-6666-6666-666666666666','m.arnaout@hospital.org','Mona Arnaout','director',NULL,NULL,'U-006','Director of Nursing',NULL,NULL,NULL,NULL,NULL,'Active'),
  ('77777777-7777-7777-7777-777777777777','o.sleiman@hospital.org','Omar Sleiman','it',NULL,NULL,'U-007','Systems Support',NULL,NULL,NULL,NULL,NULL,'Active')
ON CONFLICT (id) DO UPDATE SET
  email = EXCLUDED.email, full_name = EXCLUDED.full_name, role = EXCLUDED.role,
  dept_id = EXCLUDED.dept_id, unit_name = EXCLUDED.unit_name, employee_id = EXCLUDED.employee_id,
  job_title = EXCLUDED.job_title, supervisor_name = EXCLUDED.supervisor_name,
  hire_date = EXCLUDED.hire_date, license_number = EXCLUDED.license_number,
  specialty = EXCLUDED.specialty, phone = EXCLUDED.phone, employment_status = EXCLUDED.employment_status;

-- ============================================================
-- COURSES (valid hex UUIDs)
-- ============================================================
INSERT INTO courses (id, title, code, category, audience, duration, level, lang, instructor, prerequisites,
    thumbnail_color, thumbnail_icon, mandatory, status, pass_rule, deadline, objectives, completion_rules)
VALUES
  ('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa','Hand Hygiene & Infection Control','IC-101','Infection control','All nurses','2h 30m','Core','English / العربية','Dr. Lina Khoury','None',
   'linear-gradient(135deg,#0B5D66,#1B8A8F)','🧼',true,'Published','Quiz ≥ 80%','2026-07-20',
   '["Apply WHO 5 Moments of hand hygiene","Select correct PPE per isolation type","Comply with hospital infection control policy IC-P-04"]'::jsonb,
   '["Watch required video (≥90%)","Read & acknowledge policy document","Pass quiz (≥80%)","Complete course evaluation"]'::jsonb),
  ('bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb','Fire Safety & Emergency Codes','ES-110','Emergency response','All nurses','1h 45m','Core','English','Safety Office','None',
   'linear-gradient(135deg,#B3432B,#D9764A)','🚨',true,'Published','Quiz ≥ 80%','2026-08-15','[]','[]'),
  ('cccccccc-cccc-cccc-cccc-cccccccccccc','High-Alert Medication Safety','MS-204','Medication safety','All nurses','3h','Intermediate','English','Pharmacy / Dr. Khoury','IC-101',
   'linear-gradient(135deg,#B97A25,#D9A34A)','💊',true,'Published','Quiz ≥ 80%','2026-09-30','[]','[]'),
  ('dddddddd-dddd-dddd-dddd-dddddddddddd','New Nurse Orientation — Hospital Systems','NNO-100','New nurse orientation','New hires','6h','Core','English / العربية','Nursing Education','None',
   'linear-gradient(135deg,#2B5FA3,#4E86C9)','🏥',true,'Published','Pass all modules','30 days from hire','[]','[]'),
  ('eeeeeeee-eeee-eeee-eeee-eeeeeeeeeeee','ICU: Sepsis Bundle & Early Recognition','ICU-310','ICU training','ICU nurses','4h','Advanced','English','Dr. Lina Khoury','IC-101, MS-204',
   'linear-gradient(135deg,#4B2E83,#7E5BB5)','🫀',false,'Published','Quiz ≥ 85%','2026-11-30','[]','[]'),
  ('ffffffff-ffff-ffff-ffff-ffffffffffff','Falls Prevention Update 2026','PS-115','Patient safety','All nurses','1h','Core','English','Quality Dept.','None',
   'linear-gradient(135deg,#2E7D5B,#55A87F)','🛡️',true,'Draft','Quiz ≥ 80%','—','[]','[]')
ON CONFLICT (id) DO NOTHING;

-- ============================================================
-- COURSE MODULES & LESSONS for IC-101
-- ============================================================
INSERT INTO course_modules (id, course_id, title, order_index) VALUES
  ('a1a1a1a1-a1a1-a1a1-a1a1-a1a1a1a1a1a1','aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa','Module 1 — Fundamentals',1),
  ('a2a2a2a2-a2a2-a2a2-a2a2-a2a2a2a2a2a2','aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa','Module 2 — Assessment',2)
ON CONFLICT (id) DO NOTHING;

INSERT INTO lessons (id, module_id, type, title, duration_text, requirement, locked_note, order_index) VALUES
  ('b1b1b1b1-b1b1-b1b1-b1b1-b1b1b1b1b1b1','a1a1a1a1-a1a1-a1a1-a1a1-a1a1a1a1a1a1','video','WHO 5 Moments of Hand Hygiene','12:30','Watch ≥ 90%',NULL,1),
  ('b2b2b2b2-b2b2-b2b2-b2b2-b2b2b2b2b2b2','a1a1a1a1-a1a1-a1a1-a1a1-a1a1a1a1a1a1','doc','Policy IC-P-04: Hand Hygiene & PPE','8 pages','Read all pages + acknowledge',NULL,2),
  ('b3b3b3b3-b3b3-b3b3-b3b3-b3b3b3b3b3b3','a2a2a2a2-a2a2-a2a2-a2a2-a2a2a2a2a2a2','quiz','Infection Control Competency Quiz','10 questions','Score ≥ 80% · max 3 attempts','Unlocks after video & document',3),
  ('b4b4b4b4-b4b4-b4b4-b4b4-b4b4b4b4b4b4','a2a2a2a2-a2a2-a2a2-a2a2-a2a2a2a2a2a2','eval','Course Evaluation Form','2 min','Submit feedback',NULL,4)
ON CONFLICT (id) DO NOTHING;

-- ============================================================
-- QUIZ (valid hex UUID: 9s and 0s only)
-- ============================================================
INSERT INTO quizzes (id, title, course_id, description, pass_score, time_limit_min, max_attempts,
  randomize_questions, randomize_answers, result_display_mode, feedback_timing, certificate_eligible, mandatory)
VALUES ('09090909-0909-0909-0909-090909090909','Infection Control Competency Quiz',
  'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
  'Validates core hand hygiene and PPE knowledge.',80,10,3,true,true,'Full answer review','After quiz completion',true,true)
ON CONFLICT (id) DO NOTHING;

INSERT INTO quiz_questions (quiz_id, type, question, options, correct_answer, accept_values, explanation, points, difficulty, order_index)
VALUES
  ('09090909-0909-0909-0909-090909090909','mcq',
   'According to the WHO 5 Moments, when must hand hygiene be performed?',
   '["Only before touching a patient","Before touching a patient, before aseptic tasks, after body fluid exposure, after touching a patient, and after touching patient surroundings","Only after removing gloves","Once at the start of each shift"]',
   '1','[]','All five WHO moments apply — gloves never replace hand hygiene.',10,'Easy',1),
  ('09090909-0909-0909-0909-090909090909','tf',
   'Wearing gloves eliminates the need for hand hygiene.',
   '["True","False"]','1','[]',
   'Gloves reduce but do not eliminate contamination; hygiene is required before and after glove use.',10,'Easy',2),
  ('09090909-0909-0909-0909-090909090909','mcq',
   'The minimum duration for alcohol-based hand rub is:',
   '["5–10 seconds","20–30 seconds","60 seconds","2 minutes"]','1','[]',
   'WHO recommends 20–30 seconds for alcohol-based rub.',10,'Medium',3),
  ('09090909-0909-0909-0909-090909090909','multi',
   'Select ALL items that are part of contact-isolation PPE for MDRO patients:',
   '["Gown","Gloves","N95 respirator (routine)","Eye protection when splashing is expected"]',
   '[0,1,3]','[]','N95 is for airborne precautions, not routine contact isolation.',10,'Medium',4),
  ('09090909-0909-0909-0909-090909090909','fill',
   'Per policy IC-P-04, visibly soiled hands must be washed with soap and water for at least ____ seconds.',
   '[]','"40"','["40","40-60","forty"]',
   'Soap-and-water wash: 40–60 seconds when hands are visibly soiled.',10,'Medium',5),
  ('09090909-0909-0909-0909-090909090909','scenario',
   'Scenario: You finish emptying a urinary catheter bag, remove your gloves, and are immediately called to an adjacent bed to silence a pump alarm. What do you do first?',
   '["Silence the alarm first — it is urgent","Perform hand hygiene, then attend the alarm","Put on new gloves and attend the alarm","Ask a colleague to disinfect your hands later"]',
   '1','[]',
   'Moment 3 (after body-fluid exposure risk) requires hygiene before any other patient contact.',10,'Hard',6)
ON CONFLICT DO NOTHING;

-- ============================================================
-- PROGRAMS
-- ============================================================
INSERT INTO programs (title, code, category, objectives, outcomes, audience, dept_scope, mandatory, start_date, end_date, deadline, duration, pass_requirements, certificate_enabled, assigned_educators, assigned_supervisors, status)
VALUES
  ('Mandatory Annual Training 2026','MAT-2026','Mandatory annual training','Ensure all nursing staff complete hospital-mandated annual competencies.','Compliance with accreditation standards; validated core competencies.','All nurses','All departments',true,'2026-01-01','2026-12-31','2026-09-30','12h','80% on all quizzes',true,'Dr. Lina Khoury','All head nurses','Published'),
  ('New Nurse Orientation','NNO-01','New nurse orientation','Onboard newly hired nurses to hospital policies, systems and safety culture.','New hires ready for independent supervised practice.','New hires','All departments',true,'2026-01-01','2026-12-31','30 days from hire','20h','Pass all module quizzes',true,'Dr. Lina Khoury','Unit head nurses','Published'),
  ('ICU Clinical Competency Track','ICU-CT-3','ICU training','Advance ICU nurses through ventilator, sepsis and hemodynamics competencies.','Validated ICU clinical competency level 3.','ICU nurses','ICU',false,'2026-03-01','2026-11-30','2026-11-30','16h','85% + supervisor approval',true,'Dr. Lina Khoury','Hala Mansour','Published'),
  ('Medication Safety Update Q3','MSU-Q3','Medication safety','Communicate Q3 high-alert medication policy updates.','Reduced medication administration errors.','All nurses','All departments',true,'2026-08-01','2026-10-31','2026-10-15','3h','80%',false,'Dr. Lina Khoury','All head nurses','Pending approval'),
  ('Leadership Foundations for Charge Nurses','LEAD-1','Nursing leadership','Build core leadership and delegation skills.','Pipeline of unit leadership candidates.','Charge nurses','All departments',false,'2026-09-01','2026-12-15','2026-12-15','10h','Completion',true,'Mona Arnaout','—','Draft')
ON CONFLICT (code) DO NOTHING;

-- ============================================================
-- MATERIALS
-- ============================================================
INSERT INTO materials (title, type, course_id, size_text, latest_version, uploaded_by, upload_date, mandatory, downloadable, tracking_rule, views, avg_time, completion_pct)
VALUES
  ('WHO 5 Moments of Hand Hygiene (Video)','Video','IC-101','184 MB · 12:30','v3','Dr. L. Khoury','2026-05-02',true,false,'Watch % required (90%)',412,'11:40',88),
  ('Policy IC-P-04: Hand Hygiene & PPE','PDF','IC-101','1.2 MB · 8 pages','v5','Infection Control','2026-04-18',true,true,'Read all pages + acknowledgment',389,'9m 20s',83),
  ('High-Alert Medications — LASA List','PDF','MS-204','860 KB · 5 pages','v2','Pharmacy','2026-06-01',true,true,'Open + acknowledgment',210,'6m 05s',71),
  ('Code Red Response — Slide Deck','PowerPoint','ES-110','14 MB · 28 slides','v1','Safety Office','2026-02-11',true,false,'Open tracking',301,'12m',79),
  ('Sepsis Hour-1 Bundle Checklist','Form / Checklist','ICU-310','240 KB','v2','Dr. L. Khoury','2026-03-30',false,true,'Download tracking',96,NULL,64),
  ('NG Tube Insertion — Skills Demo (Video)','Video','NNO-100','96 MB · 8:15','v1','Media Team','2026-01-20',true,false,'Watch % required (100%)',44,'8:02',91),
  ('Hospital Orientation Handbook','Word document','NNO-100','3.4 MB · 42 pages','v6','HR / Nursing Ed.','2026-01-05',true,true,'Open + reading time',52,'31m',76),
  ('External link: WHO Hand Hygiene Portal','External link','IC-101','—','—','Dr. L. Khoury','2026-05-02',false,false,'Click tracking',120,NULL,0),
  ('Ventilator Alarms — SCORM Package','SCORM','ICU-310','52 MB','v1','Vendor','2026-04-12',false,false,'SCORM completion',38,'22m',58),
  ('Falls Risk Audio Briefing (5 min)','Audio','PS-115','6 MB · 5:10','v1','Quality Dept.','2026-06-20',false,false,'Listen % tracking',12,'4:50',80)
ON CONFLICT DO NOTHING;

DO $$
DECLARE m1 uuid; m2 uuid; m3 uuid;
BEGIN
  SELECT id INTO m1 FROM materials WHERE title = 'WHO 5 Moments of Hand Hygiene (Video)' LIMIT 1;
  SELECT id INTO m2 FROM materials WHERE title = 'Policy IC-P-04: Hand Hygiene & PPE' LIMIT 1;
  SELECT id INTO m3 FROM materials WHERE title = 'High-Alert Medications — LASA List' LIMIT 1;
  IF m1 IS NOT NULL THEN
    INSERT INTO material_versions (material_id, version, upload_date, uploaded_by, change_notes, is_active) VALUES
      (m1,'v3','2026-05-02','Dr. L. Khoury','Re-recorded with Arabic captions',true),
      (m1,'v2','2025-11-10','Dr. L. Khoury','Updated WHO poster reference',false),
      (m1,'v1','2024-09-01','Media Team','Initial upload',false)
    ON CONFLICT DO NOTHING;
  END IF;
  IF m2 IS NOT NULL THEN
    INSERT INTO material_versions (material_id, version, upload_date, uploaded_by, change_notes, is_active) VALUES
      (m2,'v5','2026-04-18','Infection Control','Annual review — glove reuse clause removed',true),
      (m2,'v4','2025-04-15','Infection Control','2025 annual review',false)
    ON CONFLICT DO NOTHING;
  END IF;
  IF m3 IS NOT NULL THEN
    INSERT INTO material_versions (material_id, version, upload_date, uploaded_by, change_notes, is_active) VALUES
      (m3,'v2','2026-06-01','Pharmacy','Added 4 new LASA pairs',true)
    ON CONFLICT DO NOTHING;
  END IF;
END $$;

-- ============================================================
-- CERTIFICATES
-- ============================================================
INSERT INTO certificates (cert_no, profile_id, course_name, issued_at, score_pct, expiry_date, status, verify_code, issued_by)
VALUES
  ('CERT-2026-0412','55555555-5555-5555-5555-555555555555','Hand Hygiene & Infection Control','2026-06-14','92%','2027-06-14','Valid','VF-8821','Mona Arnaout'),
  ('CERT-2026-0398','55555555-5555-5555-5555-555555555555','Fire Safety & Emergency Codes','2026-06-11','97%','2027-06-11','Valid','VF-8790','Mona Arnaout'),
  ('CERT-2026-0377','55555555-5555-5555-5555-555555555555','Triage Essentials','2026-05-28','91%','2027-05-28','Valid','VF-8712','Mona Arnaout'),
  ('CERT-2025-0290','44444444-4444-4444-4444-444444444444','BLS Recertification','2025-08-02','88%','2026-08-02','Expiring soon','VF-7011','Mona Arnaout'),
  ('CERT-2024-0141','33333333-3333-3333-3333-333333333333','Falls Prevention 2024','2024-10-12','84%','2025-10-12','Expired','VF-5520','Mona Arnaout')
ON CONFLICT (cert_no) DO NOTHING;

-- ============================================================
-- NOTIFICATIONS
-- ============================================================
INSERT INTO notifications (profile_id, recipient_name, type, message, channels, sent_at, read)
VALUES
  ('55555555-5555-5555-5555-555555555555','Rana Khalil','Upcoming deadline','"Hand Hygiene & Infection Control" is due on 20 Jul 2026 — 13 days left.','Email + In-system','2026-07-07 08:00',false),
  ('55555555-5555-5555-5555-555555555555','Rana Khalil','New material added','A new version of Policy IC-P-04 (v5) was published in your assigned course.','In-system','2026-07-05 14:20',false),
  ('55555555-5555-5555-5555-555555555555','Rana Khalil','Quiz completed','You passed "Emergency Codes Quiz" with 88%. Certificate available.','Email + In-system','2026-06-30 11:12',true),
  ('44444444-4444-4444-4444-444444444444','Hala Mansour','Supervisor alert','2 nurses in ICU have overdue mandatory training: Aya Merhi (2), Karim Awada (1).','Email + Dashboard alert','2026-07-07 07:00',false),
  ('22222222-2222-2222-2222-222222222222','Farah Nassar','Administrator alert','Course "High-Alert Medication Safety" completion is 32% — below the 50% mid-period target.','Email','2026-07-06 07:00',true),
  ('55555555-5555-5555-5555-555555555555','Rana Khalil','Overdue course reminder','"High-Alert Medication Safety" was due 30 Jun 2026. Your supervisor has been notified.','Email + In-system','2026-07-01 09:00',false)
ON CONFLICT DO NOTHING;

-- ============================================================
-- ANNOUNCEMENTS
-- ============================================================
INSERT INTO announcements (title, body, audience_type, priority, start_date, end_date, send_email, require_confirmation, attachment_name, sent_count, created_by)
VALUES
  ('New PPE donning stations installed in ICU & ER','New PPE donning stations have been installed at the entrance of ICU-A, ICU-B and ER Triage.','ICU, ER','High','2026-07-01','2026-07-31',true,true,'Station map (PDF)',78,'Farah Nassar'),
  ('Q3 Medication Safety Update goes live 1 Aug','The Q3 Medication Safety Update course will go live on 1 August 2026.','All nurses','Normal','2026-07-05','2026-08-05',true,false,NULL,248,'Farah Nassar'),
  ('JCI mock survey week — 14–18 Sep','JCI accreditation mock survey will take place 14–18 September.','All departments','High','2026-06-20','2026-09-18',false,true,'Readiness checklist',248,'Farah Nassar')
ON CONFLICT DO NOTHING;

-- ============================================================
-- AUDIT LOGS
-- ============================================================
INSERT INTO audit_logs (timestamp, user_name, action, affected_record, ip_address, before_value, after_value)
VALUES
  ('2026-07-07 08:41','Farah Nassar (Administrator)','Report exported','Compliance report — Excel','10.20.4.18',NULL,NULL),
  ('2026-07-07 08:12','Rana Khalil (Nurse)','User login','Nurse portal','10.20.7.102',NULL,NULL),
  ('2026-07-06 16:30','Dr. Lina Khoury (Educator)','Material changed','Policy IC-P-04 → v5','10.20.4.31','v4','v5 (glove reuse clause removed)'),
  ('2026-07-06 15:58','Farah Nassar (Administrator)','Course published','High-Alert Medication Safety (MS-204)','10.20.4.18','Pending review','Published'),
  ('2026-07-06 15:41','Sami Haddad (Super Admin)','User role changed','Karim Awada','10.20.1.5','Nurse','Nurse + Charge Nurse'),
  ('2026-07-05 11:20','System','Notification sent','Deadline reminder x61 (MAT-2026)','—',NULL,NULL),
  ('2026-07-05 09:03','Unknown (u: k.awada)','Failed login attempt','3rd failure - account locked 15 min','10.20.7.140',NULL,NULL),
  ('2026-07-04 14:12','Omar Sleiman (IT)','Settings changed','Session timeout','10.20.2.9','30 min','20 min'),
  ('2026-07-04 10:44','Farah Nassar (Administrator)','Certificate issued','CERT-2026-0412 — Jana Saab','10.20.4.18',NULL,NULL),
  ('2026-07-03 09:30','Dr. Lina Khoury (Educator)','Quiz edited','Infection Control Competency Quiz','10.20.4.31',NULL,'Added 1 scenario question')
ON CONFLICT DO NOTHING;

-- ============================================================
-- FEEDBACK
-- ============================================================
INSERT INTO feedback (course_name, course_rating, instructor_rating, materials_rating, relevance_rating, difficulty, suggestions)
VALUES
  ('Hand Hygiene & Infection Control',4.6,4.8,4.5,4.9,'Appropriate','Video with Arabic captions was very helpful. Quiz scenario questions felt realistic. Please add a printable pocket card.'),
  ('High-Alert Medication Safety',4.1,4.4,3.8,4.7,'Slightly hard','LASA list should be searchable. More case examples for insulin please.'),
  ('Fire Safety & Emergency Codes',4.4,4.3,4.4,4.6,'Appropriate','Slide deck is clear. Add a floor-plan walkthrough video.')
ON CONFLICT DO NOTHING;

-- ============================================================
-- EMAIL TEMPLATES
-- ============================================================
INSERT INTO email_templates (name, subject, trigger_event, body, dynamic_fields)
VALUES
  ('New assignment','New training assigned: {{course_name}}','On course assignment','Dear {{nurse_name}},\n\nYou have been assigned the course "{{course_name}}" due on {{due_date}}.','{{nurse_name}}, {{course_name}}, {{due_date}}, {{login_link}}'),
  ('Deadline reminder','Reminder: {{course_name}} due {{due_date}}','7 / 3 / 1 days before deadline','Dear {{nurse_name}},\n\nYour course "{{course_name}}" is due on {{due_date}}.','{{nurse_name}}, {{course_name}}, {{due_date}}, {{completion_percentage}}'),
  ('Overdue notice','Overdue: {{course_name}}','Day after deadline, then weekly','Dear {{nurse_name}},\n\nYour course "{{course_name}}" is now overdue.','{{nurse_name}}, {{course_name}}, {{supervisor_name}}, {{department}}'),
  ('Quiz result','Your result for {{course_name}}: {{quiz_score}}','On quiz submission','Dear {{nurse_name}},\n\nYour quiz result for "{{course_name}}" is {{quiz_score}}.','{{nurse_name}}, {{quiz_score}}, {{login_link}}'),
  ('Certificate issued','Certificate: {{course_name}}','On course completion','Dear {{nurse_name}},\n\nCongratulations! Your certificate for "{{course_name}}" has been issued.','{{nurse_name}}, {{course_name}}, {{hospital_name}}'),
  ('Supervisor overdue alert','{{department}}: nurses with overdue training','Weekly (Mon 07:00)','Dear {{supervisor_name}},\n\nThe following nurses in {{department}} have overdue training.','{{supervisor_name}}, {{department}}, overdue list'),
  ('Admin low-completion alert','Low completion alert: {{course_name}}','When completion drops below target','Dear Administrator,\n\nCourse "{{course_name}}" completion is {{completion_percentage}} — below target.','{{course_name}}, {{completion_percentage}}')
ON CONFLICT (name) DO NOTHING;

-- ============================================================
-- REMINDER RULES
-- ============================================================
INSERT INTO reminder_rules (rule_name, schedule_detail, channels, enabled)
VALUES
  ('On assignment','Immediately when a course is assigned','Email + in-system',true),
  ('Before deadline','7, 3 and 1 days before due date','Email + in-system',true),
  ('On deadline date','Morning of the due date (08:00)','Email',true),
  ('After deadline','Next day, then weekly until completed','Email + in-system',true),
  ('Weekly incomplete digest','Every Monday for nurses with incomplete mandatory training','Email',true),
  ('Supervisor overdue alert','Weekly summary of overdue nurses per unit','Email + dashboard alert',true),
  ('Admin low-completion alert','When a mandatory course drops below its completion target','Email',true)
ON CONFLICT DO NOTHING;

-- ============================================================
-- APP SETTINGS
-- ============================================================
INSERT INTO app_settings (key, value) VALUES
  ('hospital_name','Al Shifa University Hospital'),
  ('default_language','English'),
  ('time_zone','Asia/Beirut (GMT+3)'),
  ('session_timeout_min','20'),
  ('lockout_attempts','3'),
  ('lockout_duration_min','15'),
  ('password_policy','Min 10 chars, upper+lower+digit, 90-day rotation'),
  ('2fa_requirement','Optional per role'),
  ('smtp_server','mail.hospital.org:587 (TLS)'),
  ('sender_email','education@hospital.org'),
  ('sender_name','Nursing Education'),
  ('certificate_validity_months','12'),
  ('max_video_size_mb','2048'),
  ('max_doc_size_mb','100'),
  ('backup_schedule','Daily 02:00 + weekly full')
ON CONFLICT (key) DO NOTHING;
