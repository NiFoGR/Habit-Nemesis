// Bridge to Capacitor's LocalNotifications when running as the installed APK.
//
// In the APK this schedules through Android's AlarmManager, so the alarm fires
// with sound even when the app is backgrounded or killed, a web Notification
// cannot do that. In the browser everything here is a silent no-op and the
// caller falls back to the in-page notification.

const isNative = () => !!window.Capacitor?.isNativePlatform?.();
const plugin = () => window.Capacitor?.Plugins?.LocalNotifications;

export const hasAlarms = () => isNative() && !!plugin();

export async function ensureAlarmPermission() {
  if (!hasAlarms()) return false;
  try {
    const p = await plugin().requestPermissions();
    return p.display === 'granted';
  } catch {
    return false;
  }
}

/** One-shot alarm at a wall-clock time. Same id replaces the previous one. */
export async function scheduleAlarm(id, at, title, body) {
  if (!hasAlarms()) return false;
  try {
    await cancelAlarm(id);
    await plugin().schedule({
      notifications: [{ id, title, body, schedule: { at: new Date(at), allowWhileIdle: true } }],
    });
    return true;
  } catch {
    return false;
  }
}

export async function cancelAlarm(id) {
  if (!hasAlarms()) return;
  try {
    await plugin().cancel({ notifications: [{ id }] });
  } catch {
    /* cancelling something that never fired is fine */
  }
}

/** Daily repeating reminder at hour:minute. */
export async function scheduleDaily(id, hour, minute, title, body) {
  if (!hasAlarms()) return false;
  try {
    await cancelAlarm(id);
    await plugin().schedule({
      notifications: [{ id, title, body, schedule: { on: { hour, minute }, allowWhileIdle: true } }],
    });
    return true;
  } catch {
    return false;
  }
}

/** Cancel a whole block of ids in one call.
 *
 *  The habits section reserves a block and rebuilds it on every launch, which
 *  is hundreds of ids. One call with the list is a round trip; a loop of
 *  `cancelAlarm` is hundreds of them, at the moment the app is starting. */
export async function cancelAlarms(ids) {
  if (!hasAlarms() || !ids.length) return;
  try {
    await plugin().cancel({ notifications: ids.map((id) => ({ id })) });
  } catch {
    /* cancelling something that never fired is fine */
  }
}

/** Schedule many reminders at once.
 *  Each is `{ id, title, body, hour, minute, weekday }`, where `weekday` is
 *  1 for Sunday through 7 for Saturday, or null for every day. */
export async function scheduleMany(list) {
  if (!hasAlarms() || !list.length) return false;
  try {
    await plugin().schedule({
      notifications: list.map((n) => ({
        id: n.id,
        title: n.title,
        body: n.body,
        schedule: {
          on: n.weekday ? { weekday: n.weekday, hour: n.hour, minute: n.minute } : { hour: n.hour, minute: n.minute },
          allowWhileIdle: true,
        },
      })),
    });
    return true;
  } catch {
    return false;
  }
}

// Fixed ids so re-scheduling replaces rather than stacks.
export const ALARM_SESSION = 1001;
export const ALARM_KEGEL_REMINDER = 2001;
export const ALARM_PRAY_MORNING = 3001;
export const ALARM_PRAY_EVENING = 3002;
export const ALARM_BIBLE = 4001;
export const ALARM_BREATHE = 5001;
// Habits get a block rather than an id, because there are as many reminders as
// you make habits, and up to seven a habit when it only asks for some days.
// Eight ids a habit: seven weekdays and the everyday collapse at the head.
export const ALARM_HABIT_BASE = 6001;
export const ALARM_HABIT_SLOTS = 40;
