import { Moon, Sun } from 'lucide-react'
import { useAuth } from '../context/AuthContext'
import type { ColorTheme } from '../lib/theme'
import { applyDocumentTheme, cacheColorTheme, resolveColorTheme } from '../lib/theme'

type Props = {
  /** Icon-only control for headers (home, etc.) */
  variant?: 'icon' | 'segmented'
}

export function ThemeToggle({ variant = 'icon' }: Props) {
  const { preferences, updatePreferences } = useAuth()
  const theme = resolveColorTheme(preferences?.colorTheme)

  async function setTheme(next: ColorTheme) {
    if (next === theme) return
    applyDocumentTheme(next)
    cacheColorTheme(next)
    await updatePreferences({ colorTheme: next })
  }

  if (variant === 'segmented') {
    return (
      <div className="theme-segment" role="group" aria-label="Appearance">
        <button
          type="button"
          className={`theme-segment-btn ${theme === 'light' ? 'theme-segment-btn--active' : ''}`}
          aria-pressed={theme === 'light'}
          onClick={() => setTheme('light')}
        >
          <Sun size={16} />
          Light
        </button>
        <button
          type="button"
          className={`theme-segment-btn ${theme === 'dark' ? 'theme-segment-btn--active' : ''}`}
          aria-pressed={theme === 'dark'}
          onClick={() => setTheme('dark')}
        >
          <Moon size={16} />
          Dark
        </button>
      </div>
    )
  }

  const next: ColorTheme = theme === 'dark' ? 'light' : 'dark'
  return (
    <button
      type="button"
      className="home-icon-btn"
      aria-label={theme === 'dark' ? 'Switch to light theme' : 'Switch to dark theme'}
      onClick={() => setTheme(next)}
    >
      {theme === 'dark' ? <Sun size={17} /> : <Moon size={17} />}
    </button>
  )
}
