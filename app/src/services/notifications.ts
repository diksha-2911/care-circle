import Constants from 'expo-constants';
import { Platform } from 'react-native';

const isExpoGo =
  Constants.executionEnvironment === 'storeClient' ||
  Constants.appOwnership === 'expo';

type NotificationsModule = typeof import('expo-notifications');

const CHANNEL_ID = 'medication-reminders';

let cachedModule: NotificationsModule | null = null;
let channelReady = false;
let warnedExpoGo = false;

/** Returns the module, or null when running in Expo Go (unsupported). */
async function getNotifications(): Promise<NotificationsModule | null> {
  if (isExpoGo) {
    if (!warnedExpoGo) {
      console.warn('Notifications are disabled in Expo Go for this app.');
      warnedExpoGo = true;
    }
    return null;
  }

  if (cachedModule) return cachedModule;

  cachedModule = await import('expo-notifications');
  return cachedModule;
}

export async function ensureNotificationChannel(): Promise<void> {
  const Notifications = await getNotifications();
  if (!Notifications) return;
  if (Platform.OS !== 'android' || channelReady) return;

  await Notifications.setNotificationChannelAsync(CHANNEL_ID, {
    name: 'Medication reminders',
    importance: Notifications.AndroidImportance.MAX,
    vibrationPattern: [0, 250, 250, 250],
    enableVibrate: true,
  });

  channelReady = true;
}

export async function requestNotificationPermissions(): Promise<boolean> {
  const Notifications = await getNotifications();
  if (!Notifications) return false;

  const { status: existing } = await Notifications.getPermissionsAsync();
  if (existing === 'granted') return true;

  const { status } = await Notifications.requestPermissionsAsync();
  return status === 'granted';
}

/** Channel + permission. Returns the module, or null if unavailable/denied. */
async function prepare(): Promise<NotificationsModule | null> {
  const Notifications = await getNotifications();
  if (!Notifications) return null;

  await ensureNotificationChannel();

  const granted = await requestNotificationPermissions();
  if (!granted) {
    console.warn('Notification permission not granted; nothing scheduled.');
    return null;
  }

  return Notifications;
}

/** Call once at app startup (App.tsx). */
export async function initNotifications(): Promise<boolean> {
  return (await prepare()) !== null;
}

export async function scheduleTestNotification(): Promise<string | null> {
  const Notifications = await prepare();
  if (!Notifications) return null;

  return await Notifications.scheduleNotificationAsync({
    content: {
      title: '💊 Medicine Reminder',
      body: 'Time to take your medicine.',
    },
    trigger: {
      type: Notifications.SchedulableTriggerInputTypes.TIME_INTERVAL,
      seconds: 60,
      repeats: false,
      channelId: CHANNEL_ID,
    },
  });
}

/** Schedule one daily reminder per medication alarm time ("HH:MM", 24h). */
export async function scheduleMedicationAlarms(
  drugName: string,
  dosage: string,
  alarmTimes: string[]
): Promise<string[]> {
  const Notifications = await prepare();
  if (!Notifications) return [];

  const ids: string[] = [];

  for (const time of alarmTimes) {
    const [hourStr, minuteStr] = time.split(':');
    const hour = Number(hourStr);
    const minute = Number(minuteStr);

    if (
      !Number.isInteger(hour) ||
      !Number.isInteger(minute) ||
      hour < 0 ||
      hour > 23 ||
      minute < 0 ||
      minute > 59
    ) {
      console.warn(`Skipping invalid medication alarm time: ${time}`);
      continue;
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
        channelId: CHANNEL_ID,
      },
    });

    ids.push(id);
  }

  return ids;
}

/** Schedule appointment reminders 24 hours and 1 hour beforehand. */
export async function scheduleAppointmentReminders(
  doctorName: string,
  appointmentTime: Date
): Promise<string[]> {
  const Notifications = await prepare();
  if (!Notifications) return [];

  const now = Date.now();

  const reminders = [
    { offsetMs: 24 * 60 * 60 * 1000, label: 'tomorrow' },
    { offsetMs: 60 * 60 * 1000, label: 'in 1 hour' },
  ];

  const ids: string[] = [];

  for (const reminder of reminders) {
    const triggerDate = new Date(appointmentTime.getTime() - reminder.offsetMs);

    if (
      triggerDate.getTime() <= now ||
      triggerDate.getTime() >= appointmentTime.getTime()
    ) {
      continue;
    }

    const id = await Notifications.scheduleNotificationAsync({
      content: {
        title: '📅 Appointment reminder',
        body: `Your appointment${
          doctorName.trim() ? ` with ${doctorName.trim()}` : ''
        } is ${reminder.label}.`,
        data: {
          type: 'appointment_reminder',
          appointmentTime: appointmentTime.toISOString(),
        },
      },
      trigger: {
        type: Notifications.SchedulableTriggerInputTypes.DATE,
        date: triggerDate,
        channelId: CHANNEL_ID,
      },
    });

    ids.push(id);
  }

  return ids;
}

export async function cancelMedicationAlarms(ids: string[]): Promise<void> {
  const Notifications = await getNotifications();
  if (!Notifications) return;

  for (const id of ids) {
    try {
      await Notifications.cancelScheduledNotificationAsync(id);
    } catch (error) {
      console.warn('Could not cancel medication alarm:', error);
    }
  }
}

export async function cancelAppointmentReminders(ids: string[]): Promise<void> {
  const Notifications = await getNotifications();
  if (!Notifications) return;

  for (const id of ids) {
    try {
      await Notifications.cancelScheduledNotificationAsync(id);
    } catch (error) {
      console.warn('Could not cancel appointment reminder:', error);
    }
  }
}

export async function registerForPushNotifications(
  userId: string
): Promise<string | null> {
  const Notifications = await prepare();
  if (!Notifications) return null;

  const deviceToken = await Notifications.getDevicePushTokenAsync();
  console.log(`Device token for ${userId}:`, deviceToken.data);

  return deviceToken.data;
}