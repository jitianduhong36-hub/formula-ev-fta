-- Apply once in a dedicated Supabase project. Only capability-checked RPCs
-- are exposed; the browser cannot list rooms or access tables directly.
create extension if not exists pgcrypto with schema extensions;
create table public.fta_rooms (
 id uuid primary key,
 token_hash bytea not null,
 model jsonb not null,
 revision bigint not null default 1,
 updated_at timestamptz not null default now()
);
alter table public.fta_rooms enable row level security;
revoke all on public.fta_rooms from anon, authenticated;

create function public.fta_validate(p_model jsonb) returns void
language plpgsql set search_path = '' as $$
begin
 if p_model is null or jsonb_typeof(p_model) <> 'object' or
    p_model->>'version' is distinct from '1' or
    jsonb_typeof(p_model->'nodes') is distinct from 'array' or
    octet_length(p_model::text)>200000 then
   raise exception 'Invalid FTA model';
 end if;
 if jsonb_array_length(p_model->'nodes') not between 1 and 150 then
   raise exception 'FTA node limit exceeded';
 end if;
end $$;
revoke all on function public.fta_validate(jsonb) from public;

create function public.fta_create(p_id uuid,p_token text,p_model jsonb) returns jsonb
language plpgsql security definer set search_path = '' as $$
begin
 if p_token is null or p_token !~ '^[0-9a-f]{64}$' then raise exception 'Invalid room key'; end if;
 perform public.fta_validate(p_model);
 insert into public.fta_rooms(id,token_hash,model) values(p_id,extensions.digest(p_token,'sha256'),p_model);
 return jsonb_build_object('model',p_model,'revision',1);
end $$;

create function public.fta_read(p_id uuid,p_token text) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare r public.fta_rooms;
begin
 select * into r from public.fta_rooms where id=p_id and token_hash=extensions.digest(p_token,'sha256');
 if not found then raise exception '共有ルームが見つからないか、アクセスキーが無効です'; end if;
 return jsonb_build_object('model',r.model,'revision',r.revision);
end $$;

create function public.fta_write(p_id uuid,p_token text,p_model jsonb,p_expected bigint) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare r public.fta_rooms;
begin
 select * into r from public.fta_rooms where id=p_id and token_hash=extensions.digest(p_token,'sha256') for update;
 if not found then raise exception '共有ルームが見つからないか、アクセスキーが無効です'; end if;
 if p_expected is distinct from r.revision then
  return jsonb_build_object('conflict',true,'model',r.model,'revision',r.revision);
 end if;
 perform public.fta_validate(p_model);
 update public.fta_rooms set model=p_model,revision=revision+1,updated_at=now() where id=p_id returning * into r;
 return jsonb_build_object('model',r.model,'revision',r.revision);
end $$;
revoke all on function public.fta_create(uuid,text,jsonb) from public;
revoke all on function public.fta_read(uuid,text) from public;
revoke all on function public.fta_write(uuid,text,jsonb,bigint) from public;
grant execute on function public.fta_create(uuid,text,jsonb) to anon;
grant execute on function public.fta_read(uuid,text) to anon;
grant execute on function public.fta_write(uuid,text,jsonb,bigint) to anon;
