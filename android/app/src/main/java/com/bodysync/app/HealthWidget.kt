package com.bodysync.app

import android.content.Context
import androidx.compose.runtime.Composable
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.glance.GlanceId
import androidx.glance.GlanceModifier
import androidx.glance.appwidget.GlanceAppWidget
import androidx.glance.appwidget.provideContent
import androidx.glance.background
import androidx.glance.layout.Alignment
import androidx.glance.layout.Box
import androidx.glance.layout.Column
import androidx.glance.layout.Row
import androidx.glance.layout.Spacer
import androidx.glance.layout.fillMaxWidth
import androidx.glance.layout.padding
import androidx.glance.text.Text
import androidx.glance.text.TextStyle
import androidx.glance.unit.ColorProvider

class HealthWidget : GlanceAppWidget() {
  override suspend fun provideGlance(context: Context, id: GlanceId) {
    provideContent {
      HealthWidgetContent(context)
    }
  }

  @Composable
  private fun HealthWidgetContent(context: Context) {
    val prefs = context.getSharedPreferences("com.bodysync.app.health", Context.MODE_PRIVATE)

    val waterToday = prefs.getInt("bodysync_water_today", 0)
    val waterGoal = prefs.getInt("bodysync_water_goal", 3000)
    val mealCount = prefs.getInt("bodysync_meals_today", 0)
    val calories = prefs.getInt("bodysync_calories_today", 0)
    val calorieGoal = prefs.getInt("bodysync_calorie_goal", 2000)
    val workoutExists = prefs.getBoolean("bodysync_workout_today", false)
    val workoutCompleted = prefs.getBoolean("bodysync_workout_completed", false)
    val stepsToday = prefs.getInt("bodysync_steps_today", 0)
    val stepGoal = prefs.getInt("bodysync_step_goal", 10000)

    val waterPct = if (waterGoal > 0) (waterToday * 100) / waterGoal else 0
    val stepsPct = if (stepGoal > 0) (stepsToday * 100) / stepGoal else 0

    Column(
      modifier = GlanceModifier
        .fillMaxWidth()
        .padding(12.dp)
        .background(Color.White),
      horizontalAlignment = Alignment.CenterHorizontally
    ) {
      Text(
        "Today's Health",
        style = TextStyle(fontSize = 16.sp, color = ColorProvider(Color.Black))
      )

      Spacer(GlanceModifier.padding(vertical = 8.dp))

      // Water
      Row(
        modifier = GlanceModifier.fillMaxWidth(),
        verticalAlignment = Alignment.CenterVertically
      ) {
        Column {
          Text("Water  $waterPct%", style = TextStyle(fontSize = 10.sp, color = ColorProvider(Color.Gray)))
          Text("$waterToday / $waterGoal ml", style = TextStyle(fontSize = 12.sp, color = ColorProvider(Color.Black)))
        }
      }

      Spacer(GlanceModifier.padding(vertical = 4.dp))

      // Meals
      Row(
        modifier = GlanceModifier.fillMaxWidth(),
        verticalAlignment = Alignment.CenterVertically
      ) {
        Text(
          "$mealCount meals, $calories / $calorieGoal kcal",
          style = TextStyle(fontSize = 10.sp, color = ColorProvider(Color.Black))
        )
      }

      Spacer(GlanceModifier.padding(vertical = 4.dp))

      // Workout
      Row(
        modifier = GlanceModifier.fillMaxWidth(),
        verticalAlignment = Alignment.CenterVertically
      ) {
        Text(
          if (workoutExists) {
            if (workoutCompleted) "Completed" else "Planned"
          } else {
            "No workout"
          },
          style = TextStyle(
            fontSize = 10.sp,
            color = ColorProvider(if (workoutCompleted) Color(0xFF4CAF50) else Color.Gray)
          )
        )
      }

      Spacer(GlanceModifier.padding(vertical = 4.dp))

      // Steps
      Row(
        modifier = GlanceModifier.fillMaxWidth(),
        verticalAlignment = Alignment.CenterVertically
      ) {
        Column {
          Text("Steps  $stepsPct%", style = TextStyle(fontSize = 10.sp, color = ColorProvider(Color.Gray)))
          Text("$stepsToday / $stepGoal", style = TextStyle(fontSize = 12.sp, color = ColorProvider(Color.Black)))
        }
      }

      Spacer(GlanceModifier.padding(vertical = 8.dp))

      // Log Water Button
      Box(
        modifier = GlanceModifier
          .fillMaxWidth()
          .background(Color(0xFF1976D2))
          .padding(8.dp),
        contentAlignment = Alignment.Center
      ) {
        Text(
          "Log 250ml Water",
          style = TextStyle(fontSize = 11.sp, color = ColorProvider(Color.White))
        )
      }
    }
  }
}
