-- ============================================
-- Migration 018: RFQ System (Requests, Quotes, Matching, Notifications)
-- ============================================

-- ============================================
-- 1. RFQ REQUESTS
-- ============================================
CREATE TABLE IF NOT EXISTS rfq_requests (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
    delivery_address TEXT,
    required_by DATE,
    notes TEXT,
    status TEXT NOT NULL DEFAULT 'open' CHECK (status IN ('open', 'quoted', 'accepted', 'expired', 'cancelled')),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    expires_at TIMESTAMPTZ NOT NULL DEFAULT NOW() + INTERVAL '7 days'
);

CREATE INDEX IF NOT EXISTS idx_rfq_requests_project_id ON rfq_requests(project_id);
CREATE INDEX IF NOT EXISTS idx_rfq_requests_status ON rfq_requests(status);
CREATE INDEX IF NOT EXISTS idx_rfq_requests_expires_at ON rfq_requests(expires_at);

ALTER TABLE rfq_requests ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Project members can create RFQ requests"
    ON rfq_requests FOR INSERT
    WITH CHECK (
        user_owns_project(project_id, auth.uid())
        OR user_has_edit_access(project_id, auth.uid())
    );

CREATE POLICY "Project members can update RFQ requests"
    ON rfq_requests FOR UPDATE
    USING (
        user_owns_project(project_id, auth.uid())
        OR user_has_edit_access(project_id, auth.uid())
    );

-- ============================================
-- 2. RFQ ITEMS
-- ============================================
CREATE TABLE IF NOT EXISTS rfq_items (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    rfq_id UUID NOT NULL REFERENCES rfq_requests(id) ON DELETE CASCADE,
    material_key TEXT NOT NULL,
    material_name TEXT,
    quantity DECIMAL(12,2) NOT NULL,
    unit TEXT,
    specifications TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_rfq_items_rfq_id ON rfq_items(rfq_id);
CREATE INDEX IF NOT EXISTS idx_rfq_items_material_key ON rfq_items(material_key);

ALTER TABLE rfq_items ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Project members can create RFQ items"
    ON rfq_items FOR INSERT
    WITH CHECK (
        EXISTS (
            SELECT 1 FROM rfq_requests r
            WHERE r.id = rfq_items.rfq_id
            AND (
                user_owns_project(r.project_id, auth.uid())
                OR user_has_edit_access(r.project_id, auth.uid())
            )
        )
    );

CREATE POLICY "Project members can update RFQ items"
    ON rfq_items FOR UPDATE
    USING (
        EXISTS (
            SELECT 1 FROM rfq_requests r
            WHERE r.id = rfq_items.rfq_id
            AND (
                user_owns_project(r.project_id, auth.uid())
                OR user_has_edit_access(r.project_id, auth.uid())
            )
        )
    );

-- ============================================
-- 3. RFQ RECIPIENTS (matched suppliers)
-- ============================================
CREATE TABLE IF NOT EXISTS rfq_recipients (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    rfq_id UUID NOT NULL REFERENCES rfq_requests(id) ON DELETE CASCADE,
    supplier_id UUID NOT NULL REFERENCES suppliers(id) ON DELETE CASCADE,
    status TEXT NOT NULL DEFAULT 'notified' CHECK (status IN ('notified', 'viewed', 'quoted', 'declined')),
    notification_channels TEXT[] NOT NULL DEFAULT '{email,whatsapp}',
    notified_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    last_viewed_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE (rfq_id, supplier_id)
);

CREATE INDEX IF NOT EXISTS idx_rfq_recipients_rfq_id ON rfq_recipients(rfq_id);
CREATE INDEX IF NOT EXISTS idx_rfq_recipients_supplier_id ON rfq_recipients(supplier_id);

ALTER TABLE rfq_recipients ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Project members can view RFQ recipients"
    ON rfq_recipients FOR SELECT
    USING (
        EXISTS (
            SELECT 1 FROM rfq_requests r
            WHERE r.id = rfq_recipients.rfq_id
            AND (
                user_owns_project(r.project_id, auth.uid())
                OR project_shared_with_user(r.project_id, auth.uid())
            )
        )
        OR EXISTS (
            SELECT 1 FROM suppliers s
            WHERE s.id = rfq_recipients.supplier_id
            AND s.user_id = auth.uid()
        )
    );

CREATE POLICY "Project members can create RFQ recipients"
    ON rfq_recipients FOR INSERT
    WITH CHECK (
        EXISTS (
            SELECT 1 FROM rfq_requests r
            WHERE r.id = rfq_recipients.rfq_id
            AND (
                user_owns_project(r.project_id, auth.uid())
                OR user_has_edit_access(r.project_id, auth.uid())
            )
        )
    );

CREATE POLICY "Suppliers can update own RFQ recipient status"
    ON rfq_recipients FOR UPDATE
    USING (
        EXISTS (
            SELECT 1 FROM suppliers s
            WHERE s.id = rfq_recipients.supplier_id
            AND s.user_id = auth.uid()
        )
    );

-- Now that rfq_recipients exists, add supplier visibility into RFQ items
CREATE POLICY "Project members can view RFQ items"
    ON rfq_items FOR SELECT
    USING (
        EXISTS (
            SELECT 1 FROM rfq_requests r
            WHERE r.id = rfq_items.rfq_id
            AND (
                user_owns_project(r.project_id, auth.uid())
                OR project_shared_with_user(r.project_id, auth.uid())
            )
        )
        OR EXISTS (
            SELECT 1
            FROM rfq_recipients rr
            JOIN suppliers s ON s.id = rr.supplier_id
            WHERE rr.rfq_id = rfq_items.rfq_id
              AND s.user_id = auth.uid()
        )
    );

-- Now that rfq_recipients exists, add supplier visibility into RFQ requests
CREATE POLICY "Project members can view RFQ requests"
    ON rfq_requests FOR SELECT
    USING (
        user_owns_project(project_id, auth.uid())
        OR project_shared_with_user(project_id, auth.uid())
        OR EXISTS (
            SELECT 1
            FROM rfq_recipients rr
            JOIN suppliers s ON s.id = rr.supplier_id
            WHERE rr.rfq_id = rfq_requests.id
              AND s.user_id = auth.uid()
        )
    );

-- ============================================
-- 4. RFQ QUOTES
-- ============================================
CREATE TABLE IF NOT EXISTS rfq_quotes (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    rfq_id UUID NOT NULL REFERENCES rfq_requests(id) ON DELETE CASCADE,
    supplier_id UUID NOT NULL REFERENCES suppliers(id) ON DELETE CASCADE,
    total_usd DECIMAL(12,2),
    total_zwg DECIMAL(12,2),
    delivery_days INTEGER,
    valid_until DATE,
    notes TEXT,
    status TEXT NOT NULL DEFAULT 'submitted' CHECK (status IN ('submitted', 'accepted', 'rejected', 'expired')),
    submitted_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE (rfq_id, supplier_id)
);

CREATE INDEX IF NOT EXISTS idx_rfq_quotes_rfq_id ON rfq_quotes(rfq_id);
CREATE INDEX IF NOT EXISTS idx_rfq_quotes_supplier_id ON rfq_quotes(supplier_id);
CREATE INDEX IF NOT EXISTS idx_rfq_quotes_status ON rfq_quotes(status);

CREATE TRIGGER update_rfq_quotes_updated_at
    BEFORE UPDATE ON rfq_quotes
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

ALTER TABLE rfq_quotes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Project members can view RFQ quotes"
    ON rfq_quotes FOR SELECT
    USING (
        EXISTS (
            SELECT 1 FROM rfq_requests r
            WHERE r.id = rfq_quotes.rfq_id
            AND (
                user_owns_project(r.project_id, auth.uid())
                OR project_shared_with_user(r.project_id, auth.uid())
            )
        )
        OR EXISTS (
            SELECT 1 FROM suppliers s
            WHERE s.id = rfq_quotes.supplier_id
            AND s.user_id = auth.uid()
        )
    );

CREATE POLICY "Suppliers can create RFQ quotes"
    ON rfq_quotes FOR INSERT
    WITH CHECK (
        EXISTS (
            SELECT 1 FROM suppliers s
            WHERE s.id = rfq_quotes.supplier_id
            AND s.user_id = auth.uid()
        )
    );

CREATE POLICY "Project members and suppliers can update RFQ quotes"
    ON rfq_quotes FOR UPDATE
    USING (
        EXISTS (
            SELECT 1 FROM rfq_requests r
            WHERE r.id = rfq_quotes.rfq_id
            AND (
                user_owns_project(r.project_id, auth.uid())
                OR user_has_edit_access(r.project_id, auth.uid())
            )
        )
        OR EXISTS (
            SELECT 1 FROM suppliers s
            WHERE s.id = rfq_quotes.supplier_id
            AND s.user_id = auth.uid()
        )
    );

-- ============================================
-- 5. RFQ QUOTE ITEMS
-- ============================================
CREATE TABLE IF NOT EXISTS rfq_quote_items (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    quote_id UUID NOT NULL REFERENCES rfq_quotes(id) ON DELETE CASCADE,
    rfq_item_id UUID NOT NULL REFERENCES rfq_items(id) ON DELETE CASCADE,
    unit_price_usd DECIMAL(12,2),
    unit_price_zwg DECIMAL(12,2),
    available_quantity DECIMAL(12,2),
    notes TEXT
);

CREATE INDEX IF NOT EXISTS idx_rfq_quote_items_quote_id ON rfq_quote_items(quote_id);
CREATE INDEX IF NOT EXISTS idx_rfq_quote_items_rfq_item_id ON rfq_quote_items(rfq_item_id);

ALTER TABLE rfq_quote_items ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Project members can view RFQ quote items"
    ON rfq_quote_items FOR SELECT
    USING (
        EXISTS (
            SELECT 1 FROM rfq_quotes q
            JOIN rfq_requests r ON r.id = q.rfq_id
            WHERE q.id = rfq_quote_items.quote_id
            AND (
                user_owns_project(r.project_id, auth.uid())
                OR project_shared_with_user(r.project_id, auth.uid())
            )
        )
        OR EXISTS (
            SELECT 1 FROM rfq_quotes q
            JOIN suppliers s ON s.id = q.supplier_id
            WHERE q.id = rfq_quote_items.quote_id
            AND s.user_id = auth.uid()
        )
    );

CREATE POLICY "Suppliers can create RFQ quote items"
    ON rfq_quote_items FOR INSERT
    WITH CHECK (
        EXISTS (
            SELECT 1 FROM rfq_quotes q
            JOIN suppliers s ON s.id = q.supplier_id
            WHERE q.id = rfq_quote_items.quote_id
            AND s.user_id = auth.uid()
        )
    );

CREATE POLICY "Suppliers can update RFQ quote items"
    ON rfq_quote_items FOR UPDATE
    USING (
        EXISTS (
            SELECT 1 FROM rfq_quotes q
            JOIN suppliers s ON s.id = q.supplier_id
            WHERE q.id = rfq_quote_items.quote_id
            AND s.user_id = auth.uid()
        )
    );

-- ============================================
-- 6. RFQ NOTIFICATION QUEUE
-- ============================================
CREATE TABLE IF NOT EXISTS rfq_notification_queue (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    rfq_id UUID NOT NULL REFERENCES rfq_requests(id) ON DELETE CASCADE,
    supplier_id UUID NOT NULL REFERENCES suppliers(id) ON DELETE CASCADE,
    channel TEXT NOT NULL CHECK (channel IN ('email', 'whatsapp')),
    payload JSONB,
    status TEXT NOT NULL DEFAULT 'queued' CHECK (status IN ('queued', 'sent', 'failed')),
    attempt_count INTEGER NOT NULL DEFAULT 0,
    last_error TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    sent_at TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_rfq_notification_queue_rfq_id ON rfq_notification_queue(rfq_id);
CREATE INDEX IF NOT EXISTS idx_rfq_notification_queue_supplier_id ON rfq_notification_queue(supplier_id);
CREATE INDEX IF NOT EXISTS idx_rfq_notification_queue_status ON rfq_notification_queue(status);

ALTER TABLE rfq_notification_queue ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Project members can view RFQ notification queue"
    ON rfq_notification_queue FOR SELECT
    USING (
        EXISTS (
            SELECT 1 FROM rfq_requests r
            WHERE r.id = rfq_notification_queue.rfq_id
            AND (
                user_owns_project(r.project_id, auth.uid())
                OR project_shared_with_user(r.project_id, auth.uid())
            )
        )
        OR EXISTS (
            SELECT 1 FROM suppliers s
            WHERE s.id = rfq_notification_queue.supplier_id
            AND s.user_id = auth.uid()
        )
    );

CREATE POLICY "Project members can create RFQ notification queue"
    ON rfq_notification_queue FOR INSERT
    WITH CHECK (
        EXISTS (
            SELECT 1 FROM rfq_requests r
            WHERE r.id = rfq_notification_queue.rfq_id
            AND (
                user_owns_project(r.project_id, auth.uid())
                OR user_has_edit_access(r.project_id, auth.uid())
            )
        )
    );

CREATE POLICY "Project members can update RFQ notification queue"
    ON rfq_notification_queue FOR UPDATE
    USING (
        EXISTS (
            SELECT 1 FROM rfq_requests r
            WHERE r.id = rfq_notification_queue.rfq_id
            AND (
                user_owns_project(r.project_id, auth.uid())
                OR user_has_edit_access(r.project_id, auth.uid())
            )
        )
    );

-- ============================================
-- 7. RFQ REQUEST ACCEPTED QUOTE
-- ============================================
ALTER TABLE rfq_requests
    ADD COLUMN IF NOT EXISTS accepted_quote_id UUID REFERENCES rfq_quotes(id);

CREATE INDEX IF NOT EXISTS idx_rfq_requests_accepted_quote_id ON rfq_requests(accepted_quote_id);
