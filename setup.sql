-- Run in Supabase Dashboard -> SQL Editor. This creates a public download catalog
-- with a separate allowlist for admin accounts. Paste your own admin auth user UUID
-- into the INSERT command shown in README AFTER creating your Auth user.
create extension if not exists pgcrypto;
create table if not exists public.admin_users (
  user_id uuid primary key references auth.users(id) on delete cascade
);
create table if not exists public.fics (
  id uuid primary key default gen_random_uuid(),
  file_path text not null unique,
  filename text not null,
  format text not null,
  title text not null,
  author text not null default '',
  summary text not null default '',
  fandom text not null default '',
  relationships text[] not null default '{}',
  characters text[] not null default '{}',
  tags text[] not null default '{}',
  warnings text[] not null default '{}',
  category text not null default '',
  rating text not null default '',
  words integer,
  chapters text not null default '',
  published_date date,
  source_url text not null default '',
  source_type text not null default 'unsorted' check (source_type in ('ao3','unsorted')),
  sha256 text unique,
  published boolean not null default false,
  created_at timestamptz not null default now()
);
create index if not exists fics_public_idx on public.fics (published,created_at desc);
alter table public.admin_users enable row level security;
alter table public.fics enable row level security;

-- Membership query is limited to the authenticated user; the table cannot be
-- queried by the public. The security definer function avoids RLS recursion.
create or replace function public.is_fic_admin()
returns boolean language sql stable security definer set search_path = '' as $$
  select exists (select 1 from public.admin_users where user_id = (select auth.uid()));
$$;
revoke all on function public.is_fic_admin() from public;
grant execute on function public.is_fic_admin() to anon, authenticated;

create policy "Admins check their own allowlist entry" on public.admin_users
 for select to authenticated using (user_id = (select auth.uid()));
create policy "Public can read published fics" on public.fics
 for select to anon, authenticated using (published = true or (select public.is_fic_admin()));
create policy "Only admins create fics" on public.fics
 for insert to authenticated with check ((select public.is_fic_admin()));
create policy "Only admins update fics" on public.fics
 for update to authenticated using ((select public.is_fic_admin())) with check ((select public.is_fic_admin()));
create policy "Only admins delete fics" on public.fics
 for delete to authenticated using ((select public.is_fic_admin()));

-- Public bucket: anybody with a file URL can download it. Write/delete
-- operations still require admin authorization through Storage RLS.
insert into storage.buckets (id,name,public,file_size_limit)
 values ('fic-downloads','fic-downloads',true,52428800)
 on conflict (id) do update set public = true;
create policy "Fic admins upload files" on storage.objects for insert to authenticated
 with check (bucket_id = 'fic-downloads' and (select public.is_fic_admin()));
create policy "Fic admins remove files" on storage.objects for delete to authenticated
 using (bucket_id = 'fic-downloads' and (select public.is_fic_admin()));
create policy "Fic admins view stored object rows" on storage.objects for select to authenticated
 using (bucket_id = 'fic-downloads' and (select public.is_fic_admin()));
