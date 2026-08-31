-- Habit Nemesis: everything the account needs, in one file.
--
-- Paste into the Supabase dashboard, SQL Editor, and run once. Safe to re-run.
--
-- The app keeps its whole record in one localStorage key, so the account keeps
-- one row per user. That is not laziness: the record is read and written as a
-- whole by store.js, and splitting it into tables here would put a second,
-- differently shaped copy of the schema in a place that cannot be kept in step
-- with hydrate(). One jsonb column, sanitised by hydrate() on the way back in.
--
-- The publishable key ships inside the app and anyone can read it, so Row Level
-- Security is the whole of the security model. Every policy below is scoped to
-- auth.uid(), and every table has RLS enabled. A table without one of these is
-- a table the world can read.

/* ---------------- the record ---------------- */

create table if not exists public.habit_state (
  user_id    uuid primary key references auth.users (id) on delete cascade,
  state      jsonb       not null,
  updated_at timestamptz not null default now()
);

alter table public.habit_state enable row level security;

-- Four policies rather than one `for all`, so each verb is readable on its own.
-- auth.uid() is wrapped in a select so Postgres caches it per statement instead
-- of calling it per row.

drop policy if exists "read own record"   on public.habit_state;
drop policy if exists "insert own record" on public.habit_state;
drop policy if exists "update own record" on public.habit_state;
drop policy if exists "delete own record" on public.habit_state;

create policy "read own record" on public.habit_state
  for select to authenticated
  using ((select auth.uid()) = user_id);

create policy "insert own record" on public.habit_state
  for insert to authenticated
  with check ((select auth.uid()) = user_id);

-- Both halves: `using` picks the row, `with check` stops it being handed to
-- somebody else on the way out.
create policy "update own record" on public.habit_state
  for update to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

create policy "delete own record" on public.habit_state
  for delete to authenticated
  using ((select auth.uid()) = user_id);

/* ---------------- deleting yourself ---------------- */
-- Both stores require account deletion from inside the app, and deleting an
-- auth user needs a privileged key that must never be in www/. A definer
-- function is the way round it: it runs with the owner's rights but reads
-- auth.uid() itself, so it can only ever delete the caller.

create or replace function public.delete_own_account()
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  me uuid := auth.uid();
begin
  if me is null then
    raise exception 'not signed in';
  end if;
  delete from public.habit_state where user_id = me;
  delete from auth.users where id = me;
end;
$$;

revoke all on function public.delete_own_account() from public, anon;
grant execute on function public.delete_own_account() to authenticated;

/* ---------------- keeping the project awake ---------------- */
-- A free project is paused after seven days of low database activity and only a
-- manual click brings it back. During review, or a quiet launch week, that is an
-- outage: every sign-in fails and the reviewer rejects the build. The workflow
-- in .github/workflows/supabase-keepalive.yml reads this table once a day so
-- there is real database activity. Delete both once the project is on a paid
-- plan, where pausing does not apply.

create table if not exists public.keepalive (id int primary key);
insert into public.keepalive (id) values (1) on conflict do nothing;

alter table public.keepalive enable row level security;

drop policy if exists "anyone may read the keepalive row" on public.keepalive;
create policy "anyone may read the keepalive row" on public.keepalive
  for select to anon, authenticated using (true);
