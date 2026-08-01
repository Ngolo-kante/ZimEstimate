-- ============================================
-- 037: Contractors
-- ============================================
--
-- Until now "contractor" was not a role. The app derived it as:
--
--   const isContractor = profile?.user_type === 'builder';
--
-- and 'builder' is the default user_type for every new signup, so every
-- homeowner estimating their own house was shown a "Contractor Markup —
-- Contractor only" field. This migration makes contractor a real role with a
-- profile behind it, so that check can test something meaningful.
--
-- Registration is self-serve: filling in the form below makes you a contractor
-- immediately. There is deliberately no approval queue. `is_verified` and
-- `is_listed` exist so vetting and directory visibility can be added later
-- without another migration, and both default to false.

-- ============================================
-- 1. ROLE
-- ============================================
ALTER TABLE profiles DROP CONSTRAINT IF EXISTS profiles_user_type_check;
ALTER TABLE profiles ADD CONSTRAINT profiles_user_type_check
    CHECK (user_type IN ('builder', 'supplier', 'contractor', 'admin'));

-- ============================================
-- 2. CONTRACTOR PROFILE
-- ============================================
CREATE TABLE IF NOT EXISTS contractors (
    id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id             UUID NOT NULL UNIQUE REFERENCES profiles(id) ON DELETE CASCADE,

    company_name        TEXT NOT NULL,
    contact_phone       TEXT,
    contact_email       TEXT,
    -- Free text rather than a fixed list: Zimbabwe trades do not map cleanly
    -- onto a taxonomy, and guessing one now would force a migration later.
    trades              TEXT[] NOT NULL DEFAULT '{}',
    service_areas       TEXT[] NOT NULL DEFAULT '{}',
    years_experience    INTEGER CHECK (years_experience IS NULL OR years_experience >= 0),
    about               TEXT,

    -- Default markup applied to new BOQs. Per-BOQ values still override it.
    default_markup_pct  NUMERIC NOT NULL DEFAULT 15
                        CHECK (default_markup_pct >= 0 AND default_markup_pct <= 100),

    -- Reserved for the directory and any later vetting. Nothing sets these yet.
    is_listed           BOOLEAN NOT NULL DEFAULT FALSE,
    is_verified         BOOLEAN NOT NULL DEFAULT FALSE,

    created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    deleted_at          TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS contractors_user_id_idx ON contractors (user_id);
CREATE INDEX IF NOT EXISTS contractors_listed_idx  ON contractors (is_listed) WHERE deleted_at IS NULL;

DROP TRIGGER IF EXISTS update_contractors_updated_at ON contractors;
CREATE TRIGGER update_contractors_updated_at
    BEFORE UPDATE ON contractors
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- ============================================
-- 3. ROW-LEVEL SECURITY
-- ============================================
ALTER TABLE contractors ENABLE ROW LEVEL SECURITY;

-- Own record, always. Written as a direct auth.uid() comparison rather than a
-- subquery into profiles: migrations 003 and 035 both had to undo recursion
-- caused by policies that reach into other tables.
DROP POLICY IF EXISTS "Contractors can view own record" ON contractors;
CREATE POLICY "Contractors can view own record"
    ON contractors FOR SELECT
    USING (auth.uid() = user_id);

-- Listed contractors are public, which is what the directory will read. Nothing
-- sets is_listed yet, so this currently exposes nothing.
DROP POLICY IF EXISTS "Anyone can view listed contractors" ON contractors;
CREATE POLICY "Anyone can view listed contractors"
    ON contractors FOR SELECT
    USING (is_listed = TRUE AND deleted_at IS NULL);

DROP POLICY IF EXISTS "Users can create own contractor record" ON contractors;
CREATE POLICY "Users can create own contractor record"
    ON contractors FOR INSERT
    WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Contractors can update own record" ON contractors;
CREATE POLICY "Contractors can update own record"
    ON contractors FOR UPDATE
    USING (auth.uid() = user_id);

-- ============================================
-- 4. REGISTRATION
-- ============================================
-- Creating the record and switching the role have to happen together: a
-- contractors row whose profile still says 'builder' would be invisible to
-- every isContractor check, and a profile flipped to 'contractor' with no row
-- would break anything reading the company name. A definer function keeps the
-- pair atomic, and lets the caller update profiles.user_type without a policy
-- that would otherwise allow self-promotion to admin.
CREATE OR REPLACE FUNCTION register_as_contractor(
    p_company_name      TEXT,
    p_contact_phone     TEXT DEFAULT NULL,
    p_contact_email     TEXT DEFAULT NULL,
    p_trades            TEXT[] DEFAULT '{}',
    p_service_areas     TEXT[] DEFAULT '{}',
    p_years_experience  INTEGER DEFAULT NULL,
    p_about             TEXT DEFAULT NULL
)
RETURNS UUID AS $$
DECLARE
    v_user_id UUID := auth.uid();
    v_id      UUID;
    v_type    TEXT;
BEGIN
    IF v_user_id IS NULL THEN
        RAISE EXCEPTION 'Not authenticated';
    END IF;

    IF p_company_name IS NULL OR btrim(p_company_name) = '' THEN
        RAISE EXCEPTION 'Company name is required';
    END IF;

    SELECT user_type INTO v_type FROM profiles WHERE id = v_user_id;

    -- Suppliers and admins keep their role. Only a builder becomes a
    -- contractor, so this cannot be used to escalate or to strip a role.
    IF v_type NOT IN ('builder', 'contractor') THEN
        RAISE EXCEPTION 'Accounts of type % cannot register as a contractor', v_type;
    END IF;

    INSERT INTO contractors (
        user_id, company_name, contact_phone, contact_email,
        trades, service_areas, years_experience, about
    )
    VALUES (
        v_user_id, btrim(p_company_name), p_contact_phone, p_contact_email,
        COALESCE(p_trades, '{}'), COALESCE(p_service_areas, '{}'),
        p_years_experience, p_about
    )
    ON CONFLICT (user_id) DO UPDATE SET
        company_name     = EXCLUDED.company_name,
        contact_phone    = EXCLUDED.contact_phone,
        contact_email    = EXCLUDED.contact_email,
        trades           = EXCLUDED.trades,
        service_areas    = EXCLUDED.service_areas,
        years_experience = EXCLUDED.years_experience,
        about            = EXCLUDED.about,
        deleted_at       = NULL
    RETURNING id INTO v_id;

    UPDATE profiles SET user_type = 'contractor' WHERE id = v_user_id;

    RETURN v_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

GRANT EXECUTE ON FUNCTION register_as_contractor(TEXT, TEXT, TEXT, TEXT[], TEXT[], INTEGER, TEXT) TO authenticated;
