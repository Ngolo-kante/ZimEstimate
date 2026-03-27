-- ============================================
-- Migration 032: Test / Development Seeds
-- Creates 3 test accounts for local development
--
-- Accounts created:
--   admin@zimestimate.test    / TestAdmin123!   → tier=admin, user_type=admin
--   supplier@zimestimate.test / TestSupplier123! → supplier profile, Basic plan
--   builder@zimestimate.test  / TestBuilder123!  → regular builder account
--
-- Run ONLY in development / staging — never in production.
-- ============================================

DO $$
DECLARE
  v_admin_id    UUID := '00000000-0000-0000-0000-000000000001';
  v_supplier_id UUID := '00000000-0000-0000-0000-000000000002';
  v_builder_id  UUID := '00000000-0000-0000-0000-000000000003';
  v_supplier_row_id UUID;
BEGIN

-- ── 1. Auth users ────────────────────────────────────────────────────────────
-- Uses pgcrypto (enabled by default in Supabase) to hash passwords.

INSERT INTO auth.users (
  id, instance_id, aud, role,
  email, encrypted_password,
  email_confirmed_at,
  raw_app_meta_data, raw_user_meta_data,
  created_at, updated_at
)
VALUES
  -- Admin
  (
    v_admin_id,
    '00000000-0000-0000-0000-000000000000',
    'authenticated', 'authenticated',
    'admin@zimestimate.test',
    crypt('TestAdmin123!', gen_salt('bf', 10)),
    NOW(),
    '{"provider":"email","providers":["email"]}',
    '{"full_name":"Test Admin"}',
    NOW(), NOW()
  ),
  -- Supplier
  (
    v_supplier_id,
    '00000000-0000-0000-0000-000000000000',
    'authenticated', 'authenticated',
    'supplier@zimestimate.test',
    crypt('TestSupplier123!', gen_salt('bf', 10)),
    NOW(),
    '{"provider":"email","providers":["email"]}',
    '{"full_name":"Test Supplier"}',
    NOW(), NOW()
  ),
  -- Builder
  (
    v_builder_id,
    '00000000-0000-0000-0000-000000000000',
    'authenticated', 'authenticated',
    'builder@zimestimate.test',
    crypt('TestBuilder123!', gen_salt('bf', 10)),
    NOW(),
    '{"provider":"email","providers":["email"]}',
    '{"full_name":"Test Builder"}',
    NOW(), NOW()
  )
ON CONFLICT (id) DO NOTHING;

-- ── 2. Profiles ───────────────────────────────────────────────────────────────
-- handle_new_user() trigger fires on auth.users INSERT, but we use ON CONFLICT
-- to ensure correct tier/user_type even if the trigger already ran.

INSERT INTO public.profiles (id, email, full_name, tier, user_type, created_at, updated_at)
VALUES
  (v_admin_id,    'admin@zimestimate.test',    'Test Admin',    'admin', 'admin',    NOW(), NOW()),
  (v_supplier_id, 'supplier@zimestimate.test', 'Test Supplier', 'free',  'supplier', NOW(), NOW()),
  (v_builder_id,  'builder@zimestimate.test',  'Test Builder',  'free',  'builder',  NOW(), NOW())
ON CONFLICT (id) DO UPDATE SET
  tier      = EXCLUDED.tier,
  user_type = EXCLUDED.user_type,
  full_name = EXCLUDED.full_name,
  updated_at = NOW();

-- ── 3. Supplier record ────────────────────────────────────────────────────────

INSERT INTO public.suppliers (
  user_id, name, description,
  city, physical_address,
  contact_email, contact_phone,
  registration_number,
  material_categories,
  verification_status,
  created_at, updated_at
)
VALUES (
  v_supplier_id,
  'Zimbabwe Test Supplies (Pvt) Ltd',
  'Test supplier account for development and QA purposes.',
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
    'basic',
    'active',
    'stripe',
    NOW(),
    NOW() + INTERVAL '30 days',
    false,
    NOW(), NOW()
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
-- To promote the supplier to Pro for testing paid features, run:
--   UPDATE supplier_subscriptions
--     SET plan_id = 'pro', current_period_end = NOW() + INTERVAL '30 days'
--     WHERE supplier_id = (SELECT id FROM suppliers WHERE user_id = '00000000-0000-0000-0000-000000000002');
