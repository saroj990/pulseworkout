import { isValidPin, PIN_LENGTH } from './pin'

export type AuthFieldErrors = {
  name?: string
  pin?: string
}

const NAME_MIN = 2
const NAME_MAX = 40

export function normalizeUsername(name: string): string {
  return name.trim().replace(/\s+/g, ' ')
}

/** Case-insensitive key for looking up accounts by name. */
export function usernameKey(name: string): string {
  return normalizeUsername(name).toLowerCase()
}

export function sanitizePinInput(raw: string): string {
  return raw.replace(/\D/g, '').slice(0, PIN_LENGTH)
}

export function validateRegisterInput(name: string, pin: string): AuthFieldErrors {
  const errors: AuthFieldErrors = {}
  const trimmed = normalizeUsername(name)

  if (!trimmed) {
    errors.name = 'Enter your name.'
  } else if (trimmed.length < NAME_MIN) {
    errors.name = `Name must be at least ${NAME_MIN} characters.`
  } else if (trimmed.length > NAME_MAX) {
    errors.name = `Name must be ${NAME_MAX} characters or fewer.`
  }

  if (!pin) {
    errors.pin = 'Enter a PIN.'
  } else if (!isValidPin(pin)) {
    errors.pin = `PIN must be ${PIN_LENGTH} digits.`
  }

  return errors
}

export function validateLoginInput(name: string, pin: string): AuthFieldErrors {
  const errors: AuthFieldErrors = {}
  const trimmed = normalizeUsername(name)

  if (!trimmed) errors.name = 'Enter your name.'
  if (!pin) {
    errors.pin = 'Enter your PIN.'
  } else if (!isValidPin(pin)) {
    errors.pin = `PIN must be ${PIN_LENGTH} digits.`
  }

  return errors
}
