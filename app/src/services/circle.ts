import { supabase } from './supabase';
import { CareCircleMembership, MemberRole} from '../types/circle';

/**
 * All circles the given user belongs to, with their role/permissions in
 * each. A user can belong to more than one circle (e.g. a caregiver for
 * two different family members), so this always returns an array.
 */
export async function getMyCircleMemberships(
  userId: string
): Promise<CareCircleMembership[]> {
  const { data, error } = await supabase
    .from('circle_members')
    .select(
      `
      circle_id,
      role,
      can_manage_medications,
      can_view_health_data,
      can_manage_members,
      can_trigger_sos,
      receives_sos_alerts,
      care_circles ( name )
    `
    )
    .eq('user_id', userId);

  if (error) throw error;

  return (data ?? []).map((row: any) => ({
    circle_id: row.circle_id,
    circle_name: row.care_circles?.name ?? 'Care Circle',
    role: row.role,
    can_manage_medications: row.can_manage_medications,
    can_view_health_data: row.can_view_health_data,
    can_manage_members: row.can_manage_members,
    can_trigger_sos: row.can_trigger_sos,
    receives_sos_alerts: row.receives_sos_alerts,
  }));
}

/**
 * Creates a brand-new care circle with the given user as its patient,
 * with full permissions (patients get can_trigger_sos = true; the schema's
 * check constraint blocks that for caregivers).
 */
export async function createCareCircle(
  _patientUserId: string,
  name: string
): Promise<CareCircleMembership> {
  const { data: circleId, error } = await supabase.rpc(
    'create_care_circle',
    {
      p_name: name,
    }
  );

  if (error) throw error;

  const { data, error: membershipError } = await supabase
    .from('circle_members')
    .select(
      `
      circle_id,
      role,
      can_manage_medications,
      can_view_health_data,
      can_manage_members,
      can_trigger_sos,
      receives_sos_alerts,
      care_circles ( name )
    `
    )
    .eq('circle_id', circleId)
    .eq('role', 'patient')
    .single();

  if (membershipError) throw membershipError;

  return {
    circle_id: data.circle_id,
    circle_name: (data as any).care_circles?.name ?? 'Care Circle',
    role: data.role,
    can_manage_medications: data.can_manage_medications,
    can_view_health_data: data.can_view_health_data,
    can_manage_members: data.can_manage_members,
    can_trigger_sos: data.can_trigger_sos,
    receives_sos_alerts: data.receives_sos_alerts,
  };
}

export async function joinCareCircleWithCode(
  _userId: string,
  code: string
): Promise<{ circle_id: string; role: MemberRole }> {
  const { data, error } = await supabase.rpc('redeem_circle_invitation', {
    p_code: code,
  });

  if (error) throw error;
  if (!data || data.length === 0) throw new Error('Invite could not be redeemed.');

  return data[0];
}

export async function createCircleInvitation(
  circleId: string
): Promise<string> {
  const { data, error } = await supabase.rpc(
    'create_circle_invitation',
    {
      p_circle_id: circleId,
    }
  );

  if (error) {
    throw error;
  }

  return data;
}

