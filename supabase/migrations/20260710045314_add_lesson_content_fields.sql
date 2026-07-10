ALTER TABLE lessons
  ADD COLUMN IF NOT EXISTS video_url       text,
  ADD COLUMN IF NOT EXISTS doc_url         text,
  ADD COLUMN IF NOT EXISTS doc_filename    text,
  ADD COLUMN IF NOT EXISTS quiz_id         uuid REFERENCES quizzes(id) ON DELETE SET NULL;
