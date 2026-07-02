import { createContext, useContext, useState, useEffect, useCallback } from 'react'
import { useAuth } from './AuthContext'
import { getSettings } from '../api/settings'

const SettingsContext = createContext(null)

const applyTheme = (theme) => {
  if (theme === 'dark') document.documentElement.classList.add('dark')
  else if (theme === 'light') document.documentElement.classList.remove('dark')
  else {
    const dark = window.matchMedia('(prefers-color-scheme: dark)').matches
    document.documentElement.classList.toggle('dark', dark)
  }
}

// Sensible defaults so components never get null
const DEFAULT_SETTINGS = {
  notifications: { status_updates:true, confirmations:true, nearby:true, nearby_radius:2, municipality:false, reminder:false, fixed_alerts:true },
  map:           { default_view:'pins', default_zoom:13, show_fixed:true, show_labels:true, cluster_pins:true },
  reporting:     { auto_ai:true, save_photos:false, require_photo:true, offline_mode:true, auto_sync:true },
  privacy:       { show_name:true, anonymous:false, leaderboard:true, exact_location:true, blur_location:false, public_profile:true },
  account:       { language:'en', theme:'system' },
}

export function SettingsProvider({ children }) {
  const { isLoggedIn } = useAuth()
  const [settings, setSettings] = useState(DEFAULT_SETTINGS)

  const loadSettings = useCallback(async () => {
    try {
      const res = await getSettings()
      const s = { ...DEFAULT_SETTINGS, ...res.data }
      setSettings(s)
      applyTheme(s.account?.theme || 'system')
    } catch (e) {
      console.log('Settings load failed', e)
    }
  }, [])

  useEffect(() => {
    if (isLoggedIn) loadSettings()
    else setSettings(DEFAULT_SETTINGS)
  }, [isLoggedIn, loadSettings])

  const refresh = useCallback(() => loadSettings(), [loadSettings])

  return (
    <SettingsContext.Provider value={{ settings, refresh, applyTheme }}>
      {children}
    </SettingsContext.Provider>
  )
}

export const useSettings = () => useContext(SettingsContext)
