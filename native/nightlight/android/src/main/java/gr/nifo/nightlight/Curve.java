package gr.nifo.nightlight;

import android.content.SharedPreferences;

/**
 * Colour temperature and the schedule that picks it.
 *
 * <p>In Java because the service has to keep working with NiFo closed. Pure:
 * config plus a minute of the day gives a colour, so the settings screen can
 * ask what 03:00 looks like. The web layer mirrors this only for the preview.
 */
public final class Curve {

    private Curve() {}

    public static final int MIN_KELVIN = 1900;
    public static final int MAX_KELVIN = 6500;

    /** Cap on the wash. The overlay lifts blacks (see OverlayService), and past
         *  this the lift is worse than the blue it removes. */
    private static final float MAX_ALPHA = 0.55f;

    /** Config as the service holds it. Read every minute. */
    public static final class Config {
        public boolean enabled = false;
        /** "gradual" warms all day, "flux" holds neutral and drops in the evening. */
        public String curve = "gradual";
        public int wakeMin = 7 * 60;
        public int sleepMin = 22 * 60;
        public int dayKelvin = 6500;
        public int nightKelvin = 2700;
        public int transitionMin = 60;
        /** 0..1, scales the effect without moving the temperatures. */
        public float intensity = 1f;
        /** Epoch millis. Under this, the filter is off. */
        public long pausedUntil = 0L;
        /** Held off while the gallery or camera is open. Cleared at app start, so a
                 *  crash cannot leave the filter off for ever. */
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
         * Interpolates in mireds, not Kelvin. Kelvin is perceptually lopsided:
         * 6500K to 5500K is barely visible, 3000K to 2000K is enormous, so a
         * linear Kelvin ramp does nothing and then lurches.
         */
    public static int lerpKelvin(int from, int to, double f) {
        double a = 1e6 / clampKelvin(from);
        double b = 1e6 / clampKelvin(to);
        double m = a + (b - a) * Math.max(0, Math.min(1, f));
        return clampKelvin((int) Math.round(1e6 / m));
    }

    /**
         * The temperature this config asks for at a minute of the day. The day runs
         * wake to sleep over midnight, in three stretches: the morning ramp, the
         * body of the day, and the night holding until the alarm.
         */
    public static int kelvinAt(Config c, int minuteOfDay) {
        int dayLen = mod(c.sleepMin - c.wakeMin, 1440);
        if (dayLen == 0) dayLen = 1440; // wake == sleep: treat as always daytime
        int since = mod(minuteOfDay - c.wakeMin, 1440);

        if (since >= dayLen) return c.nightKelvin; // asleep, or meant to be

        int warmUp = Math.min(c.transitionMin, dayLen);
        if (since < warmUp) {
            // Waking: the one transition that should be quick.
            return lerpKelvin(c.nightKelvin, c.dayKelvin, (double) since / warmUp);
        }

        double t = (double) (since - warmUp) / Math.max(1, dayLen - warmUp);

        if ("flux".equals(c.curve)) {
            // Neutral until the window before bedtime, then down. What f.lux does.
            double startsAt = 1.0 - Math.min(1.0, (double) c.transitionMin / Math.max(1, dayLen - warmUp));
            if (t < startsAt) return c.dayKelvin;
            return lerpKelvin(c.dayKelvin, c.nightKelvin, (t - startsAt) / Math.max(1e-6, 1 - startsAt));
        }

        // "gradual": raised to a power, so the first half of the day is nearly
                // imperceptible. A straight line makes the afternoon visibly orange.
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
         * Overlay colour as ARGB, normalised against the day temperature: at the day
         * temperature alpha is 0 and the overlay is invisible, so "on" in daylight
         * is a genuine no-op. Alpha comes from blue, the channel this removes.
         */
    public static int overlayArgb(int kelvin, int dayKelvin, float intensity) {
        float[] target = kelvinToRgb(kelvin);
        float[] day = kelvinToRgb(dayKelvin);

        float mr = day[0] <= 0 ? 1 : target[0] / day[0];
        float mg = day[1] <= 0 ? 1 : target[1] / day[1];
        float mb = day[2] <= 0 ? 1 : target[2] / day[2];

        // Normalise so the brightest channel is untouched: a colour shift, not a dimmer.
        float max = Math.max(mr, Math.max(mg, mb));
        if (max > 0) {
            mr /= max;
            mg /= max;
            mb /= max;
        }

        float alpha = Math.min(MAX_ALPHA, (1f - Math.min(1f, mb)) * Math.max(0f, Math.min(1f, intensity)));
        if (alpha <= 0.002f) return 0; // fully transparent: nothing to draw

        // Alpha decides how much lands. Scaling the colour would darken, not warm.
        int r = Math.round(255 * mr);
        int g = Math.round(255 * mg);
        int b = Math.round(255 * mb);
        int a = Math.round(255 * alpha);
        return (a << 24) | (r << 16) | (g << 8) | b;
    }

    /** Should the filter be doing anything right now? */
    public static boolean active(Config c, long nowMillis) {
        return c.enabled && !c.suspended && nowMillis >= c.pausedUntil;
    }
}
