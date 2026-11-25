package io.github.ilakkiyagpisketch.happyparenthood;

import android.app.PendingIntent;
import android.appwidget.AppWidgetManager;
import android.appwidget.AppWidgetProvider;
import android.content.Context;
import android.content.Intent;
import android.net.Uri;
import android.os.Build;
import android.widget.RemoteViews;

import com.google.androidbrowserhelper.trusted.LauncherActivity;

/**
 * Home-screen widget with five quick buttons. Each button opens the app at
 * ".../?go=quick:<action>"; the web app then starts or stops the timer, or logs it.
 */
public class QuickWidget extends AppWidgetProvider {
    static final String BASE = "https://ilakkiyagpi-sketch.github.io/parenthoodofilakkiya/?go=";

    @Override
    public void onUpdate(Context context, AppWidgetManager manager, int[] ids) {
        for (int id : ids) {
            RemoteViews views = new RemoteViews(context.getPackageName(), R.layout.widget_quick);
            bind(context, views, R.id.w_nap, "quick:nap", 1);
            bind(context, views, R.id.w_feed, "quick:feed", 2);
            bind(context, views, R.id.w_meal, "quick:meal", 3);
            bind(context, views, R.id.w_pee, "quick:pee", 4);
            bind(context, views, R.id.w_voice, "quick:voice", 5);
            manager.updateAppWidget(id, views);
        }
    }

    private static void bind(Context context, RemoteViews views, int viewId, String go, int requestCode) {
        Intent intent = new Intent(Intent.ACTION_VIEW, Uri.parse(BASE + go), context, LauncherActivity.class);
        intent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
        int flags = PendingIntent.FLAG_UPDATE_CURRENT | (Build.VERSION.SDK_INT >= 23 ? PendingIntent.FLAG_IMMUTABLE : 0);
        views.setOnClickPendingIntent(viewId, PendingIntent.getActivity(context, requestCode, intent, flags));
    }
}
