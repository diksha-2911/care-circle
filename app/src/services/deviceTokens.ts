import { supabase } from './supabase';

export async function saveDeviceToken(
  userId: string,
  token: string
) {
  const { data, error } = await supabase
    .from('device_tokens')
    .upsert(
      {
        user_id: userId,
        token,
        platform: 'android',
        updated_at: new Date().toISOString(),
      },
      {
        onConflict: 'token',
      }
    )
    .select()
    .single();

  if (error) {
    console.error('Failed to save device token:', error);
    throw error;
  }

  console.log('Device token saved:', data.id);

  return data;
}