import * as Notifications from 'expo-notifications';
import { Platform } from 'react-native';
import * as Device from 'expo-device';

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
      description: 'Upcoming class notifications from your timetable',
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

export async function scheduleTimetableNotifications(timetableEntries) {
  // Cancel all old notifications before scheduling fresh ones
  await Notifications.cancelAllScheduledNotificationsAsync();

  const dayMap = {
    'sunday': 1, 'monday': 2, 'tuesday': 3, 'wednesday': 4,
    'thursday': 5, 'friday': 6, 'saturday': 7
  };

  const NOTIFY_MINUTES_BEFORE = 10;
  let scheduleCount = 0;

  // Track scheduled triggers (keyed by ORIGINAL start time) to avoid duplicates
  // e.g., if timetable has two entries for the same class due to parsing splits
  const scheduledKeys = new Set();

  for (const entry of timetableEntries) {
    if (!entry.dayOfWeek || !entry.startTime || !entry.subject) continue;

    const day = entry.dayOfWeek.trim().toLowerCase();
    const weekday = dayMap[day];
    if (!weekday) continue;

    const dateObj = new Date(entry.startTime);
    const origHour = dateObj.getHours();
    const origMinute = dateObj.getMinutes();

    // Deduplicate on ORIGINAL start time + day (before any offset adjustment)
    const triggerKey = `${weekday}_${origHour}_${origMinute}_${entry.subject.replace(/\s+/g, '').toLowerCase()}`;
    if (scheduledKeys.has(triggerKey)) continue;
    scheduledKeys.add(triggerKey);

    // Calculate the notification time (10 minutes before class)
    let notifyHour = origHour;
    let notifyMinute = origMinute - NOTIFY_MINUTES_BEFORE;
    if (notifyMinute < 0) {
      notifyMinute += 60;
      notifyHour -= 1;
    }
    if (notifyHour < 0) {
      notifyHour = 23;
    }

    const roomText = entry.roomCode ? ` · ${entry.roomCode}` : '';
    const groupText = entry.group ? ` · ${entry.group}` : '';
    const startTimeStr = dateObj.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });

    // Unique ID: day + original time + subject slug
    const slug = entry.subject.replace(/[^a-zA-Z0-9]/g, '').substring(0, 20);
    const notificationId = `class_${weekday}_${origHour}${origMinute}_${slug}`;

    try {
      await Notifications.scheduleNotificationAsync({
        identifier: notificationId,
        content: {
          title: `📚 ${entry.subject}`,
          body: `Starts at ${startTimeStr}${roomText}${groupText}`,
          sound: 'default',
          priority: Notifications.AndroidNotificationPriority.MAX,
          channelId: 'class_reminders',
        },
        trigger: {
          weekday,
          hour: notifyHour,
          minute: notifyMinute,
          repeats: true,
        },
      });

      scheduleCount++;

      // Tiny throttle every 5 entries to avoid OS scheduling limits
      if (scheduleCount % 5 === 0) {
        await new Promise(resolve => setTimeout(resolve, 50));
      }
    } catch (err) {
      console.warn(`[Notification] Failed to schedule "${entry.subject}" on day ${weekday}:`, err);
    }
  }

  return scheduleCount;
}
