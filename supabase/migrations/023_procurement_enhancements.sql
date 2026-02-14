-- Sprint 1: Procurement enhancements
-- Manual purchase receipts + RFQ link

ALTER TABLE purchase_records
  ADD COLUMN IF NOT EXISTS receipt_document_id UUID REFERENCES project_documents(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS rfq_quote_id UUID REFERENCES rfq_quotes(id) ON DELETE SET NULL;

ALTER TABLE procurement_requests
  ADD COLUMN IF NOT EXISTS workflow_state TEXT DEFAULT 'draft';
