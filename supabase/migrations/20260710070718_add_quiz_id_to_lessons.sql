/*
# Add quiz_id to lessons and create_quiz function

Allows syllabus lessons of type 'quiz' to reference a specific quiz,
enabling the "link quiz to lesson" feature.

1. Modified Tables
   - `lessons`: adds optional `quiz_id` (uuid, FK → quizzes.id)

2. Notes
   - Nullable so existing lessons are unaffected
   - ON DELETE SET NULL so deleting a quiz doesn't cascade-delete lessons
*/

ALTER TABLE lessons
  ADD COLUMN IF NOT EXISTS quiz_id uuid REFERENCES quizzes(id) ON DELETE SET NULL;
