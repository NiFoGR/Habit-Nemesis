package gr.nifo.nightlight;

import android.app.Notification;
import android.app.NotificationChannel;
import android.app.NotificationManager;
import android.app.PendingIntent;
import android.app.Service;
import android.content.BroadcastReceiver;
import android.content.Context;
import android.content.Intent;
import android.content.IntentFilter;
import android.content.SharedPreferences;
import android.content.pm.ServiceInfo;
import android.graphics.PixelFormat;
import android.os.Build;
import android.os.Handler;
import android.os.IBinder;
import android.os.Looper;
import android.provider.Settings;
import android.view.Gravity;
import android.view.View;
import android.view.WindowManager;

import java.util.Calendar;

/**
 * The filter itself: a foreground service that owns the schedule and repaints
 * once a minute.
 *
 * <p>It is a service rather than something the WebView drives because the app
 * is not running most of the time this feature is supposed to be working. A
 * night light that only warms the screen while you have NiFo open is not a
 * night light. So the configuration is pushed into SharedPreferences by the
 * plugin and everything after that happens here, including across a reboot.
 *
 * <h3>Why the overlay washes rather than multiplies</h3>
 *
 * <p>A real colour-temperature filter multiplies each channel: blue times 0.4
 * leaves black alone and takes the blue out of white. Window compositing cannot
 * do that. Every window on Android is blended source-over, so the most an
 * overlay can do is <em>out = amber·a + screen·(1−a)</em>, which takes blue out
 * of bright pixels correctly and lifts black pixels towards amber, which is
 * exactly wrong. There is no flag that changes this: blending happens in
 * SurfaceFlinger, below anything an app can reach.
 *
 * <p>That is why {@link HardwareTint} is tried first on every tick and this is
 * the fallback. The alpha is capped in {@link Curve} so the lift stays
 * tolerable, and the settings screen says plainly which of the two is running.
 */
public class OverlayService extends Service {

    public static final String PREFS = "nifo_nightlight";

    public static final String ACTION_REFRESH = "gr.nifo.nightlight.REFRESH";
    public static final String ACTION_PAUSE = "gr.nifo.nightlight.PAUSE";
    public static final String ACTION_STOP = "gr.nifo.nightlight.STOP";

    private static final String CHANNEL = "nifo_nightlight";
    private static final int NOTE_ID = 7301;
    private static final long TICK_MS = 60_000L;
    private static final long PAUSE_MS = 60 * 60 * 1000L;

    private final Handler handler = new Handler(Looper.getMainLooper());
    private WindowManager wm;
    private View view;
    private boolean screenOn = true;
    private int shownArgb = 0;
    private int lastKelvin = -1;
    private boolean lastWasHardware = false;
    private BroadcastReceiver screenReceiver;

    private final Runnable ticker = new Runnable() {
        @Override
        public void run() {
            apply();
            // Rescheduled from the end of the work rather than at a fixed rate,
            // so a slow tick cannot pile up a backlog of them.
            if (screenOn) handler.postDelayed(this, TICK_MS);
        }
    };

    /* ---------------- lifecycle ---------------- */

    @Override
    public void onCreate() {
        super.onCreate();
        wm = (WindowManager) getSystemService(Context.WINDOW_SERVICE);
        createChannel();

        // Nothing is visible while the screen is off, so the tick stops rather
        // than repainting an invisible window sixty times an hour. This is the
        // difference between a filter you forget about and one that shows up in
        // the battery screen.
        screenReceiver = new BroadcastReceiver() {
            @Override
            public void onReceive(Context context, Intent intent) {
                if (Intent.ACTION_SCREEN_OFF.equals(intent.getAction())) {
                    screenOn = false;
                    handler.removeCallbacks(ticker);
                } else {
                    screenOn = true;
                    handler.removeCallbacks(ticker);
                    handler.post(ticker);
                }
            }
        };
        IntentFilter f = new IntentFilter();
        f.addAction(Intent.ACTION_SCREEN_ON);
        f.addAction(Intent.ACTION_SCREEN_OFF);
        f.addAction(Intent.ACTION_USER_PRESENT);
        registerReceiver(screenReceiver, f);
    }

    @Override
    public int onStartCommand(Intent intent, int flags, int startId) {
        String action = intent == null ? null : intent.getAction();

        if (ACTION_STOP.equals(action)) {
            prefs().edit().putBoolean("enabled", false).apply();
            stopEverything();
            return START_NOT_STICKY;
        }
        if (ACTION_PAUSE.equals(action)) {
            prefs().edit().putLong("pausedUntil", System.currentTimeMillis() + PAUSE_MS).apply();
        }

        startForegroundCompat();
        handler.removeCallbacks(ticker);
        handler.post(ticker);
        // Restarted by the system if it is ever killed, which is what a filter
        // that is supposed to be on at 3am needs.
        return START_STICKY;
    }

    @Override
    public void onDestroy() {
        handler.removeCallbacks(ticker);
        detach();
        HardwareTint.clear(this);
        try {
            if (screenReceiver != null) unregisterReceiver(screenReceiver);
        } catch (Throwable ignored) {
            // Not registered, or already gone. Either way there is nothing left to do.
        }
        super.onDestroy();
    }

    @Override
    public IBinder onBind(Intent intent) {
        return null;
    }

    /* ---------------- the work ---------------- */

    private SharedPreferences prefs() {
        return getSharedPreferences(PREFS, Context.MODE_PRIVATE);
    }

    private void apply() {
        Curve.Config c = Curve.Config.from(prefs());

        if (!Curve.active(c, System.currentTimeMillis())) {
            // Paused or switched off. The window comes down and the system
            // filter goes back to whatever it was, but the service stays up so
            // an hour's pause resumes on its own.
            detach();
            if (lastWasHardware) {
                HardwareTint.clear(this);
                lastWasHardware = false;
            }
            lastKelvin = -1;
            updateNote(c, 0, false);
            // A suspend is temporary and the service has to be here to lift it,
            // so only an actual switch-off tears everything down.
            if (!c.enabled) stopEverything();
            return;
        }

        Calendar now = Calendar.getInstance();
        int minute = now.get(Calendar.HOUR_OF_DAY) * 60 + now.get(Calendar.MINUTE);
        int kelvin = Curve.kelvinAt(c, minute);

        // The good path, re-checked every tick so granting the permission over
        // adb takes effect without a restart of anything.
        if (kelvin >= c.dayKelvin - 40) {
            // Neutral. Nothing to apply either way, and leaving a zero-alpha
            // window attached all day is a window the compositor still handles.
            detach();
            if (lastWasHardware) {
                HardwareTint.clear(this);
                lastWasHardware = false;
            }
        } else if (HardwareTint.available(this) && HardwareTint.apply(this, kelvin)) {
            detach();
            lastWasHardware = true;
        } else {
            if (lastWasHardware) {
                HardwareTint.clear(this);
                lastWasHardware = false;
            }
            paint(Curve.overlayArgb(kelvin, c.dayKelvin, c.intensity));
        }

        lastKelvin = kelvin;
        updateNote(c, kelvin, true);
    }

    /* ---------------- the window ---------------- */

    private boolean canDraw() {
        return Settings.canDrawOverlays(this);
    }

    private void paint(int argb) {
        if (argb == 0) {
            detach();
            return;
        }
        if (!canDraw()) {
            detach();
            return;
        }
        if (view == null) {
            try {
                view = new View(this);
                wm.addView(view, params());
            } catch (Throwable t) {
                view = null;
                return;
            }
        }
        if (argb != shownArgb) {
            view.setBackgroundColor(argb);
            shownArgb = argb;
        }
    }

    private WindowManager.LayoutParams params() {
        int type = Build.VERSION.SDK_INT >= Build.VERSION_CODES.O
                ? WindowManager.LayoutParams.TYPE_APPLICATION_OVERLAY
                : WindowManager.LayoutParams.TYPE_SYSTEM_ALERT;

        WindowManager.LayoutParams lp = new WindowManager.LayoutParams(
                WindowManager.LayoutParams.MATCH_PARENT,
                WindowManager.LayoutParams.MATCH_PARENT,
                type,
                // NOT_TOUCHABLE is the important one: every touch has to fall
                // straight through to whatever is underneath, or the filter
                // makes the phone unusable rather than warm.
                WindowManager.LayoutParams.FLAG_NOT_FOCUSABLE
                        | WindowManager.LayoutParams.FLAG_NOT_TOUCHABLE
                        | WindowManager.LayoutParams.FLAG_LAYOUT_IN_SCREEN
                        // Without NO_LIMITS the window stops at the status and
                        // navigation bars, and two untinted strips across a warm
                        // screen look like a bug.
                        | WindowManager.LayoutParams.FLAG_LAYOUT_NO_LIMITS
                        | WindowManager.LayoutParams.FLAG_HARDWARE_ACCELERATED,
                PixelFormat.TRANSLUCENT);
        lp.gravity = Gravity.TOP | Gravity.START;
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.P) {
            lp.layoutInDisplayCutoutMode =
                    WindowManager.LayoutParams.LAYOUT_IN_DISPLAY_CUTOUT_MODE_ALWAYS;
        }
        return lp;
    }

    private void detach() {
        if (view == null) return;
        try {
            wm.removeView(view);
        } catch (Throwable ignored) {
            // Already detached, or the window manager has moved on.
        }
        view = null;
        shownArgb = 0;
    }

    private void stopEverything() {
        handler.removeCallbacks(ticker);
        detach();
        HardwareTint.clear(this);
        stopForeground(true);
        stopSelf();
    }

    /* ---------------- the notification ----------------
       Android will not let a long-running service go without one, so it may as
       well be useful: it says what the filter is actually doing and carries the
       one control anybody ever wants, which is "not for the next hour". */

    private void createChannel() {
        if (Build.VERSION.SDK_INT < Build.VERSION_CODES.O) return;
        NotificationManager nm = getSystemService(NotificationManager.class);
        if (nm == null || nm.getNotificationChannel(CHANNEL) != null) return;
        NotificationChannel ch = new NotificationChannel(
                CHANNEL, "Night light", NotificationManager.IMPORTANCE_MIN);
        ch.setDescription("The blue-light filter, and the control to pause it.");
        ch.setShowBadge(false);
        ch.setSound(null, null);
        ch.enableVibration(false);
        nm.createNotificationChannel(ch);
    }

    private Notification buildNote(Curve.Config c, int kelvin, boolean on) {
        long paused = c.pausedUntil - System.currentTimeMillis();
        String text;
        if (!on && c.suspended) {
            text = "Held off while a photo screen is open";
        } else if (!on && paused > 0) {
            text = "Paused for " + Math.max(1, paused / 60000) + " more min";
        } else if (!on) {
            text = "Off";
        } else if (kelvin >= c.dayKelvin - 40) {
            text = "Daylight, nothing filtered";
        } else {
            text = kelvin + "K · " + (lastWasHardware ? "system filter" : "overlay");
        }

        PendingIntent open = null;
        Intent launch = getPackageManager().getLaunchIntentForPackage(getPackageName());
        if (launch != null) {
            launch.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
            open = PendingIntent.getActivity(this, 0, launch, piFlags());
        }
        PendingIntent pause = PendingIntent.getService(this, 1,
                new Intent(this, OverlayService.class).setAction(ACTION_PAUSE), piFlags());
        PendingIntent stop = PendingIntent.getService(this, 2,
                new Intent(this, OverlayService.class).setAction(ACTION_STOP), piFlags());

        Notification.Builder b = Build.VERSION.SDK_INT >= Build.VERSION_CODES.O
                ? new Notification.Builder(this, CHANNEL)
                : new Notification.Builder(this);
        b.setContentTitle("Night light")
                .setContentText(text)
                .setSmallIcon(android.R.drawable.ic_menu_day)
                .setOngoing(true)
                .setShowWhen(false)
                .setPriority(Notification.PRIORITY_MIN);
        if (open != null) b.setContentIntent(open);
        b.addAction(new Notification.Action.Builder(null, paused > 0 ? "Resume" : "Pause 1h", pause).build());
        b.addAction(new Notification.Action.Builder(null, "Turn off", stop).build());
        return b.build();
    }

    private int piFlags() {
        return Build.VERSION.SDK_INT >= Build.VERSION_CODES.M
                ? PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE
                : PendingIntent.FLAG_UPDATE_CURRENT;
    }

    private void startForegroundCompat() {
        Curve.Config c = Curve.Config.from(prefs());
        Notification note = buildNote(c, lastKelvin, Curve.active(c, System.currentTimeMillis()));
        try {
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.UPSIDE_DOWN_CAKE) {
                startForeground(NOTE_ID, note, ServiceInfo.FOREGROUND_SERVICE_TYPE_SPECIAL_USE);
            } else {
                startForeground(NOTE_ID, note);
            }
        } catch (Throwable t) {
            // Android 14 refuses some foreground starts outright. Nothing to
            // recover here; the service will be restarted from the app.
        }
    }

    private void updateNote(Curve.Config c, int kelvin, boolean on) {
        try {
            NotificationManager nm = getSystemService(NotificationManager.class);
            if (nm != null) nm.notify(NOTE_ID, buildNote(c, kelvin, on));
        } catch (Throwable ignored) {
            // Notifications may be blocked outright; the filter still works.
        }
    }

    /* ---------------- entry points ---------------- */

    public static void kick(Context ctx, String action) {
        Intent i = new Intent(ctx, OverlayService.class);
        if (action != null) i.setAction(action);
        try {
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) ctx.startForegroundService(i);
            else ctx.startService(i);
        } catch (Throwable ignored) {
            // Background start restrictions. The next app launch will retry.
        }
    }
}
