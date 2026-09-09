// Shared widget plumbing: the store, the palette, the intents, and the nudge
// that makes every placed widget re-render.
package com.habitnemesis.widgets;

import android.app.PendingIntent;
import android.appwidget.AppWidgetManager;
import android.content.ComponentName;
import android.content.Context;
import android.content.Intent;
import android.content.SharedPreferences;

final class Widgets {

    static final String PREFS = "habitnemesis.widgets";
    static final String KEY_SNAPSHOT = "snapshot";
    static final String KEY_QUEUE = "queue";

    static final String ACTION_MARK = "com.habitnemesis.widgets.MARK";
    static final String EXTRA_HABIT = "habitId";
    static final String EXTRA_DAY = "day";
    static final String EXTRA_ROUTE = "route";

    /* ---- palette ---- */

    // Ground and surface are the card and the bar grooves: those live in the drawables.
    static final int LINE = 0xFF3A4459;
    static final int TEXT = 0xFFE6EAF0;
    static final int MUTED = 0xFF97A1B0;
    static final int FAINT = 0xFF6B7686;
    static final int ACCENT = 0xFFE62429;
    static final int ON_ACCENT = 0xFFFFFFFF;
    static final int GOOD = 0xFF46D17F;
    static final int WARN = 0xFFF5A524;
    static final int ASH = 0xFF5B6472;
    static final int CALM = 0xFF3AA8F0;

    /* ---- intents ---- */

    private static final int FLAGS = PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE;

    private Widgets() {
    }

    static SharedPreferences prefs(Context context) {
        return context.getSharedPreferences(PREFS, Context.MODE_PRIVATE);
    }

    static String snapshot(Context context) {
        return prefs(context).getString(KEY_SNAPSHOT, "");
    }

    static int px(Context context, float dp) {
        return Math.round(dp * context.getResources().getDisplayMetrics().density);
    }

    /** Opens the app, optionally carrying a route the web layer can read. */
    static PendingIntent launch(Context context, int requestCode, String route) {
        Intent intent = context.getPackageManager().getLaunchIntentForPackage(context.getPackageName());
        if (intent == null) return null;
        intent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
        if (route != null) intent.putExtra(EXTRA_ROUTE, route);
        return PendingIntent.getActivity(context, requestCode, intent, FLAGS);
    }

    /** Toggles one cell. The request code is per cell, or the intents collapse into one. */
    static PendingIntent mark(Context context, String habitId, String day) {
        Intent intent = new Intent(context, WidgetActionReceiver.class);
        intent.setAction(ACTION_MARK);
        intent.putExtra(EXTRA_HABIT, habitId);
        intent.putExtra(EXTRA_DAY, day);
        return PendingIntent.getBroadcast(context, (habitId + "|" + day).hashCode(), intent, FLAGS);
    }

    /* ---- refresh ---- */

    static void updateAll(Context context) {
        AppWidgetManager manager = AppWidgetManager.getInstance(context);
        if (manager == null) return;
        poke(context, manager, FixtureWidgetProvider.class);
        poke(context, manager, TodayWidgetProvider.class);
        poke(context, manager, GridWidgetProvider.class);
    }

    private static void poke(Context context, AppWidgetManager manager, Class<?> provider) {
        int[] ids;
        try {
            ids = manager.getAppWidgetIds(new ComponentName(context, provider));
        } catch (Exception e) {
            return;
        }
        if (ids == null || ids.length == 0) return;
        Intent intent = new Intent(context, provider);
        intent.setAction(AppWidgetManager.ACTION_APPWIDGET_UPDATE);
        intent.putExtra(AppWidgetManager.EXTRA_APPWIDGET_IDS, ids);
        context.sendBroadcast(intent);
    }
}
