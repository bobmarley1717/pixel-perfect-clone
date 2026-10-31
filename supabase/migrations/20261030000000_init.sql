-- EchoNature AI cloud storage.
-- There are no user accounts, so both tables are a shared public library:
-- anyone can read and add rows, nobody can edit or delete them through the API.

create table if not exists public.compositions (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  prompt text not null check (char_length(prompt) <= 500),
  title text not null check (char_length(title) between 1 and 60),
  composition jsonb not null check (jsonb_typeof(composition) = 'object' and pg_column_size(composition) < 16000)
);

create table if not exists public.biomes (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  name text not null unique check (char_length(name) between 1 and 24),
  sounds text[] not null check (cardinality(sounds) between 1 and 6)
);

alter table public.compositions enable row level security;
alter table public.biomes enable row level security;

create policy "Anyone can read compositions" on public.compositions for select to anon, authenticated using (true);
create policy "Anyone can save compositions" on public.compositions for insert to anon, authenticated with check (true);
create policy "Anyone can read biomes" on public.biomes for select to anon, authenticated using (true);
create policy "Anyone can save biomes" on public.biomes for insert to anon, authenticated with check (true);
