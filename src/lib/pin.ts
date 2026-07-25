import { createSalt, hashPassword } from './auth'

export const PIN_LENGTH = 4

type AuthListener = () => void
const authListeners = new Set<AuthListener>()

/** Fired after successful login/register so the PIN lock can stay unlocked for this session. */
export function notifyAuthenticated() {
  authListeners.forEach((listener) => listener())
}

export function onAuthenticated(listener: AuthListener) {
  authListeners.add(listener)
  return () => {
    authListeners.delete(listener)
  }
}

export function isValidPin(pin: string): boolean {
  return new RegExp(`^\\d{${PIN_LENGTH}}$`).test(pin)
}

export async function hashPin(pin: string, salt: string): Promise<string> {
  return hashPassword(pin, salt)
}

export async function createPinCredentials(pin: string) {
  if (!isValidPin(pin)) throw new Error(`PIN must be ${PIN_LENGTH} digits.`)
  const pinSalt = createSalt()
  const pinHash = await hashPin(pin, pinSalt)
  return { pinEnabled: true as const, pinHash, pinSalt }
}

export async function verifyPin(
  pin: string,
  pinHash: string | undefined,
  pinSalt: string | undefined,
): Promise<boolean> {
  if (!pinHash || !pinSalt || !isValidPin(pin)) return false
  const hash = await hashPin(pin, pinSalt)
  return hash === pinHash
}
