
create or replace function public.create_care_circle(p_name text)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  new_circle_id uuid;
  current_user_id uuid;
begin
  current_user_id := auth.uid();

  -- Only an authenticated user can create a circle.
  if current_user_id is null then
    raise exception 'Not authenticated';
  end if;

  -- Keep validation on the database side too.
  if p_name is null or btrim(p_name) = '' then
    raise exception 'Circle name cannot be empty';
  end if;

  -- Create the circle with the authenticated user as the patient.
  insert into public.care_circles (
    patient_user_id,
    name
  )
  values (
    current_user_id,
    btrim(p_name)
  )
  returning id into new_circle_id;

  -- Bootstrap the creator as the patient/member.
  insert into public.circle_members (
    circle_id,
    user_id,
    role,
    can_manage_medications,
    can_view_health_data,
    can_manage_members,
    can_trigger_sos,
    receives_sos_alerts
  )
  values (
    new_circle_id,
    current_user_id,
    'patient',
    true,
    true,
    true,
    true,
    true
  );

  return new_circle_id;
end;
$$;

-- The function is called through Supabase RPC by authenticated users.
revoke all on function public.create_care_circle(text) from public;
grant execute on function public.create_care_circle(text) to authenticated;
