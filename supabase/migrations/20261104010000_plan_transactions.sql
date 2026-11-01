-- Which App Store purchase an account's Pro comes from, and every purchase Apple refunded (src/lib/plan.ts, planAfter).
--
-- plan_transaction: the purchase (StoreKit's originalTransactionId) behind the current Pro. Only the signed-in app sets
--   it; Apple's notifications only touch the purchase it names. Null for grandfathered accounts, which no App Store
--   event can change.
-- plan_revoked: Apple's last word on each refunded purchase, "<refund key>:refunded:<ms>" or
--   "<refund key>:reversed:<ms>". A refunded purchase never grants Pro again, however often its old receipt is sent.
--
-- Safe to rerun. Apply after 20261104000000_plan_expiry.sql, before deploying the code that reads these columns.
ALTER TABLE public.users ADD COLUMN IF NOT EXISTS plan_transaction text;
ALTER TABLE public.users ADD COLUMN IF NOT EXISTS plan_revoked text[] NOT NULL DEFAULT '{}';
