// The JSON the web app writes, parsed. A saved file is untrusted input, so a
// missing or wrong-typed key is absence, never a crash.
package com.habitnemesis.widgets;

import android.graphics.Color;

import org.json.JSONArray;
import org.json.JSONException;
import org.json.JSONObject;

import java.util.ArrayList;
import java.util.List;

final class Snapshot {

    static final class Row {
        String id = "";
        String name = "";
        String kind = "yesno";
        int colour = Widgets.TEXT;
        double target = 1;
        Double[] marks = new Double[0];

        boolean yesno() {
            return "yesno".equals(kind);
        }

        Double mark(int index) {
            if (index < 0 || index >= marks.length) return null;
            return marks[index];
        }
    }

    static final class Fixture {
        String themName = "Them";
        String state = "level";
        String division = "";
        String crest = "";
        int you;
        int them;
        int daysLeft;
    }

    String today = "";
    String[] days = new String[0];
    String[] dayLabels = new String[0];
    final List<Row> rows = new ArrayList<>();
    int owedDone;
    int owedTotal;
    Fixture fixture;

    /** The column today sits in, or the last day when today is not listed. */
    int todayIndex() {
        if (today.length() > 0) {
            for (int i = 0; i < days.length; i++) {
                if (today.equals(days[i])) return i;
            }
        }
        return days.length - 1;
    }

    static Snapshot parse(String json) {
        Snapshot snap = new Snapshot();
        if (json == null || json.length() == 0) return snap;
        JSONObject root;
        try {
            root = new JSONObject(json);
        } catch (JSONException e) {
            return snap;
        }

        snap.today = root.optString("today", "");
        snap.days = strings(root.optJSONArray("days"));
        snap.dayLabels = strings(root.optJSONArray("dayLabels"));

        JSONObject owed = root.optJSONObject("owed");
        if (owed != null) {
            snap.owedDone = Math.max(0, owed.optInt("done", 0));
            snap.owedTotal = Math.max(0, owed.optInt("total", 0));
        }

        JSONArray rows = root.optJSONArray("rows");
        if (rows != null) {
            for (int i = 0; i < rows.length(); i++) {
                Row row = row(rows.optJSONObject(i));
                if (row != null) snap.rows.add(row);
            }
        }

        JSONObject fixture = root.optJSONObject("fixture");
        if (fixture != null) {
            Fixture fx = new Fixture();
            fx.themName = fixture.optString("themName", "Them");
            fx.state = fixture.optString("state", "level");
            fx.division = fixture.optString("division", "");
            fx.crest = fixture.optString("crest", "");
            fx.you = pct(fixture.optInt("you", 0));
            fx.them = pct(fixture.optInt("them", 0));
            fx.daysLeft = Math.max(0, fixture.optInt("daysLeft", 0));
            snap.fixture = fx;
        }
        return snap;
    }

    private static Row row(JSONObject source) {
        if (source == null) return null;
        Row row = new Row();
        row.id = source.optString("id", "");
        if (row.id.length() == 0) return null;
        row.name = source.optString("name", "");
        row.kind = source.optString("kind", "yesno");
        row.colour = colour(source.optString("colour", ""));
        row.target = source.optDouble("target", 1);
        if (Double.isNaN(row.target) || row.target <= 0) row.target = 1;
        row.marks = marks(source.optJSONArray("marks"));
        return row;
    }

    private static Double[] marks(JSONArray source) {
        if (source == null) return new Double[0];
        Double[] out = new Double[source.length()];
        for (int i = 0; i < source.length(); i++) {
            if (source.isNull(i)) continue;
            double value = source.optDouble(i, Double.NaN);
            if (!Double.isNaN(value)) out[i] = value;
        }
        return out;
    }

    private static String[] strings(JSONArray source) {
        if (source == null) return new String[0];
        String[] out = new String[source.length()];
        for (int i = 0; i < source.length(); i++) out[i] = source.optString(i, "");
        return out;
    }

    private static int colour(String hex) {
        if (hex == null || !hex.startsWith("#")) return Widgets.TEXT;
        try {
            return Color.parseColor(hex);
        } catch (IllegalArgumentException e) {
            return Widgets.TEXT;
        }
    }

    private static int pct(int value) {
        return Math.max(0, Math.min(100, value));
    }
}
