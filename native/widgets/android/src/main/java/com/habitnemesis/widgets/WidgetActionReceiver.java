// A tap on today's cell: flip the mark in the snapshot, queue it for the app,
// cancel the row's reminder, redraw. Only ever flips a mark, never grows the
// snapshot.
package com.habitnemesis.widgets;

import android.app.AlarmManager;
import android.app.NotificationManager;
import android.app.PendingIntent;
import android.content.BroadcastReceiver;
import android.content.Context;
import android.content.Intent;
import android.content.SharedPreferences;
import android.os.Build;

import org.json.JSONArray;
import org.json.JSONException;
import org.json.JSONObject;

public class WidgetActionReceiver extends BroadcastReceiver {

    // The app drains on launch. This is the ceiling if it never does.
    private static final int QUEUE_CAP = 500;

    @Override
    public void onReceive(Context context, Intent intent) {
        if (context == null || intent == null) return;
        if (!Widgets.ACTION_MARK.equals(intent.getAction())) return;
        String habitId = intent.getStringExtra(Widgets.EXTRA_HABIT);
        String day = intent.getStringExtra(Widgets.EXTRA_DAY);
        if (habitId == null || day == null) return;
        if (toggle(context, habitId, day)) Widgets.updateAll(context);
    }

    private boolean toggle(Context context, String habitId, String day) {
        SharedPreferences prefs = Widgets.prefs(context);
        JSONObject root;
        try {
            root = new JSONObject(prefs.getString(Widgets.KEY_SNAPSHOT, ""));
        } catch (JSONException e) {
            return false;
        }

        JSONArray days = root.optJSONArray("days");
        JSONArray rows = root.optJSONArray("rows");
        if (days == null || rows == null) return false;

        int index = -1;
        for (int i = 0; i < days.length(); i++) {
            if (day.equals(days.optString(i, ""))) {
                index = i;
                break;
            }
        }
        if (index < 0) return false;

        JSONObject row = null;
        for (int i = 0; i < rows.length(); i++) {
            JSONObject candidate = rows.optJSONObject(i);
            if (candidate != null && habitId.equals(candidate.optString("id", ""))) {
                row = candidate;
                break;
            }
        }
        if (row == null) return false;
        if (!"yesno".equals(row.optString("kind", "yesno"))) return false;

        JSONArray marks = row.optJSONArray("marks");
        if (marks == null || index >= marks.length()) return false;

        boolean wasDone = !marks.isNull(index) && marks.optDouble(index, Double.NaN) == 1;
        Object next = JSONObject.NULL;
        if (!wasDone) next = Integer.valueOf(1);
        try {
            marks.put(index, next);
        } catch (JSONException e) {
            return false;
        }

        SharedPreferences.Editor editor = prefs.edit();
        editor.putString(Widgets.KEY_SNAPSHOT, root.toString());
        editor.putString(Widgets.KEY_QUEUE, queue(prefs, habitId, day, !wasDone));
        // commit, not apply: the receiver may be gone a moment later.
        editor.commit();
        if (!wasDone) cancelReminder(context, row.optInt("alarmToday", 0));
        return true;
    }

    // The reminder the app armed for this row today, cancelled the way
    // Capacitor's own plugin cancels it: same publisher class, same id.
    private static final String PUBLISHER = "com.capacitorjs.plugins.localnotifications.TimedNotificationPublisher";

    private void cancelReminder(Context context, int id) {
        if (id <= 0) return;
        Intent intent = new Intent();
        intent.setClassName(context, PUBLISHER);
        int flags = PendingIntent.FLAG_NO_CREATE;
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.S) flags |= PendingIntent.FLAG_MUTABLE;
        PendingIntent pending = PendingIntent.getBroadcast(context, id, intent, flags);
        if (pending != null) {
            AlarmManager alarms = (AlarmManager) context.getSystemService(Context.ALARM_SERVICE);
            if (alarms != null) alarms.cancel(pending);
            pending.cancel();
        }
        NotificationManager shown = (NotificationManager) context.getSystemService(Context.NOTIFICATION_SERVICE);
        if (shown != null) shown.cancel(id);
    }

    private String queue(SharedPreferences prefs, String habitId, String day, boolean done) {
        JSONArray queue;
        try {
            queue = new JSONArray(prefs.getString(Widgets.KEY_QUEUE, "[]"));
        } catch (JSONException e) {
            queue = new JSONArray();
        }

        JSONObject mark = new JSONObject();
        Object value = JSONObject.NULL;
        if (done) value = Integer.valueOf(1);
        try {
            mark.put("habitId", habitId);
            mark.put("day", day);
            mark.put("value", value);
            mark.put("at", System.currentTimeMillis());
        } catch (JSONException e) {
            return queue.toString();
        }

        queue.put(mark);
        // Oldest goes first.
        while (queue.length() > QUEUE_CAP) queue.remove(0);
        return queue.toString();
    }
}
