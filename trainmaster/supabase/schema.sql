-- TrainMaster Database Schema
-- Run this SQL in your Supabase SQL Editor to set up all tables.

-- ── Users (trainer profiles, linked to Supabase Auth) ──────────────────────
create table if not exists public.users (
  id         uuid primary key references auth.users (id) on delete cascade,
  name       text not null,
  email      text not null unique,
  role       text not null default 'trainer' check (role in ('trainer', 'admin')),
  created_at timestamptz not null default now()
);

alter table public.users enable row level security;

create policy "Users can read their own profile"
  on public.users for select
  using (auth.uid() = id);

create policy "Users can update their own profile"
  on public.users for update
  using (auth.uid() = id);

-- ── Trainings ───────────────────────────────────────────────────────────────
create table if not exists public.trainings (
  id             uuid primary key default gen_random_uuid(),
  user_id        uuid not null references public.users (id) on delete cascade,
  title          text not null,
  description    text not null default '',
  date           date not null,
  duration_hours numeric(5,2) not null default 1,
  location       text not null default '',
  created_at     timestamptz not null default now()
);

alter table public.trainings enable row level security;

create policy "Trainers manage their own trainings"
  on public.trainings for all
  using (auth.uid() = user_id);

-- ── Attendees ───────────────────────────────────────────────────────────────
create table if not exists public.attendees (
  id          uuid primary key default gen_random_uuid(),
  training_id uuid not null references public.trainings (id) on delete cascade,
  full_name   text not null,
  email       text not null,
  status      text not null default 'invited'
                check (status in ('invited', 'attended', 'absent')),
  created_at  timestamptz not null default now()
);

alter table public.attendees enable row level security;

create policy "Trainers manage attendees of their trainings"
  on public.attendees for all
  using (
    exists (
      select 1 from public.trainings t
      where t.id = training_id and t.user_id = auth.uid()
    )
  );

-- ── Certificates ────────────────────────────────────────────────────────────
create table if not exists public.certificates (
  id                 uuid primary key default gen_random_uuid(),
  attendee_id        uuid not null references public.attendees (id) on delete cascade,
  training_id        uuid not null references public.trainings (id) on delete cascade,
  certificate_number text not null unique,
  issued_at          timestamptz not null default now(),
  pdf_url            text,
  created_at         timestamptz not null default now()
);

alter table public.certificates enable row level security;

create policy "Trainers view certificates of their trainings"
  on public.certificates for all
  using (
    exists (
      select 1 from public.trainings t
      where t.id = training_id and t.user_id = auth.uid()
    )
  );

-- ── Helper: auto-insert user profile on sign-up ─────────────────────────────
create or replace function public.handle_new_user()
returns trigger language plpgsql security definer as $$
begin
  insert into public.users (id, name, email)
  values (
    new.id,
    coalesce(new.raw_user_meta_data->>'name', split_part(new.email, '@', 1)),
    new.email
  );
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();
