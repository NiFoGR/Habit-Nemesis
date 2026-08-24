package gr.nifo.nightlight;

import android.content.BroadcastReceiver;
import android.content.Context;
import android.content.Intent;

/**
 * Puts the filter back after a reboot or an app update.
 *
 * <p>Without this the night light stays off until NiFo is next opened, which
 * for a phone that restarted overnight means it is off for exactly the hours it
 * was meant to cover.
 */
public class BootReceiver extends BroadcastReceiver {

    @Override
    public void onReceive(Context context, Intent intent) {
        String action = intent == null ? null : intent.getAction();
        if (action == null) return;
        if (!Intent.ACTION_BOOT_COMPLETED.equals(action)
                && !Intent.ACTION_MY_PACKAGE_REPLACED.equals(action)
                && !"android.intent.action.QUICKBOOT_POWERON".equals(action)) {
            return;
        }
        boolean enabled = context
                .getSharedPreferences(OverlayService.PREFS, Context.MODE_PRIVATE)
                .getBoolean("enabled", false);
        if (enabled) OverlayService.kick(context, OverlayService.ACTION_REFRESH);
    }
}
