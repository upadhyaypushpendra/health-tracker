package com.bodysync.app

import android.content.Context
import androidx.compose.runtime.Composable
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.glance.GlanceId
import androidx.glance.GlanceModifier
import androidx.glance.action.ActionParameters
import androidx.glance.action.clickable
import androidx.glance.appwidget.GlanceAppWidget
import androidx.glance.appwidget.action.ActionCallback
import androidx.glance.appwidget.action.actionRunCallback
import androidx.glance.appwidget.provideContent
import androidx.glance.appwidget.updateAll
import androidx.glance.background
import androidx.glance.layout.Alignment
import androidx.glance.layout.Box
import androidx.glance.layout.Column
import androidx.glance.layout.Row
import androidx.glance.layout.Spacer
import androidx.glance.layout.fillMaxSize
import androidx.glance.layout.fillMaxWidth
import androidx.glance.layout.height
import androidx.glance.layout.padding
import androidx.glance.layout.width
import androidx.glance.text.FontWeight
import androidx.glance.text.Text
import androidx.glance.text.TextStyle
import androidx.glance.unit.ColorProvider

private val BgMain  = Color(0xFF0D0D0D)
private val BgCard  = Color(0xFF1A1A1A)
private val BgBadge = Color(0xFF262626)
private val TxtPri  = Color(0xFFFFFFFF)
private val TxtSec  = Color(0xFF888888)
private val Divider = Color(0xFF2A2A2A)

private val ColWater = Color(0xFF3B82F6)
private val ColSteps = Color(0xFF8B5CF6)
private val ColMeals = Color(0xFFF97316)

class LogWaterCallback : ActionCallback {
    override suspend fun onAction(
        context: Context,
        glanceId: GlanceId,
        parameters: ActionParameters
    ) {
        val prefs = context.getSharedPreferences("com.bodysync.app.health", Context.MODE_PRIVATE)
        val current = prefs.getInt("bodysync_water_today", 0)
        val pending = prefs.getInt("bodysync_widget_water_pending", 0)
        prefs.edit()
            .putInt("bodysync_water_today", current + 250)
            .putInt("bodysync_widget_water_pending", pending + 250)
            .putLong("bodysync_updated_at", System.currentTimeMillis())
            .apply()
        HealthWidget().updateAll(context)
    }
}

class HealthWidget : GlanceAppWidget() {

    override suspend fun provideGlance(context: Context, id: GlanceId) {
        val prefs = context.getSharedPreferences("com.bodysync.app.health", Context.MODE_PRIVATE)

        val waterToday    = prefs.getInt("bodysync_water_today",    0)
        val waterGoal     = prefs.getInt("bodysync_water_goal",     3000)
        val mealCount     = prefs.getInt("bodysync_meals_today",    0)
        val calories      = prefs.getInt("bodysync_calories_today", 0)
        val calorieGoal   = prefs.getInt("bodysync_calorie_goal",   2000)
        val workoutExists = prefs.getBoolean("bodysync_workout_today",     false)
        val workoutDone   = prefs.getBoolean("bodysync_workout_completed", false)
        val steps         = prefs.getInt("bodysync_steps_today", 0)
        val stepGoal      = prefs.getInt("bodysync_step_goal",  10000)

        provideContent {
            Content(
                waterToday    = waterToday,
                waterGoal     = waterGoal,
                mealCount     = mealCount,
                calories      = calories,
                calorieGoal   = calorieGoal,
                workoutExists = workoutExists,
                workoutDone   = workoutDone,
                steps         = steps,
                stepGoal      = stepGoal
            )
        }
    }

    @Composable
    private fun Content(
        waterToday: Int, waterGoal: Int,
        mealCount: Int, calories: Int, calorieGoal: Int,
        workoutExists: Boolean, workoutDone: Boolean,
        steps: Int, stepGoal: Int
    ) {
        val waterPct   = pct(waterToday, waterGoal)
        val caloriePct = pct(calories, calorieGoal)
        val stepPct    = pct(steps, stepGoal)

        val workoutLabel = when {
            workoutDone   -> "Done ✓"
            workoutExists -> "Planned"
            else          -> "Rest"
        }
        val workoutColor = when {
            workoutDone   -> Color(0xFF22C55E)
            workoutExists -> Color(0xFFF59E0B)
            else          -> Color(0xFF555555)
        }

        Column(
            modifier = GlanceModifier
                .fillMaxSize()
                .background(BgMain)
                .padding(10.dp)
        ) {
            // Header
            Row(
                modifier = GlanceModifier.fillMaxWidth(),
                verticalAlignment = Alignment.CenterVertically
            ) {
                Text(
                    "Body Sync",
                    style = TextStyle(
                        fontSize = 11.sp,
                        fontWeight = FontWeight.Bold,
                        color = ColorProvider(TxtPri)
                    )
                )
                Spacer(modifier = GlanceModifier.defaultWeight())
                Box(
                    modifier = GlanceModifier
                        .background(Color(0xFF1E3A5F))
                        .padding(horizontal = 6.dp, vertical = 2.dp),
                    contentAlignment = Alignment.Center
                ) {
                    Text(
                        "Today",
                        style = TextStyle(
                            fontSize = 8.sp,
                            fontWeight = FontWeight.Medium,
                            color = ColorProvider(ColWater)
                        )
                    )
                }
            }

            Spacer(modifier = GlanceModifier.height(10.dp))

            // Card
            Column(
                modifier = GlanceModifier
                    .fillMaxWidth()
                    .background(BgCard)
                    .padding(horizontal = 10.dp, vertical = 12.dp)
            ) {
                // Row 1: Water | Steps
                Row(
                    modifier = GlanceModifier.fillMaxWidth(),
                    verticalAlignment = Alignment.CenterVertically
                ) {
                    Section(
                        modifier = GlanceModifier.defaultWeight(),
                        icon     = "💧",
                        label    = "${fmt(waterToday)}/${fmt(waterGoal)} ml",
                        pct      = "$waterPct%",
                        color    = ColWater
                    )
                    VSeparator()
                    Section(
                        modifier = GlanceModifier.defaultWeight(),
                        icon     = "🏃",
                        label    = "${fmt(steps)}/${fmt(stepGoal)}",
                        pct      = "$stepPct%",
                        color    = ColSteps
                    )
                }

                HSeparator()

                // Row 2: Meals | Workout
                Row(
                    modifier = GlanceModifier.fillMaxWidth(),
                    verticalAlignment = Alignment.CenterVertically
                ) {
                    Section(
                        modifier = GlanceModifier.defaultWeight(),
                        icon     = "🍽",
                        label    = "${fmt(calories)}/${fmt(calorieGoal)} kcal",
                        pct      = "$caloriePct%",
                        color    = ColMeals
                    )
                    VSeparator()
                    Section(
                        modifier  = GlanceModifier.defaultWeight(),
                        icon      = "💪",
                        label     = workoutLabel,
                        pct       = "$mealCount meals",
                        color     = workoutColor
                    )
                }
            }

            Spacer(modifier = GlanceModifier.defaultWeight())

            // Button
            Box(
                modifier = GlanceModifier
                    .fillMaxWidth()
                    .background(Color(0xFF1D4ED8))
                    .padding(vertical = 8.dp)
                    .clickable(actionRunCallback<LogWaterCallback>()),
                contentAlignment = Alignment.Center
            ) {
                Text(
                    "Drank 1 glass",
                    style = TextStyle(
                        fontSize = 11.sp,
                        fontWeight = FontWeight.Bold,
                        color = ColorProvider(TxtPri)
                    )
                )
            }
        }
    }

    // Icon  Label  [Pct%]  — all on one horizontal line
    @Composable
    private fun Section(
        modifier: GlanceModifier,
        icon: String,
        label: String,
        pct: String,
        color: Color
    ) {
        Row(
            modifier = modifier.padding(horizontal = 6.dp, vertical = 6.dp),
            verticalAlignment = Alignment.CenterVertically
        ) {
            Text(icon, style = TextStyle(fontSize = 14.sp))
            Spacer(modifier = GlanceModifier.width(6.dp))
            Text(
                label,
                style = TextStyle(
                    fontSize = 10.sp,
                    fontWeight = FontWeight.Medium,
                    color = ColorProvider(color)
                )
            )
            Spacer(modifier = GlanceModifier.defaultWeight())
            Box(
                modifier = GlanceModifier
                    .background(BgBadge)
                    .padding(horizontal = 5.dp, vertical = 2.dp),
                contentAlignment = Alignment.Center
            ) {
                Text(
                    pct,
                    style = TextStyle(
                        fontSize = 9.sp,
                        fontWeight = FontWeight.Bold,
                        color = ColorProvider(color)
                    )
                )
            }
        }
    }

    @Composable
    private fun VSeparator() {
        Box(
            modifier = GlanceModifier
                .width(1.dp)
                .height(36.dp)
                .background(Divider)
        ) {}
    }

    @Composable
    private fun HSeparator() {
        Box(
            modifier = GlanceModifier
                .fillMaxWidth()
                .height(1.dp)
                .background(Divider)
        ) {}
    }

    private fun pct(value: Int, goal: Int) =
        if (goal > 0) (value * 100 / goal).coerceIn(0, 100) else 0

    private fun fmt(n: Int): String =
        if (n >= 1000) "${n / 1000},${"%03d".format(n % 1000)}" else "$n"
}
