// Capacitor bridge. Real Android alarms in the APK, silent no-ops in a browser.

/** True in the APK. Some web APIs exist in the WebView and quietly do nothing,
 *  so callers that need a working route ask first. */
export const isNative = () => !!window.Capacitor?.isNativePlatform?.();
const plugin = () => window.Capacitor?.Plugins?.LocalNotifications;

export const hasAlarms = () => isNative() && !!plugin();

/* ----------------- permission ----------------- */
// Android 13 made notifications a runtime permission and denies them by
// default. Scheduling without it throws, which this file swallows, so an
// unasked app saves reminder times that can never fire.

/** 'granted', 'denied', or 'prompt' when it has never been asked. */
export async function alarmPermission() {
  if (!hasAlarms()) return 'denied';
  try {
    const { display } = await plugin().checkPermissions();
    if (display === 'granted') return 'granted';
    return display === 'denied' ? 'denied' : 'prompt';
  } catch {
    return 'denied';
  }
}

/** Asks, unless already granted or already refused. Call it where a reminder is
 *  switched on, never on launch. */
export async function askAlarms() {
  if (!hasAlarms()) return false;
  try {
    if ((await plugin().checkPermissions()).display === 'granted') return true;
    return (await plugin().requestPermissions()).display === 'granted';
  } catch {
    return false;
  }
}

/** One-shot alarm. The same id replaces the previous one. */
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
    /* never fired is fine */
  }
}

/** Cancel a block in one call. Habits rebuild hundreds of ids on every launch. */
export async function cancelAlarms(ids) {
  if (!hasAlarms() || !ids.length) return;
  try {
    await plugin().cancel({ notifications: ids.map((id) => ({ id })) });
  } catch {
    /* never fired is fine */
  }
}

/** Each `{ id, title, body, hour, minute, weekday }`. weekday 1 = Sunday, null = daily. */
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

/* ----------------- the navigation bar ----------------- */

const systemUi = () => window.Capacitor?.Plugins?.SystemUi;

export async function hideNavBar() {
  const p = systemUi();
  if (!isNative() || !p) return false;
  try {
    await p.hideNavigationBar();
    return true;
  } catch {
    // An older APK without the plugin is just a taller one.
    return false;
  }
}

// Fixed ids: re-scheduling replaces rather than stacks.
// Habits get a block: eight ids each, seven weekdays plus the daily collapse.
export const ALARM_HABIT_BASE = 6001;
export const ALARM_HABIT_SLOTS = 40;
// Arena block: arc opening, qualification, each knockout, the night before a final.
export const ALARM_ARENA_BASE = 7001;
export const ALARM_ARENA_SLOTS = 8;
