// The 4x2 fixture widget. Drawing lives in WidgetRenderer.
package com.habitnemesis.widgets;

import android.appwidget.AppWidgetManager;
import android.appwidget.AppWidgetProvider;
import android.content.Context;

public class FixtureWidgetProvider extends AppWidgetProvider {

    @Override
    public void onUpdate(Context context, AppWidgetManager manager, int[] appWidgetIds) {
        WidgetRenderer.fixture(context, manager, appWidgetIds);
    }
}
