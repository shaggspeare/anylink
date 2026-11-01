-- iOS installs without an account (docs/adr/0002): one row per App Attest key, written when the key registers
-- (POST /api/attest/register). It holds no library data, only what checking the key's calls and capping them per day
-- needs (src/lib/app-attest.ts). Apply before deploying the routes that read it. Safe to rerun.
CREATE TABLE IF NOT EXISTS public.app_attest_keys (
  key_id text PRIMARY KEY,
  public_key text NOT NULL,
  -- The last assertion's counter; the next one must be higher.
  sign_count bigint NOT NULL DEFAULT 0,
  -- 'development' | 'production', from the attestation's aaguid.
  environment text NOT NULL,
  -- The UTC day the counts below belong to; an older day reads as zero.
  usage_day date,
  crawl_count integer NOT NULL DEFAULT 0,
  check_count integer NOT NULL DEFAULT 0,
  group_count integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  last_used_at timestamptz NOT NULL DEFAULT now()
);

-- RLS on, like every table in schema.ts: the server connects directly, so with no policies it only shuts out the anon key.
ALTER TABLE public.app_attest_keys ENABLE ROW LEVEL SECURITY;
