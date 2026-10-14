import Constants from 'expo-constants';
import * as Device from 'expo-device';
import * as Notifications from 'expo-notifications';
import { Platform } from 'react-native';

const isExpoGo = Constants.appOwnership === 'expo';

export async function requestNotificationPermissions(): Promise<boolean> {
  const { status } = await Notifications.requestPermissionsAsync();
  return status === 'granted';
}

export async function ensureNotificationChannel(): Promise<void> {
  if (Platform.OS !== 'android') return;

  await Notifications.setNotificationChannelAsync('default', {
    name: 'Care Circle alerts',
    importance: Notifications.AndroidImportance.MAX,
    vibrationPattern: [0, 250, 250, 250],
    sound: 'default',
  });
}

export async function scheduleTestNotification(): Promise<string | null> {
  if (isExpoGo && Platform.OS === 'android') {
    console.warn('Use a development build to test local notifications on Android.');
    return null;
  }

  const id = await Notifications.scheduleNotificationAsync({
    content: {
      title: '💊 Medicine Reminder',
      body: 'Time to take your medicine.',
    },
    trigger: {
      type: Notifications.SchedulableTriggerInputTypes.TIME_INTERVAL,
      seconds: 60,
      repeats: false,
    },
  });

  return id;
}

/** Schedules one daily recurring local notification per alarm time. */
export async function scheduleMedicationAlarms(
  drugName: string,
  dosage: string,
  alarmTimes: string[],
): Promise<string[]> {
  const ids: string[] = [];

  for (const time of alarmTimes) {
    const [hourStr, minuteStr] = time.split(':');
    const hour = Number(hourStr);
    const minute = Number(minuteStr);
    if (!Number.isInteger(hour) || hour < 0 || hour > 23 ||
        !Number.isInteger(minute) || minute < 0 || minute > 59) {
      throw new Error(`Invalid alarm time: ${time}. Expected HH:mm.`);
    }

    const id = await Notifications.scheduleNotificationAsync({
      content: {
        title: `💊 Time for ${drugName}`,
        body: `Take your ${dosage} dose now.`,
        data: { drugName },
      },
      trigger: {
        type: Notifications.SchedulableTriggerInputTypes.DAILY,
        hour,
        minute,
      },
    });
    ids.push(id);
  }

  return ids;
}

export async function cancelMedicationAlarms(ids: string[]): Promise<void> {
  await Promise.all(ids.map((id) => Notifications.cancelScheduledNotificationAsync(id)));
}

/**
 * Requests permission if needed and returns the native FCM/APNs device token.
 * A native development/production build is required; Expo push tokens are not
 * used because the scheduler sends directly through Firebase Cloud Messaging.
 */
export async function registerForPushNotifications(_userId?: string): Promise<string | null> {
  if (!Device.isDevice) {
    console.info('Push registration skipped: a physical device is required.');
    return null;
  }

  // This app's backend sends through Firebase Admin. Android's native token is
  // an FCM registration token. iOS requires an FCM-token provider and Firebase
  // iOS configuration, which are not present in this repository yet.
  if (Platform.OS !== 'android') {
    console.info('Push registration is currently configured for Android devices only.');
    return null;
  }

  if (isExpoGo) {
    console.warn('Push registration skipped in Expo Go. Use a development build.');
    return null;
  }

  await ensureNotificationChannel();

  const current = await Notifications.getPermissionsAsync();
  let status = current.status;
  if (status !== 'granted') {
    const requested = await Notifications.requestPermissionsAsync();
    status = requested.status;
  }
  if (status !== 'granted') {
    console.info('Push registration skipped: notification permission was not granted.');
    return null;
  }

  const deviceToken = await Notifications.getDevicePushTokenAsync();
  if (typeof deviceToken.data !== 'string' || !deviceToken.data.trim()) {
    throw new Error('The operating system returned an empty device push token.');
  }

  return deviceToken.data;
}
