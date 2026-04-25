package com.bodysync.app

import android.app.Notification
import android.app.NotificationChannel
import android.app.NotificationManager
import android.app.PendingIntent
import android.app.Service
import android.content.Context
import android.content.Intent
import android.content.res.Configuration
import android.graphics.Color
import android.os.Build
import android.os.IBinder
import android.widget.RemoteViews
import androidx.core.app.NotificationCompat

class HealthNotificationService : Service() {

    companion object {
        const val CHANNEL_ID = "health_stats"
        const val NOTIFICATION_ID = 9001
        const val EXTRA_CALORIES = "calories"
        const val EXTRA_CALORIE_GOAL = "calorieGoal"
        const val EXTRA_WATER_ML = "waterMl"
        const val EXTRA_WATER_GOAL = "waterGoal"
        const val EXTRA_STEPS = "steps"
        const val EXTRA_STEP_GOAL = "stepGoal"
        private const val PREFS = "com.bodysync.app.health"
    }

    override fun onCreate() {
        super.onCreate()
        createNotificationChannel()
    }

    override fun onStartCommand(intent: Intent?, flags: Int, startId: Int): Int {
        // When restarted by START_STICKY with a null intent, restore last known values
        val prefs = getSharedPreferences(PREFS, Context.MODE_PRIVATE)
        val calories    = intent?.getIntExtra(EXTRA_CALORIES,    prefs.getInt("last_calories", 0))    ?: prefs.getInt("last_calories", 0)
        val calorieGoal = intent?.getIntExtra(EXTRA_CALORIE_GOAL, prefs.getInt("last_calorie_goal", 2000)) ?: prefs.getInt("last_calorie_goal", 2000)
        val waterMl     = intent?.getIntExtra(EXTRA_WATER_ML,    prefs.getInt("last_water_ml", 0))    ?: prefs.getInt("last_water_ml", 0)
        val waterGoal   = intent?.getIntExtra(EXTRA_WATER_GOAL,  prefs.getInt("last_water_goal", 3000)) ?: prefs.getInt("last_water_goal", 3000)
        val steps       = intent?.getIntExtra(EXTRA_STEPS,       prefs.getInt("last_steps", 0))       ?: prefs.getInt("last_steps", 0)
        val stepGoal    = intent?.getIntExtra(EXTRA_STEP_GOAL,   prefs.getInt("last_step_goal", 10000)) ?: prefs.getInt("last_step_goal", 10000)

        prefs.edit()
            .putInt("last_calories", calories)
            .putInt("last_calorie_goal", calorieGoal)
            .putInt("last_water_ml", waterMl)
            .putInt("last_water_goal", waterGoal)
            .putInt("last_steps", steps)
            .putInt("last_step_goal", stepGoal)
            .apply()

        val notification = buildNotification(calories, calorieGoal, waterMl, waterGoal, steps, stepGoal)

        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.UPSIDE_DOWN_CAKE) {
            startForeground(NOTIFICATION_ID, notification, android.content.pm.ServiceInfo.FOREGROUND_SERVICE_TYPE_SPECIAL_USE)
        } else {
            startForeground(NOTIFICATION_ID, notification)
        }

        return START_STICKY
    }

    override fun onBind(intent: Intent?): IBinder? = null

    private fun isNightMode(): Boolean {
        val nightMask = resources.configuration.uiMode and Configuration.UI_MODE_NIGHT_MASK
        return nightMask == Configuration.UI_MODE_NIGHT_YES
    }

    private fun createNotificationChannel() {
        val channel = NotificationChannel(
            CHANNEL_ID,
            "Health Stats",
            NotificationManager.IMPORTANCE_LOW
        ).apply {
            description = "Live health stats notification"
            setShowBadge(false)
        }
        getSystemService(NotificationManager::class.java).createNotificationChannel(channel)
    }

    private fun buildNotification(
        calories: Int, calorieGoal: Int,
        waterMl: Int, waterGoal: Int,
        steps: Int, stepGoal: Int
    ): Notification {
        val nightMode = isNightMode()
        val primaryColor   = if (nightMode) Color.WHITE else Color.BLACK
        val secondaryColor = if (nightMode) 0xFFAAAAAA.toInt() else 0xFF555555.toInt()
        val accentColor    = if (nightMode) 0xFF00FF87.toInt() else 0xFF007A42.toInt()

        val views = RemoteViews(packageName, R.layout.notification_health_stats)

        views.setTextViewText(R.id.tv_calories, "$calories / $calorieGoal")
        views.setTextColor(R.id.tv_calories, primaryColor)
        views.setTextColor(R.id.tv_calories_label, secondaryColor)

        views.setTextViewText(R.id.tv_water, formatWater(waterMl) + " / " + formatWater(waterGoal))
        views.setTextColor(R.id.tv_water, primaryColor)
        views.setTextColor(R.id.tv_water_label, secondaryColor)

        views.setTextViewText(R.id.tv_steps, "$steps / $stepGoal")
        views.setTextColor(R.id.tv_steps, primaryColor)
        views.setTextColor(R.id.tv_steps_label, secondaryColor)

        views.setTextColor(R.id.btn_add_water, accentColor)
        views.setTextColor(R.id.btn_log_meal, accentColor)

        val openIntent = packageManager.getLaunchIntentForPackage(packageName)
        val contentPI = PendingIntent.getActivity(
            this, 0, openIntent,
            PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE
        )

        val addWaterPI = PendingIntent.getBroadcast(
            this, 1, Intent(this, AddWaterReceiver::class.java),
            PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE
        )

        val logMealIntent = packageManager.getLaunchIntentForPackage(packageName)?.apply {
            putExtra("action", "log_meal")
            flags = Intent.FLAG_ACTIVITY_NEW_TASK or Intent.FLAG_ACTIVITY_CLEAR_TOP
        }
        val logMealPI = PendingIntent.getActivity(
            this, 2, logMealIntent,
            PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE
        )

        // Buttons embedded in layout — always visible without expanding
        views.setOnClickPendingIntent(R.id.btn_add_water, addWaterPI)
        views.setOnClickPendingIntent(R.id.btn_log_meal, logMealPI)

        return NotificationCompat.Builder(this, CHANNEL_ID)
            .setSmallIcon(R.drawable.ic_notif_health)
            .setCustomContentView(views)
            .setStyle(NotificationCompat.DecoratedCustomViewStyle())
            .setContentIntent(contentPI)
            .setVisibility(NotificationCompat.VISIBILITY_PUBLIC)
            .setOngoing(true)
            .setOnlyAlertOnce(true)
            .build()
    }

    private fun formatWater(ml: Int): String =
        if (ml >= 1000) String.format("%.1fL", ml / 1000.0) else "${ml}ml"
}
