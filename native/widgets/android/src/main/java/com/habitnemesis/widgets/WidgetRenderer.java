// Reads the snapshot and builds the RemoteViews for all three widgets.
// The providers do nothing else.
package com.habitnemesis.widgets;

import android.appwidget.AppWidgetManager;
import android.content.Context;
import android.graphics.Bitmap;
import android.graphics.BitmapFactory;
import android.os.Bundle;
import android.view.View;
import android.widget.RemoteViews;

import java.io.IOException;
import java.io.InputStream;
import java.util.HashMap;

final class WidgetRenderer {

    private static final int COLS = 4;
    private static final int MAX_ROWS = 8;

    // One request code per destination, or FLAG_UPDATE_CURRENT merges them.
    private static final int RQ_HOME = 1;
    private static final int RQ_ARENA = 2;

    private WidgetRenderer() {
    }

    /* ---- fixture ---- */

    static void fixture(Context context, AppWidgetManager manager, int[] ids) {
        Snapshot snap = Snapshot.parse(Widgets.snapshot(context));
        RemoteViews views = new RemoteViews(context.getPackageName(), R.layout.hnw_widget_fixture);
        views.setOnClickPendingIntent(R.id.hnw_fixture_root, Widgets.launch(context, RQ_ARENA, "#/arena"));

        Snapshot.Fixture fx = snap.fixture;
        views.setViewVisibility(R.id.hnw_fixture_body, fx == null ? View.GONE : View.VISIBLE);
        views.setViewVisibility(R.id.hnw_fixture_empty, fx == null ? View.VISIBLE : View.GONE);
        if (fx == null) {
            manager.updateAppWidget(ids, views);
            return;
        }

        views.setTextViewText(R.id.hnw_fixture_division, fx.division);
        views.setTextViewText(R.id.hnw_fixture_them_name, fx.themName);
        views.setTextViewText(R.id.hnw_fixture_you_pct, fx.you + "%");
        views.setTextViewText(R.id.hnw_fixture_them_pct, fx.them + "%");

        // Both lanes are percentages, so both run to 100.
        views.setProgressBar(R.id.hnw_fixture_you_bar, 100, fx.you, false);
        views.setProgressBar(R.id.hnw_fixture_them_bar, 100, fx.them, false);

        int gap = Math.abs(fx.you - fx.them);
        String verdict = "Level";
        int colour = Widgets.MUTED;
        if ("ahead".equals(fx.state)) {
            verdict = "Ahead by " + gap;
            colour = Widgets.GOOD;
        } else if ("behind".equals(fx.state)) {
            verdict = "Behind by " + gap;
            colour = Widgets.WARN;
        }
        views.setTextViewText(R.id.hnw_fixture_verdict, verdict);
        views.setTextColor(R.id.hnw_fixture_verdict, colour);
        views.setTextViewText(R.id.hnw_fixture_left, fx.daysLeft == 1 ? "1 day left" : fx.daysLeft + " days left");

        Bitmap crest = crest(context, fx.crest, Widgets.px(context, 32));
        views.setViewVisibility(R.id.hnw_fixture_crest, crest == null ? View.GONE : View.VISIBLE);
        if (crest != null) views.setImageViewBitmap(R.id.hnw_fixture_crest, crest);

        manager.updateAppWidget(ids, views);
    }

    /* ---- today ---- */

    static void today(Context context, AppWidgetManager manager, int[] ids) {
        Snapshot snap = Snapshot.parse(Widgets.snapshot(context));
        RemoteViews views = new RemoteViews(context.getPackageName(), R.layout.hnw_widget_today);
        views.setOnClickPendingIntent(R.id.hnw_today_root, Widgets.launch(context, RQ_HOME, null));

        int done = snap.owedDone;
        int total = snap.owedTotal;
        boolean cleared = total > 0 && done >= total;

        // Capped: the bitmap rides in the RemoteViews.
        int size = Math.min(Widgets.px(context, 84), 240);
        views.setImageViewBitmap(R.id.hnw_today_ring, Draw.ring(size, done, total, Widgets.LINE, Widgets.ACCENT));

        views.setViewVisibility(R.id.hnw_today_fraction, total > 0 ? View.VISIBLE : View.GONE);
        views.setTextViewText(R.id.hnw_today_fraction, done + "/" + total);
        views.setTextColor(R.id.hnw_today_fraction, cleared ? Widgets.ON_ACCENT : Widgets.TEXT);

        if (total <= 0) {
            views.setViewVisibility(R.id.hnw_today_left, View.VISIBLE);
            views.setTextViewText(R.id.hnw_today_left, "Nothing due");
        } else if (cleared) {
            // The full disc already says it.
            views.setViewVisibility(R.id.hnw_today_left, View.GONE);
        } else {
            int left = total - done;
            views.setViewVisibility(R.id.hnw_today_left, View.VISIBLE);
            views.setTextViewText(R.id.hnw_today_left, left + " left");
        }

        manager.updateAppWidget(ids, views);
    }

    /* ---- grid ---- */

    static void grid(Context context, AppWidgetManager manager, int[] ids) {
        Snapshot snap = Snapshot.parse(Widgets.snapshot(context));
        for (int id : ids) {
            manager.updateAppWidget(id, gridViews(context, snap, cap(manager, id)));
        }
    }

    private static RemoteViews gridViews(Context context, Snapshot snap, int cap) {
        RemoteViews views = new RemoteViews(context.getPackageName(), R.layout.hnw_widget_grid);
        views.setOnClickPendingIntent(R.id.hnw_grid_root, Widgets.launch(context, RQ_HOME, null));
        views.removeAllViews(R.id.hnw_grid_rows);

        int todayAt = snap.todayIndex();
        int shown = Math.min(COLS, todayAt + 1);
        int start = todayAt + 1 - shown;
        // Short weeks pad on the left, so today stays the rightmost column.
        int pad = COLS - shown;

        int[] heads = { R.id.hnw_grid_d0, R.id.hnw_grid_d1, R.id.hnw_grid_d2, R.id.hnw_grid_d3 };
        for (int c = 0; c < COLS; c++) {
            int day = c < pad ? -1 : start + (c - pad);
            String label = day >= 0 && day < snap.dayLabels.length ? snap.dayLabels[day] : "";
            views.setTextViewText(heads[c], label);
            views.setTextColor(heads[c], day >= 0 && day == todayAt ? Widgets.MUTED : Widgets.FAINT);
        }

        int total = snap.rows.size();
        int limit = Math.min(total, cap);
        int cell = Widgets.px(context, 18);
        HashMap<String, Bitmap> cache = new HashMap<>();
        int[] slots = { R.id.hnw_row_c0, R.id.hnw_row_c1, R.id.hnw_row_c2, R.id.hnw_row_c3 };

        for (int r = 0; r < limit; r++) {
            Snapshot.Row row = snap.rows.get(r);
            RemoteViews line = new RemoteViews(context.getPackageName(), R.layout.hnw_widget_grid_row);
            line.setTextViewText(R.id.hnw_row_name, row.name);
            line.setTextColor(R.id.hnw_row_name, row.colour);
            line.setOnClickPendingIntent(R.id.hnw_row_name, Widgets.launch(context, RQ_HOME, null));

            for (int c = 0; c < COLS; c++) {
                int day = c < pad ? -1 : start + (c - pad);
                line.setImageViewBitmap(slots[c], glyph(cache, cell, row, day));
                line.setContentDescription(slots[c], row.name);
                if (day == todayAt && day >= 0 && row.yesno()) {
                    line.setOnClickPendingIntent(slots[c], Widgets.mark(context, row.id, snap.days[day]));
                } else {
                    line.setOnClickPendingIntent(slots[c], Widgets.launch(context, RQ_HOME, null));
                }
            }
            views.addView(R.id.hnw_grid_rows, line);
        }

        int hidden = total - limit;
        views.setViewVisibility(R.id.hnw_grid_more, hidden > 0 ? View.VISIBLE : View.GONE);
        if (hidden > 0) views.setTextViewText(R.id.hnw_grid_more, "+" + hidden + " more");
        views.setViewVisibility(R.id.hnw_grid_head, total > 0 ? View.VISIBLE : View.GONE);
        views.setViewVisibility(R.id.hnw_grid_empty, total > 0 ? View.GONE : View.VISIBLE);
        return views;
    }

    /** How many rows the placed height fits. Header and padding 26dp, a row 24dp. */
    private static int cap(AppWidgetManager manager, int id) {
        int height = 110;
        Bundle options = manager.getAppWidgetOptions(id);
        if (options != null) {
            int reported = options.getInt(AppWidgetManager.OPTION_APPWIDGET_MIN_HEIGHT, 0);
            if (reported > 0) height = reported;
        }
        return Math.max(1, Math.min(MAX_ROWS, (height - 26) / 24));
    }

    private static Bitmap glyph(HashMap<String, Bitmap> cache, int size, Snapshot.Row row, int day) {
        Double value = row.mark(day);
        String key = "none";
        if (value != null && row.yesno()) {
            double v = value;
            key = v == 1 ? "done" + row.colour : (v == -1 ? "skip" : "miss");
        } else if (value != null) {
            key = "num" + (value >= row.target ? row.colour : Widgets.MUTED) + ":" + number(value);
        }

        Bitmap hit = cache.get(key);
        if (hit != null) return hit;

        Bitmap made;
        if (key.startsWith("done")) made = Draw.tick(size, row.colour);
        else if (key.startsWith("skip")) made = Draw.skip(size, Widgets.CALM);
        else if (key.startsWith("miss")) made = Draw.cross(size, Widgets.ASH);
        else if (key.startsWith("num")) made = Draw.label(size, number(value), value >= row.target ? row.colour : Widgets.MUTED);
        else made = Draw.dot(size, Widgets.FAINT);

        cache.put(key, made);
        return made;
    }

    private static String number(double value) {
        if (value == Math.rint(value) && Math.abs(value) < 1e9) return String.valueOf((long) value);
        return String.valueOf(Math.round(value * 10) / 10.0);
    }

    /* ---- crest ---- */

    /** Capacitor copies www/ to assets/public/. Absent or unreadable means no crest. */
    private static Bitmap crest(Context context, String name, int target) {
        if (!plain(name)) return null;
        String path = "public/img/" + name + ".webp";

        BitmapFactory.Options bounds = new BitmapFactory.Options();
        bounds.inJustDecodeBounds = true;
        InputStream probe = null;
        try {
            probe = context.getAssets().open(path);
            BitmapFactory.decodeStream(probe, null, bounds);
        } catch (Exception e) {
            return null;
        } finally {
            close(probe);
        }

        BitmapFactory.Options options = new BitmapFactory.Options();
        options.inSampleSize = sample(bounds.outWidth, target);
        InputStream in = null;
        try {
            in = context.getAssets().open(path);
            return BitmapFactory.decodeStream(in, null, options);
        } catch (Exception e) {
            return null;
        } finally {
            close(in);
        }
    }

    // The name comes from a saved file, so it never leaves img/.
    private static boolean plain(String name) {
        if (name == null || name.length() == 0 || name.length() > 64) return false;
        for (int i = 0; i < name.length(); i++) {
            char c = name.charAt(i);
            if (c != '-' && (c < 'a' || c > 'z') && (c < '0' || c > '9')) return false;
        }
        return true;
    }

    private static int sample(int width, int target) {
        int sample = 1;
        while (target > 0 && width / (sample * 2) >= target) sample *= 2;
        return sample;
    }

    private static void close(InputStream in) {
        if (in == null) return;
        try {
            in.close();
        } catch (IOException ignored) {
        }
    }
}
