# Database migrations

From 30 October 2026, Supabase no longer grants new `public` tables to the
Data API roles automatically. A new table without its own `GRANT` works in the
SQL editor but the app gets "permission denied for table" (error 42501).
Existing tables keep their grants.

Every migration that creates a table or view in `public` must include, in the
same file:

```sql
ALTER TABLE public.my_table ENABLE ROW LEVEL SECURITY;
CREATE POLICY ... ;                                    -- who sees which rows
GRANT SELECT ON public.my_table TO anon;               -- only if the public reads it
GRANT SELECT, INSERT, UPDATE, DELETE ON public.my_table TO authenticated;  -- only what is needed
GRANT ALL ON public.my_table TO service_role;
```

- Views: create them `WITH (security_invoker = on)` and grant them the same way.
- A `serial` column also needs `GRANT USAGE, SELECT ON SEQUENCE ...`; identity
  columns do not.
- Never `GRANT ... ON ALL TABLES IN SCHEMA public`, because it exposes private
  tables too.

`src/lib/server/migrationGrants.test.ts` fails the test run if a migration
from 066 on misses the grant, the RLS line or `security_invoker`.
