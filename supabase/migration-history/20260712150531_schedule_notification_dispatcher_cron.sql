create extension if not exists pg_net with schema extensions;
create extension if not exists pg_cron with schema extensions;

create or replace function public.schedule_notification_dispatcher_cron(
  function_url text,
  automation_secret text,
  cron_schedule text default '*/5 * * * *'
)
returns void
language plpgsql
security definer
set search_path = pg_catalog, public, extensions
as $$
begin
  if current_role in ('anon', 'authenticated') and (auth.uid() is null or not public.is_admin(auth.uid())) then
    raise exception 'only admins can schedule notification dispatcher';
  end if;

  if length(trim(function_url)) = 0 or length(trim(automation_secret)) = 0 or length(trim(cron_schedule)) = 0 then
    raise exception 'function_url, automation_secret, and cron_schedule are required';
  end if;

  begin
    perform cron.unschedule('notification-dispatcher-runner');
  exception
    when others then
      null;
  end;

  perform cron.schedule(
    'notification-dispatcher-runner',
    cron_schedule,
    format(
      'select net.http_post(url := %L, headers := jsonb_build_object(''Content-Type'', ''application/json'', ''x-automation-secret'', %L), body := ''{}''::jsonb);',
      function_url,
      automation_secret
    )
  );
end;
$$;

revoke all on function public.schedule_notification_dispatcher_cron(text, text, text) from public;
revoke all on function public.schedule_notification_dispatcher_cron(text, text, text) from anon;
revoke all on function public.schedule_notification_dispatcher_cron(text, text, text) from authenticated;
grant execute on function public.schedule_notification_dispatcher_cron(text, text, text) to service_role;;
