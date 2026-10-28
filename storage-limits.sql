-- Existing RPC permissions and row data remain unchanged. Byte limits apply to
-- each model, not the free plan's total database quota.
create or replace function public.fta_validate(p_model jsonb) returns void
language plpgsql set search_path = '' as $$
begin
 if p_model is null or jsonb_typeof(p_model) <> 'object' or
    p_model->>'version' is distinct from '1' or
    jsonb_typeof(p_model->'nodes') is distinct from 'array' then
  raise exception 'Invalid FTA model';
 end if;
 if octet_length(p_model::text)>2097152 then raise exception 'FTA model exceeds 2MiB storage limit'; end if;
 if jsonb_array_length(p_model->'nodes') not between 1 and 300 then raise exception 'FTA node limit exceeded (300)'; end if;
end $$;
