package gr.nifo.nightlight;

import android.content.Context;
import android.content.Intent;
import android.content.SharedPreferences;
import android.net.Uri;
import android.provider.Settings;

import com.getcapacitor.JSArray;
import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;

import java.util.Calendar;

/**
 * The bridge. Deliberately thin.
 *
 * <p>Everything the filter actually does is in {@link OverlayService} and
 * {@link Curve}, because it has to keep happening when the WebView is gone.
 * What crosses this boundary is only ever configuration going in and a status
 * readout coming back, so there is no state here that can drift out of step
 * with what is on screen.
 *
 * <p>{@link #curve} is the one exception, and it earns its place: it lets the
 * settings screen plot the whole day from the same maths the service runs,
 * instead of a JavaScript reimplementation that would be subtly wrong by the
 * second edit.
 */
@CapacitorPlugin(name = "NightLight")
public class NightLightPlugin extends Plugin {

    private SharedPreferences prefs() {
        return getContext().getSharedPreferences(OverlayService.PREFS, Context.MODE_PRIVATE);
    }

    /** What the filter can do on this device, and what it is doing now. */
    @PluginMethod
    public void status(PluginCall call) {
        Context ctx = getContext();
        Curve.Config c = Curve.Config.from(prefs());
        Calendar now = Calendar.getInstance();
        int minute = now.get(Calendar.HOUR_OF_DAY) * 60 + now.get(Calendar.MINUTE);
        int kelvin = Curve.kelvinAt(c, minute);
        boolean hardware = HardwareTint.available(ctx);
        boolean canOverlay = Settings.canDrawOverlays(ctx);
        boolean live = Curve.active(c, System.currentTimeMillis());

        JSObject r = new JSObject();
        r.put("native", true);
        r.put("enabled", c.enabled);
        r.put("running", live);
        r.put("kelvin", kelvin);
        r.put("neutral", kelvin >= c.dayKelvin - 40);
        r.put("pausedUntil", c.pausedUntil);
        r.put("suspended", c.suspended);
        r.put("canOverlay", canOverlay);
        r.put("hardware", hardware);
        r.put("hardwareMin", HardwareTint.minKelvin());
        r.put("hardwareMax", HardwareTint.maxKelvin());
        // Which of the two roads a colour would take right now, so the settings
        // screen can say so instead of the user guessing from how it looks.
        r.put("mode", !live ? (c.suspended ? "suspended" : "off")
                : hardware ? "hardware" : canOverlay ? "overlay" : "blocked");
        r.put("packageName", ctx.getPackageName());
        call.resolve(r);
    }

    /** Writes the schedule the service reads, then wakes it. */
    @PluginMethod
    public void configure(PluginCall call) {
        SharedPreferences.Editor e = prefs().edit();
        if (call.hasOption("enabled")) e.putBoolean("enabled", Boolean.TRUE.equals(call.getBoolean("enabled")));
        if (call.hasOption("curve")) e.putString("curve", call.getString("curve", "gradual"));
        if (call.hasOption("wakeMin")) e.putInt("wakeMin", clampMin(call.getInt("wakeMin", 420)));
        if (call.hasOption("sleepMin")) e.putInt("sleepMin", clampMin(call.getInt("sleepMin", 1320)));
        if (call.hasOption("dayKelvin")) e.putInt("dayKelvin", Curve.clampKelvin(call.getInt("dayKelvin", 6500)));
        if (call.hasOption("nightKelvin")) e.putInt("nightKelvin", Curve.clampKelvin(call.getInt("nightKelvin", 2700)));
        if (call.hasOption("transitionMin")) e.putInt("transitionMin", Math.max(1, Math.min(240, call.getInt("transitionMin", 60))));
        if (call.hasOption("intensity")) e.putFloat("intensity", (float) Math.max(0, Math.min(1, call.getDouble("intensity", 1.0))));
        // Changing anything cancels a pause: you came here to adjust it, so you
        // want to see the adjustment.
        if (call.hasOption("clearPause")) e.putLong("pausedUntil", 0L);
        e.apply();

        OverlayService.kick(getContext(), OverlayService.ACTION_REFRESH);
        status(call);
    }

    /** Pauses for an hour, or resumes if already paused. */
    @PluginMethod
    public void pause(PluginCall call) {
        long until = prefs().getLong("pausedUntil", 0L);
        if (until > System.currentTimeMillis()) {
            prefs().edit().putLong("pausedUntil", 0L).apply();
            OverlayService.kick(getContext(), OverlayService.ACTION_REFRESH);
        } else {
            OverlayService.kick(getContext(), OverlayService.ACTION_PAUSE);
        }
        status(call);
    }

    /**
     * Holds the filter off while a screen that needs true colour is open.
     *
     * <p>Judging a progress photo through an amber wash is misleading and
     * comparing two of them is worse, so the gallery and the camera turn this
     * on while they are up. It is a plain flag rather than a timed pause
     * because it is not a user decision; the app clears it at every launch so a
     * crash mid-gallery cannot leave the filter off indefinitely.
     */
    @PluginMethod
    public void setSuspended(PluginCall call) {
        prefs().edit().putBoolean("suspended", Boolean.TRUE.equals(call.getBoolean("suspended"))).apply();
        OverlayService.kick(getContext(), OverlayService.ACTION_REFRESH);
        status(call);
    }

    /**
     * Sends the user to the "Display over other apps" screen. There is no
     * runtime dialog for this permission; a settings screen is the only door.
     */
    @PluginMethod
    public void requestOverlayPermission(PluginCall call) {
        try {
            Intent i = new Intent(Settings.ACTION_MANAGE_OVERLAY_PERMISSION,
                    Uri.parse("package:" + getContext().getPackageName()));
            i.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
            getContext().startActivity(i);
            call.resolve();
        } catch (Throwable t) {
            call.reject("Could not open the overlay permission screen");
        }
    }

    /**
     * The whole day, sampled, using the service's own maths. `minutes` apart,
     * default every quarter of an hour.
     */
    @PluginMethod
    public void curve(PluginCall call) {
        Curve.Config c = Curve.Config.from(prefs());
        // Anything the caller passes overrides the stored config, so the
        // settings screen can plot a change before committing to it.
        if (call.hasOption("curve")) c.curve = call.getString("curve", c.curve);
        if (call.hasOption("wakeMin")) c.wakeMin = clampMin(call.getInt("wakeMin", c.wakeMin));
        if (call.hasOption("sleepMin")) c.sleepMin = clampMin(call.getInt("sleepMin", c.sleepMin));
        if (call.hasOption("dayKelvin")) c.dayKelvin = Curve.clampKelvin(call.getInt("dayKelvin", c.dayKelvin));
        if (call.hasOption("nightKelvin")) c.nightKelvin = Curve.clampKelvin(call.getInt("nightKelvin", c.nightKelvin));
        if (call.hasOption("transitionMin")) c.transitionMin = Math.max(1, Math.min(240, call.getInt("transitionMin", c.transitionMin)));
        if (call.hasOption("intensity")) c.intensity = (float) Math.max(0, Math.min(1, call.getDouble("intensity", (double) c.intensity)));

        int step = Math.max(5, Math.min(60, call.getInt("step", 15)));
        JSArray out = new JSArray();
        for (int m = 0; m < 1440; m += step) {
            int k = Curve.kelvinAt(c, m);
            JSObject o = new JSObject();
            o.put("min", m);
            o.put("kelvin", k);
            o.put("argb", Curve.overlayArgb(k, c.dayKelvin, c.intensity));
            out.put(o);
        }
        JSObject r = new JSObject();
        r.put("samples", out);
        r.put("step", step);
        call.resolve(r);
    }

    private static int clampMin(int v) {
        return Math.max(0, Math.min(1439, v));
    }
}
