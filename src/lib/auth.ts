const SESSION_KEY = 'pulse_session_user_id'

export async function hashPassword(password: string, salt: string): Promise<string> {
  const data = new TextEncoder().encode(`${salt}:${password}`)
  const digest = await crypto.subtle.digest('SHA-256', data)
  return Array.from(new Uint8Array(digest))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('')
}

export function createSalt(): string {
  const bytes = crypto.getRandomValues(new Uint8Array(16))
  return Array.from(bytes)
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('')
}

export function getSessionUserId(): number | null {
  const raw = localStorage.getItem(SESSION_KEY)
  if (!raw) return null
  const id = Number(raw)
  return Number.isFinite(id) ? id : null
}

export function setSessionUserId(id: number | null) {
  if (id == null) localStorage.removeItem(SESSION_KEY)
  else localStorage.setItem(SESSION_KEY, String(id))
}
