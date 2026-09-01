-- ============================================================
--  BlowUpSocial – Supabase Schema
--  Run this once in: Supabase Dashboard → SQL Editor → Run
-- ============================================================

-- 1. Profiles (auto-created on signup)
create table public.profiles (
  id             uuid references auth.users on delete cascade primary key,
  full_name      text,
  email          text,
  wallet_balance decimal(10,2) default 0.00,
  created_at     timestamptz   default now()
);

alter table public.profiles enable row level security;

create policy "owner_select" on public.profiles
  for select using (auth.uid() = id);

create policy "owner_update" on public.profiles
  for update using (auth.uid() = id);

-- 2. Orders
create table public.orders (
  id         bigint generated always as identity primary key,
  user_id    uuid references public.profiles(id) on delete cascade,
  order_ref  text,
  service    text          not null,
  amount     decimal(10,2) not null,
  status     text          default 'Processing',
  created_at timestamptz   default now()
);

alter table public.orders enable row level security;

create policy "owner_select" on public.orders
  for select using (auth.uid() = user_id);

create policy "owner_insert" on public.orders
  for insert with check (auth.uid() = user_id);

-- 3. Auto-create profile when a new user signs up
create or replace function public.handle_new_user()
returns trigger as $$
begin
  insert into public.profiles (id, full_name, email)
  values (
    new.id,
    new.raw_user_meta_data->>'full_name',
    new.email
  );
  return new;
end;
$$ language plpgsql security definer;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();
