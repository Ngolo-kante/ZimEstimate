-- ============================================
-- Migration 028: Leads, Support Tickets & Audit Logs
-- ============================================

-- contact_requests: builder → supplier direct contact (Pro/Premium gated)
CREATE TABLE IF NOT EXISTS contact_requests (
    id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    builder_id    UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
    supplier_id   UUID NOT NULL REFERENCES suppliers(id) ON DELETE CASCADE,
    project_id    UUID REFERENCES projects(id) ON DELETE SET NULL,
    message       TEXT NOT NULL,
    status        TEXT NOT NULL DEFAULT 'new'
                    CHECK (status IN ('new', 'read', 'replied', 'archived')),
    builder_name  TEXT,
    builder_phone TEXT,
    builder_email TEXT,
    created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_contact_requests_supplier_id ON contact_requests(supplier_id);
CREATE INDEX IF NOT EXISTS idx_contact_requests_builder_id ON contact_requests(builder_id);
CREATE INDEX IF NOT EXISTS idx_contact_requests_status ON contact_requests(status);
CREATE INDEX IF NOT EXISTS idx_contact_requests_created_at ON contact_requests(created_at DESC);

ALTER TABLE contact_requests ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Builders can create contact requests"
    ON contact_requests FOR INSERT
    WITH CHECK (auth.uid() = builder_id);

CREATE POLICY "Builders can view own contact requests"
    ON contact_requests FOR SELECT
    USING (auth.uid() = builder_id);

CREATE POLICY "Suppliers can view contact requests sent to them"
    ON contact_requests FOR SELECT
    USING (
        EXISTS (
            SELECT 1 FROM suppliers
            WHERE suppliers.id = supplier_id
              AND suppliers.user_id = auth.uid()
        )
    );

CREATE POLICY "Suppliers can update contact request status"
    ON contact_requests FOR UPDATE
    USING (
        EXISTS (
            SELECT 1 FROM suppliers
            WHERE suppliers.id = supplier_id
              AND suppliers.user_id = auth.uid()
        )
    );

CREATE POLICY "Admins can view all contact requests"
    ON contact_requests FOR SELECT
    USING (
        EXISTS (
            SELECT 1 FROM profiles
            WHERE profiles.id = auth.uid()
              AND profiles.tier = 'admin'
        )
    );

-- support_tickets
CREATE TABLE IF NOT EXISTS support_tickets (
    id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id       UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
    subject       TEXT NOT NULL,
    description   TEXT NOT NULL,
    status        TEXT NOT NULL DEFAULT 'open'
                    CHECK (status IN ('open', 'in_progress', 'resolved', 'closed')),
    priority      TEXT NOT NULL DEFAULT 'normal'
                    CHECK (priority IN ('low', 'normal', 'high', 'urgent')),
    category      TEXT DEFAULT 'general',
    assigned_to   UUID REFERENCES profiles(id),
    resolved_at   TIMESTAMPTZ,
    created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_support_tickets_user_id ON support_tickets(user_id);
CREATE INDEX IF NOT EXISTS idx_support_tickets_status ON support_tickets(status);
CREATE INDEX IF NOT EXISTS idx_support_tickets_priority ON support_tickets(priority);
CREATE INDEX IF NOT EXISTS idx_support_tickets_created_at ON support_tickets(created_at DESC);

ALTER TABLE support_tickets ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can create own tickets"
    ON support_tickets FOR INSERT
    WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can view own tickets"
    ON support_tickets FOR SELECT
    USING (auth.uid() = user_id);

CREATE POLICY "Users can update own tickets"
    ON support_tickets FOR UPDATE
    USING (auth.uid() = user_id);

CREATE POLICY "Admins can manage all tickets"
    ON support_tickets FOR ALL
    USING (
        EXISTS (
            SELECT 1 FROM profiles
            WHERE profiles.id = auth.uid()
              AND profiles.tier = 'admin'
        )
    );

-- ticket_replies: threaded replies on a ticket
CREATE TABLE IF NOT EXISTS ticket_replies (
    id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    ticket_id   UUID NOT NULL REFERENCES support_tickets(id) ON DELETE CASCADE,
    author_id   UUID NOT NULL REFERENCES profiles(id),
    body        TEXT NOT NULL,
    is_internal BOOLEAN NOT NULL DEFAULT false,
    created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_ticket_replies_ticket_id ON ticket_replies(ticket_id);

ALTER TABLE ticket_replies ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Ticket owners can view non-internal replies"
    ON ticket_replies FOR SELECT
    USING (
        is_internal = false
        AND EXISTS (
            SELECT 1 FROM support_tickets
            WHERE support_tickets.id = ticket_id
              AND support_tickets.user_id = auth.uid()
        )
    );

CREATE POLICY "Ticket owners can add replies"
    ON ticket_replies FOR INSERT
    WITH CHECK (
        auth.uid() = author_id
        AND is_internal = false
        AND EXISTS (
            SELECT 1 FROM support_tickets
            WHERE support_tickets.id = ticket_id
              AND support_tickets.user_id = auth.uid()
        )
    );

CREATE POLICY "Admins can manage all replies"
    ON ticket_replies FOR ALL
    USING (
        EXISTS (
            SELECT 1 FROM profiles
            WHERE profiles.id = auth.uid()
              AND profiles.tier = 'admin'
        )
    );

-- system_audit_logs: append-only action trail
CREATE TABLE IF NOT EXISTS system_audit_logs (
    id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id       UUID REFERENCES profiles(id) ON DELETE SET NULL,
    action        TEXT NOT NULL,
    resource_type TEXT NOT NULL,
    resource_id   TEXT,
    metadata      JSONB DEFAULT '{}',
    ip_address    TEXT,
    created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_audit_logs_user_id ON system_audit_logs(user_id);
CREATE INDEX IF NOT EXISTS idx_audit_logs_resource ON system_audit_logs(resource_type, resource_id);
CREATE INDEX IF NOT EXISTS idx_audit_logs_created_at ON system_audit_logs(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_audit_logs_action ON system_audit_logs(action);

ALTER TABLE system_audit_logs ENABLE ROW LEVEL SECURITY;

-- Audit log is insert-only from service role; only admins can read
CREATE POLICY "Admins can view all audit logs"
    ON system_audit_logs FOR SELECT
    USING (
        EXISTS (
            SELECT 1 FROM profiles
            WHERE profiles.id = auth.uid()
              AND profiles.tier = 'admin'
        )
    );
