-- Shared collections: a collection with a share_token is readable by anyone holding it
-- (see docs/adr/0001). Null = not shared. Apply before deploying the sharing clients.
ALTER TABLE public.collections ADD COLUMN IF NOT EXISTS share_token text UNIQUE;
-- What a sharer appears as on their shared pages. Null = no owner line.
ALTER TABLE public.users ADD COLUMN IF NOT EXISTS display_name text;
