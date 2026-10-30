import { db, type Equipment, type ExerciseKind, type Unit } from './db'
import { defaultStep, KIND_DEFAULTS } from './exercises'
import { getSetting, setSetting } from './settings.svelte'

export interface SeedExercise {
  name: string
  equipment: Equipment
  kind: ExerciseKind
  muscle?: string
  /** Joints it loads, for Pain flags. */
  joints: string[]
}

const ex = (
  name: string,
  equipment: Equipment,
  kind: ExerciseKind,
  muscle: string | undefined,
  ...joints: string[]
): SeedExercise => ({ name, equipment, kind, muscle, joints })

/**
 * Built-in library every lifter starts with. No weights: starting weights are personal, so the
 * lifter sets one on the Exercise before first use. Add new entries and bump SEED_VERSION.
 */
export const SEED_EXERCISES: SeedExercise[] = [
  // Lower, compound
  ex('Barbell Squat', 'barbell', 'compound-lower', 'quads', 'hip', 'knee', 'lower back'),
  ex('Deadlift', 'barbell', 'compound-lower', 'hamstrings', 'hip', 'knee', 'lower back'),
  ex('Romanian Deadlift', 'barbell', 'compound-lower', 'hamstrings', 'hip', 'lower back'),
  ex('Romanian Deadlift', 'dumbbell', 'compound-lower', 'hamstrings', 'hip', 'lower back'),
  ex('Hip Thrust', 'barbell', 'compound-lower', 'glutes', 'hip'),
  ex('Leg Press', 'machine', 'compound-lower', 'quads', 'hip', 'knee'),
  ex('Hack Squat', 'machine', 'compound-lower', 'quads', 'hip', 'knee'),
  ex('Goblet Squat', 'dumbbell', 'compound-lower', 'quads', 'hip', 'knee'),
  ex('Walking Lunge', 'dumbbell', 'compound-lower', 'quads', 'hip', 'knee'),
  ex('Bulgarian Split Squat', 'dumbbell', 'compound-lower', 'quads', 'hip', 'knee'),
  // Lower, machine and isolation
  ex('Leg Extension', 'machine', 'machine', 'quads', 'knee'),
  ex('Seated Hamstring Curl', 'machine', 'machine', 'hamstrings', 'knee'),
  ex('Lying Hamstring Curl', 'machine', 'machine', 'hamstrings', 'knee'),
  ex('Hip Abductor', 'machine', 'machine', 'glutes', 'hip'),
  ex('Hip Adductor', 'machine', 'machine', undefined, 'hip'),
  ex('Glute Extension', 'machine', 'machine', 'glutes', 'hip'),
  ex('Standing Calf Raise', 'machine', 'isolation', 'calves', 'ankle'),
  ex('Seated Calf Raise', 'machine', 'isolation', 'calves', 'ankle'),
  // Upper push
  ex('Bench Press', 'barbell', 'compound-upper', 'chest', 'shoulder', 'elbow', 'wrist'),
  ex('Chest Press', 'dumbbell', 'compound-upper', 'chest', 'shoulder', 'elbow'),
  ex('Incline Chest Press', 'dumbbell', 'compound-upper', 'chest', 'shoulder', 'elbow'),
  ex('Shoulder Press', 'dumbbell', 'compound-upper', 'shoulders', 'shoulder', 'elbow'),
  ex('Overhead Press', 'barbell', 'compound-upper', 'shoulders', 'shoulder', 'elbow', 'lower back'),
  ex('Chest Press', 'machine', 'machine', 'chest', 'shoulder', 'elbow'),
  ex('Shoulder Press', 'machine', 'machine', 'shoulders', 'shoulder', 'elbow'),
  ex('Push-up', 'bodyweight', 'compound-upper', 'chest', 'shoulder', 'elbow', 'wrist'),
  ex('Dips', 'bodyweight', 'compound-upper', 'triceps', 'shoulder', 'elbow'),
  // Upper pull
  ex('Barbell Row', 'barbell', 'compound-upper', 'back', 'lower back', 'shoulder', 'elbow'),
  ex('One-Arm Row', 'dumbbell', 'compound-upper', 'back', 'shoulder', 'elbow'),
  ex('Pull-up', 'bodyweight', 'compound-upper', 'back', 'shoulder', 'elbow'),
  ex('Chin-up', 'bodyweight', 'compound-upper', 'back', 'shoulder', 'elbow'),
  ex('Lat Pulldown', 'cable', 'machine', 'back', 'shoulder', 'elbow'),
  ex('Cable Row', 'cable', 'machine', 'back', 'shoulder', 'elbow'),
  ex('T-Bar Row', 'machine', 'machine', 'back', 'shoulder', 'elbow', 'lower back'),
  // Shoulders, arms, core
  ex('Lateral Raise', 'dumbbell', 'isolation', 'shoulders', 'shoulder'),
  ex('Lateral Raise', 'cable', 'isolation', 'shoulders', 'shoulder'),
  ex('Reverse Fly', 'dumbbell', 'isolation', 'shoulders', 'shoulder'),
  ex('Reverse Fly', 'machine', 'isolation', 'shoulders', 'shoulder'),
  ex('Face Pull', 'cable', 'isolation', 'shoulders', 'shoulder'),
  ex('Cable Fly', 'cable', 'isolation', 'chest', 'shoulder'),
  ex('Pec Deck', 'machine', 'isolation', 'chest', 'shoulder'),
  ex('Bicep Curl', 'dumbbell', 'isolation', 'biceps', 'elbow'),
  ex('Bicep Curl', 'cable', 'isolation', 'biceps', 'elbow'),
  ex('Hammer Curl', 'dumbbell', 'isolation', 'biceps', 'elbow'),
  ex('Triceps Rope Extension', 'cable', 'isolation', 'triceps', 'elbow'),
  ex('Overhead Triceps Extension', 'dumbbell', 'isolation', 'triceps', 'elbow'),
  ex('Cable Crunch', 'cable', 'isolation', 'core', 'lower back'),
  ex('Hanging Leg Raise', 'bodyweight', 'isolation', 'core', 'hip', 'shoulder'),
]

/** Raise when SEED_EXERCISES gains entries, so existing lifters get the additions once. */
export const SEED_VERSION = 1

/** Light isolation work on dumbbells and cables moves in smaller jumps than a barbell. */
function stepFor(s: SeedExercise, unit: Unit): number {
  const light = s.kind === 'isolation' && (s.equipment === 'dumbbell' || s.equipment === 'cable')
  return light ? (unit === 'lb' ? 2.5 : 1) : defaultStep(unit)
}

/**
 * Adds any built-in Exercise the lifter does not already have (same name and equipment, any case).
 * Runs once per SEED_VERSION, so an Exercise the lifter deletes stays deleted. Returns how many were added.
 */
export async function seedExercises(unit: Unit, store = db): Promise<number> {
  if ((await getSetting('exerciseSeedVersion', 0, store)) >= SEED_VERSION) return 0
  const have = new Set((await store.exercises.toArray()).map((e) => `${e.name}|${e.equipment}`.toLowerCase()))
  const fresh = SEED_EXERCISES.filter((s) => !have.has(`${s.name}|${s.equipment}`.toLowerCase()))
  await store.exercises.bulkAdd(
    fresh.map((s) => {
      const d = KIND_DEFAULTS[s.kind]
      return {
        name: s.name,
        equipment: s.equipment,
        kind: s.kind,
        step: stepFor(s, unit),
        stepUnit: unit,
        repMin: d.repMin,
        repMax: d.repMax,
        restCategory: d.rest,
        muscle: s.muscle,
        bodyAreas: [...s.joints],
      }
    }),
  )
  await setSetting('exerciseSeedVersion', SEED_VERSION, store)
  return fresh.length
}
