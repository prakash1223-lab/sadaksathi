import { useState, useEffect, useRef, useCallback } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import {
  getSettings, updateNotifications, updateMap, updateReporting,
  updatePrivacy, updateAccount, exportReports, deleteAccount,
  getSosContacts, addSosContact, getContributions,
} from '../api/settings'

// ── Utilities ─────────────────────────────────────────────────────────────────
function avatarCol(n = '') {
  const c = ['#ef4444', '#f97316', '#f59e0b', '#16a34a', '#0284c7', '#6366f1', '#9333ea']
  let h = 0
  for (let i = 0; i < n.length; i++) h = n.charCodeAt(i) + ((h << 5) - h)
  return c[Math.abs(h) % c.length]
}
function inits(n = '') {
  const p = n.trim().split(' ')
  return p.length >= 2 ? (p[0][0] + p[p.length - 1][0]).toUpperCase() : n.slice(0, 2).toUpperCase()
}

// ── Toast System ────────────────────────────────────────────────────────────────
function useToast() {
  const [toasts, setToasts] = useState([])
  const add = useCallback((msg, type = 'success') => {
    const id = Date.now()
    setToasts(p => [...p, { id, msg, type }])
    setTimeout(() => setToasts(p => p.filter(t => t.id !== id)), 3500)
  }, [])
  return { toasts, add }
}

function ToastList({ toasts }) {
  if (!toasts.length) return null
  return (
    <div className="fixed top-5 right-5 z-[9999] flex flex-col gap-2.5 pointer-events-none w-full max-w-sm">
      {toasts.map(t => (
        <div
          key={t.id}
          className={`pointer-events-auto px-4 py-3.5 rounded-xl shadow-2xl text-sm font-medium flex items-center gap-3 min-w-[260px] border backdrop-blur-sm transition-all
            ${t.type === 'error' ? 'bg-red-600/95 border-red-500 text-white' : 
              t.type === 'warn' ? 'bg-amber-500/95 border-amber-400 text-white' : 
              'bg-emerald-600/95 border-emerald-500 text-white'}`}
          style={{ animation: 'toastSlide .35s cubic-bezier(0.16, 1, 0.3, 1)' }}
        >
          <span className="text-base leading-none">
            {t.type === 'error' ? '✕' : t.type === 'warn' ? '!' : '✓'}
          </span>
          <span className="leading-tight">{t.msg}</span>
        </div>
      ))}
    </div>
  )
}

// ── Professional Toggle ─────────────────────────────────────────────────────────
function Toggle({ value, onChange, label, sub }) {
  const [saved, setSaved] = useState(false)
  const handle = async () => {
    await onChange(!value)
    setSaved(true)
    setTimeout(() => setSaved(false), 1500)
  }
  return (
    <div className="flex items-start justify-between py-4 group border-b border-slate-100 last:border-0">
      <div className="flex-1 pr-6">
        <p className="text-[15px] font-semibold text-slate-800 tracking-tight">{label}</p>
        {sub && <p className="text-[13px] text-slate-500 mt-1 leading-relaxed">{sub}</p>}
      </div>
      <div className="flex items-center gap-3 shrink-0 mt-1">
        <span className={`text-xs font-semibold transition-all duration-300 ${saved ? 'opacity-100 translate-y-0 text-emerald-600' : 'opacity-0 -translate-y-1'}`}>
          Saved
        </span>
        <button 
          onClick={handle} 
          role="switch" 
          aria-checked={value}
          className={`relative w-12 h-7 rounded-full transition-all duration-300 ease-spring focus:outline-none focus:ring-4 focus:ring-red-100 
            ${value ? 'bg-red-600 shadow-lg shadow-red-200' : 'bg-slate-200 hover:bg-slate-300'}`}
        >
          <span className={`absolute top-0.5 left-0.5 w-6 h-6 bg-white rounded-full shadow-sm transition-all duration-300 ease-spring 
            ${value ? 'translate-x-5' : ''}`}/>
        </button>
      </div>
    </div>
  )
}

// ── Premium Card ───────────────────────────────────────────────────────────────
function Card({ title, sub, children, className = '' }) {
  return (
    <div className={`bg-white rounded-2xl border border-slate-200/80 shadow-sm shadow-slate-200/50 overflow-hidden mb-5 transition-all duration-200 hover:shadow-md hover:shadow-slate-200/60 ${className}`}>
      {title && (
        <div className="px-6 py-4 border-b border-slate-100 bg-slate-50/50">
          <p className="font-bold text-slate-900 text-[15px] tracking-tight">{title}</p>
          {sub && <p className="text-[13px] text-slate-500 mt-0.5 leading-relaxed">{sub}</p>}
        </div>
      )}
      <div className="px-6 py-5">{children}</div>
    </div>
  )
}

// ── Skeleton Loader ────────────────────────────────────────────────────────────
function Skel() {
  return (
    <div className="bg-white rounded-2xl border border-slate-200/80 p-6 mb-5">
      <div className="h-5 bg-slate-200 rounded-lg w-1/3 mb-5 animate-pulse"/>
      <div className="space-y-3.5">
        <div className="h-12 bg-slate-100 rounded-xl animate-pulse"/>
        <div className="h-12 bg-slate-100 rounded-xl animate-pulse"/>
        <div className="h-12 bg-slate-100 rounded-xl animate-pulse w-4/5"/>
      </div>
    </div>
  )
}

// ── Spinner ─────────────────────────────────────────────────────────────────────
function Spin() {
  return (
    <svg className="animate-spin h-4 w-4 inline" viewBox="0 0 24 24" fill="none">
      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/>
      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z"/>
    </svg>
  )
}

const NAV = [
  { id: 'notifications', icon: '🔔', label: 'Notifications' },
  { id: 'map', icon: '🗺️', label: 'Map' },
  { id: 'reporting', icon: '📝', label: 'Reporting' },
  { id: 'privacy', icon: '🛡️', label: 'Privacy' },
  { id: 'mydata', icon: '📦', label: 'My Data' },
  { id: 'account', icon: '👤', label: 'Account' },
]

const TYPE_COLOR = {
  emergency: 'bg-red-100 text-red-700',
  traffic: 'bg-yellow-100 text-yellow-700',
  municipal: 'bg-blue-100 text-blue-700',
  roads: 'bg-gray-100 text-gray-600',
  custom: 'bg-purple-100 text-purple-700'
}

export default function Settings() {
  const { user, logout } = useAuth()
  const navigate = useNavigate()
  const { toasts, add: toast } = useToast()

  const [loading, setLoading] = useState(true)
  const [active, setActive] = useState('notifications')

  // Settings state
  const [notif, setNotif] = useState({ status_updates: true, confirmations: true, nearby: true, nearby_radius: 2, municipality: false, reminder: false })
  const [mapPrefs, setMapPrefs] = useState({ default_view: 'pins', default_zoom: 13, show_fixed: true, show_labels: true, cluster_pins: true })
  const [reporting, setReporting] = useState({ auto_ai: true, save_photos: false, require_photo: true, offline_mode: true, auto_sync: true })
  const [privacy, setPrivacy] = useState({ show_name: true, anonymous: false, leaderboard: true, exact_location: true, blur_location: false })
  const [account, setAccount] = useState({ language: 'en', theme: 'system' })
  const [contrib, setContrib] = useState(null)
  const [contacts, setContacts] = useState([])
  const [newContact, setNewContact] = useState({ name: '', number: '' })
  const [addingContact, setAC] = useState(false)

  // Delete modal
  const [delModal, setDelModal] = useState(false)
  const [delPass, setDelPass] = useState('')
  const [delErr, setDelErr] = useState('')
  const [delLoading, setDelL] = useState(false)

  // Export
  const [exporting, setExporting] = useState({ csv: false, pdf: false })

  // Scroll spy
  const sectionRefs = useRef({})
  useEffect(() => {
    const obs = new IntersectionObserver(
      entries => entries.forEach(e => { if (e.isIntersecting) setActive(e.target.id) }),
      { threshold: 0.15, rootMargin: '0px 0px -55% 0px' }
    )
    NAV.forEach(({ id }) => {
      const el = document.getElementById(id)
      if (el) { sectionRefs.current[id] = el; obs.observe(el) }
    })
    return () => obs.disconnect()
  }, [loading])

  // Load all on mount
  useEffect(() => {
    Promise.all([getSettings(), getSosContacts(), getContributions()])
      .then(([s, c, ct]) => {
        const d = s.data
        setNotif(d.notifications)
        setMapPrefs(d.map)
        setReporting(d.reporting)
        setPrivacy(d.privacy)
        setAccount(d.account)
        setContacts(c.data)
        setContrib(ct.data)
      })
      .catch(() => toast('Failed to load settings', 'error'))
      .finally(() => setLoading(false))
  }, [])

  const navTo = id => { setActive(id); document.getElementById(id)?.scrollIntoView({ behavior: 'smooth', block: 'start' }) }

  // ── Notification auto-save ─────────────────────────────────────────
  const saveNotif = async (key, val) => {
    const next = { ...notif, [key]: val }; setNotif(next)
    try { await updateNotifications({ [key]: val }) } catch { setNotif(notif); toast('Could not save. Check connection.', 'error') }
  }

  // ── Map auto-save ──────────────────────────────────────────────────
  const saveMap = async (key, val) => {
    const next = { ...mapPrefs, [key]: val }; setMapPrefs(next)
    if (key === 'default_view') localStorage.setItem('mapView', val)
    try { await updateMap({ [key]: val }) } catch { setMapPrefs(mapPrefs); toast('Could not save. Check connection.', 'error') }
  }

  // ── Reporting auto-save ──────────────────────────────────────────
  const saveReport = async (key, val) => {
    const next = { ...reporting, [key]: val }; setReporting(next)
    try { await updateReporting({ [key]: val }) } catch { setReporting(reporting); toast('Could not save. Check connection.', 'error') }
  }

  // ── Privacy auto-save ──────────────────────────────────────────────
  const savePrivacy = async (key, val) => {
    let next = { ...privacy, [key]: val }
    if (key === 'exact_location' && val) next.blur_location = false
    if (key === 'blur_location' && val) next.exact_location = false
    if (key === 'anonymous' && val) toast('Future reports will show as Anonymous', 'warn')
    setPrivacy(next)
    try { await updatePrivacy(next) } catch { setPrivacy(privacy); toast('Could not save. Check connection.', 'error') }
  }

  

  // ── Export ─────────────────────────────────────────────────────────
  const doExport = async (fmt) => {
    setExporting(p => ({ ...p, [fmt]: true }))
    try {
      const res = await exportReports(fmt)
      const url = URL.createObjectURL(new Blob([res.data]))
      const a = document.createElement('a'); a.href = url; a.download = `my-sadaksathi-reports.${fmt}`; a.click()
      URL.revokeObjectURL(url); toast('Download started!')
    } catch { toast('Download failed', 'error') }
    finally { setExporting(p => ({ ...p, [fmt]: false })) }
  }

  // ── SOS contact ─────────────────────────────────────────────────────
  const doAddContact = async () => {
    if (!newContact.name.trim() || !newContact.number.trim()) { toast('Name and number required', 'error'); return }
    setAC(true)
    try {
      const r = await addSosContact(newContact)
      setContacts(p => [...p, r.data]); setNewContact({ name: '', number: '' })
      toast('Contact added!')
    } catch { toast('Failed to add contact', 'error') }
    finally { setAC(false) }
  }

  // ── Share ───────────────────────────────────────────────────────────
  const [copied, setCopied] = useState(false)
  const copyLink = () => { navigator.clipboard.writeText(window.location.origin + '/leaderboard'); setCopied(true); setTimeout(() => setCopied(false), 2000) }
  const shareWA = () => {
    const t = encodeURIComponent(`I have reported ${contrib?.total_reports || 0} road problems in Kathmandu on SadakSathi! Join me in making Nepal roads safer 🇳🇵 ${window.location.origin}`)
    window.open('https://wa.me/?text=' + t)
  }

  // ── Delete account ──────────────────────────────────────────────────
  const doDelete = async () => {
    setDelErr(''); setDelL(true)
    try { await deleteAccount(delPass); logout(); navigate('/') }
    catch (e) {
      const msg = e.response?.data?.detail || ''
      setDelErr(!e.response ? 'Connection error, try again' : msg.toLowerCase().includes('incorrect') || msg.toLowerCase().includes('password') ? 'Incorrect password' : msg || 'Failed')
    } finally { setDelL(false) }
  }

  if (loading) return (
    <div className="min-h-screen bg-slate-50">
      <div className="max-w-6xl mx-auto px-4 py-10 flex gap-8">
        <div className="w-64 hidden lg:block"><Skel /></div>
        <div className="flex-1">{[1, 2, 3].map(i => <Skel key={i} />)}</div>
      </div>
    </div>
  )

  return (
    <div className="min-h-screen bg-slate-50 font-sans" style={{ fontFamily: "'Inter', system-ui, -apple-system, sans-serif" }}>
      <style>{`
        @keyframes toastSlide { from { opacity: 0; transform: translateX(20px) scale(0.95); } to { opacity: 1; transform: translateX(0) scale(1); } }
        .ease-spring { transition-timing-function: cubic-bezier(0.34, 1.56, 0.64, 1); }
      `}</style>
      <ToastList toasts={toasts} />

      {/* Delete Modal */}
      {delModal && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-50 flex items-center justify-center p-4 transition-all">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md p-7 border border-slate-100">
            <div className="w-12 h-12 bg-red-50 rounded-full flex items-center justify-center mb-4">
              <span className="text-red-600 text-xl">🗑️</span>
            </div>
            <h3 className="font-bold text-slate-900 text-xl mb-2">Delete your account?</h3>
            <p className="text-sm text-slate-500 leading-relaxed mb-6">
              This will permanently delete your account, all reports, and remove you from the leaderboard. 
              <span className="text-red-600 font-semibold"> This action cannot be undone.</span>
            </p>
            <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-2">Confirm with password</label>
            <input 
              type="password" 
              value={delPass} 
              onChange={e => { setDelPass(e.target.value); setDelErr('') }}
              placeholder="Enter your current password"
              className="w-full border border-slate-200 rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-red-500 focus:border-transparent mb-3 transition-all"
            />
            {delErr && <p className="text-sm text-red-600 font-medium mb-4 bg-red-50 rounded-lg px-3 py-2">{delErr}</p>}
            <div className="flex gap-3 mt-6">
              <button 
                onClick={doDelete} 
                disabled={delLoading || !delPass}
                className="flex-1 flex items-center justify-center gap-2 bg-red-600 hover:bg-red-700 active:bg-red-800 text-white font-bold py-3 rounded-xl text-sm transition-all shadow-lg shadow-red-200 disabled:opacity-50 disabled:shadow-none"
              >
                {delLoading ? <><Spin /> Deleting…</> : 'Delete forever'}
              </button>
              <button 
                onClick={() => { setDelModal(false); setDelPass(''); setDelErr('') }}
                className="flex-1 border border-slate-200 text-slate-700 font-bold py-3 rounded-xl text-sm hover:bg-slate-50 transition-colors"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      <div className="max-w-6xl mx-auto px-4 py-10 flex gap-8">

        {/* ── SIDEBAR ── */}
        <aside className="hidden lg:block w-64 shrink-0">
          <div className="sticky top-8">
            {/* Profile Card */}
            <div className="bg-white rounded-2xl border border-slate-200/80 shadow-sm shadow-slate-200/50 overflow-hidden mb-5">
              <div className="h-20 bg-gradient-to-br from-red-500 to-red-600 relative">
                <div className="absolute -bottom-8 left-5">
                  <div 
                    className="w-16 h-16 rounded-2xl flex items-center justify-center text-white text-lg font-bold shadow-lg ring-4 ring-white"
                    style={{ background: avatarCol(user?.name || '') }}
                  >
                    {inits(user?.name || '')}
                  </div>
                </div>
              </div>
              <div className="pt-10 pb-5 px-5">
                <p className="font-bold text-slate-900 text-[15px] leading-tight truncate">{user?.name}</p>
                <p className="text-xs font-bold text-red-600 uppercase tracking-wider mt-1">{contrib?.current_level || 'Reporter'}</p>
                <Link to="/profile" className="inline-flex items-center gap-1 text-xs font-semibold text-red-600 hover:text-red-700 mt-3 transition-colors">
                  Edit profile <span>→</span>
                </Link>
              </div>
            </div>

            {/* Navigation */}
            <nav className="bg-white rounded-2xl border border-slate-200/80 shadow-sm shadow-slate-200/50 p-2.5">
              {NAV.map(item => (
                <button 
                  key={item.id} 
                  onClick={() => navTo(item.id)}
                  className={`w-full flex items-center gap-3 px-3.5 py-3 rounded-xl text-sm font-semibold transition-all duration-200 mb-0.5 text-left
                    ${active === item.id 
                      ? 'bg-red-50 text-red-700 shadow-sm ring-1 ring-red-100' 
                      : 'text-slate-600 hover:bg-slate-50 hover:text-slate-900'}`}
                >
                  <span className="text-lg">{item.icon}</span>
                  {item.label}
                  {active === item.id && <span className="ml-auto w-1.5 h-1.5 rounded-full bg-red-500" />}
                </button>
              ))}
            </nav>
          </div>
        </aside>

        {/* ── MAIN ── */}
        <main className="flex-1 min-w-0">

          {/* Header Mobile */}
          <div className="lg:hidden mb-6">
            <div className="flex items-center gap-3">
              <div 
                className="w-12 h-12 rounded-xl flex items-center justify-center text-white font-bold shadow-md"
                style={{ background: avatarCol(user?.name || '') }}
              >
                {inits(user?.name || '')}
              </div>
              <div>
                <p className="font-bold text-slate-900">{user?.name}</p>
                <p className="text-xs font-bold text-red-600 uppercase tracking-wider">{contrib?.current_level || 'Reporter'}</p>
              </div>
            </div>
          </div>

          {/* ══ NOTIFICATIONS ══ */}
          <section id="notifications" className="mb-3">
            <div className="flex items-center gap-3 mb-4 px-1">
              <span className="p-2 bg-red-50 rounded-lg">🔔</span>
              <div>
                <p className="text-sm font-bold text-slate-900">Notifications</p>
                <p className="text-xs text-slate-500">Manage how we keep you updated</p>
              </div>
            </div>
            <Card>
              <Toggle value={notif.status_updates} onChange={v => saveNotif('status_updates', v)} label="Status updates" sub="When your report changes to in progress or fixed" />
              <Toggle value={notif.confirmations} onChange={v => saveNotif('confirmations', v)} label="Community confirmations" sub="When others upvote your road report" />
              <div>
                <Toggle value={notif.nearby} onChange={v => saveNotif('nearby', v)} label="Nearby reports" sub="New reports near your location" />
                {notif.nearby && (
                  <div className="mt-3 mb-1 bg-slate-50 rounded-xl p-4 border border-slate-100">
                    <div className="flex items-center justify-between mb-3">
                      <span className="text-sm font-semibold text-slate-700">Alert radius</span>
                      <span className="text-sm font-bold text-red-600 bg-red-50 px-2.5 py-1 rounded-lg">{notif.nearby_radius} km</span>
                    </div>
                    <input 
                      type="range" 
                      min={1} 
                      max={5} 
                      step={1} 
                      value={notif.nearby_radius}
                      onChange={e => { const v = +e.target.value; saveNotif('nearby_radius', v) }}
                      className="w-full h-2 bg-slate-200 rounded-lg appearance-none cursor-pointer accent-red-600"
                    />
                    <div className="flex justify-between text-xs text-slate-400 mt-2 font-medium">
                      <span>1 km</span>
                      <span>5 km</span>
                    </div>
                  </div>
                )}
              </div>
              <Toggle value={notif.municipality} onChange={v => saveNotif('municipality', v)} label="Municipality activity" sub="When KMC starts working on any report" />
              <Toggle value={notif.reminder} onChange={v => saveNotif('reminder', v)} label="Inactive reminder" sub="Remind me if I haven't reported in a while" />
            </Card>
          </section>

          {/* ══ MAP PREFERENCES ══ */}
          <section id="map" className="mb-3">
            <div className="flex items-center gap-3 mb-4 px-1">
              <span className="p-2 bg-blue-50 rounded-lg">🗺️</span>
              <div>
                <p className="text-sm font-bold text-slate-900">Map Preferences</p>
                <p className="text-xs text-slate-500">Customize your default map view</p>
              </div>
            </div>
            <Card title="Default view" sub="Choose how reports appear on your map">
              <div className="flex gap-3 mb-6">
                {[{ v: 'pins', l: '📍 Pin View', desc: 'Individual markers' }, { v: 'heat', l: '🔥 Heatmap', desc: 'Density visualization' }].map(opt => (
                  <button 
                    key={opt.v} 
                    onClick={() => saveMap('default_view', opt.v)}
                    className={`flex-1 py-4 rounded-xl text-sm border-2 transition-all duration-200 text-center
                      ${mapPrefs.default_view === opt.v 
                        ? 'border-red-500 bg-red-600 text-white shadow-lg shadow-red-200 font-bold' 
                        : 'border-slate-200 text-slate-600 hover:border-slate-300 hover:bg-slate-50'}`}
                  >
                    <p className="text-lg mb-1">{opt.l.split(' ')[0]}</p>
                    <p className={`text-xs ${mapPrefs.default_view === opt.v ? 'text-white/90' : 'text-slate-500'}`}>
                      {opt.l.split(' ').slice(1).join(' ')}
                    </p>
                  </button>
                ))}
              </div>
              <div className="mb-6">
                <div className="flex items-center justify-between mb-3">
                  <span className="text-sm font-semibold text-slate-700">Default zoom level</span>
                  <span className="text-xs font-bold text-slate-600 bg-slate-100 px-2.5 py-1 rounded-lg">
                    {mapPrefs.default_zoom <= 11 ? 'Far' : mapPrefs.default_zoom <= 13 ? 'City' : mapPrefs.default_zoom <= 15 ? 'Street' : 'Close'}
                  </span>
                </div>
                <input 
                  type="range" 
                  min={10} 
                  max={16} 
                  value={mapPrefs.default_zoom}
                  onChange={e => saveMap('default_zoom', +e.target.value)}
                  className="w-full h-2 bg-slate-200 rounded-lg appearance-none cursor-pointer accent-red-600"
                />
                <div className="flex justify-between text-xs text-slate-400 mt-2 font-medium">
                  <span>Far out</span>
                  <span>Close up</span>
                </div>
              </div>
              <Toggle value={mapPrefs.show_fixed} onChange={v => saveMap('show_fixed', v)} label="Show fixed roads" sub="Display green markers for resolved reports" />
              <Toggle value={mapPrefs.show_labels} onChange={v => saveMap('show_labels', v)} label="Show road labels" sub="Pin location names visible below markers" />
              <Toggle value={mapPrefs.cluster_pins} onChange={v => saveMap('cluster_pins', v)} label="Cluster nearby pins" sub="Group markers when zoomed out for clarity" />
            </Card>
          </section>

          {/* ══ REPORTING ══ */}
          <section id="reporting" className="mb-3">
            <div className="flex items-center gap-3 mb-4 px-1">
              <span className="p-2 bg-amber-50 rounded-lg">📝</span>
              <div>
                <p className="text-sm font-bold text-slate-900">Reporting</p>
                <p className="text-xs text-slate-500">Configure how you submit reports</p>
              </div>
            </div>
            <Card title="Photo settings">
              <Toggle value={reporting.auto_ai} onChange={v => saveReport('auto_ai', v)} label="Auto AI analysis" sub="Automatically analyze photos when uploaded" />
              <Toggle value={reporting.save_photos} onChange={v => saveReport('save_photos', v)} label="Save to gallery" sub="Keep a copy of photos on your device" />
              <Toggle value={reporting.require_photo} onChange={v => saveReport('require_photo', v)} label="Require photo" sub="Always require a photo for better accuracy" />
            </Card>
            <Card title="Offline mode">
              <Toggle value={reporting.offline_mode} onChange={v => saveReport('offline_mode', v)} label="Save reports offline" sub="Queue reports when no internet connection" />
              <div className="mt-4 flex items-start gap-3 bg-blue-50/70 border border-blue-100 rounded-xl px-4 py-3.5">
                <span className="text-blue-500 text-lg shrink-0">💡</span>
                <p className="text-sm text-blue-700 font-medium leading-relaxed">Essential for rural Nepal areas with limited connectivity. Reports will sync automatically when you're back online.</p>
              </div>
            </Card>
          </section>

          {/* ══ PRIVACY ══ */}
          <section id="privacy" className="mb-3">
            <div className="flex items-center gap-3 mb-4 px-1">
              <span className="p-2 bg-emerald-50 rounded-lg">🛡️</span>
              <div>
                <p className="text-sm font-bold text-slate-900">Privacy</p>
                <p className="text-xs text-slate-500">Control your visibility and data</p>
              </div>
            </div>
            <Card title="Public visibility">
              <Toggle value={privacy.show_name} onChange={v => savePrivacy('show_name', v)} label="Show real name" sub="Your name appears on reports and leaderboard" />
              <div>
                <Toggle value={privacy.anonymous} onChange={v => savePrivacy('anonymous', v)} label="Submit anonymously" sub="Reports display as Anonymous instead of your name" />
                {privacy.anonymous && (
                  <div className="mt-3 flex items-start gap-3 bg-amber-50/70 border border-amber-100 rounded-xl px-4 py-3.5">
                    <span className="text-amber-500 text-lg shrink-0">⚠️</span>
                    <p className="text-sm text-amber-700 font-medium">Future reports will show as Anonymous. Past reports remain unchanged.</p>
                  </div>
                )}
              </div>
              <Toggle value={privacy.leaderboard} onChange={v => savePrivacy('leaderboard', v)} label="Appear on leaderboard" sub="Allow others to see your ranking" />
            </Card>
            <Card title="Location privacy">
              <Toggle value={privacy.exact_location} onChange={v => savePrivacy('exact_location', v)} label="Exact location" sub="Share precise GPS coordinates (recommended)" />
              <Toggle value={privacy.blur_location} onChange={v => savePrivacy('blur_location', v)} label="Blurred location" sub="Show approximate area only (±500m radius)" />
              <p className="text-xs text-slate-400 mt-3 italic">These settings are mutually exclusive — enabling one automatically disables the other for your safety.</p>
            </Card>
          </section>

          {/* ══ MY DATA ══ */}
          <section id="mydata" className="mb-3">
            <div className="flex items-center gap-3 mb-4 px-1">
              <span className="p-2 bg-purple-50 rounded-lg">📦</span>
              <div>
                <p className="text-sm font-bold text-slate-900">My Data</p>
                <p className="text-xs text-slate-500">Your contributions and exports</p>
              </div>
            </div>
            
            {contrib && (
              <div className="grid grid-cols-3 gap-4 mb-5">
                {[
                  { v: contrib.total_reports, l: 'Reports', c: 'text-red-600', bg: 'bg-red-50', icon: '📝' },
                  { v: contrib.confirmations_received, l: 'Upvotes', c: 'text-amber-600', bg: 'bg-amber-50', icon: '👍' },
                  { v: contrib.roads_fixed, l: 'Fixed', c: 'text-emerald-600', bg: 'bg-emerald-50', icon: '✅' }
                ].map(s => (
                  <div key={s.l} className="bg-white rounded-2xl border border-slate-200/80 p-4 text-center shadow-sm shadow-slate-200/50 hover:shadow-md transition-all">
                    <div className={`w-10 h-10 ${s.bg} rounded-xl flex items-center justify-center mx-auto mb-2 text-lg`}>{s.icon}</div>
                    <p className={`text-2xl font-extrabold ${s.c} tracking-tight`}>{s.v}</p>
                    <p className="text-xs font-bold text-slate-400 uppercase tracking-wider mt-1">{s.l}</p>
                  </div>
                ))}
              </div>
            )}

            <Card title="Export reports" sub="Download all your submitted reports in your preferred format">
              <div className="flex gap-3">
                <button 
                  onClick={() => doExport('csv')} 
                  disabled={exporting.csv}
                  className="flex-1 flex items-center justify-center gap-2 bg-emerald-600 hover:bg-emerald-700 active:bg-emerald-800 text-white font-bold py-3 rounded-xl text-sm transition-all shadow-lg shadow-emerald-100 disabled:opacity-50 disabled:shadow-none"
                >
                  {exporting.csv ? <><Spin /> Exporting…</> : <><span className="text-base">📊</span> Download CSV</>}
                </button>
                <button 
                  onClick={() => doExport('pdf')} 
                  disabled={exporting.pdf}
                  className="flex-1 flex items-center justify-center gap-2 bg-blue-600 hover:bg-blue-700 active:bg-blue-800 text-white font-bold py-3 rounded-xl text-sm transition-all shadow-lg shadow-blue-100 disabled:opacity-50 disabled:shadow-none"
                >
                  {exporting.pdf ? <><Spin /> Exporting…</> : <><span className="text-base">📄</span> Download PDF</>}
                </button>
              </div>
            </Card>

            <Card title="Share your impact" sub="Let others know about your contributions">
              <div className="flex gap-3">
                <button 
                  onClick={shareWA} 
                  className="flex-1 flex items-center justify-center gap-2 bg-[#25D366] hover:bg-[#1fad52] text-white font-bold py-3 rounded-xl text-sm transition-all shadow-lg shadow-green-100"
                >
                  <span className="text-base">💬</span> WhatsApp
                </button>
                <button 
                  onClick={copyLink} 
                  className={`flex-1 flex items-center justify-center gap-2 border-2 font-bold py-3 rounded-xl text-sm transition-all 
                    ${copied 
                      ? 'border-emerald-200 bg-emerald-50 text-emerald-700' 
                      : 'border-slate-200 text-slate-700 hover:bg-slate-50 hover:border-slate-300'}`}
                >
                  {copied ? <><span>✓</span> Link copied!</> : <><span className="text-base">🔗</span> Copy link</>}
                </button>
              </div>
            </Card>

            <Card title="Data sync">
              <Toggle value={reporting.auto_sync} onChange={v => saveReport('auto_sync', v)} label="Auto sync" sub="Automatically sync offline reports when connected" />
              <p className="text-xs text-slate-400 mt-3 font-medium flex items-center gap-1.5">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                Last synced: just now
              </p>
            </Card>
          </section>

          {/* ══ ACCOUNT ══ */}
          <section id="account" className="mb-3">
            <div className="flex items-center gap-3 mb-4 px-1">
              <span className="p-2 bg-slate-100 rounded-lg">👤</span>
              <div>
                <p className="text-sm font-bold text-slate-900">Account</p>
                <p className="text-xs text-slate-500">Language, appearance, and session</p>
              </div>
            </div>
            
            

        

            <Card title="Session">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-full bg-slate-100 flex items-center justify-center text-slate-500 font-bold text-sm">
                    {inits(user?.name || '')}
                  </div>
                  <div>
                    <p className="text-sm font-bold text-slate-900">{user?.name}</p>
                    <p className="text-xs text-slate-500 font-medium">{user?.phone}</p>
                  </div>
                </div>
                <button 
                  onClick={() => { logout(); navigate('/login') }}
                  className="border border-slate-200 text-slate-700 font-bold px-5 py-2.5 rounded-xl text-sm hover:bg-slate-50 hover:border-slate-300 transition-all"
                >
                  🚪 Log out
                </button>
              </div>
            </Card>

            <div className="border-2 border-red-100 rounded-2xl p-6 bg-gradient-to-br from-red-50/50 to-white mt-5">
              <div className="flex items-start gap-3 mb-4">
                <span className="text-xl bg-red-100 p-2 rounded-lg">🗑️</span>
                <div>
                  <p className="font-bold text-red-700 text-[15px]">Delete account</p>
                  <p className="text-xs text-slate-500 mt-1 leading-relaxed">Permanently deletes your account, all reports, and removes you from the leaderboard. This action is irreversible.</p>
                </div>
              </div>
              <button 
                onClick={() => setDelModal(true)}
                className="w-full sm:w-auto border-2 border-red-200 text-red-600 font-bold px-6 py-3 rounded-xl text-sm hover:bg-red-50 hover:border-red-300 transition-all"
              >
                Delete my account
              </button>
            </div>
          </section>

        </main>
      </div>
    </div>
  )
}