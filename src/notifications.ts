// src/notifications.ts
import notifee, {
  AndroidImportance,
  TriggerType,
  TimestampTrigger,
  AuthorizationStatus,
} from '@notifee/react-native';
import { Medication, ReminderTime } from './types';
import { format, addDays } from 'date-fns';

const CHANNEL_ID = 'medications';

export async function initNotifications() {
  await notifee.requestPermission();

  await notifee.createChannel({
    id: CHANNEL_ID,
    name: 'Medication Reminders',
    description: 'Reminders to take your medications',
    importance: AndroidImportance.HIGH,
    vibration: true,
    sound: 'default',
  });
}

function buildLogId(medicationId: string, date: string, time: ReminderTime): string {
  return `${medicationId}__${date}__${time.hour}:${String(time.minute).padStart(2, '0')}`;
}

/**
 * Schedule notifications for the next N days for a medication.
 * Returns an array of notification IDs.
 */
export async function scheduleMedicationNotifications(
  med: Medication,
  daysAhead = 30,
): Promise<string[]> {
  await cancelMedicationNotifications(med.notificationIds);

  if (!med.active || med.frequency === 'as_needed') return [];

  const ids: string[] = [];
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  for (let d = 0; d < daysAhead; d++) {
    const date = addDays(today, d);
    const dateStr = format(date, 'yyyy-MM-dd');

    if (med.endDate && dateStr > med.endDate) break;
    if (dateStr < med.startDate) continue;

    if (med.frequency === 'weekly') {
      const dow = date.getDay();
      if (!med.activeDays?.includes(dow)) continue;
    }

    for (const t of med.reminderTimes) {
      const fireDate = new Date(date);
      fireDate.setHours(t.hour, t.minute, 0, 0);
      if (fireDate < new Date()) continue;

      const logId = buildLogId(med.id, dateStr, t);
      const timeStr = format(fireDate, 'h:mm a');
      const title = `💊 Time for ${med.name}`;
      const body = `Take ${med.dosage} ${med.dosageUnit} at ${timeStr}${med.instructions ? ' — ' + med.instructions : ''}`;

      const trigger: TimestampTrigger = {
        type: TriggerType.TIMESTAMP,
        timestamp: fireDate.getTime(),
      };

      await notifee.createTriggerNotification(
        {
          id: logId,
          title,
          body,
          android: {
            channelId: CHANNEL_ID,
            importance: AndroidImportance.HIGH,
            pressAction: { id: 'default' },
            actions: [
              { title: 'Take Now', pressAction: { id: 'take' } },
              { title: 'Snooze', pressAction: { id: 'snooze' } },
            ],
          },
          data: { logId, medicationId: med.id },
        },
        trigger,
      );

      ids.push(logId);
    }
  }

  return ids;
}

export async function cancelMedicationNotifications(ids: string[]) {
  await Promise.all(ids.map(id => notifee.cancelNotification(id)));
}

export async function cancelAllNotifications() {
  await notifee.cancelAllNotifications();
}
