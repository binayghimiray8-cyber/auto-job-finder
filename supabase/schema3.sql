-- Run after schema2.sql
create table if not exists public.job_sources (id uuid primary key default gen_random_uuid(), user_id uuid not null default auth.uid() references auth.users(id) on delete cascade, name text, url text not null, last_run timestamptz, last_status text, created_at timestamptz default now());
create table if not exists public.notifications (id uuid primary key default gen_random_uuid(), user_id uuid not null default auth.uid() references auth.users(id) on delete cascade, kind text not null, title text, body text, ref text not null default '', read boolean default false, created_at timestamptz default now(), unique (user_id, kind, ref));
create table if not exists public.conversations (id uuid primary key default gen_random_uuid(), user_id uuid not null default auth.uid() references auth.users(id) on delete cascade, role text not null, text text not null, created_at timestamptz default now());
do $$ declare t text; begin
  foreach t in array array['job_sources','notifications','conversations'] loop
    execute format('alter table public.%I enable row level security', t);
    execute format('create policy "own select" on public.%I for select using (user_id = auth.uid())', t);
    execute format('create policy "own insert" on public.%I for insert with check (user_id = auth.uid())', t);
    execute format('create policy "own update" on public.%I for update using (user_id = auth.uid()) with check (user_id = auth.uid())', t);
    execute format('create policy "own delete" on public.%I for delete using (user_id = auth.uid())', t);
  end loop; end $$;
