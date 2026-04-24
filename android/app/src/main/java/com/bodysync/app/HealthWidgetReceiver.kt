package com.bodysync.app

import android.appwidget.AppWidgetManager
import android.content.ComponentName
import android.content.Context
import android.content.Intent
import androidx.glance.appwidget.GlanceAppWidgetReceiver
import androidx.glance.appwidget.updateAll
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.launch

class HealthWidgetReceiver : GlanceAppWidgetReceiver() {
  override val glanceAppWidget = HealthWidget()

  override fun onReceive(context: Context, intent: Intent) {
    if (intent.action == "com.bodysync.app.LOG_WATER") {
      val amount = intent.getIntExtra("amount", 250)
      val prefs = context.getSharedPreferences("com.bodysync.app.health", Context.MODE_PRIVATE)
      val current = prefs.getInt("bodysync_water_today", 0)
      prefs.edit()
        .putInt("bodysync_water_today", current + amount)
        .putLong("bodysync_updated_at", System.currentTimeMillis())
        .apply()

      val result = goAsync()
      CoroutineScope(Dispatchers.Main).launch {
        try {
          HealthWidget().updateAll(context)
        } finally {
          result.finish()
        }
      }
    } else {
      super.onReceive(context, intent)
    }
  }

  companion object {
    fun requestUpdate(context: Context) {
      val manager = AppWidgetManager.getInstance(context)
      val ids = manager.getAppWidgetIds(
        ComponentName(context, HealthWidgetReceiver::class.java)
      )
      if (ids.isNotEmpty()) {
        CoroutineScope(Dispatchers.Main).launch {
          HealthWidget().updateAll(context)
        }
      }
    }
  }
}
