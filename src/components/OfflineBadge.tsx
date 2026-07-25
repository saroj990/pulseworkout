import { useEffect, useState } from 'react'
import { WifiOff } from 'lucide-react'

export function OfflineBadge() {
  const [online, setOnline] = useState(navigator.onLine)

  useEffect(() => {
    const on = () => setOnline(true)
    const off = () => setOnline(false)
    window.addEventListener('online', on)
    window.addEventListener('offline', off)
    return () => {
      window.removeEventListener('online', on)
      window.removeEventListener('offline', off)
    }
  }, [])

  if (online) return null

  return (
    <div className="fixed top-3 left-1/2 z-50 flex -translate-x-1/2 items-center gap-2 rounded-full bg-[var(--ink)] px-3 py-1.5 text-xs font-bold text-white shadow-lg animate-fade-up">
      <WifiOff size={14} />
      Offline — data saved locally
    </div>
  )
}
