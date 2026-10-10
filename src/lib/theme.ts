export type ColorTheme = 'light' | 'dark'

export const THEME_STORAGE_KEY = 'pulse-color-theme'

export function resolveColorTheme(value: ColorTheme | undefined | null): ColorTheme {
  return value === 'dark' ? 'dark' : 'light'
}

export function readCachedColorTheme(): ColorTheme | null {
  try {
    const raw = localStorage.getItem(THEME_STORAGE_KEY)
    if (raw === 'light' || raw === 'dark') return raw
  } catch {
    /* private mode / blocked storage */
  }
  return null
}

export function cacheColorTheme(theme: ColorTheme): void {
  try {
    localStorage.setItem(THEME_STORAGE_KEY, theme)
  } catch {
    /* ignore */
  }
}

export function applyDocumentTheme(theme: ColorTheme): void {
  document.documentElement.dataset.theme = theme
  document.documentElement.style.colorScheme = theme
}
