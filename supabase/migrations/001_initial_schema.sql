-- ============================================================
-- Listaviva — Initial Schema
-- Hyperlocal service catalog for Linhares, ES
-- ============================================================

-- Extensions
create extension if not exists "vector";
create extension if not exists "pg_trgm";

-- ============================================================
-- Helper functions
-- ============================================================

-- Auto-update updated_at timestamp
create or replace function public.handle_updated_at()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

-- Auto-create profile on user signup
create or replace function public.handle_new_user()
returns trigger as $$
begin
  insert into public.profiles (id, full_name, avatar_url)
  values (
    new.id,
    coalesce(new.raw_user_meta_data->>'full_name', new.raw_user_meta_data->>'name'),
    new.raw_user_meta_data->>'avatar_url'
  );
  return new;
end;
$$ language plpgsql security definer;

-- Helper: check if current user is admin
create or replace function public.is_admin()
returns boolean as $$
  select exists (
    select 1 from public.profiles
    where id = auth.uid() and role = 'admin'
  );
$$ language sql security definer stable;

-- Helper: check if current user owns a provider listing
create or replace function public.owns_provider(provider_id uuid)
returns boolean as $$
  select exists (
    select 1 from public.providers
    where id = provider_id and user_id = auth.uid()
  );
$$ language sql security definer stable;

-- ============================================================
-- Tables
-- ============================================================

-- Profiles (extends auth.users)
create table public.profiles (
  id uuid references auth.users on delete cascade primary key,
  role text not null default 'consumer' check (role in ('consumer', 'provider', 'admin')),
  full_name text,
  avatar_url text,
  locale text not null default 'pt-BR',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create trigger profiles_updated_at
  before update on public.profiles
  for each row execute function public.handle_updated_at();

-- Trigger: auto-create profile on signup
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- Categories
create table public.categories (
  id uuid primary key default gen_random_uuid(),
  name_pt text not null,
  name_en text,
  slug text unique not null,
  icon text,
  sort_order integer not null default 0,
  created_at timestamptz not null default now()
);

create index idx_categories_sort_order on public.categories (sort_order);

-- Bairros (neighborhoods)
create table public.bairros (
  id uuid primary key default gen_random_uuid(),
  name text unique not null,
  slug text unique not null,
  created_at timestamptz not null default now()
);

create index idx_bairros_name on public.bairros (name);

-- Providers
create table public.providers (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references public.profiles on delete set null,
  name text not null,
  slug text unique not null,
  description_pt text,
  description_en text,
  whatsapp text,
  phone text,
  home_bairro_id uuid references public.bairros on delete set null,
  working_hours jsonb default '{}',
  tier text not null default 'free' check (tier in ('free', 'premium')),
  status text not null default 'active' check (status in ('active', 'pending', 'inactive')),
  embedding vector(1536),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index idx_providers_home_bairro on public.providers (home_bairro_id);
create index idx_providers_status on public.providers (status);
create index idx_providers_tier on public.providers (tier);
create index idx_providers_user_id on public.providers (user_id);
create index idx_providers_embedding on public.providers using hnsw (embedding vector_cosine_ops);

create trigger providers_updated_at
  before update on public.providers
  for each row execute function public.handle_updated_at();

-- Provider ↔ Categories (many-to-many)
create table public.provider_categories (
  provider_id uuid references public.providers on delete cascade,
  category_id uuid references public.categories on delete cascade,
  primary key (provider_id, category_id)
);

-- Provider ↔ Service Areas (many-to-many: which bairros they serve)
create table public.provider_service_areas (
  provider_id uuid references public.providers on delete cascade,
  bairro_id uuid references public.bairros on delete cascade,
  primary key (provider_id, bairro_id)
);

-- Provider photos
create table public.provider_photos (
  id uuid primary key default gen_random_uuid(),
  provider_id uuid references public.providers on delete cascade not null,
  url text not null,
  sort_order integer not null default 0,
  created_at timestamptz not null default now()
);

create index idx_provider_photos_provider on public.provider_photos (provider_id, sort_order);

-- Search queries (for market intelligence)
create table public.search_queries (
  id uuid primary key default gen_random_uuid(),
  query_text text not null,
  results_count integer not null,
  user_id uuid references public.profiles on delete set null,
  bairro_filter_id uuid references public.bairros on delete set null,
  created_at timestamptz not null default now()
);

create index idx_search_queries_created_at on public.search_queries (created_at);
create index idx_search_queries_zero_results on public.search_queries (results_count) where results_count = 0;

-- Events (for future analytics)
create table public.events (
  id uuid primary key default gen_random_uuid(),
  event_type text not null,
  user_id uuid references public.profiles on delete set null,
  provider_id uuid references public.providers on delete set null,
  metadata jsonb default '{}',
  created_at timestamptz not null default now()
);

create index idx_events_type on public.events (event_type);
create index idx_events_created_at on public.events (created_at);
create index idx_events_provider on public.events (provider_id) where provider_id is not null;

-- Recommendations (community-submitted provider suggestions)
create table public.recommendations (
  id uuid primary key default gen_random_uuid(),
  submitted_by uuid references public.profiles on delete cascade not null,
  provider_name text not null,
  category_suggestion text,
  whatsapp text,
  bairro_id uuid references public.bairros on delete set null,
  description text,
  status text not null default 'pending' check (status in ('pending', 'approved', 'rejected')),
  reviewed_by uuid references public.profiles on delete set null,
  created_provider_id uuid references public.providers on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index idx_recommendations_status on public.recommendations (status);

create trigger recommendations_updated_at
  before update on public.recommendations
  for each row execute function public.handle_updated_at();

-- ============================================================
-- Row Level Security
-- ============================================================

alter table public.profiles enable row level security;
alter table public.categories enable row level security;
alter table public.bairros enable row level security;
alter table public.providers enable row level security;
alter table public.provider_categories enable row level security;
alter table public.provider_service_areas enable row level security;
alter table public.provider_photos enable row level security;
alter table public.search_queries enable row level security;
alter table public.events enable row level security;
alter table public.recommendations enable row level security;

-- Profiles policies
create policy "Users can view own profile"
  on public.profiles for select
  using (auth.uid() = id);

create policy "Users can update own profile"
  on public.profiles for update
  using (auth.uid() = id);

create policy "Admins can view all profiles"
  on public.profiles for select
  using (public.is_admin());

create policy "Admins can update all profiles"
  on public.profiles for update
  using (public.is_admin());

-- Categories policies (public read, admin write)
create policy "Anyone can view categories"
  on public.categories for select
  using (true);

create policy "Admins can manage categories"
  on public.categories for all
  using (public.is_admin());

-- Bairros policies (public read, admin write)
create policy "Anyone can view bairros"
  on public.bairros for select
  using (true);

create policy "Admins can manage bairros"
  on public.bairros for all
  using (public.is_admin());

-- Providers policies
create policy "Anyone can view active providers"
  on public.providers for select
  using (status = 'active' or user_id = auth.uid() or public.is_admin());

create policy "Providers can update own listing"
  on public.providers for update
  using (user_id = auth.uid());

create policy "Providers can insert own listing"
  on public.providers for insert
  with check (user_id = auth.uid() or public.is_admin());

create policy "Admins can manage all providers"
  on public.providers for all
  using (public.is_admin());

-- Provider categories policies
create policy "Anyone can view provider categories"
  on public.provider_categories for select
  using (true);

create policy "Providers can manage own categories"
  on public.provider_categories for all
  using (public.owns_provider(provider_id));

create policy "Admins can manage all provider categories"
  on public.provider_categories for all
  using (public.is_admin());

-- Provider service areas policies
create policy "Anyone can view service areas"
  on public.provider_service_areas for select
  using (true);

create policy "Providers can manage own service areas"
  on public.provider_service_areas for all
  using (public.owns_provider(provider_id));

create policy "Admins can manage all service areas"
  on public.provider_service_areas for all
  using (public.is_admin());

-- Provider photos policies
create policy "Anyone can view provider photos"
  on public.provider_photos for select
  using (true);

create policy "Providers can manage own photos"
  on public.provider_photos for all
  using (public.owns_provider(provider_id));

create policy "Admins can manage all photos"
  on public.provider_photos for all
  using (public.is_admin());

-- Search queries policies
create policy "Authenticated users can log searches"
  on public.search_queries for insert
  with check (auth.uid() is not null);

create policy "Admins can view search queries"
  on public.search_queries for select
  using (public.is_admin());

-- Events policies
create policy "Authenticated users can log events"
  on public.events for insert
  with check (auth.uid() is not null);

create policy "Admins can view events"
  on public.events for select
  using (public.is_admin());

-- Recommendations policies
create policy "Authenticated users can submit recommendations"
  on public.recommendations for insert
  with check (auth.uid() = submitted_by);

create policy "Users can view own recommendations"
  on public.recommendations for select
  using (submitted_by = auth.uid());

create policy "Admins can view all recommendations"
  on public.recommendations for select
  using (public.is_admin());

create policy "Admins can update recommendations"
  on public.recommendations for update
  using (public.is_admin());
