-- Create storage bucket for course materials
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'course-materials',
  'course-materials',
  true,
  104857600,  -- 100 MB
  ARRAY['application/pdf','application/vnd.ms-powerpoint','application/vnd.openxmlformats-officedocument.presentationml.presentation','application/msword','application/vnd.openxmlformats-officedocument.wordprocessingml.document','video/mp4','video/webm','audio/mpeg','audio/wav','image/jpeg','image/png','image/gif','text/plain']
)
ON CONFLICT (id) DO NOTHING;

-- Storage policies
CREATE POLICY "materials_public_select" ON storage.objects
  FOR SELECT TO public USING (bucket_id = 'course-materials');

CREATE POLICY "materials_auth_insert" ON storage.objects
  FOR INSERT TO authenticated WITH CHECK (bucket_id = 'course-materials');

CREATE POLICY "materials_auth_update" ON storage.objects
  FOR UPDATE TO authenticated USING (bucket_id = 'course-materials');

CREATE POLICY "materials_auth_delete" ON storage.objects
  FOR DELETE TO authenticated USING (bucket_id = 'course-materials');

-- Add file_url column to materials table if not present
ALTER TABLE materials ADD COLUMN IF NOT EXISTS file_url text;
