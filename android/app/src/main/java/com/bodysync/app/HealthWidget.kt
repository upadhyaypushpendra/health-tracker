package com.bodysync.app

import android.content.Context
import android.content.Intent
import androidx.compose.runtime.Composable
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.glance.GlanceId
import androidx.glance.GlanceModifier
import androidx.glance.action.clickable
import androidx.glance.appwidget.GlanceAppWidget
import androidx.glance.appwidget.action.actionSendBroadcast
import androidx.glance.appwidget.provideContent
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

private val BgMain   = Color(0xFF0D0D0D)
private val BgRow    = Color(0xFF1A1A1A)
private val BgBadge  = Color(0xFF262626)
private val TxtPri   = Color(0xFFFFFFFF)
private val TxtSec   = Color(0xFF888888)
private val ColWater = Color(0xFF3B82F6)
private val ColSteps = Color(0xFF8B5CF6)
private val ColMeals = Color(0xFFF97316)

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
                context       = context,
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
        context: Context,
        waterToday: Int, waterGoal: Int,
        mealCount: Int, calories: Int, calorieGoal: Int,
        workoutExists: Boolean, workoutDone: Boolean,
        steps: Int, stepGoal: Int
    ) {
        val waterPct    = pct(waterToday, waterGoal)
        val caloriePct  = pct(calories, calorieGoal)
        val stepPct     = pct(steps, stepGoal)

        val workoutLabel = when {
            workoutDone   -> "Done ✓"
            workoutExists -> "Planned"
            else          -> "—"
        }
        val workoutColor = when {
            workoutDone   -> Color(0xFF22C55E)
            workoutExists -> Color(0xFFF59E0B)
            else          -> Color(0xFF555555)
        }

        val logWaterIntent = Intent(context, HealthWidgetReceiver::class.java).apply {
            action = "com.bodysync.app.LOG_WATER"
            putExtra("amount", 250)
        }

        Column(
            modifier = GlanceModifier
                .fillMaxSize()
                .background(BgMain)
                .padding(10.dp)
        ) {
            // ── Header ──────────────────────────────────────
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

            Spacer(modifier = GlanceModifier.height(8.dp))

            // ── Row 1: Water | Steps ────────────────────────
            Row(
                modifier = GlanceModifier
                    .fillMaxWidth()
                    .background(BgRow)
                    .padding(horizontal = 12.dp, vertical = 10.dp)
            ) {
                MetricCell(
                    modifier    = GlanceModifier.defaultWeight(),
                    label       = "WATER",
                    value       = fmt(waterToday),
                    unit        = "ml",
                    goal        = "/ ${fmt(waterGoal)} ml",
                    pct         = "$waterPct%",
                    valueColor  = ColWater,
                    pctColor    = ColWater
                )
                Spacer(modifier = GlanceModifier.width(8.dp))
                VerticalDivider()
                Spacer(modifier = GlanceModifier.width(8.dp))
                MetricCell(
                    modifier    = GlanceModifier.defaultWeight(),
                    label       = "STEPS",
                    value       = fmt(steps),
                    unit        = "",
                    goal        = "/ ${fmt(stepGoal)}",
                    pct         = "$stepPct%",
                    valueColor  = ColSteps,
                    pctColor    = ColSteps
                )
            }

            Spacer(modifier = GlanceModifier.height(6.dp))

            // ── Row 2: Meals | Workout ───────────────────────
            Row(
                modifier = GlanceModifier
                    .fillMaxWidth()
                    .background(BgRow)
                    .padding(horizontal = 12.dp, vertical = 10.dp)
            ) {
                MetricCell(
                    modifier    = GlanceModifier.defaultWeight(),
                    label       = "MEALS",
                    value       = "$mealCount",
                    unit        = "meals",
                    goal        = "$calories / $calorieGoal kcal",
                    pct         = "$caloriePct%",
                    valueColor  = ColMeals,
                    pctColor    = ColMeals
                )
                Spacer(modifier = GlanceModifier.width(8.dp))
                VerticalDivider()
                Spacer(modifier = GlanceModifier.width(8.dp))
                Column(modifier = GlanceModifier.defaultWeight()) {
                    Text(
                        "WORKOUT",
                        style = TextStyle(
                            fontSize = 8.sp,
                            fontWeight = FontWeight.Medium,
                            color = ColorProvider(TxtSec)
                        )
                    )
                    Spacer(modifier = GlanceModifier.height(4.dp))
                    Text(
                        workoutLabel,
                        style = TextStyle(
                            fontSize = 16.sp,
                            fontWeight = FontWeight.Bold,
                            color = ColorProvider(workoutColor)
                        )
                    )
                }
            }

            Spacer(modifier = GlanceModifier.defaultWeight())

            // ── Log Water button ─────────────────────────────
            Box(
                modifier = GlanceModifier
                    .fillMaxWidth()
                    .background(Color(0xFF1D4ED8))
                    .padding(vertical = 8.dp)
                    .clickable(actionSendBroadcast(logWaterIntent)),
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

    @Composable
    private fun MetricCell(
        modifier: GlanceModifier,
        label: String,
        value: String,
        unit: String,
        goal: String,
        pct: String,
        valueColor: Color,
        pctColor: Color
    ) {
        Column(modifier = modifier) {
            Text(
                label,
                style = TextStyle(
                    fontSize = 8.sp,
                    fontWeight = FontWeight.Medium,
                    color = ColorProvider(TxtSec)
                )
            )
            Spacer(modifier = GlanceModifier.height(3.dp))
            Row(verticalAlignment = Alignment.Bottom) {
                Text(
                    value,
                    style = TextStyle(
                        fontSize = 20.sp,
                        fontWeight = FontWeight.Bold,
                        color = ColorProvider(valueColor)
                    )
                )
                if (unit.isNotEmpty()) {
                    Spacer(modifier = GlanceModifier.width(3.dp))
                    Text(
                        unit,
                        style = TextStyle(
                            fontSize = 9.sp,
                            color = ColorProvider(TxtSec)
                        )
                    )
                }
            }
            Text(
                goal,
                style = TextStyle(
                    fontSize = 9.sp,
                    color = ColorProvider(TxtSec)
                )
            )
            Spacer(modifier = GlanceModifier.height(5.dp))
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
                        color = ColorProvider(pctColor)
                    )
                )
            }
        }
    }

    @Composable
    private fun VerticalDivider() {
        Box(
            modifier = GlanceModifier
                .width(1.dp)
                .height(60.dp)
                .background(Color(0xFF2A2A2A))
        ) {}
    }

    private fun pct(value: Int, goal: Int) =
        if (goal > 0) (value * 100 / goal).coerceIn(0, 100) else 0

    private fun fmt(n: Int): String =
        if (n >= 1000) "${n / 1000},${"%03d".format(n % 1000)}" else "$n"
}
