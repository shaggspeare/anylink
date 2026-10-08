-- Accounts. public.users mirrors auth.users with the same id, so every library row keys
-- off the Supabase user. Apply before deploying the signed-in clients.

-- Billing comes later; until then everyone syncs and `plan` is only recorded.
ALTER TABLE public.users ADD COLUMN IF NOT EXISTS plan text NOT NULL DEFAULT 'free';

-- auth.users already guarantees unique emails; a second check here could only make a
-- sign-up fail (e.g. an address freed by a deleted account).
ALTER TABLE public.users DROP CONSTRAINT IF EXISTS users_email_unique;

-- The library from before sign-in stays under a placeholder nobody signs in as.
UPDATE public.users SET email = 'example_user@anylink.local'
WHERE id = 'a42b0ef2-14a3-4670-b294-62f4aac281b3';

CREATE OR REPLACE FUNCTION public.handle_new_auth_user() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
BEGIN
  -- Apple can withhold the address; the row still needs one.
  INSERT INTO public.users (id, email)
  VALUES (new.id, coalesce(new.email, new.id::text || '@users.anylink.local'))
  ON CONFLICT (id) DO NOTHING;
  RETURN new;
END $$;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_auth_user();

-- Anyone who signed up before the trigger existed.
INSERT INTO public.users (id, email)
SELECT id, coalesce(email, id::text || '@users.anylink.local') FROM auth.users
ON CONFLICT (id) DO NOTHING;
