package gr.nifo.nightlight;

import android.Manifest;
import android.content.Context;
import android.content.pm.PackageManager;
import android.content.res.Resources;
import android.provider.Settings;

/**
 * Android's own Night Light, driven directly.
 *
 * <p>This is the good path, and the overlay is the fallback. The system filter
 * is a hardware colour transform applied at the display pipeline, so it
 * genuinely reduces what the panel emits: it covers the lock screen, the
 * permission dialogs and everything else an overlay is deliberately kept away
 * from, and — the part that matters most — it does not lift blacks, because it
 * multiplies rather than washing over.
 *
 * <p>The catch is the permission. WRITE_SECURE_SETTINGS is signature-level and
 * cannot be requested at runtime; it can only be granted over adb, once:
 *
 * <pre>adb shell pm grant gr.nifo.app android.permission.WRITE_SECURE_SETTINGS</pre>
 *
 * <p>So nothing here is required. The service asks {@link #available} every
 * time it applies a colour, uses this when the answer is yes, and falls back to
 * the overlay when it is no. Granting the permission later needs no reinstall
 * and no setting changed: the next tick simply takes the better road.
 */
public final class HardwareTint {

    private HardwareTint() {}

    private static final String ACTIVATED = "night_display_activated";
    private static final String TEMPERATURE = "night_display_color_temperature";
    private static final String AUTO_MODE = "night_display_auto_mode";

    /** Conservative bounds for a device that does not publish its own. */
    private static final int FALLBACK_MIN = 2596;
    private static final int FALLBACK_MAX = 4082;

    public static boolean available(Context ctx) {
        try {
            return ctx.checkSelfPermission(Manifest.permission.WRITE_SECURE_SETTINGS)
                    == PackageManager.PERMISSION_GRANTED;
        } catch (Throwable t) {
            return false;
        }
    }

    /**
     * The device's supported range. Night Light hardware does not go anywhere
     * near as warm as an overlay can, typically bottoming out around 2600K, so
     * asking for 1900K and getting silence would look like a broken feature.
     * The value is clamped into range instead and {@link #clamp} is what the
     * settings screen reports.
     */
    public static int minKelvin() {
        return sysInt("config_nightDisplayColorTemperatureMin", FALLBACK_MIN);
    }

    public static int maxKelvin() {
        return sysInt("config_nightDisplayColorTemperatureMax", FALLBACK_MAX);
    }

    public static int clamp(int kelvin) {
        int lo = minKelvin();
        int hi = maxKelvin();
        if (lo >= hi) {
            lo = FALLBACK_MIN;
            hi = FALLBACK_MAX;
        }
        return Math.max(lo, Math.min(hi, kelvin));
    }

    private static int sysInt(String name, int fallback) {
        try {
            Resources res = Resources.getSystem();
            int id = res.getIdentifier(name, "integer", "android");
            if (id != 0) {
                int v = res.getInteger(id);
                if (v > 0) return v;
            }
        } catch (Throwable ignored) {
            // A device that hides these is a device we use the fallback for.
        }
        return fallback;
    }

    /**
     * Turns the system filter on at this temperature. Returns false if the
     * permission has gone away or the device has no Night Light at all, which
     * is the signal to fall back to the overlay.
     */
    public static boolean apply(Context ctx, int kelvin) {
        if (!available(ctx)) return false;
        try {
            // Android's own schedule would fight ours, switching the filter off
            // at its sunrise while this is still asking for warm. Manual mode
            // hands the decision over here, where the rest of it lives.
            Settings.Secure.putInt(ctx.getContentResolver(), AUTO_MODE, 0);
            Settings.Secure.putInt(ctx.getContentResolver(), TEMPERATURE, clamp(kelvin));
            Settings.Secure.putInt(ctx.getContentResolver(), ACTIVATED, 1);
            return true;
        } catch (Throwable t) {
            return false;
        }
    }

    /** Turns the system filter off, leaving its temperature where it was. */
    public static void clear(Context ctx) {
        if (!available(ctx)) return;
        try {
            Settings.Secure.putInt(ctx.getContentResolver(), ACTIVATED, 0);
        } catch (Throwable ignored) {
            // Nothing to do: the filter is either already off or unreachable.
        }
    }
}
