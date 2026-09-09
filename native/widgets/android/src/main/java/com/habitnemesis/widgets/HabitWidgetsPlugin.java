// The bridge. The web app pushes the snapshot on every change and drains the
// marks made on a widget while it was closed.
package com.habitnemesis.widgets;

import android.content.SharedPreferences;

import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;

import org.json.JSONArray;
import org.json.JSONException;
import org.json.JSONObject;

@CapacitorPlugin(name = "HabitWidgets")
public class HabitWidgetsPlugin extends Plugin {

    @PluginMethod
    public void writeSnapshot(PluginCall call) {
        String json = call.getString("json");
        if (json == null) {
            call.reject("json is required");
            return;
        }
        Widgets.prefs(getContext()).edit().putString(Widgets.KEY_SNAPSHOT, json).apply();
        Widgets.updateAll(getContext());

        JSObject result = new JSObject();
        put(result, "ok", Boolean.TRUE);
        call.resolve(result);
    }

    @PluginMethod
    public void drainQueue(PluginCall call) {
        SharedPreferences prefs = Widgets.prefs(getContext());
        JSONArray marks;
        try {
            marks = new JSONArray(prefs.getString(Widgets.KEY_QUEUE, "[]"));
        } catch (JSONException e) {
            marks = new JSONArray();
        }
        prefs.edit().remove(Widgets.KEY_QUEUE).apply();

        JSObject result = new JSObject();
        put(result, "marks", marks);
        call.resolve(result);
    }

    // Typed as JSONObject on purpose: JSObject's own put() overloads vary by version.
    private static void put(JSONObject target, String key, Object value) {
        try {
            target.put(key, value);
        } catch (JSONException ignored) {
        }
    }
}
