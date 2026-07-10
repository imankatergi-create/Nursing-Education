/*
# Add configuration columns to lesson_materials

Adds per-attachment metadata so educators can specify how a material
should be consumed within a specific lesson.

1. Modified Tables
- `lesson_materials`
  - `required_watch_pct` (integer, default 100) — minimum % the learner must
    watch/read before the material counts as completed
  - `duration_text` (text, default '') — human-readable time estimate for
    this material in this lesson (e.g. "10 min")

2. Notes
- Both columns default to safe values so existing rows are unaffected.
*/

ALTER TABLE lesson_materials
  ADD COLUMN IF NOT EXISTS required_watch_pct INTEGER NOT NULL DEFAULT 100,
  ADD COLUMN IF NOT EXISTS duration_text TEXT NOT NULL DEFAULT '';
