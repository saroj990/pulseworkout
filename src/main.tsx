import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'
import { registerSW } from 'virtual:pwa-register'
import './index.css'
import App from './App.tsx'
import { applyDocumentTheme, readCachedColorTheme, resolveColorTheme } from './lib/theme'

const bootTheme = resolveColorTheme(readCachedColorTheme())
applyDocumentTheme(bootTheme)

registerSW({ immediate: true })

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <BrowserRouter>
      <App />
    </BrowserRouter>
  </StrictMode>,
)
