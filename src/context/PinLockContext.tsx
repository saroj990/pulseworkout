import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react'
import { useAuth } from './AuthContext'
import {
  createPinCredentials,
  isValidPin,
  onAuthenticated,
  verifyPin,
} from '../lib/pin'

interface PinLockContextValue {
  pinEnabled: boolean
  locked: boolean
  unlockWithPin: (pin: string) => Promise<void>
  enablePin: (pin: string, confirmPin: string) => Promise<void>
  changePin: (currentPin: string, nextPin: string, confirmPin: string) => Promise<void>
  disablePin: (currentPin: string) => Promise<void>
  lockNow: () => void
}

const PinLockContext = createContext<PinLockContextValue | null>(null)

export function PinLockProvider({ children }: { children: ReactNode }) {
  const { user, preferences, loading, updatePreferences } = useAuth()
  const [unlocked, setUnlocked] = useState(false)

  const pinEnabled = Boolean(
    preferences?.pinEnabled && preferences.pinHash && preferences.pinSalt,
  )

  const locked = Boolean(user && !loading && pinEnabled && !unlocked)

  const lockNow = useCallback(() => {
    if (pinEnabled) setUnlocked(false)
  }, [pinEnabled])

  useEffect(() => {
    return onAuthenticated(() => setUnlocked(true))
  }, [])

  useEffect(() => {
    if (!pinEnabled || !user) return

    const lock = () => setUnlocked(false)

    const onVisibility = () => {
      if (document.visibilityState === 'hidden') lock()
    }

    document.addEventListener('visibilitychange', onVisibility)
    window.addEventListener('pagehide', lock)

    return () => {
      document.removeEventListener('visibilitychange', onVisibility)
      window.removeEventListener('pagehide', lock)
    }
  }, [pinEnabled, user])

  useEffect(() => {
    if (loading) return
    if (!user) {
      setUnlocked(false)
      return
    }
    if (!pinEnabled) setUnlocked(true)
  }, [loading, user, pinEnabled])

  const unlockWithPin = useCallback(
    async (pin: string) => {
      if (!pinEnabled) {
        setUnlocked(true)
        return
      }
      const ok = await verifyPin(pin, preferences?.pinHash, preferences?.pinSalt)
      if (!ok) throw new Error('Incorrect PIN.')
      setUnlocked(true)
    },
    [pinEnabled, preferences?.pinHash, preferences?.pinSalt],
  )

  const enablePin = useCallback(
    async (pin: string, confirmPin: string) => {
      if (!isValidPin(pin)) throw new Error('PIN must be 4 digits.')
      if (pin !== confirmPin) throw new Error('PINs do not match.')
      const creds = await createPinCredentials(pin)
      await updatePreferences(creds)
      setUnlocked(true)
    },
    [updatePreferences],
  )

  const changePin = useCallback(
    async (currentPin: string, nextPin: string, confirmPin: string) => {
      const ok = await verifyPin(currentPin, preferences?.pinHash, preferences?.pinSalt)
      if (!ok) throw new Error('Current PIN is incorrect.')
      if (!isValidPin(nextPin)) throw new Error('New PIN must be 4 digits.')
      if (nextPin !== confirmPin) throw new Error('New PINs do not match.')
      const creds = await createPinCredentials(nextPin)
      await updatePreferences(creds)
      setUnlocked(true)
    },
    [preferences?.pinHash, preferences?.pinSalt, updatePreferences],
  )

  const disablePin = useCallback(
    async (currentPin: string) => {
      const ok = await verifyPin(currentPin, preferences?.pinHash, preferences?.pinSalt)
      if (!ok) throw new Error('Current PIN is incorrect.')
      await updatePreferences({
        pinEnabled: false,
        pinHash: '',
        pinSalt: '',
      })
      setUnlocked(true)
    },
    [preferences?.pinHash, preferences?.pinSalt, updatePreferences],
  )

  const value = useMemo(
    () => ({
      pinEnabled,
      locked,
      unlockWithPin,
      enablePin,
      changePin,
      disablePin,
      lockNow,
    }),
    [pinEnabled, locked, unlockWithPin, enablePin, changePin, disablePin, lockNow],
  )

  return <PinLockContext.Provider value={value}>{children}</PinLockContext.Provider>
}

export function usePinLock() {
  const ctx = useContext(PinLockContext)
  if (!ctx) throw new Error('usePinLock must be used within PinLockProvider')
  return ctx
}
