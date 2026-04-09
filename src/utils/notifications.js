import * as Notifications from 'expo-notifications';
import { Platform } from 'react-native';
import * as Device from 'expo-device';
import AsyncStorage from '@react-native-async-storage/async-storage';
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
 * Optimized to avoid redundant cancellations and race conditions.
 */
export async function scheduleTimetableNotifications(passedEntries = null, force = false) {
  // If no entries passed, read from Async Store
  const timetableEntries = passedEntries || (await getTimetable());
  
  if (!timetableEntries || timetableEntries.length === 0) {
    await Notifications.cancelAllScheduledNotificationsAsync();
    await AsyncStorage.removeItem('last_scheduled_hash');
    return 0;
  }

  // Simple hash/check to avoid rescheduling if nothing changed
  // We check length and first/last entry IDs as a quick heuristic
  const currentHash = `h_${timetableEntries.length}_${timetableEntries[0]?.subject}_${timetableEntries[timetableEntries.length-1]?.startTime}`;
  const lastHash = await AsyncStorage.getItem('last_scheduled_hash');
  
  if (!force && currentHash === lastHash) {
    const scheduled = await Notifications.getAllScheduledNotificationsAsync();
    if (scheduled.length > 0) return scheduled.length; // Already scheduled
  }

  // Cancel all old notifications before scheduling fresh ones
  // ONLY if we are actually about to reschedule
  await Notifications.cancelAllScheduledNotificationsAsync();

  const dayMap = {
    'sunday': 1, 'monday': 2, 'tuesday': 3, 'wednesday': 4,
    'thursday': 5, 'friday': 6, 'saturday': 7
  };

  const NOTIFY_MINUTES_BEFORE = 10;
  let scheduleCount = 0;
  const scheduledKeys = new Set();

  for (const entry of timetableEntries) {
    if (!entry.dayOfWeek || !entry.startTime || !entry.subject) continue;

    const day = entry.dayOfWeek.trim().toLowerCase();
    let weekday = dayMap[day];
    if (!weekday) continue;

    const dateObj = new Date(entry.startTime);
    const origHour = dateObj.getHours();
    const origMinute = dateObj.getMinutes();

    // Deduplicate logic
    const triggerKey = `${weekday}_${origHour}_${origMinute}_${entry.subject}`.replace(/\s+/g, '').toLowerCase();
    if (scheduledKeys.has(triggerKey)) continue;
    scheduledKeys.add(triggerKey);

    // Calculate exactly 10 minutes prior
    let notifyHour = origHour;
    let notifyMinute = origMinute - NOTIFY_MINUTES_BEFORE;
    
    if (notifyMinute < 0) {
      notifyMinute += 60;
      notifyHour -= 1;
      // Midnight boundary: if hour goes below 0, notification is on the PREVIOUS day
      if (notifyHour < 0) {
        notifyHour = 23;
        weekday = weekday - 1;
        if (weekday < 1) weekday = 7; // Saturday
      }
    }

    const startTimeStr = dateObj.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });
    const roomInfo = entry.roomCode ? `Room: ${entry.roomCode}` : '';
    const batchInfo = entry.batch ? `Batch: ${entry.batch}` : '';
    const groupInfo = entry.group ? ` (${entry.group})` : '';

    const slug = entry.subject.replace(/[^a-zA-Z0-9]/g, '').substring(0, 15);
    const notificationId = `class_${weekday}_${notifyHour}${notifyMinute}_${slug}`;

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
      // Batching to prevent blocking the thread
      if (scheduleCount % 5 === 0) await new Promise(resolve => setTimeout(resolve, 30));
    } catch (err) {
      console.warn(`[Notification] Failed to schedule "${entry.subject}" on day ${weekday}:`, err);
    }
  }

  await AsyncStorage.setItem('last_scheduled_hash', currentHash);

  // LOGGING FOR VERIFICATION (As requested)
  const all = await Notifications.getAllScheduledNotificationsAsync();
  console.log(`\n🔔 [NOTIFICATIONS CHECK] ${all.length} ACTIVE ALARMS:`);
  all.forEach((n, i) => {
    const t = n.trigger;
    const time = t.hour !== undefined ? `${String(t.hour).padStart(2, '0')}:${String(t.minute).padStart(2, '0')}` : 'Unknown Time';
    const day = ['?', 'Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'][t.weekday] || '?';
    console.log(`   [${day} ${time}] ${n.content.title}`);
  });
  console.log('----------------------------------------\n');

  return scheduleCount;
}



