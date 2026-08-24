package gr.nifo.nightlight;

import android.content.SharedPreferences;

/**
 * Colour temperature, and the schedule that decides which one it is right now.
 *
 * <p>This is in Java rather than in the web layer for one reason: the service
 * has to keep working when NiFo is not running. The whole point of the feature
 * is that the screen is still warm at 23:00 whether or not the app has been
 * opened since breakfast, so the schedule and the maths belong on the side that
 * survives the WebView being torn down. The web layer writes the configuration
 * and mirrors this maths only to draw a preview swatch.
 *
 * <p>Everything here is pure: given a config and a minute of the day it returns
 * a colour. That is what makes it testable by eye — the settings screen can ask
 * for 03:00 and see what 03:00 would look like.
 */
public final class Curve {

    private Curve() {}

    public static final int MIN_KELVIN = 1900;
    public static final int MAX_KELVIN = 6500;

    /**
     * The overlay lifts blacks, because window compositing is source-over and
     * cannot multiply (see OverlayService). Past roughly this much alpha the
     * lift is worse than the blue it removes, so the wash is capped here and
     * the fine print says so rather than pretending otherwise.
     */
    private static final float MAX_ALPHA = 0.55f;

    /** Config, as the service holds it. Plain fields; it is read every minute. */
    public static final class Config {
        public boolean enabled = false;
        /** "gradual" warms all day; "flux" stays neutral and drops in the evening. */
        public String curve = "gradual";
        public int wakeMin = 7 * 60;
        public int sleepMin = 22 * 60;
        public int dayKelvin = 6500;
        public int nightKelvin = 2700;
        public int transitionMin = 60;
        /** 0..1, scales the whole effect without changing the temperatures. */
        public float intensity = 1f;
        /** Epoch millis; while now is under this the filter is off. */
        public long pausedUntil = 0L;
        /**
         * Held off for as long as a screen that needs true colour is open —
         * the progress gallery and the camera. Cleared when the app next
         * starts, so a crash with it set cannot leave the filter off forever.
         */
        public boolean suspended = false;

        public static Config from(SharedPreferences p) {
            Config c = new Config();
            c.enabled = p.getBoolean("enabled", false);
            c.curve = p.getString("curve", "gradual");
            c.wakeMin = p.getInt("wakeMin", 7 * 60);
            c.sleepMin = p.getInt("sleepMin", 22 * 60);
            c.dayKelvin = clampKelvin(p.getInt("dayKelvin", 6500));
            c.nightKelvin = clampKelvin(p.getInt("nightKelvin", 2700));
            c.transitionMin = Math.max(1, Math.min(240, p.getInt("transitionMin", 60)));
            c.intensity = Math.max(0f, Math.min(1f, p.getFloat("intensity", 1f)));
            c.pausedUntil = p.getLong("pausedUntil", 0L);
            c.suspended = p.getBoolean("suspended", false);
            return c;
        }
    }

    public static int clampKelvin(int k) {
        return Math.max(MIN_KELVIN, Math.min(MAX_KELVIN, k));
    }

    private static int mod(int v, int m) {
        int r = v % m;
        return r < 0 ? r + m : r;
    }

    private static float clamp01(double v) {
        return (float) Math.max(0, Math.min(1, v));
    }

    /**
     * Interpolates in mireds rather than in Kelvin.
     *
     * <p>Kelvin is perceptually lopsided: the step from 6500K to 5500K is
     * barely visible and the step from 3000K to 2000K is enormous, so a ramp
     * that is linear in Kelvin does almost nothing for most of its length and
     * then lurches at the end. Mireds (a million over Kelvin) are close enough
     * to perceptually even that a linear ramp in them looks like a steady
     * change, which is the entire illusion this feature depends on.
     */
    public static int lerpKelvin(int from, int to, double f) {
        double a = 1e6 / clampKelvin(from);
        double b = 1e6 / clampKelvin(to);
        double m = a + (b - a) * Math.max(0, Math.min(1, f));
        return clampKelvin((int) Math.round(1e6 / m));
    }

    /**
     * The colour temperature this config asks for at a given minute of the day.
     *
     * <p>The day runs wake to sleep, wrapping over midnight, and is treated as
     * three stretches: a short warm-to-neutral ramp just after waking, the long
     * body of the day, and the night, which simply holds the night temperature
     * until the alarm goes off.
     */
    public static int kelvinAt(Config c, int minuteOfDay) {
        int dayLen = mod(c.sleepMin - c.wakeMin, 1440);
        if (dayLen == 0) dayLen = 1440; // wake == sleep: treat as always daytime
        int since = mod(minuteOfDay - c.wakeMin, 1440);

        if (since >= dayLen) return c.nightKelvin; // asleep, or meant to be

        int warmUp = Math.min(c.transitionMin, dayLen);
        if (since < warmUp) {
            // Waking up. Coming back to daylight is the one transition that
            // should be quick: nobody wants to read a warm screen at breakfast.
            return lerpKelvin(c.nightKelvin, c.dayKelvin, (double) since / warmUp);
        }

        double t = (double) (since - warmUp) / Math.max(1, dayLen - warmUp);

        if ("flux".equals(c.curve)) {
            // Neutral until the transition window opens before bedtime, then
            // down to the night temperature. This is what f.lux does by default.
            double startsAt = 1.0 - Math.min(1.0, (double) c.transitionMin / Math.max(1, dayLen - warmUp));
            if (t < startsAt) return c.dayKelvin;
            return lerpKelvin(c.dayKelvin, c.nightKelvin, (t - startsAt) / Math.max(1e-6, 1 - startsAt));
        }

        // "gradual": warming from the moment you get up, which is what was
        // asked for. Raised to a power so the first half of the day is nearly
        // imperceptible and the change is still mostly where it matters — a
        // straight line makes the middle of the afternoon visibly orange.
        return lerpKelvin(c.dayKelvin, c.nightKelvin, Math.pow(t, 1.6));
    }

    /** Linear RGB-ish multipliers for a black body at this temperature. */
    public static float[] kelvinToRgb(int kelvin) {
        double t = Math.max(1000, Math.min(40000, kelvin)) / 100.0;
        double r, g, b;
        if (t <= 66) {
            r = 255;
        } else {
            r = 329.698727446 * Math.pow(t - 60, -0.1332047592);
        }
        if (t <= 66) {
            g = 99.4708025861 * Math.log(t) - 161.1195681661;
        } else {
            g = 288.1221695283 * Math.pow(t - 60, -0.0755148492);
        }
        if (t >= 66) {
            b = 255;
        } else if (t <= 19) {
            b = 0;
        } else {
            b = 138.5177312231 * Math.log(t - 10) - 305.0447927307;
        }
        return new float[] {clamp01(r / 255), clamp01(g / 255), clamp01(b / 255)};
    }

    /**
     * The overlay colour for a target temperature, as ARGB.
     *
     * <p>Normalised against the day temperature, so at the day temperature the
     * multipliers are all 1, the alpha is 0 and the overlay is literally
     * invisible. That matters more than it sounds: it means "night light on"
     * during the day is a no-op rather than a permanent faint tint, and the
     * feature can be left enabled all year.
     *
     * <p>Alpha comes from the blue channel because blue is the channel this
     * exists to remove, and blue is always the most attenuated of the three.
     */
    public static int overlayArgb(int kelvin, int dayKelvin, float intensity) {
        float[] target = kelvinToRgb(kelvin);
        float[] day = kelvinToRgb(dayKelvin);

        float mr = day[0] <= 0 ? 1 : target[0] / day[0];
        float mg = day[1] <= 0 ? 1 : target[1] / day[1];
        float mb = day[2] <= 0 ? 1 : target[2] / day[2];

        // Normalise so the brightest channel is untouched: this is a colour
        // shift, not a dimmer. Dimming is the user's brightness slider.
        float max = Math.max(mr, Math.max(mg, mb));
        if (max > 0) {
            mr /= max;
            mg /= max;
            mb /= max;
        }

        float alpha = Math.min(MAX_ALPHA, (1f - Math.min(1f, mb)) * Math.max(0f, Math.min(1f, intensity)));
        if (alpha <= 0.002f) return 0; // fully transparent: nothing to draw

        // The wash itself is the warm colour at full strength; alpha decides how
        // much of it lands. Scaling the colour instead would darken rather than
        // warm, which is a different feature.
        int r = Math.round(255 * mr);
        int g = Math.round(255 * mg);
        int b = Math.round(255 * mb);
        int a = Math.round(255 * alpha);
        return (a << 24) | (r << 16) | (g << 8) | b;
    }

    /** True when the filter should be doing anything at all right now. */
    public static boolean active(Config c, long nowMillis) {
        return c.enabled && !c.suspended && nowMillis >= c.pausedUntil;
    }
}
