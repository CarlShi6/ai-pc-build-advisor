-- Supabase schema for Milestone 12: Supabase Production Wiring.
-- Run this in the Supabase SQL editor, then review the RLS policies before production use.

create extension if not exists pgcrypto;

create table if not exists public.app_users (
  id uuid primary key references auth.users(id) on delete cascade,
  email text not null,
  display_name text,
  auth_provider text not null default 'supabase' check (auth_provider in ('mock', 'supabase')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.saved_builds (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references public.app_users(id) on delete cascade,
  session_id text not null,
  name text not null,
  build jsonb not null,
  build_needs jsonb not null,
  total_price numeric(12, 2) not null default 0,
  compatibility_status text not null check (compatibility_status in ('pass', 'warning', 'fail')),
  owned_parts integer not null default 0,
  target_use_case text[] not null default '{}',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.entitlements (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references public.app_users(id) on delete cascade,
  session_id text not null,
  plan text not null check (plan in ('free', 'build_pro')),
  build_id text,
  active boolean not null default true,
  payment_provider text not null check (payment_provider in ('mock', 'stripe')),
  checkout_session_id text,
  activated_at timestamptz,
  started_at timestamptz not null default now(),
  expires_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.usage_counters (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references public.app_users(id) on delete cascade,
  session_id text not null,
  build_id text,
  counter_date date not null,
  ai_questions_used_today integer not null default 0,
  ai_questions_used_for_build integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.replacement_counters (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references public.app_users(id) on delete cascade,
  session_id text not null,
  build_id text,
  replacements_used_for_build integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.owned_parts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references public.app_users(id) on delete cascade,
  session_id text not null,
  build_id text,
  part jsonb not null,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.affiliate_clicks (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references public.app_users(id) on delete set null,
  session_id text not null,
  build_id text,
  part_id text not null,
  merchant text not null check (merchant in ('amazon', 'newegg', 'microcenter', 'bestbuy', 'bhphoto', 'other')),
  url text not null,
  clicked_at timestamptz not null default now()
);

create table if not exists public.checkout_sessions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references public.app_users(id) on delete set null,
  session_id text not null,
  plan text not null check (plan in ('free', 'build_pro')),
  payment_provider text not null check (payment_provider in ('mock', 'stripe')),
  checkout_session_id text unique,
  status text not null check (status in ('created', 'completed', 'cancelled', 'failed')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists app_users_email_idx on public.app_users (email);
create index if not exists saved_builds_user_updated_idx on public.saved_builds (user_id, updated_at desc);
create index if not exists saved_builds_session_updated_idx on public.saved_builds (session_id, updated_at desc);
create index if not exists entitlements_user_active_idx on public.entitlements (user_id, active, activated_at desc);
create index if not exists entitlements_session_active_idx on public.entitlements (session_id, active, activated_at desc);
create unique index if not exists usage_counters_user_build_date_idx
  on public.usage_counters (user_id, build_id, counter_date)
  where user_id is not null;
create unique index if not exists usage_counters_session_build_date_idx
  on public.usage_counters (session_id, build_id, counter_date)
  where user_id is null;
create unique index if not exists replacement_counters_user_build_idx
  on public.replacement_counters (user_id, build_id)
  where user_id is not null;
create unique index if not exists replacement_counters_session_build_idx
  on public.replacement_counters (session_id, build_id)
  where user_id is null;
create index if not exists owned_parts_user_build_idx on public.owned_parts (user_id, build_id);
create index if not exists owned_parts_session_build_idx on public.owned_parts (session_id, build_id);
create index if not exists affiliate_clicks_user_clicked_idx on public.affiliate_clicks (user_id, clicked_at desc);
create index if not exists affiliate_clicks_session_clicked_idx on public.affiliate_clicks (session_id, clicked_at desc);
create index if not exists checkout_sessions_user_status_idx on public.checkout_sessions (user_id, status);

alter table public.app_users enable row level security;
alter table public.saved_builds enable row level security;
alter table public.entitlements enable row level security;
alter table public.usage_counters enable row level security;
alter table public.replacement_counters enable row level security;
alter table public.owned_parts enable row level security;
alter table public.affiliate_clicks enable row level security;
alter table public.checkout_sessions enable row level security;

-- Recommended authenticated-user policies.
-- The app server uses SUPABASE_SERVICE_ROLE_KEY and bypasses RLS for internal API writes.
-- These policies protect tables if a future browser/client Supabase integration is added.

create policy "Users can read their profile"
  on public.app_users for select
  using (auth.uid() = id);

create policy "Users can manage their saved builds"
  on public.saved_builds for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

create policy "Users can read their entitlements"
  on public.entitlements for select
  using (auth.uid() = user_id);

create policy "Users can read their usage counters"
  on public.usage_counters for select
  using (auth.uid() = user_id);

create policy "Users can read their replacement counters"
  on public.replacement_counters for select
  using (auth.uid() = user_id);

create policy "Users can manage their owned parts"
  on public.owned_parts for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

create policy "Users can insert affiliate clicks"
  on public.affiliate_clicks for insert
  with check (auth.uid() = user_id);

create policy "Users can read their checkout sessions"
  on public.checkout_sessions for select
  using (auth.uid() = user_id);

