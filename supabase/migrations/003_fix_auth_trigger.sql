-- Fix auth → profiles trigger (safe: does not delete user/table data)
-- Run this in the Supabase SQL editor, then retry "Run initial Main Admin setup".

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.profiles (
    id, name, user_id, email, role, status, force_password_change
  )
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'name', NEW.email, 'User'),
    COALESCE(
      NULLIF(NEW.raw_user_meta_data->>'user_id', ''),
      NULLIF(split_part(COALESCE(NEW.email, ''), '@', 1), ''),
      NEW.id::text
    ),
    NEW.email,
    COALESCE(
      (NEW.raw_user_meta_data->>'role')::public.user_role,
      'USER'::public.user_role
    ),
    'ACTIVE'::public.user_status,
    COALESCE(
      (NEW.raw_user_meta_data->>'force_password_change')::boolean,
      FALSE
    )
  )
  ON CONFLICT (id) DO UPDATE SET
    name = EXCLUDED.name,
    user_id = COALESCE(NULLIF(public.profiles.user_id, ''), EXCLUDED.user_id),
    email = COALESCE(EXCLUDED.email, public.profiles.email),
    role = COALESCE(EXCLUDED.role, public.profiles.role),
    status = COALESCE(EXCLUDED.status, public.profiles.status),
    force_password_change = EXCLUDED.force_password_change;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_new_user();
