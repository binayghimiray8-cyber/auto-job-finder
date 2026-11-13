-- Run in Supabase SQL Editor. Then turn OFF signups: Authentication > Providers > Email > "Allow new users to sign up".
create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  full_name text, dob date, email text, phone text, country text, city text, gpa text,
  skills text, languages text, portfolio text, linkedin text, other_info text,
  education jsonb not null default '[]', experience jsonb not null default '[]',
  certificates jsonb not null default '[]', projects jsonb not null default '[]',
  photo_path text, updated_at timestamptz default now()
);
alter table public.profiles enable row level security;
create policy "own profile select" on public.profiles for select using (id = auth.uid());
create policy "own profile insert" on public.profiles for insert with check (id = auth.uid());
create policy "own profile update" on public.profiles for update using (id = auth.uid()) with check (id = auth.uid());
create policy "own profile delete" on public.profiles for delete using (id = auth.uid());

insert into storage.buckets (id, name, public) values ('profile-photos', 'profile-photos', false) on conflict do nothing;
create policy "own photo select" on storage.objects for select using (bucket_id = 'profile-photos' and (storage.foldername(name))[1] = auth.uid()::text);
create policy "own photo insert" on storage.objects for insert with check (bucket_id = 'profile-photos' and (storage.foldername(name))[1] = auth.uid()::text);
create policy "own photo update" on storage.objects for update using (bucket_id = 'profile-photos' and (storage.foldername(name))[1] = auth.uid()::text);
create policy "own photo delete" on storage.objects for delete using (bucket_id = 'profile-photos' and (storage.foldername(name))[1] = auth.uid()::text);
