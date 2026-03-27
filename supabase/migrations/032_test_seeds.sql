-- ============================================
-- Migration 032: Test / Development Seeds
-- Creates 3 test accounts for local development
--
-- Accounts created:
--   admin@zimestimate.test    / TestAdmin123!    → tier=admin, user_type=admin
--   supplier@zimestimate.test / TestSupplier123! → supplier profile, Basic plan
--   builder@zimestimate.test  / TestBuilder123!  → regular builder account
--
-- Run ONLY in development / staging — never in production.
-- ============================================

-- Enable pgcrypto for gen_salt / crypt
CREATE EXTENSION IF NOT EXISTS pgcrypto;

DO $$
DECLARE
  v_admin_id        UUID := '00000000-0000-0000-0000-000000000001';
  v_supplier_id     UUID := '00000000-0000-0000-0000-000000000002';
  v_builder_id      UUID := '00000000-0000-0000-0000-000000000003';
  v_supplier_row_id UUID;
BEGIN

-- ── 1. Auth users ─────────────────────────────────────────────────────────────
-- Full column list compatible with Supabase GoTrue ≥ 2.x.
-- is_sso_user and is_anonymous added in newer GoTrue versions; safe to include.

INSERT INTO auth.users (
  id,
  instance_id,
  aud,
  role,
  email,
  encrypted_password,
  email_confirmed_at,
  invited_at,
  confirmation_token,
  confirmation_sent_at,
  recovery_token,
  recovery_sent_at,
  email_change_token_new,
  email_change,
  email_change_sent_at,
  last_sign_in_at,
  raw_app_meta_data,
  raw_user_meta_data,
  is_super_admin,
  created_at,
  updated_at,
  phone,
  phone_confirmed_at,
  phone_change,
  phone_change_token,
  phone_change_sent_at,
  email_change_token_current,
  email_change_confirm_status,
  banned_until,
  reauthentication_token,
  reauthentication_sent_at,
  is_sso_user,
  deleted_at
)
VALUES
  -- Admin
  (
    v_admin_id,
    '00000000-0000-0000-0000-000000000000',
    'authenticated', 'authenticated',
    'admin@zimestimate.test',
    extensions.crypt('TestAdmin123!', extensions.gen_salt('bf', 10)),
    NOW(), NULL, '', NULL, '', NULL, '', '', NULL, NOW(),
    '{"provider":"email","providers":["email"]}',
    '{"full_name":"Test Admin"}',
    false, NOW(), NOW(),
    NULL, NULL, '', '', NULL, '', 0, NULL, '', NULL, false, NULL
  ),
  -- Supplier
  (
    v_supplier_id,
    '00000000-0000-0000-0000-000000000000',
    'authenticated', 'authenticated',
    'supplier@zimestimate.test',
    extensions.crypt('TestSupplier123!', extensions.gen_salt('bf', 10)),
    NOW(), NULL, '', NULL, '', NULL, '', '', NULL, NOW(),
    '{"provider":"email","providers":["email"]}',
    '{"full_name":"Test Supplier"}',
    false, NOW(), NOW(),
    NULL, NULL, '', '', NULL, '', 0, NULL, '', NULL, false, NULL
  ),
  -- Builder
  (
    v_builder_id,
    '00000000-0000-0000-0000-000000000000',
    'authenticated', 'authenticated',
    'builder@zimestimate.test',
    extensions.crypt('TestBuilder123!', extensions.gen_salt('bf', 10)),
    NOW(), NULL, '', NULL, '', NULL, '', '', NULL, NOW(),
    '{"provider":"email","providers":["email"]}',
    '{"full_name":"Test Builder"}',
    false, NOW(), NOW(),
    NULL, NULL, '', '', NULL, '', 0, NULL, '', NULL, false, NULL
  )
ON CONFLICT (id) DO UPDATE SET
  encrypted_password = EXCLUDED.encrypted_password,
  email_confirmed_at = EXCLUDED.email_confirmed_at,
  updated_at         = NOW();

-- Also ensure email uniqueness index won't block re-runs on email conflict
-- (Supabase has a unique index on auth.users(email))
-- The ON CONFLICT (id) above handles the UUID case; if emails were previously
-- inserted with different UUIDs, delete and re-insert:
DELETE FROM auth.users
  WHERE email IN (
    'admin@zimestimate.test',
    'supplier@zimestimate.test',
    'builder@zimestimate.test'
  )
  AND id NOT IN (v_admin_id, v_supplier_id, v_builder_id);

-- ── 2. Profiles ───────────────────────────────────────────────────────────────
-- handle_new_user() trigger fires on auth.users INSERT and creates the profile.
-- We upsert here to ensure correct tier/user_type regardless.

INSERT INTO public.profiles (id, email, full_name, tier, user_type, created_at, updated_at)
VALUES
  (v_admin_id,    'admin@zimestimate.test',    'Test Admin',    'admin', 'admin',    NOW(), NOW()),
  (v_supplier_id, 'supplier@zimestimate.test', 'Test Supplier', 'free',  'supplier', NOW(), NOW()),
  (v_builder_id,  'builder@zimestimate.test',  'Test Builder',  'free',  'builder',  NOW(), NOW())
ON CONFLICT (id) DO UPDATE SET
  tier       = EXCLUDED.tier,
  user_type  = EXCLUDED.user_type,
  full_name  = EXCLUDED.full_name,
  updated_at = NOW();

-- ── 3. Supplier record ────────────────────────────────────────────────────────

INSERT INTO public.suppliers (
  user_id, name,
  location, physical_address,
  contact_email, contact_phone,
  registration_number,
  material_categories,
  verification_status,
  created_at, updated_at
)
VALUES (
  v_supplier_id,
  'Zimbabwe Test Supplies (Pvt) Ltd',
  'Harare',
  '123 Samora Machel Ave, Harare, Zimbabwe',
  'supplier@zimestimate.test',
  '+263 77 123 4567',
  'TEST-CIPA-001',
  ARRAY['cement', 'steel', 'timber', 'roofing', 'bricks'],
  'verified',
  NOW(), NOW()
)
ON CONFLICT DO NOTHING
RETURNING id INTO v_supplier_row_id;

-- If already existed, fetch the id
IF v_supplier_row_id IS NULL THEN
  SELECT id INTO v_supplier_row_id
    FROM public.suppliers
   WHERE user_id = v_supplier_id
   LIMIT 1;
END IF;

-- ── 4. Basic subscription for test supplier ───────────────────────────────────

IF v_supplier_row_id IS NOT NULL THEN
  INSERT INTO public.supplier_subscriptions (
    supplier_id, plan_id, status,
    payment_provider,
    current_period_start,
    current_period_end,
    cancel_at_period_end,
    created_at, updated_at
  )
  VALUES (
    v_supplier_row_id,
    'basic', 'active', 'stripe',
    NOW(), NOW() + INTERVAL '30 days',
    false, NOW(), NOW()
  )
  ON CONFLICT (supplier_id) DO NOTHING;
END IF;

END $$;

-- ── Summary ───────────────────────────────────────────────────────────────────
-- After running this migration you can log in with:
--
--   admin@zimestimate.test    / TestAdmin123!
--   supplier@zimestimate.test / TestSupplier123!
--   builder@zimestimate.test  / TestBuilder123!
--
-- To promote the supplier to Pro for testing paid features:
--   UPDATE supplier_subscriptions
--     SET plan_id = 'pro', current_period_end = NOW() + INTERVAL '30 days'
--     WHERE supplier_id = (SELECT id FROM suppliers
--                          WHERE user_id = '00000000-0000-0000-0000-000000000002');
