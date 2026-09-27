alter table public.travellers add column if not exists first_name text;
alter table public.travellers add column if not exists last_name text;

update public.travellers t
set first_name = case when array_length(arr, 1) = 1 then arr[1]
                      else array_to_string(arr[1:array_length(arr, 1) - 1], ' ') end,
    last_name  = case when array_length(arr, 1) = 1 then ''
                      else arr[array_length(arr, 1)] end
from (select id, regexp_split_to_array(trim(name), '\s+') as arr
      from public.travellers where coalesce(trim(name), '') <> '') s
where t.id = s.id and t.first_name is null and t.last_name is null;