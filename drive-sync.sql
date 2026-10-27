-- Only new rooms (and explicitly enrolled existing rooms) are copied to Drive.
create schema if not exists fta_private;
revoke all on schema fta_private from public,anon,authenticated;
create table fta_private.drive_settings (
 singleton boolean primary key default true check(singleton),
 key_hash bytea not null,
 enabled boolean not null default false,
 worker_seen timestamptz
);
create table fta_private.drive_jobs (
 room_id uuid primary key references public.fta_rooms(id) on delete cascade,
 requested bigint not null,
 saved bigint not null default 0,
 file_id text,
 synced_at timestamptz,
 last_error text,
 attempts integer not null default 0,
 next_attempt timestamptz not null default now(),
 lease_token uuid,
 lease_until timestamptz
);
alter table fta_private.drive_settings enable row level security;
alter table fta_private.drive_jobs enable row level security;
revoke all on all tables in schema fta_private from public,anon,authenticated;
create function fta_private.enqueue_drive() returns trigger language plpgsql security definer set search_path='' as $$
begin
 if TG_OP='INSERT' then
  insert into fta_private.drive_jobs(room_id,requested) values(new.id,new.revision);
 else
  update fta_private.drive_jobs set requested=new.revision,next_attempt=least(next_attempt,now()) where room_id=new.id;
 end if;
 return new;
end $$;
revoke all on function fta_private.enqueue_drive() from public,anon,authenticated;
create trigger fta_drive_queue after insert or update of model on public.fta_rooms for each row execute function fta_private.enqueue_drive();

create function fta_private.check_export_key(k text) returns void language plpgsql security definer set search_path='' as $$
begin
 if k is null or not exists(select 1 from fta_private.drive_settings where key_hash=extensions.digest(k,'sha256')) then raise exception 'Invalid export key';end if;
end $$;
revoke all on function fta_private.check_export_key(text) from public,anon,authenticated;

create function public.fta_drive_activate(p_key text) returns jsonb language plpgsql security definer set search_path='' as $$
begin perform fta_private.check_export_key(p_key);update fta_private.drive_settings set enabled=true,worker_seen=now();return jsonb_build_object('enabled',true);end $$;

create function public.fta_drive_pull(p_key text,p_limit integer default 5) returns jsonb language plpgsql security definer set search_path='' as $$
declare j record; items jsonb:='[]'::jsonb; lease uuid;
begin
 perform fta_private.check_export_key(p_key);
 if not exists(select 1 from fta_private.drive_settings where enabled) then return items;end if;
 update fta_private.drive_settings set worker_seen=now();
 for j in select q.room_id,r.model,r.revision,q.file_id from fta_private.drive_jobs q join public.fta_rooms r on r.id=q.room_id
 where q.requested>q.saved and q.next_attempt<=now() and (q.lease_until is null or q.lease_until<now())
 order by q.next_attempt limit greatest(1,least(coalesce(p_limit,5),10)) for update of q skip locked loop
  lease:=gen_random_uuid();update fta_private.drive_jobs set lease_token=lease,lease_until=now()+interval '4 minutes' where room_id=j.room_id;
  items:=items||jsonb_build_array(jsonb_build_object('id',j.room_id,'model',j.model,'revision',j.revision,'file_id',j.file_id,'lease',lease));
 end loop;return items;
end $$;

create function public.fta_drive_ack(p_key text,p_id uuid,p_lease uuid,p_revision bigint,p_file_id text,p_error text default null) returns jsonb language plpgsql security definer set search_path='' as $$
begin
 perform fta_private.check_export_key(p_key);
 if p_error is null and (p_file_id is null or p_file_id !~ '^[A-Za-z0-9_-]{10,200}$') then raise exception 'Invalid Drive file id';end if;
 if p_revision is null or p_revision<1 then raise exception 'Invalid revision';end if;
 update fta_private.drive_jobs set
  saved=case when p_error is null then greatest(saved,least(p_revision,requested)) else saved end,
  file_id=case when p_error is null then p_file_id else file_id end,
  synced_at=case when p_error is null then now() else synced_at end,
  last_error=left(p_error,300),attempts=case when p_error is null then 0 else attempts+1 end,
  next_attempt=case when p_error is null then now() else now()+make_interval(secs=>least(3600,60*(2^least(attempts,5)))::integer) end,
  lease_token=null,lease_until=null
 where room_id=p_id and lease_token=p_lease;
 if not found then return jsonb_build_object('accepted',false);end if;
 return jsonb_build_object('accepted',true);
end $$;

create function public.fta_drive_status(p_id uuid,p_token text) returns jsonb language plpgsql security definer set search_path='' as $$
declare q fta_private.drive_jobs; s fta_private.drive_settings;
begin
 if not exists(select 1 from public.fta_rooms where id=p_id and token_hash=extensions.digest(p_token,'sha256')) then raise exception 'Invalid room key';end if;
 select * into q from fta_private.drive_jobs where room_id=p_id;select * into s from fta_private.drive_settings;
 return jsonb_build_object('enrolled',q.room_id is not null,'enabled',coalesce(s.enabled,false),'worker_seen',s.worker_seen,'requested',q.requested,'saved',q.saved,'file_id',q.file_id,'synced_at',q.synced_at,'error',q.last_error);
end $$;
create function public.fta_drive_enroll(p_id uuid,p_token text) returns jsonb language plpgsql security definer set search_path='' as $$
begin
 if not exists(select 1 from public.fta_rooms where id=p_id and token_hash=extensions.digest(p_token,'sha256')) then raise exception 'Invalid room key';end if;
 insert into fta_private.drive_jobs(room_id,requested) select id,revision from public.fta_rooms where id=p_id on conflict(room_id) do update set requested=excluded.requested,next_attempt=now();
 return public.fta_drive_status(p_id,p_token);
end $$;
revoke all on function public.fta_drive_activate(text) from public,authenticated;
revoke all on function public.fta_drive_pull(text,integer) from public,authenticated;
revoke all on function public.fta_drive_ack(text,uuid,uuid,bigint,text,text) from public,authenticated;
revoke all on function public.fta_drive_status(uuid,text) from public,authenticated;
revoke all on function public.fta_drive_enroll(uuid,text) from public,authenticated;
grant execute on function public.fta_drive_activate(text),public.fta_drive_pull(text,integer),public.fta_drive_ack(text,uuid,uuid,bigint,text,text),public.fta_drive_status(uuid,text),public.fta_drive_enroll(uuid,text) to anon;
