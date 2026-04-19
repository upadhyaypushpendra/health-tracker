import { format, subDays } from "date-fns";
import { db, getSettings } from "../db";

// ── Module-level cache ────────────────────────────────────────────────────────
const TTL_MS = 5 * 60 * 1000 // 5 minutes

let healthContextCache: { value: string; expiresAt: number } | null = null
let exerciseContextCache: { value: string; expiresAt: number } | null = null

/** Call this whenever data that feeds buildHealthContext changes (e.g. after logging a meal). */
export function invalidateHealthContext() {
  healthContextCache = null
}

export async function buildHealthContext(): Promise<string> {
  if (healthContextCache && Date.now() < healthContextCache.expiresAt) {
    return healthContextCache.value
  }

  const today = format(new Date(), "yyyy-MM-dd");
  const sevenDaysAgo = format(subDays(new Date(), 7), "yyyy-MM-dd");

  const [settings, recentWorkouts, recentMeals, recentWater, recentMetrics] =
    await Promise.all([
      getSettings(),
      db.workoutLogs
        .where("date")
        .between(sevenDaysAgo, today, true, true)
        .toArray(),
      db.mealLogs
        .where("date")
        .between(sevenDaysAgo, today, true, true)
        .toArray(),
      db.waterLogs
        .where("date")
        .between(sevenDaysAgo, today, true, true)
        .toArray(),
      db.bodyMetrics.orderBy("date").reverse().limit(5).toArray(),
    ]);

  const activePlan = settings.activePlanId
    ? await db.plans.get(settings.activePlanId)
    : null;

  const lines: string[] = [
    `=== BodySync Health Data ===`,
    `Today: ${today}`,
    ``,
    `User Profile:`,
    `  Name: ${settings.name || "User"}`,
    `  Calorie goal: ${settings.calorieGoal} kcal/day`,
    `  Water goal: ${settings.waterGoal} ml/day`,
    `  Weight unit: ${settings.weightUnit}`,
    ``,
  ];

  if (activePlan) {
    lines.push(`Active Plan: ${activePlan.name}`);
    if (activePlan.description) lines.push(`  ${activePlan.description}`);
    lines.push(
      `  Calorie target: ${activePlan.calorieTarget ?? settings.calorieGoal} kcal`
    );
    lines.push(
      `  Water target: ${activePlan.waterTarget ?? settings.waterGoal} ml`
    );
    lines.push("");
  }

  if (recentMetrics.length > 0) {
    lines.push("Recent Body Metrics:");
    recentMetrics.forEach((m) => {
      const parts = [`  ${m.date}: ${m.weight}${settings.weightUnit}`];
      if (m.bodyFat) parts.push(`body fat ${m.bodyFat}%`);
      if (m.bmi) parts.push(`BMI ${m.bmi}`);
      lines.push(parts.join(", "));
    });
    lines.push("");
  }

  if (recentWorkouts.length > 0) {
    lines.push("Workouts (last 7 days):");
    const byDate: Record<string, typeof recentWorkouts> = {};
    recentWorkouts.forEach((w) => {
      (byDate[w.date] ??= []).push(w);
    });
    Object.entries(byDate).forEach(([date, logs]) => {
      const completed = logs.filter((l) => l.completed).length;
      lines.push(
        `  ${date}: ${logs.length} session(s), ${completed} completed`
      );
    });
    lines.push("");
  }

  if (recentMeals.length > 0) {
    lines.push("Nutrition (last 7 days):");
    const byDate: Record<
      string,
      { cal: number; p: number; c: number; f: number }
    > = {};
    recentMeals.forEach((m) => {
      const d = (byDate[m.date] ??= { cal: 0, p: 0, c: 0, f: 0 });
      d.cal += m.calories ?? 0;
      d.p += m.protein ?? 0;
      d.c += m.carbs ?? 0;
      d.f += m.fat ?? 0;
    });
    Object.entries(byDate).forEach(([date, t]) => {
      lines.push(
        `  ${date}: ${t.cal} kcal | P:${t.p}g C:${t.c}g F:${t.f}g`
      );
    });
    lines.push("");
  }

  if (recentWater.length > 0) {
    lines.push("Water intake (last 7 days):");
    const byDate: Record<string, number> = {};
    recentWater.forEach((w) => {
      const total = w.entries?.reduce((sum, e) => sum + e.amount, 0) ?? 0;
      byDate[w.date] = (byDate[w.date] ?? 0) + total;
    });
    Object.entries(byDate).forEach(([date, ml]) => {
      lines.push(`  ${date}: ${ml} ml`);
    });
    lines.push("");
  }

  const result = lines.join("\n");
  healthContextCache = { value: result, expiresAt: Date.now() + TTL_MS }
  return result
}

export const SYSTEM_PROMPT = `You are an AI health and fitness coach built into BodySync, a personal health tracking app. You have full access to the user's real health data shown above.

Your capabilities:
- Analyze workout consistency, nutrition trends, and hydration patterns
- Generate personalized weekly workout and meal plans
- Identify gaps between goals and actual performance
- Give specific, data-driven advice

Guidelines:
- Be concise and actionable — use bullet points and clear structure
- Reference specific numbers from the user's data when relevant
- When generating plans, use a clear Day 1 / Day 2 format
- Be encouraging but honest about areas that need improvement
- Keep responses focused — don't pad with generic fitness advice
- Keep response less than 8192 characters to fit within token limits
`;

export async function buildExerciseContext(): Promise<string> {
  if (exerciseContextCache && Date.now() < exerciseContextCache.expiresAt) {
    return exerciseContextCache.value
  }
  const exercises = await db.exercises.toArray();
  const result = exercises
    .map((e) => `${e.id}|${e.name}`)
    .join("\n");
  exerciseContextCache = { value: result, expiresAt: Date.now() + TTL_MS }
  return result
}

export async function buildPlanContext(): Promise<string> {
  const [settings] = await Promise.all([getSettings()]);
  const activePlan = settings.activePlanId
    ? await db.plans.get(settings.activePlanId)
    : null;

  const lines = [
    `Calorie goal:${settings.calorieGoal}kcal Water goal:${settings.waterGoal}ml Unit:${settings.weightUnit}`,
  ];
  if (activePlan) {
    lines.push(`Active plan:${activePlan.name} Cal:${activePlan.calorieTarget ?? settings.calorieGoal} Water:${activePlan.waterTarget ?? settings.waterGoal}`);
  }
  return lines.join("\n");
}

export const PLAN_SYSTEM_PROMPT = `You are a fitness plan creator for BodySync app.
Generate a personalized weekly workout plan based on the user's request and fitness data.

Return ONLY a raw stringified JSON — no markdown, no code blocks, no explanation, no tabs, no new lines.

Required JSON structure:
{
  "name": "descriptive plan name",
  "description": "1-2 sentence summary",
  "weekTemplate": [ ...exactly 7 DayPlan objects, dayOfWeek 0=Sunday to 6=Saturday... ],
  "calorieTarget": number,
  "waterTarget": number
}

DayPlan shape:
{
  "dayOfWeek": 0-6,
  "isRest": boolean,
  "label": "e.g. Push Day / Rest / Cardio",
  "exercises": []
}

PlannedExercise shape (only for non-rest days):
{
  "exerciseId": "exact ID from the exercise list provided",
  "name": "exact name from the exercise list",
  "sets": number,
  "reps": number,
  "weight": number,
  "unit": "kg" | "lbs" | "bodyweight" | "minutes" | "meters",
  "restSeconds": number
}

Rules:
- weekTemplate must have exactly 7 entries (dayOfWeek 0 through 6)
- Rest days: isRest=true, exercises=[]
- Use "bodyweight" unit and weight=0 for bodyweight exercises
- waterTarget is in ml (e.g. 3000 for 3L)
- Use exercise IDs exactly as given in the exercise list`;

