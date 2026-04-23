package com.bodysync.app

import android.app.PendingIntent
import android.appwidget.AppWidgetManager
import android.content.ComponentName
import android.content.Context
import android.content.Intent
import android.hardware.Sensor
import android.hardware.SensorEvent
import android.hardware.SensorEventListener
import android.hardware.SensorManager
import android.os.Build
import com.getcapacitor.JSObject
import com.getcapacitor.PermissionState
import com.getcapacitor.Plugin
import com.getcapacitor.PluginCall
import com.getcapacitor.annotation.CapacitorPlugin
import com.getcapacitor.annotation.Permission
import com.getcapacitor.annotation.PluginMethod
import java.text.SimpleDateFormat
import java.util.Date
import java.util.Locale
import java.util.concurrent.CountDownLatch
import java.util.concurrent.TimeUnit

@CapacitorPlugin(
  name = "HealthSync",
  permissions = [
    Permission(
      strings = ["android.permission.ACTIVITY_RECOGNITION"],
      alias = "activityRecognition"
    )
  ]
)
class HealthSyncPlugin : Plugin() {

  private fun getSharedPrefs() =
    context.getSharedPreferences("com.bodysync.app.health", Context.MODE_PRIVATE)

  @PluginMethod
  override fun checkPermissions(call: PluginCall) {
    if (Build.VERSION.SDK_INT < Build.VERSION_CODES.Q) {
      val result = JSObject()
      result.put("activityRecognition", "granted")
      call.resolve(result)
      return
    }
    super.checkPermissions(call)
  }

  @PluginMethod
  override fun requestPermissions(call: PluginCall) {
    if (Build.VERSION.SDK_INT < Build.VERSION_CODES.Q) {
      val result = JSObject()
      result.put("activityRecognition", "granted")
      call.resolve(result)
      return
    }
    super.requestPermissions(call)
  }

  @PluginMethod
  fun syncWaterData(call: PluginCall) {
    try {
      val waterToday = call.getObject("waterToday")
      val goal = call.getInt("goal", 3000)

      val prefs = getSharedPrefs()
      val editor = prefs.edit()

      val waterAmount = if (waterToday != null) {
        val entries = waterToday.getJSArray("entries")
        var totalAmount = 0
        if (entries != null) {
          for (i in 0 until entries.length()) {
            val entry = entries.getJSObject(i)
            totalAmount += entry?.getInt("amount", 0) ?: 0
          }
        }
        totalAmount
      } else {
        0
      }

      editor.putInt("bodysync_water_today", waterAmount)
      editor.putInt("bodysync_water_goal", goal)
      editor.putLong("bodysync_updated_at", System.currentTimeMillis())
      editor.apply()

      call.resolve()
    } catch (error: Exception) {
      call.reject("Failed to sync water data: ${error.message}", error)
    }
  }

  @PluginMethod
  fun syncMealData(call: PluginCall) {
    try {
      val mealCount = call.getInt("mealCount", 0)
      val calories = call.getInt("calories", 0)
      val goal = call.getInt("goal", 2000)

      val prefs = getSharedPrefs()
      val editor = prefs.edit()

      editor.putInt("bodysync_meals_today", mealCount)
      editor.putInt("bodysync_calories_today", calories)
      editor.putInt("bodysync_calorie_goal", goal)
      editor.putLong("bodysync_updated_at", System.currentTimeMillis())
      editor.apply()

      call.resolve()
    } catch (error: Exception) {
      call.reject("Failed to sync meal data: ${error.message}", error)
    }
  }

  @PluginMethod
  fun syncWorkoutData(call: PluginCall) {
    try {
      val exists = call.getBoolean("exists", false)
      val completed = call.getBoolean("completed", false)

      val prefs = getSharedPrefs()
      val editor = prefs.edit()

      editor.putBoolean("bodysync_workout_today", exists)
      editor.putBoolean("bodysync_workout_completed", completed)
      editor.putLong("bodysync_updated_at", System.currentTimeMillis())
      editor.apply()

      call.resolve()
    } catch (error: Exception) {
      call.reject("Failed to sync workout data: ${error.message}", error)
    }
  }

  @PluginMethod
  fun syncStepData(call: PluginCall) {
    try {
      val steps = call.getInt("steps", 0)
      val goal = call.getInt("goal", 10000)

      val prefs = getSharedPrefs()
      val editor = prefs.edit()

      editor.putInt("bodysync_steps_today", steps)
      editor.putInt("bodysync_step_goal", goal)
      editor.putLong("bodysync_updated_at", System.currentTimeMillis())
      editor.apply()

      call.resolve()
    } catch (error: Exception) {
      call.reject("Failed to sync step data: ${error.message}", error)
    }
  }

  @PluginMethod
  fun logWaterFromWidget(call: PluginCall) {
    try {
      val amount = call.getInt("amount", 250)

      val prefs = getSharedPrefs()
      val editor = prefs.edit()
      editor.putInt("bodysync_widget_log_water", amount)
      editor.apply()

      call.resolve()
    } catch (error: Exception) {
      call.reject("Failed to log water from widget: ${error.message}", error)
    }
  }

  @PluginMethod
  fun getStepsFromSensor(call: PluginCall) {
    // ACTIVITY_RECOGNITION permission is only required on Android 10+
    if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q) {
      if (getPermissionState("activityRecognition") != PermissionState.GRANTED) {
        call.reject("PERMISSION_DENIED", "Activity recognition permission is required")
        return
      }
    }

    val sensorManager = context.getSystemService(Context.SENSOR_SERVICE) as SensorManager
    val stepSensor = sensorManager.getDefaultSensor(Sensor.TYPE_STEP_COUNTER)

    if (stepSensor == null) {
      call.reject("Step counter sensor not available on this device")
      return
    }

    val latch = CountDownLatch(1)
    var totalSteps = 0

    val listener = object : SensorEventListener {
      override fun onSensorChanged(event: SensorEvent) {
        totalSteps = event.values[0].toInt()
        latch.countDown()
        sensorManager.unregisterListener(this)
      }
      override fun onAccuracyChanged(sensor: Sensor, accuracy: Int) {}
    }

    sensorManager.registerListener(listener, stepSensor, SensorManager.SENSOR_DELAY_NORMAL)

    val received = latch.await(3, TimeUnit.SECONDS)
    if (!received) {
      sensorManager.unregisterListener(listener)
      call.reject("Timed out waiting for step sensor reading")
      return
    }

    // Calculate today's steps using a stored daily baseline.
    // TYPE_STEP_COUNTER resets on reboot, so we also handle that case.
    val prefs = getSharedPrefs()
    val today = SimpleDateFormat("yyyy-MM-dd", Locale.getDefault()).format(Date())
    val storedDate = prefs.getString("bodysync_sensor_date", "")
    val baseline = if (storedDate == today) {
      prefs.getInt("bodysync_sensor_baseline", totalSteps)
    } else {
      prefs.edit()
        .putString("bodysync_sensor_date", today)
        .putInt("bodysync_sensor_baseline", totalSteps)
        .apply()
      totalSteps
    }

    // If totalSteps < baseline the device rebooted; treat all steps as today's
    val todaySteps = if (totalSteps >= baseline) totalSteps - baseline else totalSteps

    val result = JSObject()
    result.put("steps", todaySteps)
    call.resolve(result)
  }

  @PluginMethod
  fun pinWidget(call: PluginCall) {
    if (Build.VERSION.SDK_INT < Build.VERSION_CODES.O) {
      call.reject("Widget pinning requires Android 8.0 or above")
      return
    }
    val appWidgetManager = AppWidgetManager.getInstance(context)
    if (!appWidgetManager.isRequestPinAppWidgetSupported) {
      call.reject("Your launcher does not support pinning widgets directly. Long-press your home screen and look for Widgets.")
      return
    }
    val provider = ComponentName(context, HealthWidgetReceiver::class.java)
    appWidgetManager.requestPinAppWidget(provider, null, null)
    call.resolve()
  }
}
