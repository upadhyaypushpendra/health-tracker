package com.bodysync.app

import android.app.PendingIntent
import android.appwidget.AppWidgetManager
import android.content.ComponentName
import android.util.Log
import android.content.Context
import android.content.Intent
import android.hardware.Sensor
import android.hardware.SensorEvent
import android.hardware.SensorEventListener
import android.hardware.SensorManager
import android.os.Build
import androidx.activity.result.ActivityResult
import androidx.glance.appwidget.updateAll
import androidx.health.connect.client.HealthConnectClient
import androidx.health.connect.client.PermissionController
import androidx.health.connect.client.permission.HealthPermission
import androidx.health.connect.client.records.ExerciseSessionRecord
import androidx.health.connect.client.records.HydrationRecord
import androidx.health.connect.client.records.metadata.Metadata as HCMetadata
import androidx.health.connect.client.records.NutritionRecord
import androidx.health.connect.client.time.TimeRangeFilter
import androidx.health.connect.client.units.Energy
import androidx.health.connect.client.units.Mass
import androidx.health.connect.client.units.Volume
import com.getcapacitor.JSObject
import com.getcapacitor.PermissionState
import com.getcapacitor.Plugin
import com.getcapacitor.PluginCall
import com.getcapacitor.PluginMethod
import com.getcapacitor.annotation.ActivityCallback
import com.getcapacitor.annotation.CapacitorPlugin
import com.getcapacitor.annotation.Permission
import java.time.Instant
import java.time.temporal.ChronoUnit
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

  private fun dao() = HealthDatabase.getInstance(context).dailyStatsDao()
  private fun today() = HealthDatabase.todayString()

  private fun refreshWidget() {
    CoroutineScope(Dispatchers.Main).launch {
      HealthWidget().updateAll(context)
    }
  }

  private suspend fun getOrCreateToday(): DailyStats =
    dao().getByDate(today()) ?: DailyStats(date = today())

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
    val waterMl = call.data.optInt("waterMl", 0)
    val goal = call.data.optInt("goal", 3000)
    CoroutineScope(Dispatchers.IO).launch {
      try {
        dao().upsert(getOrCreateToday().copy(waterMl = waterMl, waterGoalMl = goal))
        refreshWidget()
        call.resolve()
      } catch (e: Exception) {
        call.reject("Failed to sync water data: ${e.message}", e)
      }
    }
  }

  @PluginMethod
  fun syncMealData(call: PluginCall) {
    val mealCount = call.data.optInt("mealCount", 0)
    val calories = call.data.optInt("calories", 0)
    val goal = call.data.optInt("goal", 2000)
    CoroutineScope(Dispatchers.IO).launch {
      try {
        dao().upsert(getOrCreateToday().copy(
          mealCount = mealCount,
          caloriesKcal = calories,
          calorieGoal = goal,
        ))
        refreshWidget()
        call.resolve()
      } catch (e: Exception) {
        call.reject("Failed to sync meal data: ${e.message}", e)
      }
    }
  }

  @PluginMethod
  fun syncWorkoutData(call: PluginCall) {
    val exists = call.data.optBoolean("exists", false)
    val completed = call.data.optBoolean("completed", false)
    CoroutineScope(Dispatchers.IO).launch {
      try {
        dao().upsert(getOrCreateToday().copy(
          workoutExists = exists,
          workoutCompleted = completed,
        ))
        refreshWidget()
        call.resolve()
      } catch (e: Exception) {
        call.reject("Failed to sync workout data: ${e.message}", e)
      }
    }
  }

  @PluginMethod
  fun syncStepData(call: PluginCall) {
    val steps = call.data.optInt("steps", 0)
    val goal = call.data.optInt("goal", 10000)
    CoroutineScope(Dispatchers.IO).launch {
      try {
        dao().upsert(getOrCreateToday().copy(stepsToday = steps, stepGoal = goal))
        refreshWidget()
        call.resolve()
      } catch (e: Exception) {
        call.reject("Failed to sync step data: ${e.message}", e)
      }
    }
  }

  @PluginMethod
  fun getPendingWidgetWater(call: PluginCall) {
    CoroutineScope(Dispatchers.IO).launch {
      try {
        val existing = getOrCreateToday()
        val pending = existing.pendingWaterMl
        if (pending > 0) {
          dao().upsert(existing.copy(pendingWaterMl = 0))
        }
        val result = JSObject()
        result.put("amount", pending as Int)
        call.resolve(result)
      } catch (e: Exception) {
        call.reject("Failed to get pending widget water: ${e.message}", e)
      }
    }
  }

  @PluginMethod
  fun getWidgetAction(call: PluginCall) {
    try {
      val prefs = context.getSharedPreferences("com.bodysync.app.health", Context.MODE_PRIVATE)
      val action = prefs.getString("bodysync_widget_action", "") ?: ""
      prefs.edit().remove("bodysync_widget_action").apply()
      val result = JSObject()
      result.put("action", action)
      call.resolve(result)
    } catch (e: Exception) {
      call.reject("Failed to get widget action: ${e.message}", e)
    }
  }

  @PluginMethod
  fun getStepsFromSensor(call: PluginCall) {
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

    val prefs = context.getSharedPreferences("com.bodysync.app.health", Context.MODE_PRIVATE)
    val storedDate = prefs.getString("bodysync_sensor_date", "")
    val todayStr = today()
    val baseline = if (storedDate == todayStr) {
      prefs.getInt("bodysync_sensor_baseline", totalSteps)
    } else {
      prefs.edit()
        .putString("bodysync_sensor_date", todayStr)
        .putInt("bodysync_sensor_baseline", totalSteps)
        .apply()
      totalSteps
    }

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

  // ─── Health Connect ───────────────────────────────────────────────────────

  private val hcPermissions = setOf(
    HealthPermission.getWritePermission(NutritionRecord::class),
    HealthPermission.getReadPermission(NutritionRecord::class),
    HealthPermission.getWritePermission(HydrationRecord::class),
    HealthPermission.getReadPermission(HydrationRecord::class),
    HealthPermission.getWritePermission(ExerciseSessionRecord::class),
    HealthPermission.getReadPermission(ExerciseSessionRecord::class),
  )

  private val hcPermissionContract = PermissionController.createRequestPermissionResultContract()

  private fun hcClient() = HealthConnectClient.getOrCreate(context)

  @PluginMethod
  fun isHealthConnectAvailable(call: PluginCall) {
    val status = HealthConnectClient.getSdkStatus(context)
    val result = JSObject()
    result.put("available", status == HealthConnectClient.SDK_AVAILABLE)
    call.resolve(result)
  }

  @PluginMethod
  fun checkHealthPermissions(call: PluginCall) {
    CoroutineScope(Dispatchers.IO).launch {
      try {
        val granted = hcClient().permissionController.getGrantedPermissions()
        val result = JSObject()
        result.put("granted", hcPermissions.all { it in granted })
        call.resolve(result)
      } catch (e: Exception) {
        val result = JSObject()
        result.put("granted", false)
        call.resolve(result)
      }
    }
  }

  @PluginMethod
  fun requestHealthPermissions(call: PluginCall) {
    Log.d("HealthSync", "requestHealthPermissions: called")
    if (HealthConnectClient.getSdkStatus(context) != HealthConnectClient.SDK_AVAILABLE) {
      Log.d("HealthSync", "requestHealthPermissions: HC not available, status=${HealthConnectClient.getSdkStatus(context)}")
      call.reject("Health Connect is not available on this device")
      return
    }
    try {
      Log.d("HealthSync", "requestHealthPermissions: creating intent")
      val intent = hcPermissionContract.createIntent(context, hcPermissions)
      Log.d("HealthSync", "requestHealthPermissions: calling startActivityForResult")
      startActivityForResult(call, intent, "permissionCallback")
      Log.d("HealthSync", "requestHealthPermissions: startActivityForResult returned")
    } catch (e: Exception) {
      Log.e("HealthSync", "requestHealthPermissions: exception ${e.message}", e)
      call.reject("Failed to launch Health Connect: ${e.message}", e)
    }
  }

  @ActivityCallback
  private fun permissionCallback(call: PluginCall?, result: ActivityResult) {
    Log.d("HealthSync", "permissionCallback: called, resultCode=${result.resultCode}")
    if (call == null) {
      Log.e("HealthSync", "permissionCallback: call is null")
      return
    }
    CoroutineScope(Dispatchers.IO).launch {
      try {
        val granted = hcClient().permissionController.getGrantedPermissions()
        Log.d("HealthSync", "permissionCallback: granted=${granted.size} permissions, all=${hcPermissions.all { it in granted }}")
        val res = JSObject()
        res.put("granted", hcPermissions.all { it in granted })
        call.resolve(res)
      } catch (e: Exception) {
        Log.e("HealthSync", "permissionCallback: exception ${e.message}", e)
        val res = JSObject()
        res.put("granted", false)
        call.resolve(res)
      }
    }
  }

  @PluginMethod
  fun writeNutritionRecord(call: PluginCall) {
    val name      = call.data.optString("name", "Meal")
    val calories  = call.data.optDouble("calories", 0.0)
    val protein   = call.data.optDouble("protein", 0.0)
    val carbs     = call.data.optDouble("carbs", 0.0)
    val fat       = call.data.optDouble("fat", 0.0)
    val mealType  = call.data.optString("mealType", "snack")
    val startTime = call.data.optString("startTime", "") ?: ""
    CoroutineScope(Dispatchers.IO).launch {
      try {
        val start = Instant.parse(startTime)
        val end   = start.plus(30, ChronoUnit.MINUTES)
        val mealTypeInt = when (mealType) {
          "breakfast" -> 1
          "lunch"     -> 2
          "dinner"    -> 3
          else        -> 4
        }
        val record = NutritionRecord(
          name               = name,
          mealType           = mealTypeInt,
          energy             = Energy.kilocalories(calories),
          protein            = Mass.grams(protein),
          totalCarbohydrate  = Mass.grams(carbs),
          totalFat           = Mass.grams(fat),
          startTime          = start,
          endTime            = end,
          startZoneOffset    = null,
          endZoneOffset      = null,
          metadata           = HCMetadata.manualEntry(),
        )
        hcClient().insertRecords(listOf(record))
        call.resolve()
      } catch (e: Exception) {
        call.reject("writeNutritionRecord failed: ${e.message}", e)
      }
    }
  }

  @PluginMethod
  fun deleteNutritionRecord(call: PluginCall) {
    val startTime = call.data.optString("startTime", "") ?: ""
    val endTime   = call.data.optString("endTime",   "") ?: ""
    CoroutineScope(Dispatchers.IO).launch {
      try {
        val start = Instant.parse(startTime)
        val end   = Instant.parse(endTime).plus(30, ChronoUnit.MINUTES)
        hcClient().deleteRecords(NutritionRecord::class, TimeRangeFilter.between(start, end))
        call.resolve()
      } catch (e: Exception) {
        call.reject("deleteNutritionRecord failed: ${e.message}", e)
      }
    }
  }

  @PluginMethod
  fun writeHydrationRecord(call: PluginCall) {
    val volumeMl  = call.data.optDouble("volumeMl", 0.0)
    val startTime = call.data.optString("startTime", "") ?: ""
    CoroutineScope(Dispatchers.IO).launch {
      try {
        val start  = Instant.parse(startTime)
        val end    = start.plus(1, ChronoUnit.MINUTES)
        val record = HydrationRecord(
          volume          = Volume.milliliters(volumeMl),
          startTime       = start,
          endTime         = end,
          startZoneOffset = null,
          endZoneOffset   = null,
          metadata        = HCMetadata.manualEntry(),
        )
        hcClient().insertRecords(listOf(record))
        call.resolve()
      } catch (e: Exception) {
        call.reject("writeHydrationRecord failed: ${e.message}", e)
      }
    }
  }

  @PluginMethod
  fun deleteHydrationRecord(call: PluginCall) {
    val startTime = call.data.optString("startTime", "") ?: ""
    val endTime   = call.data.optString("endTime",   "") ?: ""
    CoroutineScope(Dispatchers.IO).launch {
      try {
        val start = Instant.parse(startTime)
        val end   = Instant.parse(endTime).plus(1, ChronoUnit.MINUTES)
        hcClient().deleteRecords(HydrationRecord::class, TimeRangeFilter.between(start, end))
        call.resolve()
      } catch (e: Exception) {
        call.reject("deleteHydrationRecord failed: ${e.message}", e)
      }
    }
  }

  @PluginMethod
  fun writeExerciseSession(call: PluginCall) {
    val title        = call.data.optString("title", "Workout")
    val startTime    = call.data.optString("startTime", "") ?: ""
    val endTime      = call.data.optString("endTime",   "") ?: ""
    val exerciseType = call.data.optString("exerciseType", "weights")
    CoroutineScope(Dispatchers.IO).launch {
      try {
        val start = Instant.parse(startTime)
        val end   = Instant.parse(endTime)
        val exerciseTypeInt = when (exerciseType) {
          "cardio" -> ExerciseSessionRecord.EXERCISE_TYPE_OTHER_WORKOUT
          else     -> ExerciseSessionRecord.EXERCISE_TYPE_STRENGTH_TRAINING
        }
        val record = ExerciseSessionRecord(
          title           = title,
          exerciseType    = exerciseTypeInt,
          startTime       = start,
          endTime         = end,
          startZoneOffset = null,
          endZoneOffset   = null,
          metadata        = HCMetadata.manualEntry(),
        )
        hcClient().insertRecords(listOf(record))
        call.resolve()
      } catch (e: Exception) {
        call.reject("writeExerciseSession failed: ${e.message}", e)
      }
    }
  }

  @PluginMethod
  fun deleteExerciseSession(call: PluginCall) {
    val startTime = call.data.optString("startTime", "") ?: ""
    val endTime   = call.data.optString("endTime",   "") ?: ""
    CoroutineScope(Dispatchers.IO).launch {
      try {
        val start = Instant.parse(startTime)
        val end   = Instant.parse(endTime)
        hcClient().deleteRecords(ExerciseSessionRecord::class, TimeRangeFilter.between(start, end))
        call.resolve()
      } catch (e: Exception) {
        call.reject("deleteExerciseSession failed: ${e.message}", e)
      }
    }
  }
}
