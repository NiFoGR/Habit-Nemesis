// Bridge to Capacitor's LocalNotifications when running as the installed APK.
//
// In the APK this schedules through Android's AlarmManager, so the alarm fires
// with sound even when the app is backgrounded or killed, a web Notification
// cannot do that. In the browser everything here is a silent no-op and the
// caller falls back to the in-page notification.

/** True in the installed APK, false in any browser. Exported because a handful
 *  of web APIs are present in the WebView and quietly do nothing there, and a
 *  caller that cannot tell the difference has no way to offer a route that
 *  works. `ui.js`'s saveFile is the one that cares. */
export const isNative = () => !!window.Capacitor?.isNativePlatform?.();
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

/* ---------------- the navigation bar ----------------
   NiFo has its own bottom bar now, and two bars stacked at the bottom of a
   phone is one too many. The system one goes, in the mode where a swipe from
   the edge brings it back for a few seconds. The status bar is left alone: it
   carries the clock and the battery and nothing of ours wants that strip.

   Android drops the request every time the window loses focus, so this is
   called again on every return to the foreground. Asking twice costs nothing. */

const systemUi = () => window.Capacitor?.Plugins?.SystemUi;

export async function hideNavBar() {
  const p = systemUi();
  if (!isNative() || !p) return false;
  try {
    await p.hideNavigationBar();
    return true;
  } catch {
    // An older APK without the plugin is not a broken app, just a taller one.
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
// The Arena's own block: an arc opening, qualification night, each knockout
// round, and the shout the day before a final. Fixed ids so re-scheduling on
// every launch replaces rather than stacks, the same as the habit block.
export const ALARM_ARENA_BASE = 7001;
export const ALARM_ARENA_SLOTS = 8;
