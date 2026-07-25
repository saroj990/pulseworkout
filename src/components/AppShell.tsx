import { NavLink, Outlet } from 'react-router-dom'
import { useLiveQuery } from 'dexie-react-hooks'
import { format } from 'date-fns'
import { Check, Droplets, Dumbbell, History, Home, Settings } from 'lucide-react'
import { OfflineBadge } from './OfflineBadge'
import { OldDataAlertModal } from './OldDataAlertModal'
import { ProfileMenu } from './ProfileMenu'
import { useAuth } from '../context/AuthContext'
import { db } from '../db'

const links = [
  { to: '/', label: 'Home', icon: Home, end: true },
  { to: '/log', label: 'Log', icon: Dumbbell, checkToday: true },
  { to: '/water', label: 'Water', icon: Droplets },
  { to: '/history', label: 'History', icon: History },
  { to: '/settings', label: 'Settings', icon: Settings },
]

function NavItems({
  loggedToday,
  variant,
}: {
  loggedToday: boolean
  variant: 'mobile' | 'desktop'
}) {
  return (
    <>
      {links.map(({ to, label, icon: Icon, end, checkToday }) => {
        const logDone = Boolean(checkToday && loggedToday)
        if (variant === 'desktop') {
          return (
            <NavLink
              key={to}
              to={to}
              end={end}
              title={logDone ? 'Already logged today' : undefined}
              className={({ isActive }) =>
                `flex items-center gap-3 rounded-2xl px-3.5 py-3 text-sm font-bold transition ${
                  logDone
                    ? 'bg-[var(--brand-soft)] text-[var(--brand)]'
                    : isActive
                      ? 'bg-[var(--brand)] text-white shadow-[0_8px_24px_rgba(15,118,110,0.25)]'
                      : 'text-[var(--ink-muted)] hover:bg-white hover:text-[var(--ink)]'
                }`
              }
            >
              {logDone ? <Check size={20} strokeWidth={2.4} /> : <Icon size={20} strokeWidth={2.2} />}
              <span className="flex-1">{logDone ? 'Logged today' : label}</span>
            </NavLink>
          )
        }

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
    </>
  )
}

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

  const done = Boolean(loggedToday)

  return (
    <div className="app-shell">
      <OfflineBadge />
      <OldDataAlertModal />

      <aside className="desktop-sidebar glass">
        <div className="flex h-full flex-col px-4 py-6">
          <div className="px-2">
            <p className="font-display text-2xl font-extrabold text-[var(--brand)]">Pulse</p>
            <p className="mt-1 text-sm text-[var(--ink-muted)]">
              {user?.name ? `Hi, ${user.name.split(' ')[0]}` : 'Workout tracker'}
            </p>
          </div>

          <nav className="mt-8 flex flex-1 flex-col gap-1.5" aria-label="Main">
            <NavItems loggedToday={done} variant="desktop" />
          </nav>

          <div className="rounded-2xl bg-[var(--brand-soft)] px-3.5 py-3 text-sm">
            <p className="font-bold text-[var(--brand)]">Offline ready</p>
            <p className="mt-1 text-xs text-[var(--ink-muted)]">
              Logs stay on this device in IndexedDB.
            </p>
          </div>
        </div>
      </aside>

      <div className="app-content">
        <header className="app-topbar glass">
          <div className="topbar-inner">
            <div className="min-w-0">
              <p className="font-display text-lg font-extrabold text-[var(--brand)] lg:hidden">Pulse</p>
              <div className="hidden lg:block">
                <p className="text-xs font-bold uppercase tracking-wider text-[var(--ink-muted)]">
                  {format(new Date(), 'EEEE, MMM d')}
                </p>
                <p className="font-display text-lg font-bold">Your training desk</p>
              </div>
              <p className="truncate text-xs font-semibold text-[var(--ink-muted)] lg:hidden">
                {format(new Date(), 'EEE, MMM d')}
              </p>
            </div>
            <div className="flex items-center gap-2">
              <NavLink to="/plans" className="btn btn-secondary hidden py-2 text-sm lg:inline-flex">
                Plans
              </NavLink>
              <div className="lg:hidden">
                <ProfileMenu compact />
              </div>
              <div className="hidden lg:block">
                <ProfileMenu />
              </div>
            </div>
          </div>
        </header>

        <main className="app-main">
          <div className="page-frame">
            <Outlet />
          </div>
        </main>
      </div>

      <nav className="mobile-bottom-nav glass" aria-label="Mobile">
        <div className="mx-auto flex max-w-lg items-stretch justify-around px-1 pb-[env(safe-area-inset-bottom)] pt-1.5 sm:px-2 sm:pt-2">
          <NavItems loggedToday={done} variant="mobile" />
        </div>
      </nav>
    </div>
  )
}
