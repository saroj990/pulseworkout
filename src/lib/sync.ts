import * as XLSX from 'xlsx'
import { db, type Workout } from '../db'
import { format } from 'date-fns'

function workoutsToSheet(workouts: Workout[]) {
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
  return XLSX.utils.json_to_sheet(rows)
}

export async function buildWorkbookBlob(userId: number): Promise<Blob> {
  const workouts = await db.workouts.where('userId').equals(userId).sortBy('date')
  const goals = await db.goals.where('userId').equals(userId).first()
  const prefs = await db.preferences.where('userId').equals(userId).first()

  const wb = XLSX.utils.book_new()
  XLSX.utils.book_append_sheet(wb, workoutsToSheet(workouts), 'Workouts')

  const summary = XLSX.utils.json_to_sheet([
    {
      ExportedAt: format(new Date(), 'yyyy-MM-dd HH:mm'),
      TotalWorkouts: workouts.length,
      WeeklyGoal: goals?.weeklyWorkouts ?? '',
      DailyMinutesGoal: goals?.dailyMinutes ?? '',
      Units: prefs?.units ?? 'kg',
      Focus: goals?.focus ?? '',
    },
  ])
  XLSX.utils.book_append_sheet(wb, summary, 'Summary')

  const array = XLSX.write(wb, { bookType: 'xlsx', type: 'array' }) as ArrayBuffer
  return new Blob([array], {
    type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  })
}

export async function exportToExcel(userId: number): Promise<void> {
  const blob = await buildWorkbookBlob(userId)
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = `pulse-workouts-${format(new Date(), 'yyyy-MM-dd')}.xlsx`
  a.click()
  URL.revokeObjectURL(url)

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

declare global {
  interface Window {
    google?: {
      accounts: {
        oauth2: {
          initTokenClient: (config: {
            client_id: string
            scope: string
            callback: (resp: { access_token?: string; error?: string }) => void
          }) => { requestAccessToken: () => void }
        }
      }
    }
  }
}

function loadGisScript(): Promise<void> {
  return new Promise((resolve, reject) => {
    if (window.google?.accounts?.oauth2) {
      resolve()
      return
    }
    const existing = document.querySelector('script[data-gis]')
    if (existing) {
      existing.addEventListener('load', () => resolve())
      existing.addEventListener('error', () => reject(new Error('Failed to load Google Identity')))
      return
    }
    const script = document.createElement('script')
    script.src = 'https://accounts.google.com/gsi/client'
    script.async = true
    script.dataset.gis = '1'
    script.onload = () => resolve()
    script.onerror = () => reject(new Error('Failed to load Google Identity'))
    document.head.appendChild(script)
  })
}

function requestDriveToken(clientId: string): Promise<string> {
  return new Promise((resolve, reject) => {
    const client = window.google!.accounts.oauth2.initTokenClient({
      client_id: clientId,
      scope: 'https://www.googleapis.com/auth/drive.file',
      callback: (resp) => {
        if (resp.error || !resp.access_token) {
          reject(new Error(resp.error || 'Google auth failed'))
          return
        }
        resolve(resp.access_token)
      },
    })
    client.requestAccessToken()
  })
}

export async function syncToGoogleDrive(userId: number, clientId: string): Promise<void> {
  if (!clientId.trim()) {
    throw new Error('Add a Google OAuth Client ID in Settings first.')
  }
  if (!navigator.onLine) {
    throw new Error('You are offline. Connect to sync with Google Drive.')
  }

  await loadGisScript()
  const token = await requestDriveToken(clientId.trim())
  const blob = await buildWorkbookBlob(userId)
  const meta = await db.syncMeta.where('userId').equals(userId).first()
  const fileName = `pulse-workouts.xlsx`

  let fileId = meta?.driveFileId ?? null

  if (fileId) {
    const res = await fetch(
      `https://www.googleapis.com/upload/drive/v3/files/${fileId}?uploadType=media`,
      {
        method: 'PATCH',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type':
            'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        },
        body: blob,
      },
    )
    if (!res.ok) {
      // File may have been deleted — create a new one
      fileId = null
    }
  }

  if (!fileId) {
    const metadata = {
      name: fileName,
      mimeType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    }
    const form = new FormData()
    form.append(
      'metadata',
      new Blob([JSON.stringify(metadata)], { type: 'application/json' }),
    )
    form.append('file', blob)

    const res = await fetch(
      'https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart&fields=id',
      {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
        body: form,
      },
    )
    if (!res.ok) {
      const text = await res.text()
      throw new Error(`Drive upload failed: ${text}`)
    }
    const data = (await res.json()) as { id: string }
    fileId = data.id
  }

  const now = new Date().toISOString()
  if (meta?.id) {
    await db.syncMeta.update(meta.id, {
      lastDriveSyncAt: now,
      driveFileId: fileId,
    })
  } else {
    await db.syncMeta.add({
      userId,
      lastExcelExportAt: null,
      lastDriveSyncAt: now,
      driveFileId: fileId,
    })
  }
}
