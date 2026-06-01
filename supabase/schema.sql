-- GalvBot optional Supabase persistence schema.
-- Apply this in the Supabase SQL editor (or via the CLI) only if you want to
-- use the Supabase StorageProvider instead of the default localStorage adapter.

create table if not exists public.layout_projects (
  id text primary key,
  name text not null,
  data jsonb not null,
  updated_at timestamptz not null default now()
);

-- The MVP uses the anon key directly from the browser. For a single-tenant
-- demo you can keep RLS disabled. For multi-tenant use, enable RLS and add an
-- owner column + policies keyed to auth.uid().
alter table public.layout_projects enable row level security;

-- Permissive demo policy (anon can read/write). REPLACE for production.
create policy "demo full access"
  on public.layout_projects
  for all
  using (true)
  with check (true);
