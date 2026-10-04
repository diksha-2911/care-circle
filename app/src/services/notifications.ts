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