-- ============================================
-- Migration 017: Supplier Portal
-- Adds supplier registration and product management
-- ============================================

-- Add user_type to profiles to distinguish builders from suppliers
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS user_type TEXT DEFAULT 'builder' CHECK (user_type IN ('builder', 'supplier', 'admin'));

-- Add user_id to suppliers table to link to authenticated users
ALTER TABLE suppliers ADD COLUMN IF NOT EXISTS user_id UUID REFERENCES profiles(id);
ALTER TABLE suppliers ADD COLUMN IF NOT EXISTS registration_number TEXT;
ALTER TABLE suppliers ADD COLUMN IF NOT EXISTS business_license_url TEXT;
ALTER TABLE suppliers ADD COLUMN IF NOT EXISTS physical_address TEXT;
ALTER TABLE suppliers ADD COLUMN IF NOT EXISTS delivery_radius_km INTEGER;
ALTER TABLE suppliers ADD COLUMN IF NOT EXISTS material_categories TEXT[];
ALTER TABLE suppliers ADD COLUMN IF NOT EXISTS payment_terms TEXT;
ALTER TABLE suppliers ADD COLUMN IF NOT EXISTS verification_status TEXT DEFAULT 'unverified' CHECK (verification_status IN ('unverified', 'pending', 'verified', 'trusted', 'premium'));
ALTER TABLE suppliers ADD COLUMN IF NOT EXISTS verified_at TIMESTAMPTZ;
ALTER TABLE suppliers ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT NOW();

-- Create index for user_id lookup
CREATE INDEX IF NOT EXISTS idx_suppliers_user_id ON suppliers(user_id);

-- ============================================
-- Supplier Applications Table (for vetting)
-- ============================================

CREATE TABLE IF NOT EXISTS supplier_applications (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
    business_name TEXT NOT NULL,
    registration_number TEXT,
    business_license_url TEXT,
    physical_address TEXT,
    city TEXT,
    contact_phone TEXT,
    contact_email TEXT,
    website TEXT,
    delivery_radius_km INTEGER DEFAULT 50,
    material_categories TEXT[] DEFAULT '{}',
    payment_terms TEXT,
    years_in_business INTEGER,
    customer_references TEXT[],
    status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'under_review', 'approved', 'rejected')),
    reviewed_by UUID REFERENCES profiles(id),
    reviewed_at TIMESTAMPTZ,
    rejection_reason TEXT,
    notes TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Enable RLS
ALTER TABLE supplier_applications ENABLE ROW LEVEL SECURITY;

-- Users can view and manage their own applications
CREATE POLICY "Users can view own applications"
    ON supplier_applications FOR SELECT
    USING (auth.uid() = user_id);

CREATE POLICY "Users can create applications"
    ON supplier_applications FOR INSERT
    WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own pending applications"
    ON supplier_applications FOR UPDATE
    USING (auth.uid() = user_id AND status = 'pending');

-- Admins can view and manage all applications
CREATE POLICY "Admins can view all applications"
    ON supplier_applications FOR SELECT
    USING (
        EXISTS (
            SELECT 1 FROM profiles
            WHERE profiles.id = auth.uid()
            AND profiles.tier = 'admin'
        )
    );

CREATE POLICY "Admins can update all applications"
    ON supplier_applications FOR UPDATE
    USING (
        EXISTS (
            SELECT 1 FROM profiles
            WHERE profiles.id = auth.uid()
            AND profiles.tier = 'admin'
        )
    );

-- Trigger for updated_at
CREATE TRIGGER update_supplier_applications_updated_at
    BEFORE UPDATE ON supplier_applications
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- ============================================
-- Supplier Products Table (catalog)
-- ============================================

CREATE TABLE IF NOT EXISTS supplier_products (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    supplier_id UUID NOT NULL REFERENCES suppliers(id) ON DELETE CASCADE,
    material_key TEXT NOT NULL,
    material_name TEXT,
    price_usd DECIMAL(12,2),
    price_zwg DECIMAL(12,2),
    min_order_qty INTEGER DEFAULT 1,
    max_order_qty INTEGER,
    unit TEXT,
    stock_status TEXT NOT NULL DEFAULT 'in_stock' CHECK (stock_status IN ('in_stock', 'low_stock', 'out_of_stock', 'discontinued')),
    lead_time_days INTEGER DEFAULT 1,
    notes TEXT,
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE(supplier_id, material_key)
);

-- Enable RLS
ALTER TABLE supplier_products ENABLE ROW LEVEL SECURITY;

-- Anyone can view active products
CREATE POLICY "Anyone can view active products"
    ON supplier_products FOR SELECT
    USING (is_active = true);

-- Suppliers can manage their own products
CREATE POLICY "Suppliers can manage own products"
    ON supplier_products FOR ALL
    USING (
        EXISTS (
            SELECT 1 FROM suppliers
            WHERE suppliers.id = supplier_products.supplier_id
            AND suppliers.user_id = auth.uid()
        )
    );

-- Admins can manage all products
CREATE POLICY "Admins can manage all products"
    ON supplier_products FOR ALL
    USING (
        EXISTS (
            SELECT 1 FROM profiles
            WHERE profiles.id = auth.uid()
            AND profiles.tier = 'admin'
        )
    );

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_supplier_products_supplier_id ON supplier_products(supplier_id);
CREATE INDEX IF NOT EXISTS idx_supplier_products_material_key ON supplier_products(material_key);
CREATE INDEX IF NOT EXISTS idx_supplier_products_stock_status ON supplier_products(stock_status);

-- Trigger for updated_at
CREATE TRIGGER update_supplier_products_updated_at
    BEFORE UPDATE ON supplier_products
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- ============================================
-- Update suppliers RLS for supplier self-management
-- ============================================

-- Suppliers can update their own profile
CREATE POLICY "Suppliers can update own profile"
    ON suppliers FOR UPDATE
    USING (user_id = auth.uid());

-- Suppliers can view their own full profile
CREATE POLICY "Suppliers can view own profile"
    ON suppliers FOR SELECT
    USING (user_id = auth.uid() OR is_trusted = true OR verification_status IN ('verified', 'trusted', 'premium'));

-- ============================================
-- Function to approve supplier application
-- ============================================

CREATE OR REPLACE FUNCTION approve_supplier_application(
    p_application_id UUID,
    p_reviewer_id UUID
)
RETURNS UUID AS $$
DECLARE
    v_app supplier_applications%ROWTYPE;
    v_supplier_id UUID;
BEGIN
    -- Get application
    SELECT * INTO v_app FROM supplier_applications WHERE id = p_application_id;

    IF v_app.id IS NULL THEN
        RAISE EXCEPTION 'Application not found';
    END IF;

    IF v_app.status != 'pending' AND v_app.status != 'under_review' THEN
        RAISE EXCEPTION 'Application is not pending';
    END IF;

    -- Create or update supplier record
    INSERT INTO suppliers (
        user_id,
        name,
        location,
        contact_phone,
        contact_email,
        website,
        registration_number,
        physical_address,
        delivery_radius_km,
        material_categories,
        payment_terms,
        verification_status,
        verified_at,
        is_trusted
    ) VALUES (
        v_app.user_id,
        v_app.business_name,
        v_app.city,
        v_app.contact_phone,
        v_app.contact_email,
        v_app.website,
        v_app.registration_number,
        v_app.physical_address,
        v_app.delivery_radius_km,
        v_app.material_categories,
        v_app.payment_terms,
        'verified',
        NOW(),
        FALSE
    )
    ON CONFLICT (user_id) DO UPDATE SET
        name = EXCLUDED.name,
        location = EXCLUDED.location,
        contact_phone = EXCLUDED.contact_phone,
        contact_email = EXCLUDED.contact_email,
        website = EXCLUDED.website,
        registration_number = EXCLUDED.registration_number,
        physical_address = EXCLUDED.physical_address,
        delivery_radius_km = EXCLUDED.delivery_radius_km,
        material_categories = EXCLUDED.material_categories,
        payment_terms = EXCLUDED.payment_terms,
        verification_status = 'verified',
        verified_at = NOW(),
        updated_at = NOW()
    RETURNING id INTO v_supplier_id;

    -- Update user profile to supplier type
    UPDATE profiles SET user_type = 'supplier' WHERE id = v_app.user_id;

    -- Update application status
    UPDATE supplier_applications SET
        status = 'approved',
        reviewed_by = p_reviewer_id,
        reviewed_at = NOW()
    WHERE id = p_application_id;

    RETURN v_supplier_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================
-- Function to reject supplier application
-- ============================================

CREATE OR REPLACE FUNCTION reject_supplier_application(
    p_application_id UUID,
    p_reviewer_id UUID,
    p_reason TEXT
)
RETURNS VOID AS $$
BEGIN
    UPDATE supplier_applications SET
        status = 'rejected',
        reviewed_by = p_reviewer_id,
        reviewed_at = NOW(),
        rejection_reason = p_reason
    WHERE id = p_application_id
    AND (status = 'pending' OR status = 'under_review');

    IF NOT FOUND THEN
        RAISE EXCEPTION 'Application not found or not pending';
    END IF;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Add unique constraint on suppliers.user_id (one supplier account per user)
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'suppliers_user_id_key'
    ) THEN
        ALTER TABLE suppliers ADD CONSTRAINT suppliers_user_id_key UNIQUE (user_id);
    END IF;
END $$;
