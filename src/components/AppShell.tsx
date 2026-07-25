import { NavLink, Outlet } from 'react-router-dom'
import { useLiveQuery } from 'dexie-react-hooks'
import { format } from 'date-fns'
import { Check, Droplets, Dumbbell, History, Home, Settings } from 'lucide-react'
import { OfflineBadge } from './OfflineBadge'
import { OldDataAlertModal } from './OldDataAlertModal'
import { useAuth } from '../context/AuthContext'
import { db } from '../db'

const links = [
  { to: '/', label: 'Home', icon: Home, end: true },
  { to: '/log', label: 'Log', icon: Dumbbell, checkToday: true },
  { to: '/water', label: 'Water', icon: Droplets },
  { to: '/history', label: 'History', icon: History },
  { to: '/settings', label: 'Settings', icon: Settings },
]

export function AppShell() {
  const { user } = useAuth()
  const today = format(new Date(), 'yyyy-MM-dd')

  const loggedToday = useLiveQuery(async () => {
    if (!user?.id) return false
    const hit = await db.workouts
      .where('userId')
      .equals(user.id)
      .filter((w) => w.date === today)
      .first()
    return Boolean(hit)
  }, [user?.id, today])

  return (
    <div className="mx-auto flex min-h-svh w-full max-w-lg flex-col">
      <OfflineBadge />
      <OldDataAlertModal />
      <main className="safe-bottom flex-1 px-[var(--page-pad)] pt-4 sm:pt-6">
        <Outlet />
      </main>
      <nav className="glass fixed bottom-0 left-0 right-0 z-40 border-t border-[var(--line)]">
        <div className="mx-auto flex max-w-lg items-stretch justify-around px-1 pb-[env(safe-area-inset-bottom)] pt-1.5 sm:px-2 sm:pt-2">
          {links.map(({ to, label, icon: Icon, end, checkToday }) => {
            const logDone = Boolean(checkToday && loggedToday)
            return (
              <NavLink
                key={to}
                to={to}
                end={end}
                aria-disabled={logDone || undefined}
                title={logDone ? 'Already logged today' : undefined}
                className={({ isActive }) =>
                  `flex flex-1 flex-col items-center gap-0.5 rounded-xl px-1 py-1.5 text-[0.62rem] font-bold transition sm:gap-1 sm:px-2 sm:py-2 sm:text-[0.68rem] ${
                    logDone
                      ? 'text-[var(--brand)]/70'
                      : isActive
                        ? 'text-[var(--brand)]'
                        : 'text-[var(--ink-muted)] hover:text-[var(--ink)]'
                  }`
                }
              >
                {({ isActive }) => (
                  <>
                    <span
                      className={`relative flex h-8 w-8 items-center justify-center rounded-xl sm:h-9 sm:w-9 ${
                        isActive || logDone ? 'bg-[var(--brand-soft)]' : ''
                      }`}
                    >
                      {isActive && !logDone && (
                        <span className="animate-pulse-ring absolute inset-0 rounded-xl bg-[var(--brand)]/20" />
                      )}
                      {logDone ? (
                        <Check size={18} strokeWidth={2.4} className="sm:h-5 sm:w-5" />
                      ) : (
                        <Icon size={18} strokeWidth={isActive ? 2.4 : 2} className="sm:h-5 sm:w-5" />
                      )}
                    </span>
                    {logDone ? 'Done' : label}
                  </>
                )}
              </NavLink>
            )
          })}
        </div>
      </nav>
    </div>
  )
}
