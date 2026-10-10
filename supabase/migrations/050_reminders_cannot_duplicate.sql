-- ─── A pending reminder cannot be scheduled twice ───────────────────────────
--
-- The reminders table had no uniqueness of any kind. The UNIQUE constraint
-- added in migration 011 is on project_recurring_reminders, a different table,
-- so nothing ever stopped two identical rows being written.
--
-- It happened: three byte-identical compliance reminders for "Cottage house
-- Harare" were created 19 milliseconds apart — 01:38:12.654, .664 and .673.
-- Nineteen milliseconds is too fast for three deliberate clicks, but the
-- Schedule button had no in-flight guard and stayed enabled for the whole round
-- trip, so any burst of clicks or a retried request produced one row each. The
-- dispatcher reads this table at face value, so the cost of the bug is a
-- builder receiving the same reminder three times.
--
-- Fixing the button alone would only close the path we happen to know about.
-- This closes it for every caller, including the dispatcher's own
-- enqueue_due_project_reminders and anything added later.

-- Partial, on pending rows only. Two deliberate points:
--
--   * Once a reminder has been sent, is_sent flips to true and the row leaves
--     the index, so scheduling the same reminder again next month is still
--     allowed. Uniqueness is about "queued twice right now", not "never
--     repeated".
--   * The three existing duplicates are all is_sent = true already, so they sit
--     outside the index and the migration applies without having to delete
--     anybody's data.
--
-- item_id is excluded on purpose: the duplicates carried the same item_id as
-- each other, so including it would not have prevented them, and a NULL
-- item_id would make the whole key NULL-ish and stop the index biting at all
-- for requirement-level reminders, which is exactly the case that broke.
CREATE UNIQUE INDEX IF NOT EXISTS reminders_no_duplicate_pending
    ON reminders (user_id, project_id, message, scheduled_date)
    WHERE is_sent = FALSE;

COMMENT ON INDEX reminders_no_duplicate_pending IS
'Stops the same reminder being queued twice while it is still pending. Partial
on is_sent = FALSE so a reminder can legitimately be scheduled again after the
previous one has gone out. Callers should treat a 23505 here as "already
scheduled", not as a failure.';
