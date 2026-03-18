-- claim_requests table
create table public.claim_requests (
  id uuid primary key default gen_random_uuid(),
  provider_id uuid references public.providers on delete cascade not null,
  user_id uuid references public.profiles on delete cascade not null,
  status text not null default 'pending'
    check (status in ('pending', 'approved', 'rejected')),
  message text,
  created_at timestamptz not null default now()
);

alter table public.claim_requests enable row level security;

create policy "Users can view own claims"
  on public.claim_requests for select using (user_id = auth.uid());

create policy "Users can insert own claims"
  on public.claim_requests for insert with check (user_id = auth.uid());

create policy "Admins can manage all claims"
  on public.claim_requests for all using (public.is_admin());

-- Storage: allow authenticated users to upload provider photos
create policy "Authenticated users can upload photos"
  on storage.objects for insert
  with check (
    bucket_id = 'provider-photos'
    and auth.role() = 'authenticated'
  );
