import { useEffect } from 'react'
import { useAuth } from '../context/AuthContext'
import { applyDocumentTheme, cacheColorTheme, resolveColorTheme } from '../lib/theme'

/** Applies the signed-in user’s theme preference to the document root. */
export function ThemeSync() {
  const { preferences } = useAuth()

  useEffect(() => {
    if (!preferences) return
    const theme = resolveColorTheme(preferences.colorTheme)
    applyDocumentTheme(theme)
    cacheColorTheme(theme)
  }, [preferences, preferences?.colorTheme])

  return null
}
