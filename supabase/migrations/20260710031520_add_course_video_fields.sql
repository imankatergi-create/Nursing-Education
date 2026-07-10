/*
# Add video fields to courses table

Adds video storage support to courses so admins can upload
a video file that nurses watch in the course player.

1. Modified Tables
   - `courses`
     - `video_url` (text) — public URL of the uploaded video in Supabase Storage
     - `video_filename` (text) — original filename for display
     - `video_size_mb` (numeric) — file size in MB for display
     - `video_duration_sec` (int) — actual video duration in seconds

2. Storage
   - Bucket `course-videos` is created as public so the video can
     be streamed directly by the browser without auth headers.
   - Authenticated users can upload/replace/delete; anyone can read.
*/

ALTER TABLE courses
  ADD COLUMN IF NOT EXISTS video_url       text,
  ADD COLUMN IF NOT EXISTS video_filename  text,
  ADD COLUMN IF NOT EXISTS video_size_mb   numeric,
  ADD COLUMN IF NOT EXISTS video_duration_sec int;

-- Storage bucket for course videos (public read, auth write)
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'course-videos',
  'course-videos',
  true,
  524288000,  -- 500 MB limit
  ARRAY['video/mp4','video/webm','video/ogg','video/quicktime','video/x-msvideo']
)
ON CONFLICT (id) DO UPDATE SET
  public = true,
  file_size_limit = 524288000,
  allowed_mime_types = ARRAY['video/mp4','video/webm','video/ogg','video/quicktime','video/x-msvideo'];

-- Allow authenticated users to upload to course-videos bucket
DROP POLICY IF EXISTS "auth_upload_course_videos" ON storage.objects;
CREATE POLICY "auth_upload_course_videos" ON storage.objects
  FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'course-videos');

DROP POLICY IF EXISTS "auth_update_course_videos" ON storage.objects;
CREATE POLICY "auth_update_course_videos" ON storage.objects
  FOR UPDATE TO authenticated
  USING (bucket_id = 'course-videos');

DROP POLICY IF EXISTS "auth_delete_course_videos" ON storage.objects;
CREATE POLICY "auth_delete_course_videos" ON storage.objects
  FOR DELETE TO authenticated
  USING (bucket_id = 'course-videos');

-- Public read (bucket is public so this allows unauthenticated streaming)
DROP POLICY IF EXISTS "public_read_course_videos" ON storage.objects;
CREATE POLICY "public_read_course_videos" ON storage.objects
  FOR SELECT TO public
  USING (bucket_id = 'course-videos');
