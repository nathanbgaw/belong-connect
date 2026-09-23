-- Belong Connect — schema.
-- All tables are prefixed bc_ so this can share a Supabase project with other
-- apps. RLS is enabled with NO policies: the anon key can read nothing; the
-- server talks to these tables with the service-role key only.

create extension if not exists pgcrypto;

create table if not exists bc_churches (
  id            uuid primary key default gen_random_uuid(),
  slug          text unique not null,
  host          text unique,                 -- normalised website host, e.g. templebc.com
  name          text not null,
  website       text,
  denomination  text,
  address       text,
  city          text,
  state         text default 'MD',
  zip           text,
  lat           double precision,
  lng           double precision,
  phone         text,
  email         text,
  service_times text,
  summary       text,
  tags          text[] not null default '{}',
  profile       jsonb,                       -- full ChurchProfile as extracted
  pages_read    text[] not null default '{}',
  source        text not null default 'scan', -- scan | osm | church
  status        text not null default 'scanned', -- pending | scanned | failed | unreadable
  error         text,
  scanned_at    timestamptz,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);
create index if not exists bc_churches_latlng on bc_churches (lat, lng);
create index if not exists bc_churches_zip on bc_churches (zip);

create table if not exists bc_resources (
  id            uuid primary key default gen_random_uuid(),
  church_id     uuid not null references bc_churches(id) on delete cascade,
  title         text not null,
  category      text not null,
  description   text,
  audience      text,
  schedule      text,
  how_to_access text,
  contact       text,
  source_url    text,
  confidence    text not null default 'stated', -- stated | inferred
  created_at    timestamptz not null default now()
);
create index if not exists bc_resources_church on bc_resources (church_id);
create index if not exists bc_resources_category on bc_resources (category);

-- Needs entered by individuals (anonymous by default).
create table if not exists bc_needs (
  id            uuid primary key default gen_random_uuid(),
  zip           text,
  lat           double precision,
  lng           double precision,
  category      text not null,
  description   text not null,
  contact_ok    boolean not null default false,
  contact       text,
  status        text not null default 'open',  -- open | met | closed
  created_at    timestamptz not null default now()
);

-- What churches say they can provide.
create table if not exists bc_offers (
  id            uuid primary key default gen_random_uuid(),
  church_name   text not null,
  website       text,
  contact_name  text,
  contact_email text,
  zip           text,
  lat           double precision,
  lng           double precision,
  category      text not null,
  description   text not null,
  status        text not null default 'open',
  created_at    timestamptz not null default now()
);

-- Cache of OpenStreetMap lookups, keyed by rounded lat/lng + radius.
create table if not exists bc_osm_cache (
  key           text primary key,
  payload       jsonb not null,
  fetched_at    timestamptz not null default now()
);

alter table bc_churches  enable row level security;
alter table bc_resources enable row level security;
alter table bc_needs     enable row level security;
alter table bc_offers    enable row level security;
alter table bc_osm_cache enable row level security;
