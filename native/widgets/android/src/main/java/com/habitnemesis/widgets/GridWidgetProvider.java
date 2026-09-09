// The resizable grid widget. Drawing lives in WidgetRenderer.
package com.habitnemesis.widgets;

import android.appwidget.AppWidgetManager;
import android.appwidget.AppWidgetProvider;
import android.content.Context;
import android.os.Bundle;

public class GridWidgetProvider extends AppWidgetProvider {

    @Override
    public void onUpdate(Context context, AppWidgetManager manager, int[] appWidgetIds) {
        WidgetRenderer.grid(context, manager, appWidgetIds);
    }

    // Resized: the row count comes from the height, so redraw.
    @Override
    public void onAppWidgetOptionsChanged(Context context, AppWidgetManager manager, int appWidgetId, Bundle newOptions) {
        WidgetRenderer.grid(context, manager, new int[] { appWidgetId });
    }
}
