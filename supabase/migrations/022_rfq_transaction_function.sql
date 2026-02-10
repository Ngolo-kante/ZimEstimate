-- ============================================
-- Migration 022: RFQ Transaction Function
-- DB-001 FIX: Wrap RFQ creation in a database transaction
-- ============================================

-- Create a function that creates an RFQ with items and recipients atomically
-- This ensures that if any part fails, the entire operation is rolled back
CREATE OR REPLACE FUNCTION create_rfq_with_items_and_recipients(
    p_project_id UUID,
    p_user_id UUID,
    p_delivery_address TEXT,
    p_required_by DATE,
    p_notes TEXT,
    p_items JSONB,
    p_recipients JSONB
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_rfq_id UUID;
    v_item JSONB;
    v_recipient JSONB;
    v_result JSONB;
    v_item_ids UUID[];
    v_recipient_ids UUID[];
    v_new_item_id UUID;
    v_new_recipient_id UUID;
BEGIN
    -- Create the RFQ request
    INSERT INTO rfq_requests (
        project_id,
        user_id,
        delivery_address,
        required_by,
        notes,
        status
    )
    VALUES (
        p_project_id,
        p_user_id,
        p_delivery_address,
        p_required_by,
        p_notes,
        'open'
    )
    RETURNING id INTO v_rfq_id;

    -- Create RFQ items
    v_item_ids := ARRAY[]::UUID[];
    FOR v_item IN SELECT * FROM jsonb_array_elements(p_items)
    LOOP
        INSERT INTO rfq_items (
            rfq_id,
            material_key,
            material_name,
            quantity,
            unit
        )
        VALUES (
            v_rfq_id,
            v_item->>'material_key',
            v_item->>'material_name',
            (v_item->>'quantity')::DECIMAL,
            v_item->>'unit'
        )
        RETURNING id INTO v_new_item_id;

        v_item_ids := array_append(v_item_ids, v_new_item_id);
    END LOOP;

    -- Create RFQ recipients
    v_recipient_ids := ARRAY[]::UUID[];
    FOR v_recipient IN SELECT * FROM jsonb_array_elements(p_recipients)
    LOOP
        INSERT INTO rfq_recipients (
            rfq_id,
            supplier_id,
            status,
            notification_channels
        )
        VALUES (
            v_rfq_id,
            (v_recipient->>'supplier_id')::UUID,
            COALESCE(v_recipient->>'status', 'notified'),
            COALESCE(
                ARRAY(SELECT jsonb_array_elements_text(v_recipient->'notification_channels')),
                ARRAY['email', 'whatsapp']
            )
        )
        RETURNING id INTO v_new_recipient_id;

        v_recipient_ids := array_append(v_recipient_ids, v_new_recipient_id);
    END LOOP;

    -- Return the created IDs
    v_result := jsonb_build_object(
        'rfq_id', v_rfq_id,
        'item_ids', to_jsonb(v_item_ids),
        'recipient_ids', to_jsonb(v_recipient_ids)
    );

    RETURN v_result;
EXCEPTION
    WHEN OTHERS THEN
        -- Log the error and re-raise
        RAISE WARNING 'RFQ creation failed: %', SQLERRM;
        RAISE;
END;
$$;

-- Grant execute permission to authenticated users
GRANT EXECUTE ON FUNCTION create_rfq_with_items_and_recipients TO authenticated;

-- Add a comment explaining the function
COMMENT ON FUNCTION create_rfq_with_items_and_recipients IS
'Creates an RFQ request with items and recipients atomically.
If any part fails, the entire operation is rolled back.
Returns a JSONB object with rfq_id, item_ids, and recipient_ids.';
