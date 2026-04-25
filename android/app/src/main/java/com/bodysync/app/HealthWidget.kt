package com.bodysync.app

import android.content.Context
import android.content.Intent
import androidx.compose.runtime.Composable
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.glance.GlanceId
import androidx.glance.GlanceModifier
import androidx.glance.Image
import androidx.glance.ImageProvider
import androidx.glance.action.ActionParameters
import androidx.glance.action.actionParametersOf
import androidx.glance.action.clickable
import androidx.glance.appwidget.GlanceAppWidget
import androidx.glance.appwidget.action.ActionCallback
import androidx.glance.appwidget.action.actionRunCallback
import androidx.glance.appwidget.cornerRadius
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
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.withContext

private val BgMain  = Color(0xFF0D0D0D)
private val TxtPri  = Color(0xFFFFFFFF)
private val Divider = Color(0xFF2A2A2A)

private val ColWater = Color(0xFF3B82F6)
private val ColSteps = Color(0xFF8B5CF6)
private val ColMeals = Color(0xFFF97316)

class OpenAppCallback : ActionCallback {
    companion object {
        val ActionKey = ActionParameters.Key<String>("widget_action")
        const val ACTION_LOG_WATER = "log_water"
    }

    override suspend fun onAction(
        context: Context,
        glanceId: GlanceId,
        parameters: ActionParameters
    ) {
        val action = parameters[ActionKey] ?: return

        if (action == ACTION_LOG_WATER) {
            withContext(Dispatchers.IO) {
                val dao = HealthDatabase.getInstance(context).dailyStatsDao()
                val today = HealthDatabase.todayString()
                val existing = dao.getByDate(today) ?: DailyStats(date = today)
                dao.upsert(existing.copy(
                    waterMl = existing.waterMl + 250,
                    pendingWaterMl = existing.pendingWaterMl + 250,
                ))
            }
            HealthWidget().updateAll(context)
            return
        }

        // All other actions open the app
        context.getSharedPreferences("com.bodysync.app.health", Context.MODE_PRIVATE)
            .edit()
            .putString("bodysync_widget_action", action)
            .apply()
        context.startActivity(
            Intent(context, MainActivity::class.java).apply {
                flags = Intent.FLAG_ACTIVITY_NEW_TASK or Intent.FLAG_ACTIVITY_SINGLE_TOP
            }
        )
    }
}

class HealthWidget : GlanceAppWidget() {

    override suspend fun provideGlance(context: Context, id: GlanceId) {
        val today = HealthDatabase.todayString()
        val stats = withContext(Dispatchers.IO) {
            HealthDatabase.getInstance(context).dailyStatsDao().getByDate(today)
        } ?: DailyStats(date = today)

        provideContent {
            Content(
                waterToday    = stats.waterMl,
                waterGoal     = stats.waterGoalMl,
                calories      = stats.caloriesKcal,
                calorieGoal   = stats.calorieGoal,
                workoutExists = stats.workoutExists,
                workoutDone   = stats.workoutCompleted,
                steps         = stats.stepsToday,
                stepGoal      = stats.stepGoal,
            )
        }
    }

    @Composable
    private fun Content(
        waterToday: Int, waterGoal: Int,
        calories: Int, calorieGoal: Int,
        workoutExists: Boolean, workoutDone: Boolean,
        steps: Int, stepGoal: Int
    ) {
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
                .cornerRadius(12.dp)
                .padding(8.dp)
        ) {
            // Header
            Row(
                modifier = GlanceModifier.fillMaxWidth(),
                verticalAlignment = Alignment.CenterVertically
            ) {
                Text(
                    "Body Sync",
                    style = TextStyle(
                        fontSize = 13.sp,
                        fontWeight = FontWeight.Bold,
                        color = ColorProvider(TxtPri)
                    )
                )
                Spacer(modifier = GlanceModifier.defaultWeight())
                Box(
                    modifier = GlanceModifier
                        .background(Color(0xFF1E3A5F))
                        .padding(horizontal = 6.dp, vertical = 2.dp)
                        .cornerRadius(4.dp),
                    contentAlignment = Alignment.Center
                ) {
                    Text(
                        "Today",
                        style = TextStyle(
                            fontSize = 10.sp,
                            fontWeight = FontWeight.Medium,
                            color = ColorProvider(ColWater),
                        )
                    )
                }
            }

            Spacer(modifier = GlanceModifier.height(8.dp))

            // Sections
            Column(modifier = GlanceModifier.fillMaxWidth()) {
                Row(
                    modifier = GlanceModifier.fillMaxWidth(),
                    verticalAlignment = Alignment.CenterVertically
                ) {
                    Section(
                        modifier = GlanceModifier.defaultWeight(),
                        iconRes  = R.drawable.ic_water,
                        label    = "${fmt(waterToday)}/${fmt(waterGoal)} ml",
                        color    = ColWater
                    )
                    VSeparator()
                    Section(
                        modifier = GlanceModifier.defaultWeight(),
                        iconRes  = R.drawable.ic_steps,
                        label    = "${fmt(steps)}/${fmt(stepGoal)}",
                        color    = ColSteps
                    )
                }
                HSeparator()
                Row(
                    modifier = GlanceModifier.fillMaxWidth(),
                    verticalAlignment = Alignment.CenterVertically
                ) {
                    Section(
                        modifier = GlanceModifier.defaultWeight(),
                        iconRes  = R.drawable.ic_meals,
                        label    = "${fmt(calories)}/${fmt(calorieGoal)} kcal",
                        color    = ColMeals
                    )
                    VSeparator()
                    Section(
                        modifier = GlanceModifier.defaultWeight(),
                        iconRes  = R.drawable.ic_workout,
                        label    = workoutLabel,
                        color    = workoutColor
                    )
                }
            }

            Spacer(modifier = GlanceModifier.height(8.dp))

            // Buttons
            Row(
                modifier = GlanceModifier.fillMaxWidth(),
                verticalAlignment = Alignment.CenterVertically
            ) {
                Box(
                    modifier = GlanceModifier
                        .defaultWeight()
                        .background(ColWater)
                        .cornerRadius(8.dp)
                        .padding(vertical = 8.dp)
                        .clickable(actionRunCallback<OpenAppCallback>(
                            actionParametersOf(OpenAppCallback.ActionKey to OpenAppCallback.ACTION_LOG_WATER)
                        )),
                    contentAlignment = Alignment.Center
                ) {
                    Text(
                        "Log Water",
                        style = TextStyle(
                            fontSize = 13.sp,
                            fontWeight = FontWeight.Bold,
                            color = ColorProvider(TxtPri)
                        )
                    )
                }
                Spacer(modifier = GlanceModifier.width(6.dp))
                Box(
                    modifier = GlanceModifier
                        .defaultWeight()
                        .background(ColMeals)
                        .cornerRadius(8.dp)
                        .padding(vertical = 8.dp)
                        .clickable(actionRunCallback<OpenAppCallback>(
                            actionParametersOf(OpenAppCallback.ActionKey to "nutrition_log_meal")
                        )),
                    contentAlignment = Alignment.Center
                ) {
                    Text(
                        "Log Meal",
                        style = TextStyle(
                            fontSize = 13.sp,
                            fontWeight = FontWeight.Bold,
                            color = ColorProvider(TxtPri)
                        )
                    )
                }
            }
        }
    }

    @Composable
    private fun Section(
        modifier: GlanceModifier,
        iconRes: Int,
        label: String,
        color: Color
    ) {
        Row(
            modifier = modifier.padding(horizontal = 4.dp, vertical = 8.dp),
            verticalAlignment = Alignment.CenterVertically
        ) {
            Image(
                provider = ImageProvider(iconRes),
                contentDescription = null,
                modifier = GlanceModifier.width(20.dp).height(20.dp)
            )
            Spacer(modifier = GlanceModifier.width(6.dp))
            Text(
                label,
                style = TextStyle(
                    fontSize = 12.sp,
                    fontWeight = FontWeight.Medium,
                    color = ColorProvider(color)
                )
            )
        }
    }

    @Composable
    private fun VSeparator() {
        Box(
            modifier = GlanceModifier
                .width(1.dp)
                .height(42.dp)
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
