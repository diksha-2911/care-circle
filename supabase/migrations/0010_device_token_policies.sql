-- Protect device registrations: a signed-in user may manage only their own rows.
-- The AWS scheduler uses the service-role key, which bypasses RLS by design.

alter table public.device_tokens enable row level security;

drop policy if exists "users can view their own device tokens" on public.device_tokens;
create policy "users can view their own device tokens"
  on public.device_tokens
  for select
  to authenticated
  using (user_id = (select auth.uid()));

drop policy if exists "users can register their own device tokens" on public.device_tokens;
create policy "users can register their own device tokens"
  on public.device_tokens
  for insert
  to authenticated
  with check (user_id = (select auth.uid()));

drop policy if exists "users can update their own device tokens" on public.device_tokens;
create policy "users can update their own device tokens"
  on public.device_tokens
  for update
  to authenticated
  using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()));

drop policy if exists "users can delete their own device tokens" on public.device_tokens;
create policy "users can delete their own device tokens"
  on public.device_tokens
  for delete
  to authenticated
  using (user_id = (select auth.uid()));

create index if not exists device_tokens_platform_idx
  on public.device_tokens(platform);


-- A single physical device token is unique. When a different account signs in
-- on the same device, transfer ownership to the currently authenticated user.
-- The token is supplied by the native OS API in the app, never by user input.
create or replace function public.register_device_token(
  p_token text,
  p_platform text
)
returns uuid
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_user_id uuid := auth.uid();
  v_id uuid;
begin
  if v_user_id is null then
    raise exception 'Authentication required to register a device token';
  end if;
  if p_token is null or length(trim(p_token)) = 0 then
    raise exception 'A non-empty device token is required';
  end if;
  if p_platform is null or p_platform not in ('android', 'ios', 'web', 'other') then
    raise exception 'Unsupported device platform';
  end if;

  insert into public.device_tokens (user_id, token, platform, updated_at)
  values (v_user_id, trim(p_token), p_platform, now())
  on conflict (token) do update
    set user_id = excluded.user_id,
        platform = excluded.platform,
        updated_at = now()
  returning id into v_id;

  return v_id;
end;
$$;

revoke all on function public.register_device_token(text, text) from public;
grant execute on function public.register_device_token(text, text) to authenticated;
