import Constants from 'expo-constants';
import * as Notifications from 'expo-notifications';

const isExpoGo = Constants.appOwnership === 'expo';

export async function requestNotificationPermissions() {
  const { status } = await Notifications.requestPermissionsAsync();
  return status === 'granted';
}

export async function ensureNotificationChannel() {
  await Notifications.setNotificationChannelAsync('default', {
    name: 'default',
    importance: Notifications.AndroidImportance.MAX,
  });
}

export async function scheduleTestNotification() {
  if (isExpoGo) {
    console.warn(
      'Skipping local notification: not supported in Expo Go on Android (SDK 53+). ' +
      'Use a development build to test this.'
    );
    return null;
  }

  const Notifications = await import('expo-notifications');

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

/**
 * Schedules one daily recurring local notification per alarm time.
 * Returns the notification IDs.
 */
export async function scheduleMedicationAlarms(
  drugName: string,
  dosage: string,
  alarmTimes: string[] // e.g. ["08:00", "20:00"]
): Promise<string[]> {
  const ids: string[] = [];

  for (const time of alarmTimes) {
    const [hourStr, minuteStr] = time.split(':');
    const hour = Number(hourStr);
    const minute = Number(minuteStr);

    const id = await Notifications.scheduleNotificationAsync({
      content: {
        title: `💊 Time for ${drugName}`,
        body: `Take your ${dosage} dose now.`,
        data: { drugName }, // useful later for deep-linking/logging taken status
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

/** Cancels a previously scheduled set of alarms **/
export async function cancelMedicationAlarms(ids: string[]): Promise<void> {
  for (const id of ids) {
    await Notifications.cancelScheduledNotificationAsync(id);
  }
}

export async function registerForPushNotifications(userId: string) {
  if (isExpoGo) {
    console.warn(
      'Skipping push token registration in Expo Go. ' +
      'Use the Android development build.'
    );
    return null;
  }

  const { status: existingStatus } =
    await Notifications.getPermissionsAsync();

  let finalStatus = existingStatus;

  if (existingStatus !== 'granted') {
    const { status } = await Notifications.requestPermissionsAsync();
    finalStatus = status;
  }

  if (finalStatus !== 'granted') {
    console.warn('Notification permission was not granted.');
    return null;
  }

  await ensureNotificationChannel();

  const deviceToken = await Notifications.getDevicePushTokenAsync();

  console.log('📱 Android device token:', deviceToken.data);

  return deviceToken.data;
}