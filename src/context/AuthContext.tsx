import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react'
import { db, type Goals, type Preferences, type User } from '../db'
import { SEED_EXERCISES } from '../data/exercises'
import { EXTRA_EXERCISES } from '../data/plans'
import {
  createSalt,
  getSessionUserId,
  hashPassword,
  setSessionUserId,
} from '../lib/auth'
import { getOldDataSummary, type OldDataSummary } from '../lib/storageAlert'
import { notifyAuthenticated } from '../lib/pin'

interface AuthContextValue {
  user: User | null
  preferences: Preferences | null
  goals: Goals | null
  loading: boolean
  storageAlert: OldDataSummary | null
  clearStorageAlert: () => void
  login: (email: string, password: string) => Promise<void>
  register: (name: string, email: string, password: string) => Promise<void>
  logout: () => void
  refreshProfile: () => Promise<void>
  updatePreferences: (patch: Partial<Preferences>) => Promise<void>
  updateGoals: (patch: Partial<Goals>) => Promise<void>
}

const AuthContext = createContext<AuthContextValue | null>(null)

async function ensureSeedExercises() {
  const allSeed = [...SEED_EXERCISES, ...EXTRA_EXERCISES]
  const existing = await db.exercises.filter((e) => !e.isCustom).toArray()
  if (existing.length === 0) {
    await db.exercises.bulkAdd(allSeed)
    return
  }
  const names = new Set(existing.map((e) => e.name))
  const missing = allSeed.filter((e) => !names.has(e.name))
  if (missing.length > 0) {
    await db.exercises.bulkAdd(missing)
  }
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null)
  const [preferences, setPreferences] = useState<Preferences | null>(null)
  const [goals, setGoals] = useState<Goals | null>(null)
  const [loading, setLoading] = useState(true)
  const [storageAlert, setStorageAlert] = useState<OldDataSummary | null>(null)

  const clearStorageAlert = useCallback(() => setStorageAlert(null), [])

  const loadUser = useCallback(async (id: number) => {
    const u = await db.users.get(id)
    if (!u) {
      setSessionUserId(null)
      setUser(null)
      setPreferences(null)
      setGoals(null)
      return
    }
    const prefs = await db.preferences.where('userId').equals(id).first()
    let g = await db.goals.where('userId').equals(id).first()
    if (g?.id && (g.dailyWaterMl == null || !Number.isFinite(g.dailyWaterMl))) {
      await db.goals.update(g.id, { dailyWaterMl: 2000 })
      g = await db.goals.get(g.id)
    }
    setUser(u)
    setPreferences(prefs ?? null)
    setGoals(g ?? null)
  }, [])

  useEffect(() => {
    ;(async () => {
      try {
        await ensureSeedExercises()
        const id = getSessionUserId()
        if (id) await loadUser(id)
      } finally {
        setLoading(false)
      }
    })()
  }, [loadUser])

  const register = useCallback(
    async (name: string, email: string, password: string) => {
      const normalized = email.trim().toLowerCase()
      const existing = await db.users.where('email').equals(normalized).first()
      if (existing) throw new Error('An account with this email already exists.')

      const salt = createSalt()
      const passwordHash = await hashPassword(password, salt)
      const id = Number(
        await db.users.add({
          email: normalized,
          name: name.trim(),
          passwordHash,
          salt,
          createdAt: new Date().toISOString(),
        }),
      )

      await db.preferences.add({
        userId: id,
        units: 'kg',
        restSeconds: 90,
        weekStartsOn: 1,
        preferredMuscles: [],
        googleClientId: '',
        onboardingDone: false,
      })

      await db.goals.add({
        userId: id,
        weeklyWorkouts: 0,
        dailyMinutes: 0,
        dailyWaterMl: 2000,
        targetWeightKg: 0,
        currentWeightKg: 0,
        focus: 'Build consistency',
      })

      await db.syncMeta.add({
        userId: id,
        lastExcelExportAt: null,
        lastDriveSyncAt: null,
        driveFileId: null,
      })

      setStorageAlert(null)
      setSessionUserId(id)
      await loadUser(id)
      notifyAuthenticated()
    },
    [loadUser],
  )

  const login = useCallback(
    async (email: string, password: string) => {
      const normalized = email.trim().toLowerCase()
      const u = await db.users.where('email').equals(normalized).first()
      if (!u) throw new Error('Invalid email or password.')
      const hash = await hashPassword(password, u.salt)
      if (hash !== u.passwordHash) throw new Error('Invalid email or password.')

      const summary = await getOldDataSummary(u.id!)
      setStorageAlert(summary.hasOldData ? summary : null)

      setSessionUserId(u.id!)
      await loadUser(u.id!)
      notifyAuthenticated()
    },
    [loadUser],
  )

  const logout = useCallback(() => {
    setSessionUserId(null)
    setUser(null)
    setPreferences(null)
    setGoals(null)
    setStorageAlert(null)
  }, [])

  const refreshProfile = useCallback(async () => {
    if (user?.id) await loadUser(user.id)
  }, [loadUser, user?.id])

  const updatePreferences = useCallback(
    async (patch: Partial<Preferences>) => {
      if (!preferences?.id || !user?.id) return
      await db.preferences.update(preferences.id, patch)
      await loadUser(user.id)
    },
    [preferences?.id, user?.id, loadUser],
  )

  const updateGoals = useCallback(
    async (patch: Partial<Goals>) => {
      if (!goals?.id || !user?.id) return
      await db.goals.update(goals.id, patch)
      await loadUser(user.id)
    },
    [goals?.id, user?.id, loadUser],
  )

  const value = useMemo(
    () => ({
      user,
      preferences,
      goals,
      loading,
      storageAlert,
      clearStorageAlert,
      login,
      register,
      logout,
      refreshProfile,
      updatePreferences,
      updateGoals,
    }),
    [
      user,
      preferences,
      goals,
      loading,
      storageAlert,
      clearStorageAlert,
      login,
      register,
      logout,
      refreshProfile,
      updatePreferences,
      updateGoals,
    ],
  )

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

export function useAuth() {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth must be used within AuthProvider')
  return ctx
}
