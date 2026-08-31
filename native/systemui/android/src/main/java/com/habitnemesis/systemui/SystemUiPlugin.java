package com.habitnemesis.systemui;

import android.app.Activity;
import android.view.View;
import android.view.Window;

import androidx.core.view.WindowCompat;
import androidx.core.view.WindowInsetsCompat;
import androidx.core.view.WindowInsetsControllerCompat;

import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;

/**
 * The navigation bar, hidden, in the mode where a swipe from the edge brings it
 * back for a few seconds. Two bottom bars is one too many. The status bar is
 * left alone: it carries the clock and the battery.
 *
 * <p>A plugin rather than an edit to the generated project, because
 * {@code android/} is rebuilt on every build. Android forgets the request when
 * the window loses focus, so it is re-applied on resume and from the web layer.
 */
@CapacitorPlugin(name = "SystemUi")
public class SystemUiPlugin extends Plugin {

    private boolean navHidden = false;

    @PluginMethod
    public void hideNavigationBar(PluginCall call) {
        navHidden = true;
        apply(true);
        JSObject r = new JSObject();
        r.put("hidden", true);
        call.resolve(r);
    }

    @PluginMethod
    public void showNavigationBar(PluginCall call) {
        navHidden = false;
        apply(false);
        JSObject r = new JSObject();
        r.put("hidden", false);
        call.resolve(r);
    }

    @Override
    public void handleOnResume() {
        if (navHidden) apply(true);
    }

    private void apply(boolean hide) {
        final Activity activity = getActivity();
        if (activity == null) return;
        activity.runOnUiThread(() -> {
            Window window = activity.getWindow();
            View decor = window.getDecorView();
            WindowInsetsControllerCompat controller = WindowCompat.getInsetsController(window, decor);
            if (controller == null) return;
            if (hide) {
                // Transient: the gesture is never taken away, only the strip of screen.
                controller.setSystemBarsBehavior(
                        WindowInsetsControllerCompat.BEHAVIOR_SHOW_TRANSIENT_BARS_BY_SWIPE);
                controller.hide(WindowInsetsCompat.Type.navigationBars());
            } else {
                controller.show(WindowInsetsCompat.Type.navigationBars());
            }
        });
    }
}
