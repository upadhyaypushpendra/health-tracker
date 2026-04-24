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
import com.getcapacitor.PluginMethod
import com.getcapacitor.annotation.CapacitorPlugin
import com.getcapacitor.annotation.Permission
import androidx.glance.appwidget.updateAll
import java.text.SimpleDateFormat
import java.util.Date
import java.util.Locale
import java.util.concurrent.CountDownLatch
import java.util.concurrent.TimeUnit
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.launch

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

  private fun refreshWidget() {
    CoroutineScope(Dispatchers.Main).launch {
      HealthWidget().updateAll(context)
    }
  }

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
      val goal = call.data.optInt("goal", 3000)
      val waterTodayObj = call.data.optJSONObject("waterToday")
      val waterAmount = if (waterTodayObj != null) {
        val entries = waterTodayObj.optJSONArray("entries")
        var total = 0
        if (entries != null) {
          for (i in 0 until entries.length()) {
            total += entries.optJSONObject(i)?.optInt("amount", 0) ?: 0
          }
        }
        total
      } else {
        0
      }

      getSharedPrefs().edit()
        .putInt("bodysync_water_today", waterAmount)
        .putInt("bodysync_water_goal", goal)
        .putLong("bodysync_updated_at", System.currentTimeMillis())
        .apply()

      refreshWidget()
      call.resolve()
    } catch (error: Exception) {
      call.reject("Failed to sync water data: ${error.message}", error)
    }
  }

  @PluginMethod
  fun syncMealData(call: PluginCall) {
    try {
      val mealCount = call.data.optInt("mealCount", 0)
      val calories = call.data.optInt("calories", 0)
      val goal = call.data.optInt("goal", 2000)

      getSharedPrefs().edit()
        .putInt("bodysync_meals_today", mealCount)
        .putInt("bodysync_calories_today", calories)
        .putInt("bodysync_calorie_goal", goal)
        .putLong("bodysync_updated_at", System.currentTimeMillis())
        .apply()

      refreshWidget()
      call.resolve()
    } catch (error: Exception) {
      call.reject("Failed to sync meal data: ${error.message}", error)
    }
  }

  @PluginMethod
  fun syncWorkoutData(call: PluginCall) {
    try {
      val exists = call.data.optBoolean("exists", false)
      val completed = call.data.optBoolean("completed", false)

      getSharedPrefs().edit()
        .putBoolean("bodysync_workout_today", exists)
        .putBoolean("bodysync_workout_completed", completed)
        .putLong("bodysync_updated_at", System.currentTimeMillis())
        .apply()

      refreshWidget()
      call.resolve()
    } catch (error: Exception) {
      call.reject("Failed to sync workout data: ${error.message}", error)
    }
  }

  @PluginMethod
  fun syncStepData(call: PluginCall) {
    try {
      val steps = call.data.optInt("steps", 0)
      val goal = call.data.optInt("goal", 10000)

      getSharedPrefs().edit()
        .putInt("bodysync_steps_today", steps)
        .putInt("bodysync_step_goal", goal)
        .putLong("bodysync_updated_at", System.currentTimeMillis())
        .apply()

      refreshWidget()
      call.resolve()
    } catch (error: Exception) {
      call.reject("Failed to sync step data: ${error.message}", error)
    }
  }

  @PluginMethod
  fun logWaterFromWidget(call: PluginCall) {
    try {
      val amount = call.data.optInt("amount", 250)

      getSharedPrefs().edit()
        .putInt("bodysync_widget_log_water", amount)
        .apply()

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
  fun getPendingWidgetWater(call: PluginCall) {
    try {
      val prefs = getSharedPrefs()
      val pending = prefs.getInt("bodysync_widget_water_pending", 0)
      prefs.edit().putInt("bodysync_widget_water_pending", 0).apply()
      val result = JSObject()
      result.put("amount", pending)
      call.resolve(result)
    } catch (error: Exception) {
      call.reject("Failed to get pending widget water: ${error.message}", error)
    }
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
