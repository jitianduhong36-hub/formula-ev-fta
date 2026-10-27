create table public.fta_presence (
 room_id uuid not null references public.fta_rooms(id) on delete cascade,
 client_id uuid not null,
 display_name text not null check(length(display_name) between 1 and 32),
 seen_revision bigint not null,
 state text not null check(state in ('synced','editing','saving','conflict')),
 last_seen timestamptz not null default now(),
 primary key(room_id,client_id)
);
create index fta_presence_recent on public.fta_presence(room_id,last_seen);
alter table public.fta_presence enable row level security;
revoke all on public.fta_presence from public,anon,authenticated;
create function public.fta_presence_ping(p_id uuid,p_token text,p_client uuid,p_name text,p_seen bigint,p_state text) returns jsonb
language plpgsql security definer set search_path='' as $$
declare current_revision bigint; peers jsonb;
begin
 select revision into current_revision from public.fta_rooms where id=p_id and token_hash=extensions.digest(p_token,'sha256');
 if not found then raise exception '共有ルームが見つからないか、アクセスキーが無効です'; end if;
 if p_name is null or length(trim(p_name)) not between 1 and 32 or p_seen is null or p_seen<0 or p_state not in ('synced','editing','saving','conflict') then raise exception 'Invalid presence'; end if;
 delete from public.fta_presence where room_id=p_id and last_seen<now()-interval '2 minutes';
 insert into public.fta_presence(room_id,client_id,display_name,seen_revision,state,last_seen)
 values(p_id,p_client,trim(p_name),least(p_seen,current_revision),p_state,now())
 on conflict(room_id,client_id) do update set display_name=excluded.display_name,seen_revision=excluded.seen_revision,state=excluded.state,last_seen=excluded.last_seen;
 select coalesce(jsonb_agg(jsonb_build_object('client',client_id,'name',display_name,'seen',seen_revision,'state',state) order by last_seen desc),'[]'::jsonb) into peers
 from public.fta_presence where room_id=p_id and last_seen>now()-interval '30 seconds';
 return jsonb_build_object('revision',current_revision,'peers',peers);
end $$;
revoke all on function public.fta_presence_ping(uuid,text,uuid,text,bigint,text) from public,authenticated;
grant execute on function public.fta_presence_ping(uuid,text,uuid,text,bigint,text) to anon;
