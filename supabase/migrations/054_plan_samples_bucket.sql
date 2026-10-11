-- ─── Private store for copies of uploaded floor plans ──────────────────────
--
-- Plans uploaded for reading were analysed and thrown away, so there was no
-- way to test the reader against the plans people here actually draw. The
-- API now keeps a copy and the reader's result (src/lib/server/planSamples.ts).
--
-- Private: public = false, and deliberately no storage.objects policies for
-- anon or authenticated users, so only the service role — the server — can
-- read or write it. Nothing identifying the uploader is stored. Files are
-- deleted after twelve months by the daily job, as the privacy policy says.

INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'plan-samples',
  'plan-samples',
  false,
  10485760, -- 10 MB, the reader's own upload limit
  ARRAY['image/png', 'image/jpeg', 'image/webp', 'application/pdf', 'application/json']
)
ON CONFLICT (id) DO UPDATE
  SET public = false,
      file_size_limit = EXCLUDED.file_size_limit,
      allowed_mime_types = EXCLUDED.allowed_mime_types;
