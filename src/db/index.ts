import Dexie, { type EntityTable } from 'dexie'
import type { PlanDay } from '../data/plans'

export type MuscleGroup =
  | 'chest'
  | 'back'
  | 'shoulders'
  | 'arms'
  | 'legs'
  | 'core'
  | 'cardio'
  | 'full'

export interface User {
  id?: number
  /** Legacy field — unused for new accounts. */
  email?: string
  name: string
  /** Account PIN (hashed). */
  pinHash: string
  pinSalt: string
  /** @deprecated Legacy password fields — ignored for new sign-in. */
  passwordHash?: string
  salt?: string
  createdAt: string
}

export interface Preferences {
  id?: number
  userId: number
  units: 'kg' | 'lbs'
  restSeconds: number
  weekStartsOn: 0 | 1
  preferredMuscles: MuscleGroup[]
  googleClientId: string
  onboardingDone: boolean
  pinEnabled?: boolean
  pinHash?: string
  pinSalt?: string
}

export interface Goals {
  id?: number
  userId: number
  weeklyWorkouts: number
  dailyMinutes: number
  dailyWaterMl?: number
  targetWeightKg: number | null
  currentWeightKg: number | null
  focus: string
}

export interface Exercise {
  id?: number
  name: string
  muscle: MuscleGroup
  equipment: string
  description: string
  imageKey: string
  isCustom: boolean
  userId?: number
}

export interface WorkoutSet {
  reps: number
  weight: number
  completed: boolean
}

export interface WorkoutExercise {
  exerciseId: number
  exerciseName: string
  muscle: MuscleGroup
  imageKey: string
  sets: WorkoutSet[]
  notes?: string
}

export interface Workout {
  id?: number
  userId: number
  date: string
  title: string
  notes: string
  durationMin: number
  exercises: WorkoutExercise[]
  createdAt: string
  updatedAt: string
}

export interface SyncMeta {
  id?: number
  userId: number
  lastExcelExportAt: string | null
  lastDriveSyncAt: string | null
  driveFileId: string | null
}

export interface UserPlan {
  id?: number
  userId: number
  templateId: string
  name: string
  days: PlanDay[]
  active: boolean
  updatedAt: string
}

export interface WaterLog {
  id?: number
  userId: number
  date: string
  amountMl: number
  createdAt: string
}

class WorkoutDB extends Dexie {
  users!: EntityTable<User, 'id'>
  preferences!: EntityTable<Preferences, 'id'>
  goals!: EntityTable<Goals, 'id'>
  exercises!: EntityTable<Exercise, 'id'>
  workouts!: EntityTable<Workout, 'id'>
  syncMeta!: EntityTable<SyncMeta, 'id'>
  userPlans!: EntityTable<UserPlan, 'id'>
  waterLogs!: EntityTable<WaterLog, 'id'>

  constructor() {
    super('pulseWorkoutDB')
    this.version(1).stores({
      users: '++id, email',
      preferences: '++id, userId',
      goals: '++id, userId',
      exercises: '++id, muscle, name, userId',
      workouts: '++id, userId, date, updatedAt',
      syncMeta: '++id, userId',
    })
    this.version(2).stores({
      users: '++id, email',
      preferences: '++id, userId',
      goals: '++id, userId',
      exercises: '++id, muscle, name, userId',
      workouts: '++id, userId, date, updatedAt',
      syncMeta: '++id, userId',
      userPlans: '++id, userId, active',
    })
    this.version(3).stores({
      users: '++id, email',
      preferences: '++id, userId',
      goals: '++id, userId',
      exercises: '++id, muscle, name, userId',
      workouts: '++id, userId, date, updatedAt',
      syncMeta: '++id, userId',
      userPlans: '++id, userId, active',
      waterLogs: '++id, userId, date, createdAt',
    })
    this.version(4).stores({
      users: '++id, email, name',
      preferences: '++id, userId',
      goals: '++id, userId',
      exercises: '++id, muscle, name, userId',
      workouts: '++id, userId, date, updatedAt',
      syncMeta: '++id, userId',
      userPlans: '++id, userId, active',
      waterLogs: '++id, userId, date, createdAt',
    })
  }
}

export const db = new WorkoutDB()
