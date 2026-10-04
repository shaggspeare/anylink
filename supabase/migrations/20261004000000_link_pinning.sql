-- Existing links start unpinned. Apply before deploying the pinning clients.
ALTER TABLE public.links ADD COLUMN IF NOT EXISTS pinned boolean NOT NULL DEFAULT false;
