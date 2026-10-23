
import Constants from 'expo-constants';

const isExpoGo =
  Constants.executionEnvironment === 'storeClient' ||
  Constants.appOwnership === 'expo';

type NotificationsModule = typeof import('expo-notifications');

async function getNotifications(): Promise<NotificationsModule | null> {
  if (isExpoGo) {
    console.warn(
      'Notifications are disabled in Expo Go for this app.'
    );
    return null;
  }

  // Load the native module only in a compatible runtime.
  return await import('expo-notifications');
}

export async function requestNotificationPermissions(): Promise<boolean> {
  const Notifications = await getNotifications();
  if (!Notifications) return false;

  const { status } = await Notifications.requestPermissionsAsync();
  return status === 'granted';
}

export async function ensureNotificationChannel(): Promise<void> {
  const Notifications = await getNotifications();
  if (!Notifications) return;

  await Notifications.setNotificationChannelAsync('default', {
    name: 'default',
    importance: Notifications.AndroidImportance.MAX,
  });
}

export async function scheduleTestNotification(): Promise<string | null> {
  const Notifications = await getNotifications();
  if (!Notifications) return null;

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

/** Schedule one daily reminder per medication alarm time. */
export async function scheduleMedicationAlarms(
  drugName: string,
  dosage: string,
  alarmTimes: string[]
): Promise<string[]> {
  const Notifications = await getNotifications();
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
  const Notifications = await getNotifications();
  if (!Notifications) return [];

  const now = Date.now();

  const reminders = [
    { offsetMs: 24 * 60 * 60 * 1000, label: 'tomorrow' },
    { offsetMs: 60 * 60 * 1000, label: 'in 1 hour' },
  ];

  const ids: string[] = [];

  for (const reminder of reminders) {
    const triggerDate = new Date(
      appointmentTime.getTime() - reminder.offsetMs
    );

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
      },
    });

    ids.push(id);
  }

  return ids;
}

export async function cancelMedicationAlarms(
  ids: string[]
): Promise<void> {
  const Notifications = await getNotifications();
  if (!Notifications) return;

  for (const id of ids) {
    await Notifications.cancelScheduledNotificationAsync(id);
  }
}

export async function cancelAppointmentReminders(
  ids: string[]
): Promise<void> {
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
  const Notifications = await getNotifications();
  if (!Notifications) return null;

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

  await Notifications.setNotificationChannelAsync('default', {
    name: 'default',
    importance: Notifications.AndroidImportance.MAX,
  });

  const deviceToken = await Notifications.getDevicePushTokenAsync();

  console.log(`Device token for ${userId}:`, deviceToken.data);

  return deviceToken.data;
}
