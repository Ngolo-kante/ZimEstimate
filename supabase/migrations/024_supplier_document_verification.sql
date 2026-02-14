-- ============================================
-- Migration 024: Supplier document verification + annual re-verification
-- ============================================

-- Add verification expiry to suppliers
ALTER TABLE suppliers
  ADD COLUMN IF NOT EXISTS verification_expires_at TIMESTAMPTZ;

-- Backfill expiry for existing verified suppliers
UPDATE suppliers
  SET verification_expires_at = COALESCE(verification_expires_at, verified_at + INTERVAL '1 year')
  WHERE verified_at IS NOT NULL;

-- Supplier document storage (application + re-verification)
CREATE TABLE IF NOT EXISTS supplier_documents (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  application_id UUID REFERENCES supplier_applications(id) ON DELETE CASCADE,
  supplier_id UUID REFERENCES suppliers(id) ON DELETE CASCADE,
  document_type TEXT NOT NULL,
  file_name TEXT,
  file_path TEXT NOT NULL,
  file_url TEXT,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'verified', 'rejected')),
  notes TEXT,
  uploaded_by UUID REFERENCES profiles(id),
  reviewed_by UUID REFERENCES profiles(id),
  reviewed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE supplier_documents
  ADD CONSTRAINT supplier_documents_owner_check
  CHECK ((application_id IS NOT NULL) OR (supplier_id IS NOT NULL));

ALTER TABLE supplier_documents ENABLE ROW LEVEL SECURITY;

-- Users can view their own documents (by application or supplier profile)
CREATE POLICY "Users can view own supplier documents"
  ON supplier_documents FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM supplier_applications
      WHERE supplier_applications.id = supplier_documents.application_id
        AND supplier_applications.user_id = auth.uid()
    )
    OR EXISTS (
      SELECT 1 FROM suppliers
      WHERE suppliers.id = supplier_documents.supplier_id
        AND suppliers.user_id = auth.uid()
        AND suppliers.deleted_at IS NULL
    )
  );

-- Users can upload documents for their own applications or supplier profile
CREATE POLICY "Users can upload supplier documents"
  ON supplier_documents FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM supplier_applications
      WHERE supplier_applications.id = supplier_documents.application_id
        AND supplier_applications.user_id = auth.uid()
    )
    OR EXISTS (
      SELECT 1 FROM suppliers
      WHERE suppliers.id = supplier_documents.supplier_id
        AND suppliers.user_id = auth.uid()
        AND suppliers.deleted_at IS NULL
    )
  );

-- Admins can view and manage documents
CREATE POLICY "Admins can view supplier documents"
  ON supplier_documents FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
        AND profiles.tier = 'admin'
    )
  );

CREATE POLICY "Admins can update supplier documents"
  ON supplier_documents FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
        AND profiles.tier = 'admin'
    )
  );

CREATE POLICY "Admins can delete supplier documents"
  ON supplier_documents FOR DELETE
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
        AND profiles.tier = 'admin'
    )
  );

-- ============================================
-- Update approval function with verification expiry
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
    verification_expires_at,
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
    NOW() + INTERVAL '1 year',
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
    verification_expires_at = NOW() + INTERVAL '1 year',
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
