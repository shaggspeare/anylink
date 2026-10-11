-- Optional emoji per collection; null keeps the colour dot. Apply before deploying the icon clients.
ALTER TABLE public.collections ADD COLUMN IF NOT EXISTS icon text;
