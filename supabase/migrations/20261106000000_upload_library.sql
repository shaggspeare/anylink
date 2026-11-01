-- Upgrade and lapse (Phase 5, CONTEXT.md). `client_id` is the id a link had in an iOS local library before
-- uploadLibrary moved it here, so uploading again matches instead of duplicating: notes and images have no URL to
-- match on. `ai_pending` marks a link saved without the AI step (a free crawl, or an upload), so enrichLink can add the
-- summary and tags when a Pro user opens it. Apply before deploying the Phase 5 clients. Safe to rerun.
ALTER TABLE public.links ADD COLUMN IF NOT EXISTS client_id text;
ALTER TABLE public.links ADD COLUMN IF NOT EXISTS ai_pending boolean NOT NULL DEFAULT false;
CREATE UNIQUE INDEX IF NOT EXISTS links_user_id_client_id_idx ON public.links (user_id, client_id)
  WHERE client_id IS NOT NULL;
