-- Check columns:
select column_name, data_type
from information_schema.columns
where table_schema = 'public' and table_name = 'feedback'
order by ordinal_position;

-- Check policies:
select policyname, cmd
from pg_policies
where schemaname = 'public' and tablename = 'feedback';
