import { v4 as uuid } from 'uuid'
import { db } from './index'
import type { Exercise, Plan, PlannedExercise, DayPlan } from './types'

const LIBRARY: Omit<Exercise, 'id'>[] = [
  // ── Chest ─────────────────────────────────────────────────────────────────
  { name: 'Bench Press', muscleGroup: 'chest', defaultSets: 4, defaultReps: 8, defaultWeight: 60, unit: 'kg', isCustom: false },
  { name: 'Incline Bench Press', muscleGroup: 'chest', defaultSets: 3, defaultReps: 10, defaultWeight: 50, unit: 'kg', isCustom: false },
  { name: 'Dumbbell Flyes', muscleGroup: 'chest', defaultSets: 3, defaultReps: 12, defaultWeight: 15, unit: 'kg', isCustom: false },
  { name: 'Push-Ups', muscleGroup: 'chest', defaultSets: 3, defaultReps: 15, defaultWeight: 0, unit: 'bodyweight', isCustom: false },
  { name: 'Cable Crossover', muscleGroup: 'chest', defaultSets: 3, defaultReps: 12, defaultWeight: 15, unit: 'kg', isCustom: false },
  { name: 'Chest Dips', muscleGroup: 'chest', defaultSets: 3, defaultReps: 10, defaultWeight: 0, unit: 'bodyweight', isCustom: false },

  // ── Back ──────────────────────────────────────────────────────────────────
  { name: 'Deadlift', muscleGroup: 'back', defaultSets: 4, defaultReps: 5, defaultWeight: 80, unit: 'kg', isCustom: false },
  { name: 'Pull-Ups', muscleGroup: 'back', defaultSets: 4, defaultReps: 8, defaultWeight: 0, unit: 'bodyweight', isCustom: false },
  { name: 'Barbell Row', muscleGroup: 'back', defaultSets: 4, defaultReps: 8, defaultWeight: 60, unit: 'kg', isCustom: false },
  { name: 'Dumbbell Row', muscleGroup: 'back', defaultSets: 3, defaultReps: 12, defaultWeight: 16, unit: 'kg', isCustom: false },
  { name: 'Lat Pulldown', muscleGroup: 'back', defaultSets: 3, defaultReps: 12, defaultWeight: 55, unit: 'kg', isCustom: false },
  { name: 'Seated Cable Row', muscleGroup: 'back', defaultSets: 3, defaultReps: 12, defaultWeight: 50, unit: 'kg', isCustom: false },
  { name: 'Face Pulls', muscleGroup: 'back', defaultSets: 3, defaultReps: 15, defaultWeight: 20, unit: 'kg', isCustom: false },
  { name: 'T-Bar Row', muscleGroup: 'back', defaultSets: 3, defaultReps: 10, defaultWeight: 40, unit: 'kg', isCustom: false },

  // ── Shoulders ─────────────────────────────────────────────────────────────
  { name: 'Overhead Press', muscleGroup: 'shoulders', defaultSets: 4, defaultReps: 8, defaultWeight: 40, unit: 'kg', isCustom: false },
  { name: 'Dumbbell Shoulder Press', muscleGroup: 'shoulders', defaultSets: 3, defaultReps: 10, defaultWeight: 18, unit: 'kg', isCustom: false },
  { name: 'Lateral Raises', muscleGroup: 'shoulders', defaultSets: 3, defaultReps: 15, defaultWeight: 8, unit: 'kg', isCustom: false },
  { name: 'Front Raises', muscleGroup: 'shoulders', defaultSets: 3, defaultReps: 12, defaultWeight: 8, unit: 'kg', isCustom: false },
  { name: 'Arnold Press', muscleGroup: 'shoulders', defaultSets: 3, defaultReps: 10, defaultWeight: 15, unit: 'kg', isCustom: false },
  { name: 'Upright Row', muscleGroup: 'shoulders', defaultSets: 3, defaultReps: 12, defaultWeight: 30, unit: 'kg', isCustom: false },

  // ── Arms ──────────────────────────────────────────────────────────────────
  { name: 'Barbell Curl', muscleGroup: 'arms', defaultSets: 3, defaultReps: 12, defaultWeight: 25, unit: 'kg', isCustom: false },
  { name: 'Dumbbell Curl', muscleGroup: 'arms', defaultSets: 3, defaultReps: 12, defaultWeight: 12, unit: 'kg', isCustom: false },
  { name: 'Hammer Curl', muscleGroup: 'arms', defaultSets: 3, defaultReps: 12, defaultWeight: 12, unit: 'kg', isCustom: false },
  { name: 'Tricep Pushdown', muscleGroup: 'arms', defaultSets: 3, defaultReps: 15, defaultWeight: 25, unit: 'kg', isCustom: false },
  { name: 'Skull Crushers', muscleGroup: 'arms', defaultSets: 3, defaultReps: 12, defaultWeight: 25, unit: 'kg', isCustom: false },
  { name: 'Overhead Tricep Extension', muscleGroup: 'arms', defaultSets: 3, defaultReps: 12, defaultWeight: 20, unit: 'kg', isCustom: false },
  { name: 'Close-Grip Bench Press', muscleGroup: 'arms', defaultSets: 3, defaultReps: 10, defaultWeight: 45, unit: 'kg', isCustom: false },
  { name: 'Preacher Curl', muscleGroup: 'arms', defaultSets: 3, defaultReps: 12, defaultWeight: 20, unit: 'kg', isCustom: false },

  // ── Legs ──────────────────────────────────────────────────────────────────
  { name: 'Squat', muscleGroup: 'legs', defaultSets: 4, defaultReps: 8, defaultWeight: 80, unit: 'kg', isCustom: false },
  { name: 'Romanian Deadlift', muscleGroup: 'legs', defaultSets: 3, defaultReps: 10, defaultWeight: 60, unit: 'kg', isCustom: false },
  { name: 'Leg Press', muscleGroup: 'legs', defaultSets: 4, defaultReps: 12, defaultWeight: 120, unit: 'kg', isCustom: false },
  { name: 'Leg Extension', muscleGroup: 'legs', defaultSets: 3, defaultReps: 15, defaultWeight: 40, unit: 'kg', isCustom: false },
  { name: 'Leg Curl', muscleGroup: 'legs', defaultSets: 3, defaultReps: 12, defaultWeight: 30, unit: 'kg', isCustom: false },
  { name: 'Lunges', muscleGroup: 'legs', defaultSets: 3, defaultReps: 12, defaultWeight: 20, unit: 'kg', isCustom: false },
  { name: 'Bulgarian Split Squat', muscleGroup: 'legs', defaultSets: 3, defaultReps: 10, defaultWeight: 20, unit: 'kg', isCustom: false },
  { name: 'Calf Raises', muscleGroup: 'legs', defaultSets: 4, defaultReps: 15, defaultWeight: 0, unit: 'bodyweight', isCustom: false },
  { name: 'Goblet Squat', muscleGroup: 'legs', defaultSets: 3, defaultReps: 12, defaultWeight: 24, unit: 'kg', isCustom: false },

  // ── Core ──────────────────────────────────────────────────────────────────
  { name: 'Plank', muscleGroup: 'core', defaultSets: 3, defaultReps: 1, defaultWeight: 1, unit: 'minutes', isCustom: false },
  { name: 'Crunches', muscleGroup: 'core', defaultSets: 3, defaultReps: 20, defaultWeight: 0, unit: 'bodyweight', isCustom: false },
  { name: 'Russian Twists', muscleGroup: 'core', defaultSets: 3, defaultReps: 20, defaultWeight: 0, unit: 'bodyweight', isCustom: false },
  { name: 'Leg Raises', muscleGroup: 'core', defaultSets: 3, defaultReps: 15, defaultWeight: 0, unit: 'bodyweight', isCustom: false },
  { name: 'Ab Wheel Rollout', muscleGroup: 'core', defaultSets: 3, defaultReps: 10, defaultWeight: 0, unit: 'bodyweight', isCustom: false },
  { name: 'Cable Crunch', muscleGroup: 'core', defaultSets: 3, defaultReps: 15, defaultWeight: 30, unit: 'kg', isCustom: false },

  // ── Cardio ────────────────────────────────────────────────────────────────
  { name: 'Running', muscleGroup: 'cardio', defaultSets: 1, defaultReps: 1, defaultWeight: 30, unit: 'minutes', isCustom: false },
  { name: 'Cycling', muscleGroup: 'cardio', defaultSets: 1, defaultReps: 1, defaultWeight: 30, unit: 'minutes', isCustom: false },
  { name: 'Jump Rope', muscleGroup: 'cardio', defaultSets: 3, defaultReps: 1, defaultWeight: 5, unit: 'minutes', isCustom: false },
  { name: 'Rowing Machine', muscleGroup: 'cardio', defaultSets: 1, defaultReps: 1, defaultWeight: 20, unit: 'minutes', isCustom: false },
  { name: 'Burpees', muscleGroup: 'cardio', defaultSets: 3, defaultReps: 15, defaultWeight: 0, unit: 'bodyweight', isCustom: false },
  { name: 'HIIT Intervals', muscleGroup: 'cardio', defaultSets: 8, defaultReps: 1, defaultWeight: 1, unit: 'minutes', isCustom: false },

  // ── Full Body ─────────────────────────────────────────────────────────────
  { name: 'Clean and Press', muscleGroup: 'full_body', defaultSets: 4, defaultReps: 5, defaultWeight: 40, unit: 'kg', isCustom: false },
  { name: 'Turkish Get-Up', muscleGroup: 'full_body', defaultSets: 3, defaultReps: 5, defaultWeight: 12, unit: 'kg', isCustom: false },
  { name: 'Kettlebell Swing', muscleGroup: 'full_body', defaultSets: 4, defaultReps: 15, defaultWeight: 16, unit: 'kg', isCustom: false },
  { name: 'Thruster', muscleGroup: 'full_body', defaultSets: 4, defaultReps: 8, defaultWeight: 30, unit: 'kg', isCustom: false },
]

export async function seedExerciseLibrary(): Promise<void> {
  const exercises = LIBRARY.map((e) => ({ ...e, id: uuid() }))
  await db.exercises.bulkPut(exercises)
}

// ─── Sample Plans ────────────────────────────────────────────────────────────

export async function seedSamplePlans(): Promise<void> {
  /** Look up exercise IDs by name from the seeded library */
  const ex = await db.exercises.toArray()
  const byName = Object.fromEntries(ex.map((e) => [e.name, e.id]))

  function pe(
    name: string,
    sets: number,
    reps: number,
    weight: number,
    unit: Exercise['unit'],
    restSeconds = 90,
  ): PlannedExercise {
    return { exerciseId: byName[name] ?? uuid(), name, sets, reps, weight, unit, restSeconds }
  }

  function rest(day: 0 | 1 | 2 | 3 | 4 | 5 | 6, label = 'Rest'): DayPlan {
    return { dayOfWeek: day, isRest: true, label, exercises: [] }
  }

  const now = new Date().toISOString()

  const plans: Plan[] = [
    // ── 1. Strength Beginner ──────────────────────────────────────────────
    {
      id: uuid(), name: '5-Day Strength — Beginner',
      description: 'Classic push/pull/legs split for beginners. Focus on form over weight.',
      calorieGoal: 2200, proteinGoal: 160, carbsGoal: 250, weightGoal: null,
      isActive: false, createdAt: now, updatedAt: now,
      weekTemplate: [
        rest(0),
        { dayOfWeek: 1, isRest: false, label: 'Chest & Triceps', exercises: [
          pe('Bench Press', 3, 10, 40, 'kg'), pe('Incline Bench Press', 3, 10, 30, 'kg'),
          pe('Push-Ups', 2, 15, 0, 'bodyweight'), pe('Tricep Pushdown', 3, 12, 15, 'kg'),
          pe('Overhead Tricep Extension', 2, 12, 10, 'kg'),
        ]},
        { dayOfWeek: 2, isRest: false, label: 'Back & Biceps', exercises: [
          pe('Lat Pulldown', 3, 12, 40, 'kg'), pe('Seated Cable Row', 3, 12, 35, 'kg'),
          pe('Face Pulls', 3, 15, 12, 'kg'), pe('Dumbbell Curl', 3, 12, 8, 'kg'),
          pe('Hammer Curl', 2, 12, 8, 'kg'),
        ]},
        { dayOfWeek: 3, isRest: false, label: 'Legs', exercises: [
          pe('Squat', 3, 10, 50, 'kg'), pe('Leg Press', 3, 12, 80, 'kg'),
          pe('Leg Extension', 3, 15, 25, 'kg'), pe('Leg Curl', 3, 12, 20, 'kg'),
          pe('Calf Raises', 3, 20, 0, 'bodyweight'),
        ]},
        { dayOfWeek: 4, isRest: false, label: 'Shoulders & Arms', exercises: [
          pe('Dumbbell Shoulder Press', 3, 10, 12, 'kg'), pe('Lateral Raises', 3, 15, 5, 'kg'),
          pe('Front Raises', 2, 12, 5, 'kg'), pe('Barbell Curl', 3, 12, 20, 'kg'),
          pe('Skull Crushers', 3, 12, 15, 'kg'),
        ]},
        { dayOfWeek: 5, isRest: false, label: 'Full Body & Cardio', exercises: [
          pe('Goblet Squat', 3, 12, 16, 'kg'), pe('Barbell Row', 3, 10, 30, 'kg'),
          pe('Dumbbell Flyes', 3, 12, 8, 'kg'), pe('Running', 1, 1, 20, 'minutes', 0),
        ]},
        rest(6),
      ],
    },

    // ── 2. Strength Intermediate ──────────────────────────────────────────
    {
      id: uuid(), name: '5-Day Strength — Intermediate',
      description: 'Higher volume push/pull/legs with progressive overload. Assumes 6+ months of training.',
      calorieGoal: 2600, proteinGoal: 190, carbsGoal: 300, weightGoal: null,
      isActive: false, createdAt: now, updatedAt: now,
      weekTemplate: [
        rest(0),
        { dayOfWeek: 1, isRest: false, label: 'Chest & Triceps', exercises: [
          pe('Bench Press', 4, 8, 70, 'kg'), pe('Incline Bench Press', 4, 8, 55, 'kg'),
          pe('Dumbbell Flyes', 3, 12, 16, 'kg'), pe('Cable Crossover', 3, 15, 15, 'kg'),
          pe('Tricep Pushdown', 4, 12, 25, 'kg'), pe('Skull Crushers', 3, 10, 25, 'kg'),
        ]},
        { dayOfWeek: 2, isRest: false, label: 'Back & Biceps', exercises: [
          pe('Deadlift', 4, 5, 100, 'kg', 180), pe('Pull-Ups', 4, 8, 0, 'bodyweight'),
          pe('Barbell Row', 4, 8, 70, 'kg'), pe('T-Bar Row', 3, 10, 40, 'kg'),
          pe('Barbell Curl', 4, 10, 30, 'kg'), pe('Preacher Curl', 3, 12, 20, 'kg'),
        ]},
        { dayOfWeek: 3, isRest: false, label: 'Legs', exercises: [
          pe('Squat', 4, 8, 90, 'kg', 180), pe('Romanian Deadlift', 4, 10, 70, 'kg'),
          pe('Bulgarian Split Squat', 3, 10, 22, 'kg'), pe('Leg Extension', 3, 15, 45, 'kg'),
          pe('Leg Curl', 3, 12, 35, 'kg'), pe('Calf Raises', 4, 20, 0, 'bodyweight'),
        ]},
        { dayOfWeek: 4, isRest: false, label: 'Shoulders & Arms', exercises: [
          pe('Overhead Press', 4, 8, 50, 'kg'), pe('Arnold Press', 3, 10, 18, 'kg'),
          pe('Lateral Raises', 4, 15, 10, 'kg'), pe('Upright Row', 3, 12, 30, 'kg'),
          pe('Barbell Curl', 3, 10, 30, 'kg'), pe('Close-Grip Bench Press', 3, 10, 50, 'kg'),
        ]},
        { dayOfWeek: 5, isRest: false, label: 'Full Body Power', exercises: [
          pe('Clean and Press', 4, 5, 40, 'kg', 180), pe('Thruster', 3, 8, 30, 'kg'),
          pe('Kettlebell Swing', 4, 15, 20, 'kg'), pe('Pull-Ups', 3, 8, 0, 'bodyweight'),
          pe('Goblet Squat', 3, 10, 28, 'kg'),
        ]},
        rest(6),
      ],
    },

    // ── 3. Weight Loss Beginner ───────────────────────────────────────────
    {
      id: uuid(), name: 'Weight Loss — Beginner',
      description: 'Full-body circuits 5 days a week combined with steady-state cardio. Low rest, high rep.',
      calorieGoal: 1700, proteinGoal: 140, carbsGoal: 160, weightGoal: null,
      isActive: false, createdAt: now, updatedAt: now,
      weekTemplate: [
        rest(0),
        { dayOfWeek: 1, isRest: false, label: 'Full Body Circuit A', exercises: [
          pe('Goblet Squat', 3, 15, 12, 'kg', 45), pe('Push-Ups', 3, 15, 0, 'bodyweight', 45),
          pe('Lunges', 3, 12, 0, 'kg', 45), pe('Dumbbell Row', 3, 12, 10, 'kg', 45),
          pe('Burpees', 3, 10, 0, 'bodyweight', 60), pe('Running', 1, 1, 20, 'minutes', 0),
        ]},
        { dayOfWeek: 2, isRest: false, label: 'Cardio + Core', exercises: [
          pe('Jump Rope', 3, 1, 5, 'minutes', 60), pe('Crunches', 3, 20, 0, 'bodyweight', 45),
          pe('Plank', 3, 1, 0.5, 'minutes', 45), pe('Russian Twists', 3, 20, 0, 'bodyweight', 45),
          pe('Running', 1, 1, 25, 'minutes', 0),
        ]},
        { dayOfWeek: 3, isRest: false, label: 'Full Body Circuit B', exercises: [
          pe('Squat', 3, 15, 30, 'kg', 45), pe('Dumbbell Shoulder Press', 3, 12, 8, 'kg', 45),
          pe('Leg Press', 3, 15, 60, 'kg', 45), pe('Lat Pulldown', 3, 12, 30, 'kg', 45),
          pe('Burpees', 3, 10, 0, 'bodyweight', 60), pe('Cycling', 1, 1, 20, 'minutes', 0),
        ]},
        { dayOfWeek: 4, isRest: false, label: 'HIIT + Core', exercises: [
          pe('HIIT Intervals', 6, 1, 1, 'minutes', 60), pe('Leg Raises', 3, 15, 0, 'bodyweight', 45),
          pe('Crunches', 3, 20, 0, 'bodyweight', 45), pe('Plank', 3, 1, 0.5, 'minutes', 45),
          pe('Jump Rope', 3, 1, 3, 'minutes', 60),
        ]},
        { dayOfWeek: 5, isRest: false, label: 'Full Body Circuit C', exercises: [
          pe('Kettlebell Swing', 4, 15, 12, 'kg', 45), pe('Push-Ups', 3, 20, 0, 'bodyweight', 45),
          pe('Goblet Squat', 3, 15, 14, 'kg', 45), pe('Seated Cable Row', 3, 12, 25, 'kg', 45),
          pe('Burpees', 3, 12, 0, 'bodyweight', 60), pe('Running', 1, 1, 20, 'minutes', 0),
        ]},
        rest(6),
      ],
    },

    // ── 4. Weight Loss Intermediate ───────────────────────────────────────
    {
      id: uuid(), name: 'Weight Loss — Intermediate',
      description: 'Compound lifts superset with cardio intervals. Higher intensity to maximise calorie burn.',
      calorieGoal: 1900, proteinGoal: 155, carbsGoal: 180, weightGoal: null,
      isActive: false, createdAt: now, updatedAt: now,
      weekTemplate: [
        rest(0),
        { dayOfWeek: 1, isRest: false, label: 'Upper Body + HIIT', exercises: [
          pe('Bench Press', 4, 10, 55, 'kg', 60), pe('Barbell Row', 4, 10, 55, 'kg', 60),
          pe('Overhead Press', 3, 12, 35, 'kg', 60), pe('Pull-Ups', 3, 8, 0, 'bodyweight', 60),
          pe('HIIT Intervals', 6, 1, 1, 'minutes', 60),
        ]},
        { dayOfWeek: 2, isRest: false, label: 'Lower Body + Cardio', exercises: [
          pe('Squat', 4, 12, 65, 'kg', 75), pe('Romanian Deadlift', 4, 12, 55, 'kg', 75),
          pe('Lunges', 3, 12, 18, 'kg', 60), pe('Leg Curl', 3, 15, 30, 'kg', 60),
          pe('Running', 1, 1, 25, 'minutes', 0),
        ]},
        { dayOfWeek: 3, isRest: false, label: 'HIIT + Core', exercises: [
          pe('Burpees', 4, 15, 0, 'bodyweight', 45), pe('Jump Rope', 4, 1, 5, 'minutes', 60),
          pe('Ab Wheel Rollout', 3, 12, 0, 'bodyweight', 45), pe('Cable Crunch', 3, 15, 25, 'kg', 45),
          pe('Russian Twists', 3, 20, 0, 'bodyweight', 45), pe('Leg Raises', 3, 15, 0, 'bodyweight', 45),
        ]},
        { dayOfWeek: 4, isRest: false, label: 'Full Body Compound', exercises: [
          pe('Deadlift', 4, 6, 80, 'kg', 120), pe('Clean and Press', 3, 6, 35, 'kg', 120),
          pe('Thruster', 3, 10, 25, 'kg', 90), pe('Kettlebell Swing', 4, 20, 18, 'kg', 60),
          pe('Rowing Machine', 1, 1, 15, 'minutes', 0),
        ]},
        { dayOfWeek: 5, isRest: false, label: 'Cardio Endurance', exercises: [
          pe('Running', 1, 1, 40, 'minutes', 0), pe('Jump Rope', 3, 1, 5, 'minutes', 60),
          pe('Cycling', 1, 1, 20, 'minutes', 0),
        ]},
        rest(6),
      ],
    },

    // ── 5. Abs Beginner ───────────────────────────────────────────────────
    {
      id: uuid(), name: 'Abs — Beginner',
      description: '5-day core-focused program using bodyweight exercises. Builds foundational strength.',
      calorieGoal: 2000, proteinGoal: 150, carbsGoal: 220, weightGoal: null,
      isActive: false, createdAt: now, updatedAt: now,
      weekTemplate: [
        rest(0),
        { dayOfWeek: 1, isRest: false, label: 'Core Basics A', exercises: [
          pe('Crunches', 3, 20, 0, 'bodyweight', 45), pe('Plank', 3, 1, 0.5, 'minutes', 45),
          pe('Leg Raises', 3, 12, 0, 'bodyweight', 45), pe('Russian Twists', 3, 20, 0, 'bodyweight', 45),
        ]},
        { dayOfWeek: 2, isRest: false, label: 'Core + Cardio', exercises: [
          pe('Jump Rope', 3, 1, 5, 'minutes', 60), pe('Crunches', 3, 20, 0, 'bodyweight', 45),
          pe('Plank', 3, 1, 0.5, 'minutes', 45), pe('Burpees', 2, 10, 0, 'bodyweight', 60),
        ]},
        { dayOfWeek: 3, isRest: false, label: 'Core Basics B', exercises: [
          pe('Leg Raises', 4, 15, 0, 'bodyweight', 45), pe('Russian Twists', 3, 20, 0, 'bodyweight', 45),
          pe('Plank', 3, 1, 1, 'minutes', 45), pe('Crunches', 3, 25, 0, 'bodyweight', 45),
        ]},
        { dayOfWeek: 4, isRest: false, label: 'Core + Cardio', exercises: [
          pe('Running', 1, 1, 20, 'minutes', 0), pe('Crunches', 3, 20, 0, 'bodyweight', 45),
          pe('Plank', 3, 1, 0.5, 'minutes', 45), pe('Russian Twists', 3, 20, 0, 'bodyweight', 45),
        ]},
        { dayOfWeek: 5, isRest: false, label: 'Core Basics C', exercises: [
          pe('Crunches', 4, 25, 0, 'bodyweight', 45), pe('Leg Raises', 4, 15, 0, 'bodyweight', 45),
          pe('Plank', 4, 1, 1, 'minutes', 45), pe('Russian Twists', 4, 20, 0, 'bodyweight', 45),
          pe('Burpees', 2, 10, 0, 'bodyweight', 60),
        ]},
        rest(6),
      ],
    },

    // ── 6. Abs Intermediate ───────────────────────────────────────────────
    {
      id: uuid(), name: 'Abs — Intermediate',
      description: 'Higher volume core training with weighted exercises and full-body integration.',
      calorieGoal: 2100, proteinGoal: 160, carbsGoal: 230, weightGoal: null,
      isActive: false, createdAt: now, updatedAt: now,
      weekTemplate: [
        rest(0),
        { dayOfWeek: 1, isRest: false, label: 'Weighted Core A', exercises: [
          pe('Cable Crunch', 4, 15, 30, 'kg', 60), pe('Ab Wheel Rollout', 4, 12, 0, 'bodyweight', 60),
          pe('Leg Raises', 4, 15, 0, 'bodyweight', 45), pe('Russian Twists', 3, 20, 0, 'bodyweight', 45),
          pe('Plank', 3, 1, 1, 'minutes', 45),
        ]},
        { dayOfWeek: 2, isRest: false, label: 'Core + HIIT', exercises: [
          pe('HIIT Intervals', 6, 1, 1, 'minutes', 60), pe('Ab Wheel Rollout', 3, 12, 0, 'bodyweight', 60),
          pe('Cable Crunch', 3, 15, 30, 'kg', 60), pe('Burpees', 3, 15, 0, 'bodyweight', 60),
        ]},
        { dayOfWeek: 3, isRest: false, label: 'Weighted Core B', exercises: [
          pe('Cable Crunch', 4, 15, 35, 'kg', 60), pe('Leg Raises', 4, 20, 0, 'bodyweight', 45),
          pe('Ab Wheel Rollout', 4, 15, 0, 'bodyweight', 60), pe('Plank', 3, 1, 1.5, 'minutes', 45),
          pe('Russian Twists', 3, 30, 0, 'bodyweight', 45),
        ]},
        { dayOfWeek: 4, isRest: false, label: 'Core + Cardio', exercises: [
          pe('Running', 1, 1, 30, 'minutes', 0), pe('Cable Crunch', 3, 15, 30, 'kg', 60),
          pe('Ab Wheel Rollout', 3, 12, 0, 'bodyweight', 60), pe('Plank', 3, 1, 1, 'minutes', 45),
        ]},
        { dayOfWeek: 5, isRest: false, label: 'Full Core Blast', exercises: [
          pe('Cable Crunch', 5, 15, 35, 'kg', 60), pe('Ab Wheel Rollout', 5, 12, 0, 'bodyweight', 60),
          pe('Leg Raises', 4, 20, 0, 'bodyweight', 45), pe('Russian Twists', 4, 30, 0, 'bodyweight', 45),
          pe('Plank', 4, 1, 1.5, 'minutes', 45), pe('HIIT Intervals', 4, 1, 1, 'minutes', 60),
        ]},
        rest(6),
      ],
    },
  ]

  await db.plans.bulkPut(plans)
}
