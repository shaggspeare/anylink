-- Pro launch (docs/adr/0002): every account made before plans were enforced keeps what it had, so it's Pro.
-- Accounts made later keep the 'free' default.
--
-- Safe to rerun: the cutoff means a later run never hands Pro to an account that signed up free.
-- Run it right before deploying the code that enforces plans. If that's after the cutoff, move the cutoff to
-- the deploy time first.
UPDATE public.users SET plan = 'pro'
WHERE plan <> 'pro' AND created_at < '2026-11-02 00:00:00+00';
