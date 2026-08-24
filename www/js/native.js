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

// Fixed ids so re-scheduling replaces rather than stacks.
export const ALARM_SESSION = 1001;
export const ALARM_KEGEL_REMINDER = 2001;
export const ALARM_PRAY_MORNING = 3001;
export const ALARM_PRAY_EVENING = 3002;
export const ALARM_BIBLE = 4001;
export const ALARM_BREATHE = 5001;
