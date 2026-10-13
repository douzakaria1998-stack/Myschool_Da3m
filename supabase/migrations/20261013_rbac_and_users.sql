-- ==============================================================================
-- NON-DESTRUCTIVE MIGRATION: Role-Based Access Control (RBAC) & Users Table
-- Strict Rules:
-- 1. NO DROP TABLE, NO DROP COLUMN, NO TRUNCATE.
-- 2. ONLY CREATE TABLE IF NOT EXISTS and ALTER TABLE ... ADD COLUMN IF NOT EXISTS.
-- 3. Default role is 'user', with support for 'admin' and 'super_admin'.
-- ==============================================================================

-- 1. Create users table if it does not already exist
CREATE TABLE IF NOT EXISTS public.users (
  id TEXT PRIMARY KEY,
  username TEXT UNIQUE NOT NULL,
  password_hash TEXT NOT NULL,
  salt TEXT NOT NULL,
  name TEXT,
  role TEXT NOT NULL DEFAULT 'user',
  permissions JSONB DEFAULT '[]'::jsonb,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- 2. If table exists, safely add any missing columns non-destructively
DO $$
BEGIN
  -- Add role column defaulting to standard user if missing
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' AND table_name = 'users' AND column_name = 'role'
  ) THEN
    ALTER TABLE public.users ADD COLUMN role TEXT NOT NULL DEFAULT 'user';
  END IF;

  -- Add permissions column if missing
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' AND table_name = 'users' AND column_name = 'permissions'
  ) THEN
    ALTER TABLE public.users ADD COLUMN permissions JSONB DEFAULT '[]'::jsonb;
  END IF;

  -- Add salt column if missing
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' AND table_name = 'users' AND column_name = 'salt'
  ) THEN
    ALTER TABLE public.users ADD COLUMN salt TEXT;
  END IF;

  -- Add name column if missing
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' AND table_name = 'users' AND column_name = 'name'
  ) THEN
    ALTER TABLE public.users ADD COLUMN name TEXT;
  END IF;
END $$;

-- 3. Enable row level security and create non-destructive policies if not already present
ALTER TABLE public.users ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'users' AND policyname = 'allow_authenticated_read'
  ) THEN
    CREATE POLICY allow_authenticated_read ON public.users FOR SELECT USING (true);
  END IF;
END $$;
