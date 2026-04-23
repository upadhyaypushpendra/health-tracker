package com.bodysync.app

import android.content.Context
import android.content.Intent
import androidx.glance.appwidget.GlanceAppWidgetReceiver

class HealthWidgetReceiver : GlanceAppWidgetReceiver() {
  override val glanceAppWidget = HealthWidget()

  override fun onReceive(context: Context, intent: Intent) {
    super.onReceive(context, intent)
    if (intent.action == "com.bodysync.app.LOG_WATER") {
      val mainIntent = Intent(context, MainActivity::class.java)
      mainIntent.action = "com.bodysync.app.LOG_WATER"
      mainIntent.putExtra("amount", 250)
      mainIntent.flags = Intent.FLAG_ACTIVITY_NEW_TASK or Intent.FLAG_ACTIVITY_SINGLE_TOP
      context.startActivity(mainIntent)
    }
  }
}
