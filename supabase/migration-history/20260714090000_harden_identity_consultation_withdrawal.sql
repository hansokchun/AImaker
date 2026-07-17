alter table public.profiles add column if not exists withdrawn_at timestamptz;
alter table public.profiles add column if not exists account_status text not null default 'active';
alter table public.profiles add column if not exists interests text[] not null default '{}';
alter table public.profiles add column if not exists request_purposes text[] not null default '{}';
create or replace function public.guard_profile_user_mutation()
returns trigger language plpgsql set search_path = '' as $$
begin
  if current_role = 'authenticated' and (
    new.id is distinct from old.id
    or new.account_status is distinct from old.account_status
    or new.withdrawn_at is distinct from old.withdrawn_at
  ) then raise exception 'account status and withdrawal fields are server-managed'; end if;
  return new;
end; $$;
drop trigger if exists guard_profile_user_mutation on public.profiles;
create trigger guard_profile_user_mutation before update on public.profiles
for each row execute function public.guard_profile_user_mutation();
drop policy if exists "Users can insert their own profile" on public.profiles;
create policy "Users can insert their own profile" on public.profiles for insert to authenticated
with check ((select auth.uid()) = id and account_status = 'active' and withdrawn_at is null);
drop policy if exists "Users can update own profile" on public.profiles;
create policy "Users can update own profile" on public.profiles for update to authenticated
using ((select auth.uid()) = id and account_status = 'active' and withdrawn_at is null)
with check ((select auth.uid()) = id and account_status = 'active' and withdrawn_at is null);
revoke update on public.profiles from authenticated;
grant update (id, email, display_name, name, avatar_url, is_expert, expert_intro, ai_tools, sample_links, interests, request_purposes, updated_at)
on public.profiles to authenticated;
update storage.buckets set
  file_size_limit = 5242880,
  allowed_mime_types = array['image/jpeg', 'image/png', 'image/webp']
where id = 'profile-images';
drop policy if exists "Users can upload profile images" on storage.objects;
drop policy if exists "Public can read profile images" on storage.objects;
create policy "Public can read profile images" on storage.objects for select
using (bucket_id = 'profile-images');
create policy "Users can upload own profile images" on storage.objects for insert to authenticated with check (
  bucket_id = 'profile-images'
  and (storage.foldername(name))[1] = (select auth.uid())::text
  and exists (select 1 from public.profiles where id = (select auth.uid()) and account_status = 'active' and withdrawn_at is null)
  and lower(storage.extension(name)) in ('jpg', 'jpeg', 'png', 'webp')
  and metadata->>'mimetype' in ('image/jpeg', 'image/png', 'image/webp')
  and coalesce((metadata->>'size')::bigint, 0) between 1 and 5242880
);
drop policy if exists "Users can replace own profile images" on storage.objects;
create policy "Users can replace own profile images" on storage.objects for update to authenticated
using (bucket_id = 'profile-images' and owner_id = (select auth.uid())::text and (storage.foldername(name))[1] = (select auth.uid())::text and exists (select 1 from public.profiles where id = (select auth.uid()) and account_status = 'active' and withdrawn_at is null))
with check (bucket_id = 'profile-images' and owner_id = (select auth.uid())::text and (storage.foldername(name))[1] = (select auth.uid())::text and exists (select 1 from public.profiles where id = (select auth.uid()) and account_status = 'active' and withdrawn_at is null) and lower(storage.extension(name)) in ('jpg', 'jpeg', 'png', 'webp') and metadata->>'mimetype' in ('image/jpeg', 'image/png', 'image/webp') and coalesce((metadata->>'size')::bigint, 0) between 1 and 5242880);
drop policy if exists "Users can select own profile images for upsert" on storage.objects;
create policy "Users can select own profile images for upsert" on storage.objects for select to authenticated
using (bucket_id = 'profile-images' and owner_id = (select auth.uid())::text and (storage.foldername(name))[1] = (select auth.uid())::text and exists (select 1 from public.profiles where id = (select auth.uid()) and account_status = 'active' and withdrawn_at is null));
drop policy if exists "Users can delete own profile images" on storage.objects;
create policy "Users can delete own profile images" on storage.objects for delete to authenticated
using (bucket_id = 'profile-images' and owner_id = (select auth.uid())::text and (storage.foldername(name))[1] = (select auth.uid())::text and exists (select 1 from public.profiles where id = (select auth.uid()) and account_status = 'active' and withdrawn_at is null));
drop policy if exists "Clients can insert own consultations" on public.consultations;
drop policy if exists "Consultation participants can update consultations" on public.consultations;
drop policy if exists "Consultation participants can insert messages" on public.consultation_messages;
drop policy if exists "Admins can update consultations" on public.consultations;
drop policy if exists "Admins can insert admin actions" on public.admin_actions;
drop policy if exists "Admins can update reports" on public.admin_reports;
drop policy if exists "Admins can update profiles" on public.profiles;
drop policy if exists "Admins can update products" on public.expert_products;
drop policy if exists "Admins can update reviews" on public.reviews;
revoke insert on public.admin_actions from authenticated;
revoke update on public.admin_reports from authenticated;
revoke update on public.reviews from authenticated;
drop policy if exists "Experts can view own payout account" on public.expert_payout_accounts;
create policy "Experts can view own payout account" on public.expert_payout_accounts for select to authenticated
using ((select auth.uid()) = expert_id and exists (select 1 from public.profiles where id = (select auth.uid()) and account_status = 'active' and withdrawn_at is null));
drop policy if exists "Experts can upsert own payout account" on public.expert_payout_accounts;
create policy "Experts can upsert own payout account" on public.expert_payout_accounts for insert to authenticated
with check ((select auth.uid()) = expert_id and exists (select 1 from public.profiles where id = (select auth.uid()) and account_status = 'active' and withdrawn_at is null));
drop policy if exists "Experts can update own payout account" on public.expert_payout_accounts;
create policy "Experts can update own payout account" on public.expert_payout_accounts for update to authenticated
using ((select auth.uid()) = expert_id and exists (select 1 from public.profiles where id = (select auth.uid()) and account_status = 'active' and withdrawn_at is null))
with check ((select auth.uid()) = expert_id and exists (select 1 from public.profiles where id = (select auth.uid()) and account_status = 'active' and withdrawn_at is null));
drop policy if exists "Experts can view own settlement payouts" on public.settlement_payouts;
create policy "Experts can view own settlement payouts" on public.settlement_payouts for select to authenticated
using ((select auth.uid()) = expert_id and exists (select 1 from public.profiles where id = (select auth.uid()) and account_status = 'active' and withdrawn_at is null));
create or replace function public.is_active_admin(check_user_id uuid)
returns boolean language sql stable security definer set search_path = '' as $$
  select exists (
    select 1 from public.admin_users a join public.profiles p on p.id = a.user_id
    where a.user_id = check_user_id and p.account_status = 'active' and p.withdrawn_at is null
  );
$$;
revoke all on function public.is_active_admin(uuid) from public, anon;
grant execute on function public.is_active_admin(uuid) to authenticated;
drop policy if exists "Admins can view operation logs" on public.operation_logs;
create policy "Admins can view operation logs" on public.operation_logs for select to authenticated using ((select public.is_active_admin((select auth.uid()))));
drop policy if exists "Admins can view admin actions" on public.admin_actions;
create policy "Admins can view admin actions" on public.admin_actions for select to authenticated using ((select public.is_active_admin((select auth.uid()))));
drop policy if exists "Admins can view reports" on public.admin_reports;
create policy "Admins can view reports" on public.admin_reports for select to authenticated using ((select public.is_active_admin((select auth.uid()))));
drop policy if exists "Admins can view profiles" on public.profiles;
create policy "Admins can view profiles" on public.profiles for select to authenticated using ((select public.is_active_admin((select auth.uid()))));
drop policy if exists "Admins can view payout accounts" on public.expert_payout_accounts;
create policy "Admins can view payout accounts" on public.expert_payout_accounts for select to authenticated using ((select public.is_active_admin((select auth.uid()))));
drop policy if exists "Admins can view settlement payouts" on public.settlement_payouts;
create policy "Admins can view settlement payouts" on public.settlement_payouts for select to authenticated using ((select public.is_active_admin((select auth.uid()))));
drop policy if exists "Admins can view products" on public.expert_products;
create policy "Admins can view products" on public.expert_products for select to authenticated using ((select public.is_active_admin((select auth.uid()))));
drop policy if exists "Admins can view consultations" on public.consultations;
create policy "Admins can view consultations" on public.consultations for select to authenticated using ((select public.is_active_admin((select auth.uid()))));
drop policy if exists "Admins can view consultation messages" on public.consultation_messages;
create policy "Admins can view consultation messages" on public.consultation_messages for select to authenticated using ((select public.is_active_admin((select auth.uid()))));
drop policy if exists "Admins can view service requests" on public.service_requests;
create policy "Admins can view service requests" on public.service_requests for select to authenticated using ((select public.is_active_admin((select auth.uid()))));
drop policy if exists "Admins can view proposals" on public.proposals;
create policy "Admins can view proposals" on public.proposals for select to authenticated using ((select public.is_active_admin((select auth.uid()))));
drop policy if exists "Admins can view works" on public.works;
create policy "Admins can view works" on public.works for select to authenticated using ((select public.is_active_admin((select auth.uid()))));
drop policy if exists "Admins can view work steps" on public.work_steps;
create policy "Admins can view work steps" on public.work_steps for select to authenticated using ((select public.is_active_admin((select auth.uid()))));
drop policy if exists "Admins can view deliverables" on public.deliverables;
create policy "Admins can view deliverables" on public.deliverables for select to authenticated using ((select public.is_active_admin((select auth.uid()))));
drop policy if exists "Admins can view work messages" on public.work_messages;
create policy "Admins can view work messages" on public.work_messages for select to authenticated using ((select public.is_active_admin((select auth.uid()))));
drop policy if exists "Admins can view reviews" on public.reviews;
create policy "Admins can view reviews" on public.reviews for select to authenticated using ((select public.is_active_admin((select auth.uid()))));
drop policy if exists "Public can read reviews" on public.reviews;
create policy "Public can read reviews" on public.reviews for select
using (status = 'published');
drop policy if exists "Work participants can view messages" on public.work_messages;
create policy "Work participants can view messages" on public.work_messages for select to authenticated using (
  exists (select 1 from public.profiles where id = (select auth.uid()) and account_status = 'active' and withdrawn_at is null)
  and exists (select 1 from public.works where works.id = work_messages.work_id and (select auth.uid()) in (works.client_id, works.expert_id))
);
drop policy if exists "Work participants can insert messages" on public.work_messages;
create policy "Work participants can insert messages" on public.work_messages for insert to authenticated with check (
  sender_id = (select auth.uid())
  and exists (select 1 from public.profiles where id = (select auth.uid()) and account_status = 'active' and withdrawn_at is null)
  and exists (select 1 from public.works where works.id = work_messages.work_id and (select auth.uid()) in (works.client_id, works.expert_id))
);
create or replace function public.guard_inactive_authenticated_mutation()
returns trigger language plpgsql set search_path = '' as $$
declare actor_id uuid := (select auth.uid());
begin
  if actor_id is not null and not exists (
    select 1 from public.profiles where id = actor_id and account_status = 'active' and withdrawn_at is null
  ) then raise exception 'active account required'; end if;
  if tg_op = 'DELETE' then return old; end if;
  return new;
end; $$;
drop trigger if exists guard_inactive_authenticated_mutation on public.expert_profiles;
create trigger guard_inactive_authenticated_mutation before insert or update or delete on public.expert_profiles for each row execute function public.guard_inactive_authenticated_mutation();
drop trigger if exists guard_inactive_authenticated_mutation on public.expert_products;
create trigger guard_inactive_authenticated_mutation before insert or update or delete on public.expert_products for each row execute function public.guard_inactive_authenticated_mutation();
drop trigger if exists guard_inactive_authenticated_mutation on public.expert_payout_accounts;
create trigger guard_inactive_authenticated_mutation before insert or update or delete on public.expert_payout_accounts for each row execute function public.guard_inactive_authenticated_mutation();
drop trigger if exists guard_inactive_authenticated_mutation on public.notification_preferences;
create trigger guard_inactive_authenticated_mutation before insert or update or delete on public.notification_preferences for each row execute function public.guard_inactive_authenticated_mutation();
drop trigger if exists guard_inactive_authenticated_mutation on public.service_requests;
create trigger guard_inactive_authenticated_mutation before insert or update or delete on public.service_requests for each row execute function public.guard_inactive_authenticated_mutation();
drop trigger if exists guard_inactive_authenticated_mutation on public.admin_reports;
create trigger guard_inactive_authenticated_mutation before insert or update or delete on public.admin_reports for each row execute function public.guard_inactive_authenticated_mutation();
drop trigger if exists guard_inactive_authenticated_mutation on public.reviews;
create trigger guard_inactive_authenticated_mutation before insert or update or delete on public.reviews for each row execute function public.guard_inactive_authenticated_mutation();
drop trigger if exists guard_inactive_authenticated_mutation on public.work_messages;
create trigger guard_inactive_authenticated_mutation before insert or update or delete on public.work_messages for each row execute function public.guard_inactive_authenticated_mutation();
drop policy if exists "Users can upload own product samples" on storage.objects;
create policy "Users can upload own product samples" on storage.objects for insert to authenticated with check (
  bucket_id = 'product-samples' and (storage.foldername(name))[1] = (select auth.uid())::text
  and exists (select 1 from public.profiles where id = (select auth.uid()) and account_status = 'active' and withdrawn_at is null)
);
drop policy if exists "Users can replace own product samples" on storage.objects;
create policy "Users can replace own product samples" on storage.objects for update to authenticated
using (bucket_id = 'product-samples' and (storage.foldername(name))[1] = (select auth.uid())::text and exists (select 1 from public.profiles where id = (select auth.uid()) and account_status = 'active' and withdrawn_at is null))
with check (bucket_id = 'product-samples' and (storage.foldername(name))[1] = (select auth.uid())::text and exists (select 1 from public.profiles where id = (select auth.uid()) and account_status = 'active' and withdrawn_at is null));
drop policy if exists "Users can select own product samples for upsert" on storage.objects;
create policy "Users can select own product samples for upsert" on storage.objects for select to authenticated
using (bucket_id = 'product-samples' and (storage.foldername(name))[1] = (select auth.uid())::text and exists (select 1 from public.profiles where id = (select auth.uid()) and account_status = 'active' and withdrawn_at is null));
drop policy if exists "Work participants can read deliverable files" on storage.objects;
create policy "Work participants can read deliverable files" on storage.objects for select to authenticated using (
  bucket_id = 'deliverable-files'
  and exists (select 1 from public.profiles where id = (select auth.uid()) and account_status = 'active' and withdrawn_at is null)
  and exists (select 1 from public.works where works.id::text = (storage.foldername(name))[1] and (select auth.uid()) in (works.client_id, works.expert_id))
);
drop policy if exists "Experts can upload deliverable files" on storage.objects;
create policy "Experts can upload deliverable files" on storage.objects for insert to authenticated with check (
  bucket_id = 'deliverable-files'
  and exists (select 1 from public.profiles where id = (select auth.uid()) and account_status = 'active' and withdrawn_at is null)
  and exists (select 1 from public.works where works.id::text = (storage.foldername(name))[1] and works.expert_id = (select auth.uid()))
);
drop policy if exists "Consultation participants can view consultations" on public.consultations;
create policy "Consultation participants can view consultations" on public.consultations for select to authenticated
using (
  (select auth.uid()) in (client_id, expert_id)
  and exists (select 1 from public.profiles where id = (select auth.uid()) and account_status = 'active' and withdrawn_at is null)
);
drop policy if exists "Consultation participants can view messages" on public.consultation_messages;
create policy "Consultation participants can view messages" on public.consultation_messages for select to authenticated
using (
  exists (
    select 1 from public.consultations c join public.profiles p on p.id = (select auth.uid())
    where c.id = consultation_messages.consultation_id
      and (select auth.uid()) in (c.client_id, c.expert_id)
      and p.account_status = 'active' and p.withdrawn_at is null
  )
);
create or replace function public.create_consultation(expert_user_id uuid, product_row_id uuid, consultation_title text, initial_message text default null)
returns public.consultations language plpgsql security definer set search_path = '' as $$
declare actor_id uuid := (select auth.uid()); created_consultation public.consultations;
begin
  if actor_id is null then raise exception 'authentication required'; end if;
  if actor_id = expert_user_id then raise exception 'self consultation is not allowed'; end if;
  if length(trim(consultation_title)) = 0 then raise exception 'consultation title is required'; end if;
  if not exists (select 1 from public.profiles where id = actor_id and account_status = 'active' and withdrawn_at is null) then raise exception 'active client account required'; end if;
  if not exists (select 1 from public.profiles where id = expert_user_id and is_expert and account_status = 'active' and withdrawn_at is null) then raise exception 'active expert account required'; end if;
  if product_row_id is not null and not exists (select 1 from public.expert_products where id = product_row_id and expert_id = expert_user_id and status = 'published') then raise exception 'published expert product required'; end if;
  insert into public.consultations (client_id, expert_id, product_id, title, status)
  values (actor_id, expert_user_id, product_row_id, trim(consultation_title), 'open') returning * into created_consultation;
  if nullif(trim(coalesce(initial_message, '')), '') is not null then
    insert into public.consultation_messages (consultation_id, sender_id, body, attachment_urls)
    values (created_consultation.id, actor_id, trim(initial_message), '{}');
  end if;
  return created_consultation;
end; $$;
create or replace function public.append_consultation_message(consultation_row_id uuid, message_body text, message_attachment_urls text[] default '{}')
returns public.consultation_messages language plpgsql security definer set search_path = '' as $$
declare actor_id uuid := (select auth.uid()); current_consultation public.consultations; created_message public.consultation_messages;
begin
  if actor_id is null then raise exception 'authentication required'; end if;
  if nullif(trim(message_body), '') is null then raise exception 'message body is required'; end if;
  select * into current_consultation from public.consultations where id = consultation_row_id for update;
  if not found or current_consultation.status = 'closed' or actor_id not in (current_consultation.client_id, current_consultation.expert_id)
    or not exists (select 1 from public.profiles where id = actor_id and account_status = 'active' and withdrawn_at is null)
  then raise exception 'open active-participant consultation required'; end if;
  insert into public.consultation_messages (consultation_id, sender_id, body, attachment_urls)
  values (consultation_row_id, actor_id, trim(message_body), coalesce(message_attachment_urls, '{}')) returning * into created_message;
  update public.consultations set last_message_at = created_message.created_at where id = consultation_row_id;
  return created_message;
end; $$;
create or replace function public.transition_consultation(consultation_row_id uuid, next_status text)
returns public.consultations language plpgsql security definer set search_path = '' as $$
declare actor_id uuid := (select auth.uid()); current_consultation public.consultations;
begin
  if actor_id is null then raise exception 'authentication required'; end if;
  if not exists (select 1 from public.profiles where id = actor_id and account_status = 'active' and withdrawn_at is null) then raise exception 'active participant account required'; end if;
  select * into current_consultation from public.consultations where id = consultation_row_id for update;
  if not found or actor_id not in (current_consultation.client_id, current_consultation.expert_id) then raise exception 'consultation participant required'; end if;
  if next_status = 'proposal_sent' then
    if actor_id <> current_consultation.expert_id or current_consultation.status <> 'open' then raise exception 'only the expert can send a proposal from an open consultation'; end if;
  elsif next_status = 'closed' then
    if current_consultation.status not in ('open', 'proposal_sent') then raise exception 'consultation cannot be closed from its current state'; end if;
  else raise exception 'unsupported consultation transition'; end if;
  update public.consultations set status = next_status, last_message_at = now() where id = consultation_row_id returning * into current_consultation;
  return current_consultation;
end; $$;
revoke all on function public.create_consultation(uuid, uuid, text, text) from public, anon;
revoke all on function public.append_consultation_message(uuid, text, text[]) from public, anon;
revoke all on function public.transition_consultation(uuid, text) from public, anon;
grant execute on function public.create_consultation(uuid, uuid, text, text) to authenticated;
grant execute on function public.append_consultation_message(uuid, text, text[]) to authenticated;
grant execute on function public.transition_consultation(uuid, text) to authenticated;
create or replace function public.apply_admin_moderation_action(admin_user_id uuid, target_type_value text, target_id_value text, action_type_value text, reason_value text)
returns void language plpgsql security definer set search_path = '' as $$
declare target_product public.expert_products; adjacent_product public.expert_products; affected_count integer := 0;
begin
  if not exists (select 1 from public.admin_users a join public.profiles p on p.id = a.user_id where a.user_id = admin_user_id and p.account_status = 'active' and p.withdrawn_at is null) then raise exception 'active admin role required'; end if;
  if nullif(trim(reason_value), '') is null then raise exception 'admin action reason required'; end if;
  if target_type_value = 'user' and action_type_value = 'restrict' then
    update public.profiles set account_status = 'restricted' where id = target_id_value::uuid; get diagnostics affected_count = row_count;
  elsif target_type_value = 'user' and action_type_value = 'release_restriction' then
    update public.profiles set account_status = 'active' where id = target_id_value::uuid and withdrawn_at is null; get diagnostics affected_count = row_count;
  elsif target_type_value = 'product' and action_type_value in ('hide_product', 'restore_product') then
    update public.expert_products set status = case when action_type_value = 'hide_product' then 'hidden' else 'published' end where id = target_id_value::uuid; get diagnostics affected_count = row_count;
  elsif target_type_value = 'product' and action_type_value in ('feature_product', 'unfeature_product') then
    update public.expert_products set is_featured = action_type_value = 'feature_product' where id = target_id_value::uuid; get diagnostics affected_count = row_count;
  elsif target_type_value = 'product' and action_type_value in ('move_product_up', 'move_product_down') then
    select * into target_product from public.expert_products where id = target_id_value::uuid for update;
    if not found then raise exception 'target product not found'; end if;
    if action_type_value = 'move_product_up' then select * into adjacent_product from public.expert_products where expert_id = target_product.expert_id and display_order < target_product.display_order order by display_order desc limit 1 for update;
    else select * into adjacent_product from public.expert_products where expert_id = target_product.expert_id and display_order > target_product.display_order order by display_order asc limit 1 for update; end if;
    if found then update public.expert_products set display_order = adjacent_product.display_order where id = target_product.id; update public.expert_products set display_order = target_product.display_order where id = adjacent_product.id; affected_count := 1; end if;
  elsif target_type_value = 'consultation' and action_type_value = 'close_consultation' then
    update public.consultations set status = 'closed' where id = target_id_value::uuid; get diagnostics affected_count = row_count;
  elsif target_type_value = 'review' and action_type_value in ('hide_review', 'restore_review') then
    update public.reviews set status = case when action_type_value = 'hide_review' then 'hidden' else 'published' end where id = target_id_value::uuid; get diagnostics affected_count = row_count;
  elsif target_type_value = 'report' and action_type_value in ('resolve_report', 'dismiss_report') then
    update public.admin_reports set status = case when action_type_value = 'resolve_report' then 'resolved' else 'dismissed' end, resolved_at = now(), resolved_by = admin_user_id where id = target_id_value::uuid; get diagnostics affected_count = row_count;
  elsif target_type_value = 'work' and action_type_value in ('open_dispute', 'resolve_dispute') then
    update public.works set dispute_status = case when action_type_value = 'open_dispute' then 'open' else 'resolved' end where id = target_id_value::uuid; get diagnostics affected_count = row_count;
  elsif action_type_value in ('note', 'warn') then affected_count := 1;
  else raise exception 'unsupported non-financial admin action'; end if;
  if affected_count = 0 then raise exception 'admin action target not found or transition denied'; end if;
  insert into public.admin_actions (admin_id, target_type, target_id, action_type, reason)
  values (admin_user_id, target_type_value, target_id_value, action_type_value, trim(reason_value));
end; $$;
revoke all on function public.apply_admin_moderation_action(uuid, text, text, text, text) from public, anon, authenticated;
grant execute on function public.apply_admin_moderation_action(uuid, text, text, text, text) to service_role;
create or replace function public.withdraw_account(requested_user_id uuid)
returns void language plpgsql security definer set search_path = '' as $$
begin
  if requested_user_id is null then raise exception 'user ID is required'; end if;
  update public.profiles set account_status = 'restricted', withdrawn_at = coalesce(withdrawn_at, now()), email = null,
    display_name = '탈퇴한 사용자', name = '탈퇴한 사용자', avatar_url = null, expert_intro = null,
    ai_tools = '{}', sample_links = '{}', interests = '{}', request_purposes = '{}' where id = requested_user_id;
  if not found then raise exception 'profile not found'; end if;
  update public.expert_profiles set image_url = null, profession = '', name = '탈퇴한 사용자', one_liner = '', greeting = '', activities = '[]', awards = '[]', sample_links = '[]', ai_tools = '[]', edit_tools = '[]', packages = '{}', contact_available_time = null, average_response_time = null where user_id = requested_user_id;
  update public.expert_payout_accounts set bank_name = '', account_number = '', account_holder = '', verified_at = null where expert_id = requested_user_id;
  update public.expert_products set status = 'hidden', is_featured = false, display_order = 0 where expert_id = requested_user_id;
  update public.notification_preferences set phone_number = '', kakao_alimtalk_enabled = false, sms_fallback_enabled = false where user_id = requested_user_id;
  insert into public.operation_logs (actor_id, event_type, target_type, target_id, detail)
  values (requested_user_id, 'account_withdrawal_access_blocked', 'user', requested_user_id::text, '{"physicalDeletion":false}');
end; $$;
create or replace function public.record_withdrawal_session_revocation(requested_user_id uuid, revocation_succeeded boolean, detail_text text default null)
returns void language plpgsql security definer set search_path = '' as $$
begin
  if not exists (select 1 from public.profiles where id = requested_user_id and account_status = 'restricted' and withdrawn_at is not null) then raise exception 'withdrawal access block required'; end if;
  insert into public.operation_logs (actor_id, event_type, target_type, target_id, detail)
  values (requested_user_id, case when revocation_succeeded then 'account_withdrawal_sessions_revoked' else 'account_withdrawal_session_recovery_required' end, 'user', requested_user_id::text, jsonb_build_object('succeeded', revocation_succeeded, 'detail', detail_text));
end; $$;
revoke all on function public.withdraw_account(uuid) from public, anon, authenticated;
revoke all on function public.record_withdrawal_session_revocation(uuid, boolean, text) from public, anon, authenticated;
grant execute on function public.withdraw_account(uuid) to service_role;
grant execute on function public.record_withdrawal_session_revocation(uuid, boolean, text) to service_role;
