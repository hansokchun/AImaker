grant select on public.profiles to authenticated;
grant select on public.expert_products, public.proposals, public.reviews, public.service_requests, public.works to anon, authenticated;
grant select on public.notification_events, public.payment_orders to anon, authenticated;
grant select on public.settlement_payouts to authenticated;
grant insert, update on public.expert_products to authenticated;
grant insert, update on public.service_requests to anon, authenticated;
grant insert on public.profiles to authenticated;
grant insert on public.reviews to anon, authenticated;
