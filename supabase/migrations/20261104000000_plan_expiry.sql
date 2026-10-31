-- Pro bought in the App Store (docs/adr/0002): which product it came from, and when it ends.
-- An account is Pro while plan = 'pro' and plan_expires_at is null or still ahead (src/lib/plan.ts).
-- No expiry means lifetime: a lifetime purchase, or an account grandfathered by 20261102000000_grandfather_pro.sql,
-- which has no product. On a free account, plan_expires_at records when Pro last ended.
--
-- Safe to rerun. Apply before deploying the billing routes.
ALTER TABLE public.users ADD COLUMN IF NOT EXISTS plan_product text;
ALTER TABLE public.users ADD COLUMN IF NOT EXISTS plan_expires_at timestamptz;
