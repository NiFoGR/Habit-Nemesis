package gr.nifo.systemui;

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
 * The navigation bar, hidden.
 *
 * <p>NiFo has its own bottom bar now, and two bars stacked at the bottom of a
 * phone is one too many: the app's own tabs sit above a black strip of system
 * chrome doing the same job. So the system one goes, in the mode where a swipe
 * from the edge brings it back for a few seconds and then it leaves again.
 *
 * <p>The status bar is deliberately left alone. Hiding it as well would take
 * the clock and the battery with it, which is a real loss for no gain: nothing
 * of NiFo's is trying to occupy that strip.
 *
 * <p>This is a plugin rather than a line in the generated project because
 * {@code android/} is rebuilt from scratch on every build, so an edit to the
 * activity or to a theme would be thrown away. A plugin's manifest and code are
 * merged in by Capacitor instead, which is the same reason the night light is
 * one.
 *
 * <p>Android forgets the request whenever the window loses and regains focus,
 * so it is re-applied on resume here and again from the web layer whenever the
 * page becomes visible. Asking twice costs nothing; asking once does not hold.
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
                // Transient rather than permanent: a swipe from the bottom edge
                // shows the bar for a moment and then it hides itself again, so
                // the gesture is never taken away, only the strip of screen.
                controller.setSystemBarsBehavior(
                        WindowInsetsControllerCompat.BEHAVIOR_SHOW_TRANSIENT_BARS_BY_SWIPE);
                controller.hide(WindowInsetsCompat.Type.navigationBars());
            } else {
                controller.show(WindowInsetsCompat.Type.navigationBars());
            }
        });
    }
}
