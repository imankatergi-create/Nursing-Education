ALTER TABLE materials
  ADD COLUMN IF NOT EXISTS duration_text text DEFAULT '',
  ADD COLUMN IF NOT EXISTS watch_pct_required integer DEFAULT 90,
  ADD COLUMN IF NOT EXISTS requires_acknowledgment boolean DEFAULT false,
  ADD COLUMN IF NOT EXISTS description text DEFAULT '';
