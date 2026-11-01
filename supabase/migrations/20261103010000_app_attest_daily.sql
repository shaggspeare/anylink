-- Groupings by iOS installs without an account, per UTC day, across every App Attest key (src/lib/db/attest-keys.ts).
-- One device can register many keys, so this is the ceiling on the day's AI spend that per-key caps can't give.
-- Apply before deploying the code that reads it. Safe to rerun.
CREATE TABLE IF NOT EXISTS public.app_attest_daily (
  day date PRIMARY KEY,
  groups integer NOT NULL DEFAULT 0
);

-- RLS on, like every table in schema.ts: the server connects directly, so with no policies it only shuts out the anon key.
ALTER TABLE public.app_attest_daily ENABLE ROW LEVEL SECURITY;
