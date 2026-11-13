-- Run after schema.sql
create table if not exists public.jobs (
  id uuid primary key default gen_random_uuid(), user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  title text not null, company text, location text, salary text, category text default 'Other',
  foreign_label text default 'Foreign eligibility unknown', deadline date, description text, url text, source text,
  retrieved_at timestamptz, match_score int, match_why jsonb, match_missing jsonb, match_note text, created_at timestamptz default now()
);
create table if not exists public.documents (
  id uuid primary key default gen_random_uuid(), user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  job_id uuid references public.jobs(id) on delete set null, kind text not null check (kind in ('cv','cover')),
  title text, content text, with_photo boolean default false, created_at timestamptz default now()
);
create table if not exists public.applications (
  id uuid primary key default gen_random_uuid(), user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  job_id uuid references public.jobs(id) on delete set null, company text, title text, url text,
  status text not null default 'Prepared', applied_at date, interview_at date, cv_id uuid, cover_id uuid, notes text, response text,
  created_at timestamptz default now()
);
do $$ declare t text; begin
  foreach t in array array['jobs','documents','applications'] loop
    execute format('alter table public.%I enable row level security', t);
    execute format('create policy "own select" on public.%I for select using (user_id = auth.uid())', t);
    execute format('create policy "own insert" on public.%I for insert with check (user_id = auth.uid())', t);
    execute format('create policy "own update" on public.%I for update using (user_id = auth.uid()) with check (user_id = auth.uid())', t);
    execute format('create policy "own delete" on public.%I for delete using (user_id = auth.uid())', t);
  end loop; end $$;
