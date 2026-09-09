// The 2x2 today widget. Drawing lives in WidgetRenderer.
package com.habitnemesis.widgets;

import android.appwidget.AppWidgetManager;
import android.appwidget.AppWidgetProvider;
import android.content.Context;

public class TodayWidgetProvider extends AppWidgetProvider {

    @Override
    public void onUpdate(Context context, AppWidgetManager manager, int[] appWidgetIds) {
        WidgetRenderer.today(context, manager, appWidgetIds);
    }
}
