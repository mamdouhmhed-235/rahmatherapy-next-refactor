alter table public.staff_profiles
  add column if not exists profile_photo_path text,
  add column if not exists phone text,
  add column if not exists show_phone_on_profile boolean not null default false,
  add column if not exists short_bio text,
  add column if not exists specialties text[] not null default '{}'::text[],
  add column if not exists languages text[] not null default '{}'::text[],
  add column if not exists service_areas text[] not null default '{}'::text[],
  add column if not exists profile_completed_at timestamp with time zone;

alter table public.staff_profiles
  drop constraint if exists staff_profiles_profile_photo_path_length,
  add constraint staff_profiles_profile_photo_path_length
    check (profile_photo_path is null or char_length(profile_photo_path) <= 512);

alter table public.staff_profiles
  drop constraint if exists staff_profiles_phone_length,
  add constraint staff_profiles_phone_length
    check (phone is null or char_length(phone) <= 40);

alter table public.staff_profiles
  drop constraint if exists staff_profiles_short_bio_length,
  add constraint staff_profiles_short_bio_length
    check (short_bio is null or char_length(short_bio) <= 600);

alter table public.staff_profiles
  drop constraint if exists staff_profiles_profile_list_lengths,
  add constraint staff_profiles_profile_list_lengths
    check (
      cardinality(specialties) <= 12
      and cardinality(languages) <= 12
      and cardinality(service_areas) <= 12
    );

create index if not exists staff_profiles_specialties_gin_idx
  on public.staff_profiles using gin (specialties);

create index if not exists staff_profiles_service_areas_gin_idx
  on public.staff_profiles using gin (service_areas);
