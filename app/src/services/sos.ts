import { supabase } from './supabase';

const SOS_API_URL = process.env.EXPO_PUBLIC_SOS_API_URL;

export interface SosResult {
  eventId: string;
  status: string;
  message: string;
  deliveries?: Array<{ channel: string; status: string; recipient?: string }>;
}

async function request(path: string, method: 'GET' | 'POST', body?: unknown) {
  if (!SOS_API_URL) throw new Error('SOS API is not configured. Set EXPO_PUBLIC_SOS_API_URL.');
  const { data, error } = await supabase.auth.getSession();
  if (error || !data.session?.access_token) throw new Error('Please sign in before using SOS.');
  const response = await fetch(`${SOS_API_URL.replace(/\/$/, '')}${path}`, {
    method,
    headers: {
      Authorization: `Bearer ${data.session.access_token}`,
      'Content-Type': 'application/json',
    },
    ...(body === undefined ? {} : { body: JSON.stringify(body) }),
  });
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(payload.error || `SOS request failed (${response.status}).`);
  return payload;
}

export async function triggerSos(circleId: string, idempotencyKey: string): Promise<SosResult> {
  const result = await request('/sos', 'POST', { circleId, idempotencyKey });
  return { eventId: result.eventId, status: result.status, message: result.message, deliveries: result.deliveries };
}

export async function getSosStatus(eventId: string): Promise<SosResult> {
  const result = await request(`/sos/${encodeURIComponent(eventId)}`, 'GET');
  return { eventId: result.eventId, status: result.status, message: result.message, deliveries: result.deliveries };
}

export async function acknowledgeSos(eventId: string): Promise<{ eventId: string; acknowledgedAt: string }> {
  return request(`/sos/${encodeURIComponent(eventId)}/acknowledge`, 'POST');
}
