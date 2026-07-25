import { format } from 'date-fns'
import * as XLSX from 'xlsx'
import { db, type Workout } from '../db'

function workoutRows(workouts: Workout[]) {
  const rows: Record<string, string | number>[] = []
  for (const w of workouts) {
    if (w.exercises.length === 0) {
      rows.push({
        Date: w.date,
        Workout: w.title,
        DurationMin: w.durationMin,
        Notes: w.notes,
        Exercise: '',
        Muscle: '',
        Set: '',
        Reps: '',
        Weight: '',
      })
      continue
    }
    for (const ex of w.exercises) {
      ex.sets.forEach((set, i) => {
        rows.push({
          Date: w.date,
          Workout: w.title,
          DurationMin: w.durationMin,
          Notes: w.notes,
          Exercise: ex.exerciseName,
          Muscle: ex.muscle,
          Set: i + 1,
          Reps: set.reps,
          Weight: set.weight,
        })
      })
    }
  }
  return rows
}

function downloadText(filename: string, content: string, mime: string) {
  const blob = new Blob([content], { type: mime })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  a.click()
  URL.revokeObjectURL(url)
}

function sheetToCsv(rows: Record<string, string | number>[]): string {
  if (rows.length === 0) return ''
  const sheet = XLSX.utils.json_to_sheet(rows)
  return XLSX.utils.sheet_to_csv(sheet)
}

export async function exportToCsv(userId: number): Promise<void> {
  const [workouts, water, goals, prefs] = await Promise.all([
    db.workouts.where('userId').equals(userId).sortBy('date'),
    db.waterLogs.where('userId').equals(userId).sortBy('date'),
    db.goals.where('userId').equals(userId).first(),
    db.preferences.where('userId').equals(userId).first(),
  ])

  const stamp = format(new Date(), 'yyyy-MM-dd')
  const workoutCsv = sheetToCsv(workoutRows(workouts))
  const waterCsv = sheetToCsv(
    water.map((w) => ({
      Date: w.date,
      AmountMl: w.amountMl,
      CreatedAt: w.createdAt,
    })),
  )
  const summaryCsv = sheetToCsv([
    {
      ExportedAt: format(new Date(), 'yyyy-MM-dd HH:mm'),
      TotalWorkouts: workouts.length,
      TotalWaterEntries: water.length,
      WeeklyGoal: goals?.weeklyWorkouts ?? '',
      DailyMinutesGoal: goals?.dailyMinutes ?? '',
      DailyWaterGoalMl: goals?.dailyWaterMl ?? '',
      Units: prefs?.units ?? 'kg',
      Focus: goals?.focus ?? '',
    },
  ])

  // Bundle as a single downloadable zip-like multi-file isn't free without deps —
  // download three CSVs (workouts is primary) + summary/water as additional files.
  downloadText(`pulse-workouts-${stamp}.csv`, workoutCsv || 'Date,Workout,DurationMin,Notes,Exercise,Muscle,Set,Reps,Weight\n', 'text/csv;charset=utf-8')
  downloadText(`pulse-water-${stamp}.csv`, waterCsv || 'Date,AmountMl,CreatedAt\n', 'text/csv;charset=utf-8')
  downloadText(`pulse-summary-${stamp}.csv`, summaryCsv, 'text/csv;charset=utf-8')

  const meta = await db.syncMeta.where('userId').equals(userId).first()
  const now = new Date().toISOString()
  if (meta?.id) {
    await db.syncMeta.update(meta.id, { lastExcelExportAt: now })
  } else {
    await db.syncMeta.add({
      userId,
      lastExcelExportAt: now,
      lastDriveSyncAt: null,
      driveFileId: null,
    })
  }
}

/** Clears training data for this user. Keeps the account, preferences, and goals. */
export async function clearUserTrainingData(userId: number): Promise<void> {
  await db.transaction('rw', db.workouts, db.waterLogs, db.userPlans, db.syncMeta, async () => {
    await db.workouts.where('userId').equals(userId).delete()
    await db.waterLogs.where('userId').equals(userId).delete()
    await db.userPlans.where('userId').equals(userId).delete()
    await db.syncMeta.where('userId').equals(userId).modify({
      lastExcelExportAt: null,
      lastDriveSyncAt: null,
      driveFileId: null,
    })
  })
}
