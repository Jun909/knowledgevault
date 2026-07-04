-- Run this once in the Supabase SQL editor (Project > SQL Editor > New query).

create table if not exists folders (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  parent_id uuid references folders(id) on delete cascade,
  created_at timestamptz not null default now()
);

create table if not exists notes (
  id uuid primary key default gen_random_uuid(),
  folder_id uuid references folders(id) on delete cascade,
  title text not null default 'Untitled',
  content jsonb not null default '[]',
  created_by uuid references auth.users(id),
  updated_at timestamptz not null default now()
);

alter table notes add column if not exists last_edited_by text;

-- Base64-encoded Yjs doc snapshot (Y.encodeStateAsUpdate), used for live
-- collaborative editing. Null until a note is first opened after this
-- column was added, at which point it's seeded from `content`.
alter table notes add column if not exists doc_state text;

create index if not exists folders_parent_id_idx on folders(parent_id);
create index if not exists notes_folder_id_idx on notes(folder_id);

alter table folders enable row level security;
alter table notes enable row level security;

-- Only 3 trusted users share one workspace: any authenticated user can
-- read/write everything. No public signup, no per-user ownership.
create policy "authenticated read/write folders"
  on folders for all
  to authenticated
  using (true)
  with check (true);

create policy "authenticated read/write notes"
  on notes for all
  to authenticated
  using (true)
  with check (true);

-- Realtime (Postgres Changes) so the sidebar's folder/note list updates live
-- across clients instead of requiring a refresh. Safe to re-run: skips
-- tables already in the publication.
do $$
begin
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'folders'
  ) then
    alter publication supabase_realtime add table folders;
  end if;
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'notes'
  ) then
    alter publication supabase_realtime add table notes;
  end if;
end $$;
