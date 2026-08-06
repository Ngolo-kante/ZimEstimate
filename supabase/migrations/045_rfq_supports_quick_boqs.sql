-- ─── The RFQ transaction function learns the other owner ─────────────────────
--
-- create_rfq_with_items_and_recipients required p_project_id, so there was no
-- way to run a quick estimate's "Request quotes" through the same atomic path
-- a full project's RFQ already uses. createQuickQuoteRequest worked around
-- that by hand-rolling its own plain inserts with no recipients and no
-- notification at all — the request reached the database and nobody else.
--
-- p_project_id becomes optional and p_quick_boq_id joins it, matching the
-- "exactly one owner" shape rfq_requests itself has enforced since migration
-- 043. Existing callers are unaffected: create_rfq_request in rfq.ts passes
-- p_project_id by name, so an added, defaulted parameter changes nothing for
-- full projects.

-- CREATE OR REPLACE only truly replaces a function when its parameter list is
-- unchanged. Adding p_quick_boq_id changes the argument count, so without
-- this DROP, Postgres would keep the original 7-argument function AND add
-- this one as a second overload of the same name — leaving PostgREST to
-- guess which one a caller meant, rather than there being a single function
-- to call.
DROP FUNCTION IF EXISTS create_rfq_with_items_and_recipients(
    UUID, UUID, TEXT, DATE, TEXT, JSONB, JSONB
);

CREATE FUNCTION create_rfq_with_items_and_recipients(
    p_project_id UUID DEFAULT NULL,
    p_user_id UUID DEFAULT NULL,
    p_delivery_address TEXT DEFAULT NULL,
    p_required_by DATE DEFAULT NULL,
    p_notes TEXT DEFAULT NULL,
    p_items JSONB DEFAULT '[]'::jsonb,
    p_recipients JSONB DEFAULT '[]'::jsonb,
    p_quick_boq_id UUID DEFAULT NULL
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
    IF p_user_id IS NULL THEN
        RAISE EXCEPTION 'p_user_id is required';
    END IF;

    -- Left to the table's own CHECK constraint (rfq_requests_exactly_one_owner)
    -- rather than duplicated here, so there is one place this rule can drift.
    INSERT INTO rfq_requests (
        project_id,
        quick_boq_id,
        user_id,
        delivery_address,
        required_by,
        notes,
        status
    )
    VALUES (
        p_project_id,
        p_quick_boq_id,
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

    v_result := jsonb_build_object(
        'rfq_id', v_rfq_id,
        'item_ids', to_jsonb(v_item_ids),
        'recipient_ids', to_jsonb(v_recipient_ids)
    );

    RETURN v_result;
EXCEPTION
    WHEN OTHERS THEN
        RAISE WARNING 'RFQ creation failed: %', SQLERRM;
        RAISE;
END;
$$;

GRANT EXECUTE ON FUNCTION create_rfq_with_items_and_recipients(
    UUID, UUID, TEXT, DATE, TEXT, JSONB, JSONB, UUID
) TO authenticated;

COMMENT ON FUNCTION create_rfq_with_items_and_recipients(
    UUID, UUID, TEXT, DATE, TEXT, JSONB, JSONB, UUID
) IS
'Creates an RFQ request with items and recipients atomically, against either
a project or a quick estimate — exactly one of p_project_id / p_quick_boq_id.
If any part fails, the entire operation is rolled back.
Returns a JSONB object with rfq_id, item_ids, and recipient_ids.';
