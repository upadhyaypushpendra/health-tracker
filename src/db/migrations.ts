import { db } from './index'

// ─── Runner ───────────────────────────────────────────────────────────────────

export async function runMigrations(): Promise<void> {
  for (const migration of MIGRATIONS) {
    const already = await db.migrations.get(migration.id)
    if (already) continue
    await migration.run()
    await db.migrations.put({ id: migration.id, appliedAt: new Date().toISOString() })
  }
}

// ─── Migration list (append-only, never edit existing entries) ────────────────

const MIGRATIONS: { id: string; run: () => Promise<void> }[] = [
  {
    id: 'v3_goals_restructure',
    run: async () => {
      // Migrate UserSettings: remove calorieGoal + goalWeight, add currentWeight
      const settings = await db.settings.get('user')
      if (settings) {
        const raw = settings as any
        await db.settings.put({
          ...settings,
          currentWeight: raw.goalWeight ?? null, // best available starting weight
          // strip removed fields
          calorieGoal: undefined,
          goalWeight: undefined,
        } as any)
      }

      // Migrate Plans: calorieTarget → calorieGoal, remove waterTarget, add proteinGoal/carbsGoal/weightGoal
      const plans = await db.plans.toArray()
      for (const plan of plans) {
        const raw = plan as any
        await db.plans.put({
          ...plan,
          calorieGoal: raw.calorieTarget ?? 2000,
          proteinGoal: 150,
          carbsGoal: 200,
          weightGoal: null,
          // strip removed fields
          calorieTarget: undefined,
          waterTarget: undefined,
        } as any)
      }
    },
  },
]
