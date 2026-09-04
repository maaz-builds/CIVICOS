-- CivicFix: complaints table + row-level security.
-- Run this ONCE in the Supabase SQL editor (Dashboard -> SQL Editor -> New query)
-- before using SupabaseService. Idempotent - safe to re-run.

create extension if not exists pgcrypto;

create table if not exists public.complaints (
    id           uuid primary key default gen_random_uuid(),
    tracking_id  text not null unique,
    -- Photo (populated once Supabase Storage is wired):
    image_url    text,
    -- Vision agent output:
    issue_type   text not null,
    confidence   numeric,
    severity     text,
    description  text,
    -- Location agent output:
    ward         text,
    lat          double precision,
    lng          double precision,
    -- Routing agent output:
    department   text,
    routing_notes text,
    -- Lifecycle:
    status       text not null default 'submitted',
    created_at   timestamptz not null default now()
);

alter table public.complaints enable row level security;

-- DEMO-GRADE policies: any caller with the anon key can insert and read.
-- Fine for a hackathon demo; replace with authenticated-user policies
-- before going to production.
create policy "allow anon insert"
    on public.complaints
    for insert
    with check (true);

create policy "allow anon select"
    on public.complaints
    for select
    using (true);

-- ---------------------------------------------------------------------------
-- Storage: complaint photo uploads.
-- Creates the public bucket + demo-grade policies used by StorageService.
-- The bucket must exist BEFORE photos can be uploaded; this SQL creates it
-- idempotently, so running the whole file again is safe.
-- ---------------------------------------------------------------------------
insert into storage.buckets (id, name, public)
values ('complaint-photos', 'complaint-photos', true)
on conflict (id) do nothing;

-- DEMO-GRADE policies: anyone with the anon key can upload and read photos
-- in this bucket. Fine for a hackathon demo; restrict these (e.g. to
-- authenticated users) before going to production.
-- Dropped first so re-running the file is safe.
drop policy if exists "allow anon upload complaint photos" on storage.objects;
create policy "allow anon upload complaint photos"
    on storage.objects
    for insert
    with check (bucket_id = 'complaint-photos');

drop policy if exists "allow anon read complaint photos" on storage.objects;
create policy "allow anon read complaint photos"
    on storage.objects
    for select
    using (bucket_id = 'complaint-photos');
