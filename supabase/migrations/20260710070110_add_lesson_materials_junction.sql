/*
# Add lesson_materials junction table

Links materials from the materials library to specific lessons in a syllabus,
enabling the "attach materials to lesson" feature in the Syllabus Builder.

1. New Tables
   - `lesson_materials` — many-to-many between lessons and materials
     - `lesson_id` (uuid, FK → lessons.id)
     - `material_id` (uuid, FK → materials.id)
     - `order_index` (int) — display order within the lesson

2. Security
   - RLS enabled
   - Authenticated users can fully manage lesson_materials
*/

CREATE TABLE IF NOT EXISTS lesson_materials (
  lesson_id   uuid NOT NULL REFERENCES lessons(id) ON DELETE CASCADE,
  material_id uuid NOT NULL REFERENCES materials(id) ON DELETE CASCADE,
  order_index int NOT NULL DEFAULT 0,
  PRIMARY KEY (lesson_id, material_id)
);

ALTER TABLE lesson_materials ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "auth_select_lesson_materials" ON lesson_materials;
CREATE POLICY "auth_select_lesson_materials" ON lesson_materials
  FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS "auth_insert_lesson_materials" ON lesson_materials;
CREATE POLICY "auth_insert_lesson_materials" ON lesson_materials
  FOR INSERT TO authenticated WITH CHECK (true);

DROP POLICY IF EXISTS "auth_update_lesson_materials" ON lesson_materials;
CREATE POLICY "auth_update_lesson_materials" ON lesson_materials
  FOR UPDATE TO authenticated USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "auth_delete_lesson_materials" ON lesson_materials;
CREATE POLICY "auth_delete_lesson_materials" ON lesson_materials
  FOR DELETE TO authenticated USING (true);
