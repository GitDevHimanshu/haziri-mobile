import * as Notifications from 'expo-notifications';
import { Platform } from 'react-native';
import * as Device from 'expo-device';
import { getTimetable } from '../api/client';

Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge: false,
  }),
});

export async function requestNotificationPermissions() {
  if (Platform.OS === 'android') {
    await Notifications.setNotificationChannelAsync('class_reminders', {
      name: 'Class Reminders',
      description: 'Upcoming class alarms from your timetable',
      importance: Notifications.AndroidImportance.MAX,
      vibrationPattern: [0, 250, 250, 250],
      lightColor: '#4f46e5',
      sound: 'default',
    });
  }

  if (Device.isDevice) {
    const { status: existingStatus } = await Notifications.getPermissionsAsync();
    let finalStatus = existingStatus;
    if (existingStatus !== 'granted') {
      const { status } = await Notifications.requestPermissionsAsync();
      finalStatus = status;
    }
    return finalStatus === 'granted';
  } else {
    return true;
  }
}

/**
 * Schedules individual alarms for every class in the timetable.
 * Now reads directly from AsyncStorage (ground truth) as requested.
 */
export async function scheduleTimetableNotifications(passedEntries = null) {
  // Cancel all old notifications before scheduling fresh ones
  await Notifications.cancelAllScheduledNotificationsAsync();

  // If no entries passed, or to ensure we have ground truth, read from Async Store
  const timetableEntries = passedEntries || (await getTimetable());

  if (!timetableEntries || timetableEntries.length === 0) {
    return 0;
  }

  const dayMap = {
    'sunday': 1, 'monday': 2, 'tuesday': 3, 'wednesday': 4,
    'thursday': 5, 'friday': 6, 'saturday': 7
  };

  const NOTIFY_MINUTES_BEFORE = 10;
  let scheduleCount = 0;

  // Track scheduled triggers to avoid duplicates
  const scheduledKeys = new Set();

  for (const entry of timetableEntries) {
    if (!entry.dayOfWeek || !entry.startTime || !entry.subject) continue;

    const day = entry.dayOfWeek.trim().toLowerCase();
    const weekday = dayMap[day];
    if (!weekday) continue;

    const dateObj = new Date(entry.startTime);
    const origHour = dateObj.getHours();
    const origMinute = dateObj.getMinutes();

    // Deduplicate logic
    const triggerKey = `${weekday}_${origHour}_${origMinute}_${entry.subject}_${entry.batch || ''}_${entry.group || ''}`.replace(/\s+/g, '').toLowerCase();
    if (scheduledKeys.has(triggerKey)) continue;
    scheduledKeys.add(triggerKey);

    // Calculate exactly 10 minutes prior
    let notifyHour = origHour;
    let notifyMinute = origMinute - NOTIFY_MINUTES_BEFORE;
    
    if (notifyMinute < 0) {
      notifyMinute += 60;
      notifyHour -= 1;
    }
    if (notifyHour < 0) {
      notifyHour = 23;
    }

    const startTimeStr = dateObj.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });
    const roomInfo = entry.roomCode ? `Room: ${entry.roomCode}` : '';
    const batchInfo = entry.batch ? `Batch: ${entry.batch}` : '';
    const groupInfo = entry.group ? ` (${entry.group})` : '';

    const slug = entry.subject.replace(/[^a-zA-Z0-9]/g, '').substring(0, 15);
    const notificationId = `class_${weekday}_${origHour}${origMinute}_${slug}`;

    try {
      await Notifications.scheduleNotificationAsync({
        identifier: notificationId,
        content: {
          title: `⏰ CLASS STARTING: ${entry.subject}`,
          body: `Starts at ${startTimeStr} in 10 mins\n${batchInfo}${groupInfo}\n${roomInfo}`,
          sound: 'default',
          priority: Notifications.AndroidNotificationPriority.MAX,
          channelId: 'class_reminders',
          data: { type: 'class_reminder', entry },
        },
        trigger: {
          weekday,
          hour: notifyHour,
          minute: notifyMinute,
          repeats: true,
        },
      });

      scheduleCount++;
      if (scheduleCount % 5 === 0) await new Promise(resolve => setTimeout(resolve, 50));
    } catch (err) {
      console.warn(`[Notification] Failed to schedule "${entry.subject}" on day ${weekday}:`, err);
    }
  }

  return scheduleCount;
}



