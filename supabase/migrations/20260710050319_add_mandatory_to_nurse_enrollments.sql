ALTER TABLE nurse_enrollments
  ADD COLUMN IF NOT EXISTS mandatory boolean NOT NULL DEFAULT false;
