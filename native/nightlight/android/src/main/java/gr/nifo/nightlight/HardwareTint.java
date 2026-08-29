package gr.nifo.nightlight;

import android.Manifest;
import android.content.Context;
import android.content.pm.PackageManager;
import android.content.res.Resources;
import android.provider.Settings;

/**
 * Android's own Night Light, driven directly. The good path: a hardware
 * transform at the display pipeline, so it covers the lock screen and does not
 * lift blacks.
 *
 * <p>WRITE_SECURE_SETTINGS is signature-level and can only be granted over adb:
 *
 * <pre>adb shell pm grant gr.nifo.app android.permission.WRITE_SECURE_SETTINGS</pre>
 *
 * <p>So nothing here is required. The service asks {@link #available} every tick
 * and falls back to the overlay.
 */
public final class HardwareTint {

    private HardwareTint() {}

    private static final String ACTIVATED = "night_display_activated";
    private static final String TEMPERATURE = "night_display_color_temperature";
    private static final String AUTO_MODE = "night_display_auto_mode";

    /** Bounds for a device that does not publish its own. */
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

    /** The device's range. Night Light hardware bottoms out around 2600K, so a
         *  request for 1900K is clamped rather than silently ignored. */
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
            // A device that hides these is one we use the fallback for.
        }
        return fallback;
    }

    /** On, at this temperature. False means fall back to the overlay. */
    public static boolean apply(Context ctx, int kelvin) {
        if (!available(ctx)) return false;
        try {
            // Android's own schedule would switch this off at its sunrise. Manual mode
                        // hands the decision here.
            Settings.Secure.putInt(ctx.getContentResolver(), AUTO_MODE, 0);
            Settings.Secure.putInt(ctx.getContentResolver(), TEMPERATURE, clamp(kelvin));
            Settings.Secure.putInt(ctx.getContentResolver(), ACTIVATED, 1);
            return true;
        } catch (Throwable t) {
            return false;
        }
    }

    /** Off, leaving its temperature where it was. */
    public static void clear(Context ctx) {
        if (!available(ctx)) return;
        try {
            Settings.Secure.putInt(ctx.getContentResolver(), ACTIVATED, 0);
        } catch (Throwable ignored) {
            // Already off, or unreachable.
        }
    }
}
