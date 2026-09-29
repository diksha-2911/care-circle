// Mirrors supabase/migrations/*latest.sql*

export type MemberRole = 'patient' | 'caregiver';

export interface CirclePermissions {
  can_manage_medications: boolean;
  can_view_health_data: boolean;
  can_manage_members: boolean;
  can_trigger_sos: boolean;
  receives_sos_alerts: boolean;
}

export interface CareCircleMembership extends CirclePermissions {
  circle_id: string;
  circle_name: string;
  role: MemberRole;
}