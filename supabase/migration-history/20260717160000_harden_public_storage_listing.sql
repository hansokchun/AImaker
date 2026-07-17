-- Public buckets serve known object URLs without a storage.objects SELECT policy.
-- Remove broad metadata listing while retaining each owner's SELECT policy needed for upsert.
drop policy if exists "Public can read product samples" on storage.objects;
drop policy if exists "Public can read profile images" on storage.objects;
