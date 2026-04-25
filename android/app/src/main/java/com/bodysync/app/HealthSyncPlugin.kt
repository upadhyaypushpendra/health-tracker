package com.bodysync.app

import android.app.NotificationChannel
import android.app.NotificationManager
import android.app.PendingIntent
import android.content.ContentValues
import android.content.Context
import android.content.Intent
import android.hardware.Sensor
import android.hardware.SensorEvent
import android.hardware.SensorEventListener
import android.hardware.SensorManager
import android.os.Build
import android.os.Environment
import android.provider.MediaStore
import android.util.Log
import androidx.activity.result.ActivityResultLauncher
import androidx.core.app.NotificationCompat
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
import com.getcapacitor.annotation.CapacitorPlugin
import com.getcapacitor.annotation.Permission
import java.io.File
import java.time.Instant
import java.time.LocalDate
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

  private fun today() = LocalDate.now().toString()

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
  fun saveToDownloads(call: PluginCall) {
    val text     = call.data.optString("text",     "") ?: ""
    val filename = call.data.optString("filename", "backup.json") ?: "backup.json"
    Log.d("HealthSync", "saveToDownloads: filename=$filename textLen=${text.length} api=${Build.VERSION.SDK_INT}")
    CoroutineScope(Dispatchers.IO).launch {
      try {
        val fileUri: android.net.Uri
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q) {
          val values = ContentValues().apply {
            put(MediaStore.Downloads.DISPLAY_NAME, filename)
            put(MediaStore.Downloads.MIME_TYPE, "application/json")
            put(MediaStore.Downloads.IS_PENDING, 1)
          }
          val resolver = context.contentResolver
          val uri = resolver.insert(MediaStore.Downloads.EXTERNAL_CONTENT_URI, values)
            ?: throw Exception("Could not create file in Downloads")
          Log.d("HealthSync", "saveToDownloads: inserted uri=$uri")
          resolver.openOutputStream(uri)?.use { it.write(text.toByteArray(Charsets.UTF_8)) }
          values.clear()
          values.put(MediaStore.Downloads.IS_PENDING, 0)
          resolver.update(uri, values, null, null)
          fileUri = uri
        } else {
          val dir = Environment.getExternalStoragePublicDirectory(Environment.DIRECTORY_DOWNLOADS)
          val file = File(dir, filename)
          file.writeText(text, Charsets.UTF_8)
          fileUri = androidx.core.content.FileProvider.getUriForFile(
            context, "${context.packageName}.fileprovider", file
          )
        }
        Log.d("HealthSync", "saveToDownloads: success $filename")
        postDownloadNotification(filename, fileUri)
        call.resolve()
      } catch (e: Exception) {
        Log.e("HealthSync", "saveToDownloads: failed ${e.message}", e)
        call.reject("saveToDownloads failed: ${e.message}", e)
      }
    }
  }

  private fun postDownloadNotification(filename: String, fileUri: android.net.Uri) {
    val channelId = "downloads"
    val notifManager = context.getSystemService(NotificationManager::class.java)
    val channel = NotificationChannel(channelId, "Downloads", NotificationManager.IMPORTANCE_DEFAULT)
    notifManager.createNotificationChannel(channel)

    val openIntent = Intent(Intent.ACTION_VIEW).apply {
      setDataAndType(fileUri, "application/json")
      flags = Intent.FLAG_GRANT_READ_URI_PERMISSION or Intent.FLAG_ACTIVITY_NEW_TASK
    }
    val openPI = PendingIntent.getActivity(
      context, filename.hashCode(), openIntent,
      PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE
    )

    val notif = NotificationCompat.Builder(context, channelId)
      .setSmallIcon(R.drawable.ic_notif_health)
      .setContentTitle(filename)
      .setContentText("Download complete — tap to open")
      .setContentIntent(openPI)
      .setAutoCancel(true)
      .build()

    notifManager.notify(filename.hashCode(), notif)
    Log.d("HealthSync", "saveToDownloads: notification posted for $filename")
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

  private var pendingHcCall: PluginCall? = null
  private lateinit var requestHcPermissions: ActivityResultLauncher<Set<String>>

  override fun load() {
    val contract = PermissionController.createRequestPermissionResultContract()
    requestHcPermissions = activity.registerForActivityResult(contract) { _ ->
      val call = pendingHcCall ?: return@registerForActivityResult
      pendingHcCall = null
      CoroutineScope(Dispatchers.IO).launch {
        try {
          val granted = hcClient().permissionController.getGrantedPermissions()
          val res = JSObject()
          res.put("granted", hcPermissions.all { it in granted })
          call.resolve(res)
        } catch (e: Exception) {
          Log.e("HealthSync", "permissionCallback error: ${e.message}", e)
          val res = JSObject()
          res.put("granted", false)
          call.resolve(res)
        }
      }
    }
  }

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
    if (HealthConnectClient.getSdkStatus(context) != HealthConnectClient.SDK_AVAILABLE) {
      call.reject("Health Connect is not available on this device")
      return
    }
    try {
      pendingHcCall = call
      requestHcPermissions.launch(hcPermissions)
    } catch (e: Exception) {
      Log.e("HealthSync", "requestHealthPermissions failed: ${e.message}", e)
      pendingHcCall = null
      call.reject("Failed to launch Health Connect: ${e.message}", e)
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

  // ─── Health Notification ──────────────────────────────────────────────────

  private fun buildNotifIntent(call: PluginCall): Intent =
    Intent(context, HealthNotificationService::class.java).apply {
      putExtra(HealthNotificationService.EXTRA_CALORIES,    call.getInt("calories", 0))
      putExtra(HealthNotificationService.EXTRA_CALORIE_GOAL, call.getInt("calorieGoal", 2000))
      putExtra(HealthNotificationService.EXTRA_WATER_ML,    call.getInt("waterMl", 0))
      putExtra(HealthNotificationService.EXTRA_WATER_GOAL,  call.getInt("waterGoal", 3000))
      putExtra(HealthNotificationService.EXTRA_STEPS,       call.getInt("steps", 0))
      putExtra(HealthNotificationService.EXTRA_STEP_GOAL,   call.getInt("stepGoal", 10000))
    }

  @PluginMethod
  fun startHealthNotification(call: PluginCall) {
    context.startForegroundService(buildNotifIntent(call))
    call.resolve()
  }

  @PluginMethod
  fun updateHealthNotification(call: PluginCall) {
    context.startForegroundService(buildNotifIntent(call))
    call.resolve()
  }

  @PluginMethod
  fun stopHealthNotification(call: PluginCall) {
    context.stopService(Intent(context, HealthNotificationService::class.java))
    call.resolve()
  }

  @PluginMethod
  fun getPendingWaterAdd(call: PluginCall) {
    val prefs = context.getSharedPreferences("com.bodysync.app.health", Context.MODE_PRIVATE)
    val pending = prefs.getInt("pending_water_ml", 0)
    prefs.edit().putInt("pending_water_ml", 0).apply()
    val result = JSObject()
    result.put("pendingMl", pending)
    call.resolve(result)
  }

  @PluginMethod
  fun getIntentAction(call: PluginCall) {
    val action = activity.intent?.getStringExtra("action") ?: ""
    activity.intent?.removeExtra("action")
    val result = JSObject()
    result.put("action", action)
    call.resolve(result)
  }
}
