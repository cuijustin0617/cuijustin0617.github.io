-- Wout on Supabase: paste into Dashboard → SQL Editor → New query → Run. Safe to re-run.
-- Same model as the original Wout: one JSON WorkoutState per user + an optimistic-concurrency revision.

create table if not exists public.user_state (
  user_id    uuid primary key references auth.users (id) on delete cascade,
  data       jsonb not null,
  revision   integer not null default 1,
  updated_at timestamptz not null default now(),
  constraint user_state_shape check (
    jsonb_typeof(data) = 'object'
    and jsonb_typeof(data -> 'history') = 'array'
    and jsonb_typeof(data -> 'favorites') = 'array'
    and jsonb_typeof(data -> 'profile') = 'object'
  ),
  constraint user_state_size check (octet_length(data::text) <= 4000000)
);

alter table public.user_state enable row level security;

-- Each signed-in user can read only their own row. Writes go through save_wout_state() below.
drop policy if exists "read own state" on public.user_state;
create policy "read own state" on public.user_state
  for select to authenticated using ((select auth.uid()) = user_id);

drop policy if exists "insert own state" on public.user_state;
create policy "insert own state" on public.user_state
  for insert to authenticated with check ((select auth.uid()) = user_id);

drop policy if exists "update own state" on public.user_state;
create policy "update own state" on public.user_state
  for update to authenticated using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);

revoke all on public.user_state from anon;
grant select, insert, update on public.user_state to authenticated;

-- Save with optimistic concurrency. revision 0 = first save. Returns {revision, conflict}.
create or replace function public.save_wout_state(p_data jsonb, p_revision integer)
returns jsonb
language plpgsql
security invoker
set search_path = public
as $$
declare
  uid uuid := auth.uid();
  new_revision integer;
begin
  if uid is null then
    raise exception 'Sign in to save.' using errcode = '28000';
  end if;
  if p_revision is null or p_revision < 0 then
    raise exception 'Invalid revision' using errcode = '22023';
  end if;

  if p_revision = 0 then
    insert into public.user_state (user_id, data, revision, updated_at)
    values (uid, p_data, 1, now())
    on conflict (user_id) do nothing;
    if found then
      return jsonb_build_object('revision', 1, 'conflict', false);
    end if;
  else
    update public.user_state
       set data = p_data, revision = revision + 1, updated_at = now()
     where user_id = uid and revision = p_revision
    returning revision into new_revision;
    if new_revision is not null then
      return jsonb_build_object('revision', new_revision, 'conflict', false);
    end if;
  end if;

  return jsonb_build_object('revision', p_revision, 'conflict', true);
end;
$$;

revoke all on function public.save_wout_state(jsonb, integer) from public, anon;
grant execute on function public.save_wout_state(jsonb, integer) to authenticated;
