create or replace function public.create_circle_invitation(
  p_circle_id uuid
)
returns text
language plpgsql
security definer
set search_path = public
as $$
declare
  invitation_code text;
begin
  -- Caller must be logged in
  if auth.uid() is null then
    raise exception 'Not authenticated';
  end if;

  -- Caller must have permission to manage members
  if not exists (
    select 1
    from public.circle_members
    where circle_id = p_circle_id
      and user_id = auth.uid()
      and can_manage_members = true
  ) then
    raise exception 'You do not have permission to invite members';
  end if;

  -- Generate a unique invitation code
  loop
    invitation_code :=
      'FAM-' || upper(substr(md5(gen_random_uuid()::text), 1, 6));

    exit when not exists (
      select 1
      from public.circle_invitations
      where code = invitation_code
    );
  end loop;

  -- Create invitation
  insert into public.circle_invitations (
    circle_id,
    invited_by_user_id,
    code,
    role
  )
  values (
    p_circle_id,
    auth.uid(),
    invitation_code,
    'caregiver'
  );

  return invitation_code;
end;
$$;

revoke all on function public.create_circle_invitation(uuid) from public;

grant execute
on function public.create_circle_invitation(uuid)
to authenticated;

create or replace function public.redeem_circle_invitation(p_code text)
returns table (circle_id uuid, role member_role)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_invitation circle_invitations%rowtype;
begin
  select * into v_invitation
  from circle_invitations
  where code = p_code
  for update; -- lock the row so two people can't redeem the same code at once

  if not found then
    raise exception 'Invite code not found';
  end if;

  if v_invitation.status != 'pending' then
    raise exception 'This invite has already been % ', v_invitation.status;
  end if;

  if v_invitation.expires_at < now() then
    update circle_invitations set status = 'expired' where id = v_invitation.id;
    raise exception 'This invite code has expired';
  end if;

  -- Already a member? Don't duplicate — just mark the invite accepted.
  if exists (
    select 1 from circle_members
    where circle_members.circle_id = v_invitation.circle_id
      and user_id = auth.uid()
  ) then
    update circle_invitations set status = 'accepted' where id = v_invitation.id;
    return query select v_invitation.circle_id, v_invitation.role;
    return;
  end if;

  insert into circle_members (
    circle_id, user_id, role,
    can_manage_medications, can_view_health_data, can_manage_members,
    can_trigger_sos, receives_sos_alerts
  ) values (
    v_invitation.circle_id, auth.uid(), v_invitation.role,
    false, true, true, false, true
    -- matches the caregiver defaults in seed.sql; patients are never
    -- invited (they create their own circle), so this is safe as-is
  );

  update circle_invitations set status = 'accepted' where id = v_invitation.id;

  return query select v_invitation.circle_id, v_invitation.role;
end;
$$;

revoke all on function public.redeem_circle_invitation(text) from public;

grant execute
on function public.redeem_circle_invitation(text)
to authenticated;