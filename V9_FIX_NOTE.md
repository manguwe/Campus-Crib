# V9 SQL fix

The `get_call_contact` RPC now explicitly casts profile name, phone, and auth email to `text`. This fixes PostgreSQL's `structure of query does not match function result type` error caused by returning varchar columns from a `returns table(... text ...)` function.

Run the corrected `supabase_sql/35_v9_call_identity_and_reliable_audio.sql` in Supabase SQL Editor.
