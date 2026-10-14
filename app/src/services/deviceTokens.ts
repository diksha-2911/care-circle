import { Platform } from 'react-native';
import { supabase } from './supabase';
import { registerForPushNotifications } from './notifications';

export type DevicePlatform = 'android' | 'ios' | 'web' | 'other';

function getDevicePlatform(): DevicePlatform {
  if (Platform.OS === 'android' || Platform.OS === 'ios' || Platform.OS === 'web') {
    return Platform.OS;
  }
  return 'other';
}

/** Save the current device token for the authenticated user. */
export async function saveDeviceToken(userId: string, token: string) {
  if (!userId) throw new Error('A signed-in user is required to save a device token.');
  if (!token.trim()) throw new Error('A non-empty device token is required.');

  const { data: deviceTokenId, error: registrationError } = await supabase.rpc(
    'register_device_token',
    {
      p_token: token,
      p_platform: getDevicePlatform(),
    },
  );

  if (registrationError) {
    console.error('Failed to register device token:', registrationError.message);
    throw registrationError;
  }

  const { data, error } = await supabase
    .from('device_tokens')
    .select('id, user_id, token, platform, created_at, updated_at')
    .eq('id', deviceTokenId)
    .single();

  if (error) {
    console.error('Failed to load registered device token:', error.message);
    throw error;
  }
  return data;
}

/** Register the native token and persist it; returns null if permission is denied. */
export async function registerDeviceTokenForUser(userId: string) {
  const token = await registerForPushNotifications(userId);
  if (!token) return null;
  return saveDeviceToken(userId, token);
}

/** Remove only the signed-in user's device registration. */
export async function removeDeviceToken(userId: string, token: string): Promise<void> {
  const { error } = await supabase
    .from('device_tokens')
    .delete()
    .eq('user_id', userId)
    .eq('token', token);

  if (error) {
    console.error('Failed to remove device token:', error.message);
    throw error;
  }
}
