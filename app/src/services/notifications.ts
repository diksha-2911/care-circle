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
    console.warn('Skipping local notification: use a development build to test this on Android.');
    return null;
  }

  const id = await Notifications.scheduleNotificationAsync({
    content: { title: '💊 Medicine Reminder', body: 'Time to take your medicine.' },
    trigger: {
      type: Notifications.SchedulableTriggerInputTypes.TIME_INTERVAL,
      seconds: 60,
      repeats: false,
    },
  });
  return id;
}

/** Schedules one daily recurring local notification per medicine alarm time. */
export async function scheduleMedicationAlarms(
  drugName: string,
  dosage: string,
  alarmTimes: string[],
): Promise<string[]> {
  const ids: string[] = [];
  for (const time of alarmTimes) {
    const [hourStr, minuteStr] = time.split(':');
    const id = await Notifications.scheduleNotificationAsync({
      content: {
        title: `💊 Time for ${drugName}`,
        body: `Take your ${dosage} dose now.`,
        data: { drugName },
      },
      trigger: {
        type: Notifications.SchedulableTriggerInputTypes.DAILY,
        hour: Number(hourStr),
        minute: Number(minuteStr),
      },
    });
    ids.push(id);
  }
  return ids;
}

/** Schedules local appointment reminders 24 hours and 1 hour beforehand. */
export async function scheduleAppointmentReminders(
  doctorName: string,
  appointmentTime: Date,
): Promise<string[]> {
  if (isExpoGo) {
    console.warn('Appointment reminders require an Expo development build on Android.');
    return [];
  }

  const now = Date.now();
  const reminders = [
    { offsetMs: 24 * 60 * 60 * 1000, label: 'tomorrow' },
    { offsetMs: 60 * 60 * 1000, label: 'in 1 hour' },
  ];
  const ids: string[] = [];

  for (const reminder of reminders) {
    const triggerDate = new Date(appointmentTime.getTime() - reminder.offsetMs);
    // Do not schedule reminders whose trigger time has already passed.
    if (triggerDate.getTime() <= now || triggerDate.getTime() >= appointmentTime.getTime()) continue;

    const id = await Notifications.scheduleNotificationAsync({
      content: {
        title: '📅 Appointment reminder',
        body: `Your appointment${doctorName.trim() ? ` with ${doctorName.trim()}` : ''} is ${reminder.label}.`,
        data: { type: 'appointment_reminder', appointmentTime: appointmentTime.toISOString() },
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

export async function cancelMedicationAlarms(ids: string[]): Promise<void> {
  for (const id of ids) await Notifications.cancelScheduledNotificationAsync(id);
}

export async function cancelAppointmentReminders(ids: string[]): Promise<void> {
  for (const id of ids) {
    try {
      await Notifications.cancelScheduledNotificationAsync(id);
    } catch (error) {
      // Continue cancelling remaining reminders if an ID is stale or invalid.
      console.warn('Could not cancel appointment reminder:', error);
    }
  }
}

export async function registerForPushNotifications(userId: string) {
  if (isExpoGo) {
    console.warn('Skipping push token registration in Expo Go. Use the Android development build.');
    return null;
  }

  const { status: existingStatus } = await Notifications.getPermissionsAsync();
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
  console.log(`📱 Device token for ${userId}:`, deviceToken.data);
  return deviceToken.data;
}
