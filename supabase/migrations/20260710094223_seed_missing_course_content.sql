
-- Fire Safety & Emergency Codes
INSERT INTO course_modules (id, course_id, title, order_index) VALUES
  ('bb000001-0000-0000-0000-000000000001', 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb', 'Emergency Response Fundamentals', 1),
  ('bb000002-0000-0000-0000-000000000002', 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb', 'Code Response Procedures', 2)
ON CONFLICT DO NOTHING;

INSERT INTO lessons (id, module_id, type, title, duration_text, requirement, order_index) VALUES
  ('bb010001-0000-0000-0000-000000000001', 'bb000001-0000-0000-0000-000000000001', 'video', 'Fire Response & Evacuation Procedures', '12 min', 'Watch 90%', 1),
  ('bb010002-0000-0000-0000-000000000002', 'bb000001-0000-0000-0000-000000000001', 'doc',   'Emergency Code Reference Card', '5 min',  'Acknowledge', 2),
  ('bb020001-0000-0000-0000-000000000001', 'bb000002-0000-0000-0000-000000000002', 'video', 'Code Blue & Code Red Scenarios', '10 min', 'Watch 90%', 1),
  ('bb020002-0000-0000-0000-000000000002', 'bb000002-0000-0000-0000-000000000002', 'quiz',  'Fire Safety Knowledge Check', '10 min', 'Score ≥80%', 2)
ON CONFLICT DO NOTHING;

-- High-Alert Medication Safety
INSERT INTO course_modules (id, course_id, title, order_index) VALUES
  ('cc000001-0000-0000-0000-000000000001', 'cccccccc-cccc-cccc-cccc-cccccccccccc', 'High-Alert Medication Overview', 1),
  ('cc000002-0000-0000-0000-000000000002', 'cccccccc-cccc-cccc-cccc-cccccccccccc', 'Safe Administration Practices', 2)
ON CONFLICT DO NOTHING;

INSERT INTO lessons (id, module_id, type, title, duration_text, requirement, order_index) VALUES
  ('cc010001-0000-0000-0000-000000000001', 'cc000001-0000-0000-0000-000000000001', 'video', 'Introduction to High-Alert Medications', '15 min', 'Watch 90%', 1),
  ('cc010002-0000-0000-0000-000000000002', 'cc000001-0000-0000-0000-000000000001', 'doc',   'ISMP High-Alert Medication List', '8 min',  'Acknowledge', 2),
  ('cc020001-0000-0000-0000-000000000001', 'cc000002-0000-0000-0000-000000000002', 'video', 'Double-Check Protocols & Pump Safety', '12 min', 'Watch 90%', 1),
  ('cc020002-0000-0000-0000-000000000002', 'cc000002-0000-0000-0000-000000000002', 'quiz',  'Medication Safety Competency Quiz', '15 min', 'Score ≥80%', 2)
ON CONFLICT DO NOTHING;

-- New Nurse Orientation — Hospital Systems
INSERT INTO course_modules (id, course_id, title, order_index) VALUES
  ('dd000001-0000-0000-0000-000000000001', 'dddddddd-dddd-dddd-dddd-dddddddddddd', 'Hospital Overview & Policies', 1),
  ('dd000002-0000-0000-0000-000000000002', 'dddddddd-dddd-dddd-dddd-dddddddddddd', 'Clinical Systems & Documentation', 2)
ON CONFLICT DO NOTHING;

INSERT INTO lessons (id, module_id, type, title, duration_text, requirement, order_index) VALUES
  ('dd010001-0000-0000-0000-000000000001', 'dd000001-0000-0000-0000-000000000001', 'video', 'Welcome to Our Hospital', '10 min', 'Watch 90%', 1),
  ('dd010002-0000-0000-0000-000000000002', 'dd000001-0000-0000-0000-000000000001', 'doc',   'Nursing Policy Manual Highlights', '10 min', 'Acknowledge', 2),
  ('dd020001-0000-0000-0000-000000000001', 'dd000002-0000-0000-0000-000000000002', 'video', 'EMR Navigation & Documentation', '18 min', 'Watch 90%', 1),
  ('dd020002-0000-0000-0000-000000000002', 'dd000002-0000-0000-0000-000000000002', 'quiz',  'Orientation Assessment', '15 min', 'Score ≥80%', 2)
ON CONFLICT DO NOTHING;

-- ICU: Sepsis Bundle & Early Recognition
INSERT INTO course_modules (id, course_id, title, order_index) VALUES
  ('ee000001-0000-0000-0000-000000000001', 'eeeeeeee-eeee-eeee-eeee-eeeeeeeeeeee', 'Recognizing Sepsis', 1),
  ('ee000002-0000-0000-0000-000000000002', 'eeeeeeee-eeee-eeee-eeee-eeeeeeeeeeee', 'Hour-1 Bundle Implementation', 2)
ON CONFLICT DO NOTHING;

INSERT INTO lessons (id, module_id, type, title, duration_text, requirement, order_index) VALUES
  ('ee010001-0000-0000-0000-000000000001', 'ee000001-0000-0000-0000-000000000001', 'video', 'Early Warning Signs of Sepsis', '14 min', 'Watch 90%', 1),
  ('ee010002-0000-0000-0000-000000000002', 'ee000001-0000-0000-0000-000000000001', 'doc',   'Sepsis Screening Tool — qSOFA & SIRS', '6 min',  'Acknowledge', 2),
  ('ee020001-0000-0000-0000-000000000001', 'ee000002-0000-0000-0000-000000000002', 'video', 'Hour-1 Bundle — Lactate, Cultures & Fluids', '16 min', 'Watch 90%', 1),
  ('ee020002-0000-0000-0000-000000000002', 'ee000002-0000-0000-0000-000000000002', 'quiz',  'Sepsis Bundle Knowledge Assessment', '15 min', 'Score ≥80%', 2)
ON CONFLICT DO NOTHING;
