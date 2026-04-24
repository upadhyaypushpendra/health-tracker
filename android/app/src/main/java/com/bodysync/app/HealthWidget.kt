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
import androidx.glance.appwidget.action.actionStartActivity
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

class HealthWidget : GlanceAppWidget() {
    override suspend fun provideGlance(context: Context, id: GlanceId) {
        val prefs = context.getSharedPreferences("com.bodysync.app.health", Context.MODE_PRIVATE)

        val waterToday = prefs.getInt("bodysync_water_today", 0)
        val waterGoal = prefs.getInt("bodysync_water_goal", 3000)
        val mealCount = prefs.getInt("bodysync_meals_today", 0)
        val calories = prefs.getInt("bodysync_calories_today", 0)
        val calorieGoal = prefs.getInt("bodysync_calorie_goal", 2000)
        val workoutExists = prefs.getBoolean("bodysync_workout_today", false)
        val workoutCompleted = prefs.getBoolean("bodysync_workout_completed", false)
        val steps = prefs.getInt("bodysync_steps_today", 0)
        val stepGoal = prefs.getInt("bodysync_step_goal", 10000)

        provideContent {
            WidgetContent(
                context = context,
                waterToday = waterToday,
                waterGoal = waterGoal,
                mealCount = mealCount,
                calories = calories,
                calorieGoal = calorieGoal,
                workoutExists = workoutExists,
                workoutCompleted = workoutCompleted,
                steps = steps,
                stepGoal = stepGoal
            )
        }
    }

    @Composable
    private fun WidgetContent(
        context: Context,
        waterToday: Int,
        waterGoal: Int,
        mealCount: Int,
        calories: Int,
        calorieGoal: Int,
        workoutExists: Boolean,
        workoutCompleted: Boolean,
        steps: Int,
        stepGoal: Int
    ) {
        val waterPct = if (waterGoal > 0) (waterToday * 100 / waterGoal).coerceAtMost(100) else 0
        val caloriePct = if (calorieGoal > 0) (calories * 100 / calorieGoal).coerceAtMost(100) else 0
        val stepPct = if (stepGoal > 0) (steps * 100 / stepGoal).coerceAtMost(100) else 0

        val logWaterIntent = Intent(context, MainActivity::class.java).apply {
            action = "com.bodysync.app.LOG_WATER"
            putExtra("amount", 250)
            flags = Intent.FLAG_ACTIVITY_NEW_TASK or Intent.FLAG_ACTIVITY_SINGLE_TOP
        }

        val workoutLabel = when {
            workoutCompleted -> "Done ✓"
            workoutExists -> "Planned"
            else -> "—"
        }
        val workoutColor = when {
            workoutCompleted -> Color(0xFF16A34A)
            workoutExists -> Color(0xFFF59E0B)
            else -> Color(0xFF9CA3AF)
        }

        Column(
            modifier = GlanceModifier
                .fillMaxSize()
                .background(Color(0xFFFAFAFA))
                .padding(12.dp)
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
                        color = ColorProvider(Color(0xFF111827))
                    )
                )
                Spacer(modifier = GlanceModifier.defaultWeight())
                Box(
                    modifier = GlanceModifier
                        .background(Color(0xFFEFF6FF))
                        .padding(horizontal = 5.dp, vertical = 2.dp),
                    contentAlignment = Alignment.Center
                ) {
                    Text(
                        "Today",
                        style = TextStyle(
                            fontSize = 8.sp,
                            fontWeight = FontWeight.Medium,
                            color = ColorProvider(Color(0xFF2563EB))
                        )
                    )
                }
            }

            Spacer(modifier = GlanceModifier.height(8.dp))

            // Top row: Water | Steps
            Row(modifier = GlanceModifier.fillMaxWidth()) {
                MetricCard(
                    modifier = GlanceModifier.defaultWeight(),
                    label = "WATER",
                    value = formatNum(waterToday),
                    sub = "/ $waterGoal ml",
                    pct = "$waterPct%",
                    valueColor = Color(0xFF2563EB),
                    badgeBg = Color(0xFFEFF6FF),
                    badgeFg = Color(0xFF2563EB)
                )
                Spacer(modifier = GlanceModifier.width(6.dp))
                MetricCard(
                    modifier = GlanceModifier.defaultWeight(),
                    label = "STEPS",
                    value = formatNum(steps),
                    sub = "/ ${formatNum(stepGoal)}",
                    pct = "$stepPct%",
                    valueColor = Color(0xFF7C3AED),
                    badgeBg = Color(0xFFF5F3FF),
                    badgeFg = Color(0xFF7C3AED)
                )
            }

            Spacer(modifier = GlanceModifier.height(6.dp))

            // Bottom row: Meals | Workout
            Row(modifier = GlanceModifier.fillMaxWidth()) {
                MetricCard(
                    modifier = GlanceModifier.defaultWeight(),
                    label = "MEALS",
                    value = "$mealCount",
                    sub = "$calories / $calorieGoal kcal",
                    pct = "$caloriePct%",
                    valueColor = Color(0xFFEA580C),
                    badgeBg = Color(0xFFFFF7ED),
                    badgeFg = Color(0xFFEA580C)
                )
                Spacer(modifier = GlanceModifier.width(6.dp))
                WorkoutCard(
                    modifier = GlanceModifier.defaultWeight(),
                    label = workoutLabel,
                    color = workoutColor
                )
            }

            Spacer(modifier = GlanceModifier.defaultWeight())

            // Log Water button
            Box(
                modifier = GlanceModifier
                    .fillMaxWidth()
                    .background(Color(0xFF2563EB))
                    .padding(vertical = 7.dp)
                    .clickable(actionStartActivity(logWaterIntent)),
                contentAlignment = Alignment.Center
            ) {
                Text(
                    "+ Log 250ml Water",
                    style = TextStyle(
                        fontSize = 10.sp,
                        fontWeight = FontWeight.Bold,
                        color = ColorProvider(Color.White)
                    )
                )
            }
        }
    }

    @Composable
    private fun MetricCard(
        modifier: GlanceModifier,
        label: String,
        value: String,
        sub: String,
        pct: String,
        valueColor: Color,
        badgeBg: Color,
        badgeFg: Color
    ) {
        Column(
            modifier = modifier
                .background(Color.White)
                .padding(8.dp)
        ) {
            Text(
                label,
                style = TextStyle(
                    fontSize = 8.sp,
                    fontWeight = FontWeight.Medium,
                    color = ColorProvider(Color(0xFF9CA3AF))
                )
            )
            Spacer(modifier = GlanceModifier.height(2.dp))
            Text(
                value,
                style = TextStyle(
                    fontSize = 18.sp,
                    fontWeight = FontWeight.Bold,
                    color = ColorProvider(valueColor)
                )
            )
            Text(
                sub,
                style = TextStyle(
                    fontSize = 9.sp,
                    color = ColorProvider(Color(0xFF6B7280))
                )
            )
            Spacer(modifier = GlanceModifier.height(4.dp))
            Box(
                modifier = GlanceModifier
                    .background(badgeBg)
                    .padding(horizontal = 5.dp, vertical = 2.dp),
                contentAlignment = Alignment.Center
            ) {
                Text(
                    pct,
                    style = TextStyle(
                        fontSize = 9.sp,
                        fontWeight = FontWeight.Bold,
                        color = ColorProvider(badgeFg)
                    )
                )
            }
        }
    }

    @Composable
    private fun WorkoutCard(
        modifier: GlanceModifier,
        label: String,
        color: Color
    ) {
        Column(
            modifier = modifier
                .background(Color.White)
                .padding(8.dp)
        ) {
            Text(
                "WORKOUT",
                style = TextStyle(
                    fontSize = 8.sp,
                    fontWeight = FontWeight.Medium,
                    color = ColorProvider(Color(0xFF9CA3AF))
                )
            )
            Spacer(modifier = GlanceModifier.height(2.dp))
            Text(
                label,
                style = TextStyle(
                    fontSize = 16.sp,
                    fontWeight = FontWeight.Bold,
                    color = ColorProvider(color)
                )
            )
        }
    }

    private fun formatNum(n: Int): String =
        if (n >= 1000) "${n / 1000},${"%03d".format(n % 1000)}" else "$n"
}
