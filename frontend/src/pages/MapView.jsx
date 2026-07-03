import { useEffect, useState, useRef, useCallback } from 'react'
import { MapContainer, TileLayer, useMap } from 'react-leaflet'
import { Link, useNavigate } from 'react-router-dom'
import L from 'leaflet'
import 'leaflet.heat'
import 'leaflet.markercluster'
import 'leaflet.markercluster/dist/MarkerCluster.css'
import 'leaflet.markercluster/dist/MarkerCluster.Default.css'
import { useSettings } from '../context/SettingsContext'
import { getReports, getHeatmap, upvoteReport } from '../api/reports'
import { getUnreadCount, getNotifications, markRead, markAllRead } from '../api/notifications'
import { useAuth } from '../context/AuthContext'
import { timeAgo } from '../utils/time'

// ── Custom circular pins ──────────────────────────────────────────────────────
function makePin(bg, border, symbol, label = '') {
  return L.divIcon({
    className: '',
    iconAnchor: [20, 20],
    popupAnchor: [0, -24],
    html: `<div style="display:inline-flex;flex-direction:column;align-items:center">
      <div style="width:40px;height:40px;border-radius:50%;background:${bg};border:3px solid ${border};
        box-shadow:0 3px 10px rgba(0,0,0,.25);display:flex;align-items:center;justify-content:center;
        font-size:18px;cursor:pointer">${symbol}</div>
      ${label ? `<div style="margin-top:3px;background:white;border:1px solid #e5e7eb;border-radius:6px;
        padding:1px 6px;font-size:9px;font-weight:600;color:#374151;max-width:80px;
        white-space:nowrap;overflow:hidden;text-overflow:ellipsis;box-shadow:0 1px 4px rgba(0,0,0,.1)">
        ${label.split(',')[0].trim().slice(0,14)}</div>` : ''}
    </div>`,
  })
}

const PIN = {
  high:   (lbl) => makePin('#ef4444','white','⚠️', lbl),
  medium: (lbl) => makePin('#f59e0b','white','🛣️', lbl),
  low:    (lbl) => makePin('#22c55e','white','〰️', lbl),
  fixed:  (lbl) => makePin('#16a34a','white','✅', lbl),
}

function pinFor(r) {
  if (r.status === 'fixed') return PIN.fixed(r.address)
  return (PIN[r.severity] || PIN.medium)(r.address)
}

// ── Heat layer ────────────────────────────────────────────────────────────────
function HeatLayer({ points, visible }) {
  const map = useMap()
  const ref = useRef(null)
  useEffect(() => {
    if (!visible || !points.length) {
      ref.current?.remove()
      ref.current = null
      return
    }
    ref.current = L.heatLayer(
      points.map(p => [p.lat, p.lng, p.intensity]),
      { radius:35, blur:20, maxZoom:17,
        gradient:{0.2:'#00ff00',0.5:'#ffff00',0.8:'#ff6600',1.0:'#ff0000'} }
    ).addTo(map)
    return () => { ref.current?.remove(); ref.current = null }
  }, [visible, points, map])
  return null
}

// ── Cluster + markers layer ───────────────────────────────────────────────────
function PinLayer({ reports, visible, onSelect, clusterPins=true, showLabels=true, displayName }) {
  const map = useMap()
  const gRef = useRef(null)

  useEffect(() => {
    if (!visible) {
      if (gRef.current) { map.removeLayer(gRef.current); gRef.current = null }
      return
    }
    if (gRef.current) { map.removeLayer(gRef.current); gRef.current = null }

    const grp = L.markerClusterGroup({
      maxClusterRadius: clusterPins ? 45 : 1,
      iconCreateFunction(c) {
        const sevs = c.getAllChildMarkers().map(m => m.options._sev || 'low')
        const col = sevs.includes('high') ? '#ef4444' : sevs.includes('medium') ? '#f59e0b' : '#22c55e'
        return L.divIcon({
          className: '', iconSize:[38,38], iconAnchor:[19,19],
          html: `<div style="width:38px;height:38px;border-radius:50%;background:${col};border:3px solid white;
            box-shadow:0 2px 8px rgba(0,0,0,.3);display:flex;align-items:center;justify-content:center;
            color:white;font-weight:800;font-size:13px">${c.getChildCount()}</div>`,
        })
      },
    })

    reports.forEach(r => {
      const sev = r.severity
      const sevBg  = sev==='high'?'#fef2f2':sev==='medium'?'#fefce8':'#f0fdf4'
      const sevTxt = sev==='high'?'#b91c1c':sev==='medium'?'#92400e':'#15803d'
      const sevLbl = sev==='high'?'⚠️ High Severity':sev==='medium'?'🟡 Medium':'🟢 Low'

      const icon = showLabels
        ? pinFor(r)
        : makePin(
            r.status==='fixed'?'#16a34a':sev==='high'?'#ef4444':sev==='medium'?'#f59e0b':'#22c55e',
            'white',
            r.status==='fixed'?'✅':sev==='high'?'⚠️':sev==='medium'?'🛣️':'〰️',
            ''
          )

      const m = L.marker([r.latitude, r.longitude], { icon, _sev: sev })
      const reporterName = displayName ? displayName(r.reporter?.name) : (r.reporter?.name || '—')

      m.bindPopup(`
        <div style="min-width:220px;max-width:260px;font-family:system-ui,sans-serif;border-radius:12px;overflow:hidden">
          <div style="background:${sevBg};border-radius:8px;padding:6px 10px;margin-bottom:8px;display:inline-flex;align-items:center;gap:6px">
            <span style="color:${sevTxt};font-size:12px;font-weight:700">${sevLbl}</span>
          </div>
          <p style="font-weight:800;font-size:14px;margin:0 0 6px;line-height:1.35;color:#111827">${r.title}</p>
          ${r.address ? `<p style="font-size:11px;color:#6b7280;margin:0 0 4px">📍 ${r.address}</p>` : ''}
          <p style="font-size:11px;color:#9ca3af;margin:0 0 6px">👤 ${reporterName} · ${timeAgo(r.created_at)}</p>
          ${r.damage_type ? `
            <div style="background:#f5f3ff;border-radius:8px;padding:6px 10px;margin-bottom:8px">
              <p style="font-size:11px;color:#5b21b6;font-weight:600;margin:0 0 2px">🤖 AI Detection (Gemini Vision)</p>
              <p style="font-size:11px;color:#7c3aed;margin:0">
                ${r.damage_type.replace('_',' ')} · 
                <b>${r.ai_confidence ? Math.round(r.ai_confidence*100)+'% confident' : 'detected'}</b>
              </p>
            </div>` : ''}
          <hr style="border:none;border-top:1px solid #f3f4f6;margin:8px 0"/>
          <div style="display:flex;gap:8px">
            <a href="#" onclick="return false" style="flex:1;display:flex;align-items:center;justify-content:center;gap:5px;
              background:#dc2626;color:white;padding:8px;border-radius:9px;font-size:11px;font-weight:700;text-decoration:none;cursor:pointer">
              👍 ${r.upvotes} Confirmed
            </a>
            <a href="/reports/${r.id}" style="flex:1;display:flex;align-items:center;justify-content:center;
              background:#f9fafb;border:1.5px solid #e5e7eb;color:#374151;padding:8px;border-radius:9px;
              font-size:11px;font-weight:700;text-decoration:none">Details</a>
          </div>
        </div>`, { maxWidth:280 })

      m.on('click', () => onSelect(r))
      grp.addLayer(m)
    })

    map.addLayer(grp)
    gRef.current = grp
    return () => { if (gRef.current) { map.removeLayer(gRef.current); gRef.current = null } }
  }, [visible, reports, map, clusterPins, showLabels])

  return null
}

// ── FlyTo ─────────────────────────────────────────────────────────────────────
function FlyTo({ target }) {
  const map = useMap()
  useEffect(() => {
    if (target) map.flyTo([target.lat, target.lng], 16, { duration:1.2 })
  }, [target, map])
  return null
}

// ── Helpers ───────────────────────────────────────────────────────────────────
function avatarCol(n='') {
  const c=['#ef4444','#f97316','#f59e0b','#16a34a','#0284c7','#6366f1','#9333ea','#ec4899']
  let h=0; for(let i=0;i<n.length;i++) h=n.charCodeAt(i)+((h<<5)-h)
  return c[Math.abs(h)%c.length]
}
function initials(n='') {
  const p=n.trim().split(' ')
  return p.length>=2?(p[0][0]+p[p.length-1][0]).toUpperCase():n.slice(0,2).toUpperCase()
}

const STA_STYLE = {
  pending:     'bg-red-50 text-red-600 border-red-100',
  in_progress: 'bg-amber-50 text-amber-600 border-amber-100',
  fixed:       'bg-green-50 text-green-600 border-green-100',
}
const STA_LBL  = { pending:'Pending', in_progress:'Working', fixed:'Fixed' }
const SEV_COL  = { high:'#ef4444', medium:'#f59e0b', low:'#22c55e' }
const KATHMANDU = [27.7172, 85.324]

// ── Notification bell ─────────────────────────────────────────────────────────
function NotifBell() {
  const navigate = useNavigate()
  const [open,setOpen]   = useState(false)
  const [unread,setUnread] = useState(0)
  const [notifs,setNotifs] = useState([])
  const [prev,setPrev]   = useState(0)
  const [toast,setToast] = useState(null)
  const ref = useRef(null)

  const poll = useCallback(async () => {
    try {
      const r = await getUnreadCount()
      const c = r.data.count
      if (c > prev && prev !== 0) setToast(`🔔 ${c-prev} new notification${c-prev>1?'s':''}!`)
      setPrev(c); setUnread(c)
    } catch {}
  }, [prev])

  useEffect(() => { poll(); const t=setInterval(poll,30000); return()=>clearInterval(t) }, [poll])
  useEffect(() => {
    const h = e => { if (ref.current && !ref.current.contains(e.target)) setOpen(false) }
    document.addEventListener('mousedown', h)
    return () => document.removeEventListener('mousedown', h)
  }, [])

  const openBell = async () => {
    setOpen(o => !o)
    if (!open) { try { const r=await getNotifications(); setNotifs(r.data) } catch {} }
  }

  return (
    <>
      {toast && (
        <div className="fixed bottom-6 right-6 z-[9999] bg-gray-900 text-white px-4 py-3 rounded-2xl shadow-2xl text-sm font-medium flex items-center gap-2"
          style={{animation:'slideUp .3s ease-out'}}>
          {toast}
          <button onClick={()=>setToast(null)} className="ml-2 opacity-50 hover:opacity-100">✕</button>
        </div>
      )}
      <div className="relative" ref={ref}>
        <button onClick={openBell} className="relative w-9 h-9 flex items-center justify-center rounded-xl hover:bg-white/10 transition-colors">
          <svg className="w-5 h-5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9"/>
          </svg>
          {unread>0 && (
            <span className="absolute -top-0.5 -right-0.5 bg-white text-red-600 text-xs font-extrabold rounded-full min-w-[18px] h-[18px] flex items-center justify-center px-1 leading-none shadow">
              {unread>9?'9+':unread}
            </span>
          )}
        </button>
        {open && (
          <div className="absolute right-0 top-full mt-2 w-72 bg-white rounded-2xl shadow-2xl border border-gray-100 overflow-hidden z-[2000]"
            style={{maxHeight:'calc(100vh - 120px)', overflowY:'auto'}}>
            <div className="flex items-center justify-between px-4 py-3 border-b border-gray-100 bg-gray-50 sticky top-0">
              <p className="font-bold text-gray-900 text-sm">Notifications</p>
              {unread>0 && (
                <button onClick={async()=>{await markAllRead();setNotifs(p=>p.map(n=>({...n,is_read:true})));setUnread(0)}}
                  className="text-xs text-red-600 font-semibold hover:underline">
                  Mark all read
                </button>
              )}
            </div>
            <div className="max-h-64 overflow-y-auto divide-y divide-gray-50">
              {notifs.length===0
                ? <div className="text-center py-8 text-gray-400 text-sm">No notifications</div>
                : notifs.map(n => (
                  <button key={n.id}
                    onClick={async()=>{
                      if(!n.is_read){await markRead(n.id);setNotifs(p=>p.map(x=>x.id===n.id?{...x,is_read:true}:x));setUnread(c=>Math.max(0,c-1))}
                      setOpen(false); navigate('/map')
                    }}
                    className={`w-full text-left px-4 py-3 hover:bg-gray-50 transition-colors ${!n.is_read?'bg-blue-50':''}`}>
                    <p className="text-sm text-gray-800 leading-snug">{n.message}</p>
                    <p className="text-xs text-gray-400 mt-0.5">{timeAgo(n.created_at)}</p>
                  </button>
                ))
              }
            </div>
          </div>
        )}
      </div>
    </>
  )
}

// ── Main ──────────────────────────────────────────────────────────────────────
export default function MapView() {
  const { user, isLoggedIn, logout } = useAuth()
  const { settings } = useSettings()
  const navigate = useNavigate()

  const mp   = settings?.map     || {}
  const priv = settings?.privacy || {}

  const [allReports, setAll]     = useState([])
  const [heatPts,    setHeat]    = useState([])
  const [loading,    setLoading] = useState(true)
  const [sevF,       setSev]     = useState('all')
  const [staF,       setSta]     = useState('all')
  const [search,     setSearch]  = useState('')
  const [sortBy,     setSort]    = useState('newest')
  const [view,       setView]    = useState(() => mp.default_view || localStorage.getItem('ss_view') || 'pins')
  const [switching,  setSwitching] = useState(false)
  const [selected,   setSelected]  = useState(null)
  const [flyTarget,  setFly]       = useState(null)
  const [ddOpen,     setDd]        = useState(false)
  const [lastUp,     setLastUp]    = useState(Date.now())
  const [mobileSheet,setMobileSheet] = useState(false)
  const ddRef = useRef(null)

  // Apply saved default view when settings load
  useEffect(() => { if (mp.default_view) setView(mp.default_view) }, [mp.default_view])

  useEffect(() => {
    getReports({ limit:100 })
      .then(r => { setAll(r.data); setLastUp(Date.now()) })
      .finally(() => setLoading(false))
  }, [])

  useEffect(() => {
    if (view==='heat' && !heatPts.length)
      getHeatmap().then(r => setHeat(r.data)).catch(()=>{})
  }, [view])

  useEffect(() => {
    const h = e => { if (ddRef.current && !ddRef.current.contains(e.target)) setDd(false) }
    document.addEventListener('mousedown', h)
    return () => document.removeEventListener('mousedown', h)
  }, [])

  const switchView = m => {
    if (m===view) return
    setSwitching(true)
    setTimeout(() => { setView(m); localStorage.setItem('ss_view',m); setSwitching(false) }, 350)
  }

  const locateMe = () => {
    navigator.geolocation?.getCurrentPosition(
      pos => setFly({ lat:pos.coords.latitude, lng:pos.coords.longitude }),
      () => {}
    )
  }

  // Sort
  const sorted = [...allReports].sort((a,b) => {
    if (sortBy==='newest')   return new Date(b.created_at) - new Date(a.created_at)
    if (sortBy==='upvotes')  return b.upvotes - a.upvotes
    const s = {high:3,medium:2,low:1}
    return (s[b.severity]||0) - (s[a.severity]||0)
  })

  // Filter
  const filtered = sorted.filter(r => {
    if (mp.show_fixed===false && r.status==='fixed') return false
    if (sevF!=='all' && r.severity!==sevF) return false
    if (staF!=='all' && r.status!==staF)   return false
    if (search) {
      const q = search.toLowerCase()
      if (!r.title.toLowerCase().includes(q) && !(r.address||'').toLowerCase().includes(q)) return false
    }
    return true
  })

  // Privacy — anonymous name display
  const displayName = name =>
    (priv.show_name===false || priv.anonymous) ? 'Anonymous' : (name || '—')

  // Counts
  const C = {
    all:         allReports.length,
    high:        allReports.filter(r=>r.severity==='high').length,
    medium:      allReports.filter(r=>r.severity==='medium').length,
    low:         allReports.filter(r=>r.severity==='low').length,
    pending:     allReports.filter(r=>r.status==='pending').length,
    in_progress: allReports.filter(r=>r.status==='in_progress').length,
    fixed:       allReports.filter(r=>r.status==='fixed').length,
  }

  const selectReport = r => { setSelected(r.id); setFly({lat:r.latitude,lng:r.longitude}); setMobileSheet(false) }

  const luAgo = (() => {
    const s = (Date.now()-lastUp)/1000
    if (s<10)  return 'just now'
    if (s<60)  return `${Math.floor(s)}s ago`
    return `${Math.floor(s/60)}m ago`
  })()

  return (
    <div className="flex flex-col bg-white" style={{height:'100vh',fontFamily:"'Inter',system-ui,sans-serif"}}>
      <style>{`
        @keyframes slideUp{from{opacity:0;transform:translateY(14px)}to{opacity:1;transform:translateY(0)}}
        @keyframes ddFade{from{opacity:0;transform:translateY(-6px) scale(.97)}to{opacity:1;transform:translateY(0) scale(1)}}
        .dd-anim{animation:ddFade .14s ease-out forwards}
        .sidebar-card:hover{background:#fafafa}
        .chip-btn{transition:all .15s ease}
        .view-btn{transition:all .15s ease}
      `}</style>

      {/* ═══ NAVBAR ═══ */}
      <header className="bg-red-600 text-white shrink-0 shadow-md z-30" style={{height:56}}>
        <div className="h-full flex items-center gap-3 px-4">
          <Link to="/" className="flex items-center gap-2 font-bold text-base shrink-0 whitespace-nowrap">
            <span className="text-xl">📍</span> SadakSathi
          </Link>

          <div className="flex-1 max-w-md mx-3 hidden sm:flex items-center bg-white/15 border border-white/25 rounded-xl px-3 gap-2">
            <svg className="w-4 h-4 text-white/70 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"/>
            </svg>
            <input value={search} onChange={e=>setSearch(e.target.value)}
              placeholder="Search location, area or report..."
              className="flex-1 bg-transparent text-white placeholder-white/60 text-sm py-2 focus:outline-none"/>
            <kbd className="text-white/40 text-xs border border-white/20 rounded px-1.5 py-0.5">/</kbd>
          </div>

          <div className="flex items-center gap-2 ml-auto">
            <button onClick={()=>navigate(isLoggedIn?'/report/new':'/login')}
              className="flex items-center gap-1.5 bg-white text-red-600 font-bold text-xs px-3 py-2 rounded-xl hover:bg-red-50 transition-colors shadow-sm whitespace-nowrap">
              <span className="hidden sm:inline">+ Report Problem</span>
              <span className="sm:hidden">+ Report</span>
            </button>

            {user && <NotifBell/>}

            {user ? (
              <div className="relative" ref={ddRef}>
                <button onClick={()=>setDd(o=>!o)}
                  className="flex items-center gap-1 rounded-xl hover:bg-white/10 transition-colors px-1.5 py-1.5">
                  <div className="w-8 h-8 rounded-full flex items-center justify-center text-white text-xs font-bold shadow-sm shrink-0"
                    style={{background:avatarCol(user.name)}}>
                    {initials(user.name)}
                  </div>
                  <svg className={`w-3 h-3 opacity-70 transition-transform hidden sm:block ${ddOpen?'rotate-180':''}`}
                    fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7"/>
                  </svg>
                </button>
                {ddOpen && (
                  <div className="dd-anim absolute right-0 top-full mt-2 w-48 bg-white rounded-2xl shadow-xl border border-gray-100 overflow-hidden z-[2000]"
                    style={{maxHeight:'calc(100vh - 120px)', overflowY:'auto'}}>
                    {[
                      { label:'Profile',  fn:()=>{setDd(false);navigate('/profile')},
                        icon:<svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}><path strokeLinecap="round" strokeLinejoin="round" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z"/></svg> },
                      { label:'Settings', fn:()=>{setDd(false);navigate('/settings')},
                        icon:<svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}><path strokeLinecap="round" strokeLinejoin="round" d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z"/><path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"/></svg> },
                    ].map(it => (
                      <button key={it.label} onClick={it.fn}
                        className="flex items-center gap-3 w-full px-4 py-2.5 text-sm text-gray-700 hover:bg-gray-50 transition-colors">
                        <span className="text-gray-400">{it.icon}</span>{it.label}
                      </button>
                    ))}
                    <div className="border-t border-gray-100"/>
                    <button onClick={()=>{setDd(false);logout();navigate('/login')}}
                      className="flex items-center gap-3 w-full px-4 py-2.5 text-sm text-red-600 hover:bg-red-50 transition-colors font-medium">
                      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1"/>
                      </svg>
                      Logout
                    </button>
                  </div>
                )}
              </div>
            ) : (
              <Link to="/login" className="text-xs bg-white/15 hover:bg-white/20 border border-white/30 text-white font-medium px-3 py-1.5 rounded-lg transition-colors">
                Login
              </Link>
            )}
          </div>
        </div>
      </header>

      {/* ═══ FILTER BAR ═══ */}
      <div className="bg-white border-b border-gray-200 shrink-0 z-20" style={{height:48}}>
        <div className="h-full flex items-center gap-2 px-4 overflow-x-auto">
          {[
            {v:'all',    l:`All · ${C.all}`,           active:'bg-red-600 text-white',                              inactive:'bg-gray-100 text-gray-600'},
            {v:'high',   l:`⚠️ High · ${C.high}`,      active:'bg-red-100 text-red-700 ring-1 ring-red-300',        inactive:'bg-gray-100 text-gray-600'},
            {v:'medium', l:`⚠️ Medium · ${C.medium}`,  active:'bg-yellow-100 text-yellow-700 ring-1 ring-yellow-300',inactive:'bg-gray-100 text-gray-600'},
            {v:'low',    l:`✅ Low · ${C.low}`,         active:'bg-green-100 text-green-700 ring-1 ring-green-300',  inactive:'bg-gray-100 text-gray-600'},
          ].map(({v,l,active,inactive}) => (
            <button key={v} onClick={()=>setSev(v)}
              className={`chip-btn px-3 py-1.5 rounded-lg text-xs font-semibold whitespace-nowrap ${sevF===v?active:inactive} hover:opacity-90`}>
              {l}
            </button>
          ))}

          <div className="w-px h-5 bg-gray-200 mx-1 shrink-0"/>

          {[
            {v:'all',         l:'All Status'},
            {v:'pending',     l:`Pending · ${C.pending}`},
            {v:'in_progress', l:`🔧 Working · ${C.in_progress}`},
            {v:'fixed',       l:`✅ Fixed · ${C.fixed}`},
          ].map(({v,l}) => (
            <button key={v} onClick={()=>setSta(v)}
              className={`chip-btn px-3 py-1.5 rounded-lg text-xs font-semibold whitespace-nowrap ${staF===v?'bg-gray-800 text-white':'bg-gray-100 text-gray-600'} hover:opacity-90`}>
              {l}
            </button>
          ))}

          <div className="ml-auto shrink-0">
            <select value={sortBy} onChange={e=>setSort(e.target.value)}
              className="border border-gray-200 rounded-lg px-2 py-1.5 text-xs bg-white text-gray-600 focus:outline-none">
              <option value="newest">Newest</option>
              <option value="upvotes">Most Upvoted</option>
              <option value="severity">Highest Severity</option>
            </select>
          </div>
        </div>
      </div>

      {/* ═══ BODY ═══ */}
      <div className="flex flex-1 overflow-hidden">

        {/* ── SIDEBAR ── */}
       <aside className="hidden md:flex flex-col bg-white border-r border-gray-200 shrink-0" style={{width:272}}>

  {/* Header */}
  <div className="px-3 py-2.5 border-b border-gray-100 flex items-center justify-between bg-white">
    <h2 className="font-semibold text-gray-800 text-sm flex items-center gap-1.5">
      Reports
      <span className="bg-red-600 text-white text-xs px-1.5 py-0.5 rounded-full font-medium ml-1">
        {filtered.length}
      </span>
    </h2>
    <select
      value={sortBy}
      onChange={e => setSort(e.target.value)}
      className="text-xs text-gray-400 bg-transparent border-none outline-none cursor-pointer"
    >
      <option value="newest">Newest</option>
      <option value="upvotes">Most upvoted</option>
      <option value="severity">Severity</option>
    </select>
  </div>

  {/* List */}
  <div className="overflow-y-auto flex-1">
    {loading && (
      <div className="text-center py-10 text-gray-400 text-xs">Loading…</div>
    )}

    {filtered.map(r => {
      const isSel = selected === r.id

      const sevColor =
        r.status === 'fixed'    ? '#16a34a' :
        r.severity === 'high'   ? '#ef4444' :
        r.severity === 'medium' ? '#f59e0b' : '#22c55e'

      const badgeClass =
        r.status === 'fixed'       ? 'bg-green-50 text-green-700 border-green-200' :
        r.status === 'in_progress' ? 'bg-amber-50 text-amber-700 border-amber-200' :
                                     'bg-gray-100 text-gray-600 border-gray-200'

      const badgeText =
        r.status === 'fixed'       ? 'Fixed' :
        r.status === 'in_progress' ? 'Working' : 'Pending'

      return (
        <button
          key={r.id}
          onClick={() => selectReport(r)}
          className="w-full text-left px-3 py-3 border-b border-gray-100 hover:bg-gray-50 transition-colors"
          style={isSel
            ? { borderLeft:'3px solid #DC2626', background:'#fff5f5' }
            : { borderLeft:'3px solid transparent' }
          }
        >
          {/* Row 1: dot + title + status badge */}
          <div className="flex items-center gap-2 mb-1">
            <span
              className="w-2.5 h-2.5 rounded-full shrink-0"
              style={{ background: sevColor }}
            />
            <p className="text-xs font-semibold text-gray-900 flex-1 truncate">
              {r.title}
            </p>
            <span className={`text-xs px-2 py-0.5 rounded-md font-medium border shrink-0 ${badgeClass}`}>
              {badgeText}
            </span>
          </div>

          {/* Row 2: location */}
          {r.address && (
            <p className="text-xs text-gray-400 truncate pl-5 mb-1.5">
              📍 {r.address}
            </p>
          )}

          {/* Row 3: confirmed + button */}
          <div className="flex items-center justify-between pl-5">
            <span className="text-xs text-gray-400">
              👍 {r.upvotes || 0} confirmed
            </span>
            {r.status === 'fixed' ? (
              <span className="text-xs text-green-600 font-medium">✓ Resolved</span>
            ) : isLoggedIn ? (
              <button
                onClick={async e => {
                  e.stopPropagation()
                  try {
                    await upvoteReport(r.id)
                    setAll(prev => prev.map(x =>
                      x.id === r.id ? { ...x, upvotes: x.upvotes + 1 } : x
                    ))
                  } catch {}
                }}
                className="text-xs text-red-600 font-medium bg-red-50 hover:bg-red-100 px-2.5 py-1 rounded-full border border-red-100 transition-colors"
              >
                Upvote
              </button>
            ) : null}
          </div>
        </button>
      )
    })}

    {!loading && filtered.length === 0 && (
      <div className="text-center py-12">
        <p className="text-gray-400 text-xs">No reports match filters</p>
      </div>
    )}
  </div>
</aside>

        {/* ── MAP ── */}
        <div className="relative flex-1">
          {switching && (
            <div className="absolute inset-0 z-[1500] bg-white/70 backdrop-blur-sm flex items-center justify-center">
              <div className="bg-white rounded-2xl shadow-lg px-5 py-3 text-sm font-medium text-gray-700 flex items-center gap-2">
                <svg className="animate-spin h-4 w-4 text-red-600" viewBox="0 0 24 24" fill="none">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/>
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z"/>
                </svg>
                Switching view…
              </div>
            </div>
          )}

          <MapContainer center={KATHMANDU} zoom={mp.default_zoom||12}
            style={{height:'100%',width:'100%'}} zoomControl={true}>
            <TileLayer
              attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
              url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"/>
            {flyTarget && <FlyTo target={flyTarget}/>}
            <PinLayer
              reports={filtered}
              visible={view==='pins' && !switching}
              onSelect={setSelected}
              clusterPins={mp.cluster_pins !== false}
              showLabels={mp.show_labels !== false}
              displayName={displayName}/>
            <HeatLayer points={heatPts} visible={view==='heat' && !switching}/>
          </MapContainer>

          {/* ── View Toggle (Pins / Heat) ── */}
          <div className="absolute top-3 left-3 z-[400] flex bg-white rounded-xl shadow-md border border-gray-100 overflow-hidden">
            <button onClick={()=>switchView('pins')}
              className={`view-btn flex items-center gap-1 px-3 py-2 text-xs font-semibold transition-all
                ${view==='pins' ? 'bg-red-600 text-white' : 'text-gray-500 hover:bg-gray-50'}`}>
              📍 <span className="hidden sm:inline">Pins</span>
            </button>
            <button onClick={()=>switchView('heat')}
              className={`view-btn flex items-center gap-1 px-3 py-2 text-xs font-semibold transition-all
                ${view==='heat' ? 'bg-red-600 text-white' : 'text-gray-500 hover:bg-gray-50'}`}>
              🔥 <span className="hidden sm:inline">Heatmap</span>
            </button>
          </div>

          {/* Legend — bottom left */}
          <div className="absolute bottom-16 left-3 z-[400] bg-white rounded-xl shadow-md border border-gray-100 px-3 py-2.5">
            {view==='pins'
              ? [['#ef4444','High',C.high],['#f59e0b','Medium',C.medium],['#22c55e','Low',C.low],['#16a34a','Fixed',C.fixed]]
                  .map(([c,l,n]) => (
                    <div key={l} className="flex items-center gap-2 text-xs text-gray-700 mb-1 last:mb-0">
                      <span className="w-3 h-3 rounded-full shrink-0" style={{background:c}}/>
                      <span>{l}</span>
                      <span className="text-gray-400 ml-auto pl-3">({n})</span>
                    </div>
                  ))
              : [['#ff0000','Critical'],['#ff6600','High'],['#ffff00','Medium'],['#00ff00','Low']]
                  .map(([c,l]) => (
                    <div key={l} className="flex items-center gap-2 text-xs text-gray-700 mb-1 last:mb-0">
                      <span className="w-3 h-3 rounded-full shrink-0" style={{background:c}}/>{l}
                    </div>
                  ))
            }
          </div>

          {/* Report Problem FAB */}
          <button onClick={()=>navigate(isLoggedIn?'/report/new':'/login')}
            className="absolute bottom-20 right-4 z-[400] flex items-center gap-2 bg-red-600 hover:bg-red-700 text-white font-bold px-5 py-3 rounded-full shadow-xl text-sm transition-all active:scale-95 whitespace-nowrap">
            + Report Problem
          </button>

          {/* My Location button */}
          <button onClick={locateMe}
            className="absolute bottom-6 right-4 z-[400] flex items-center gap-2 bg-white hover:bg-gray-50 border border-gray-200 text-gray-700 font-semibold px-4 py-2.5 rounded-full shadow-md text-sm transition-all">
            <svg className="w-4 h-4 text-gray-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z"/>
              <path strokeLinecap="round" strokeLinejoin="round" d="M15 11a3 3 0 11-6 0 3 3 0 016 0z"/>
            </svg>
            My Location
          </button>

          {/* Mobile: bottom sheet trigger */}
          <button onClick={()=>setMobileSheet(true)}
            className="md:hidden absolute bottom-6 left-4 z-[400] bg-white border border-gray-200 shadow-md text-gray-700 font-semibold px-4 py-2.5 rounded-full text-sm flex items-center gap-2">
            📋 Reports ({filtered.length})
          </button>
        </div>
      </div>

      {/* ═══ STATS BAR ═══ */}
      <div className="bg-white border-t border-gray-200 shrink-0 px-4 py-2.5 flex items-center gap-3 text-xs text-gray-500 overflow-x-auto">
        <span className="flex items-center gap-1 whitespace-nowrap">
          📍 Showing <strong className="text-gray-800 ml-1">{filtered.length}</strong> reports
        </span>
        <span className="text-gray-200">|</span>
        <span className="whitespace-nowrap">⚠️ High: <strong className="text-red-600 ml-0.5">{C.high}</strong></span>
        <span className="whitespace-nowrap">🟡 Medium: <strong className="text-yellow-600 ml-0.5">{C.medium}</strong></span>
        <span className="whitespace-nowrap">✅ Fixed: <strong className="text-green-600 ml-0.5">{C.fixed}</strong></span>
        <div className="ml-auto flex items-center gap-1.5 whitespace-nowrap text-gray-400 shrink-0">
          <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"/>
          </svg>
          Last updated: {luAgo}
        </div>
      </div>

      {/* ═══ MOBILE BOTTOM SHEET ═══ */}
      {mobileSheet && (
        <div className="md:hidden fixed inset-0 z-[3000] flex flex-col justify-end">
          <div className="absolute inset-0 bg-black/40" onClick={()=>setMobileSheet(false)}/>
          <div className="relative bg-white rounded-t-3xl max-h-[70vh] flex flex-col">
            <div className="flex items-center justify-between px-4 py-3 border-b border-gray-100">
              <h3 className="font-bold text-gray-900">Reports [{filtered.length}]</h3>
              <button onClick={()=>setMobileSheet(false)}
                className="w-8 h-8 rounded-full bg-gray-100 flex items-center justify-center text-gray-500 font-bold">✕</button>
            </div>
            <div className="overflow-y-auto flex-1">
              {filtered.map(r => (
                <button key={r.id} onClick={()=>selectReport(r)}
                  className="w-full text-left px-4 py-3 border-b border-gray-100 hover:bg-gray-50 transition-colors">
                  <div className="flex items-center gap-2 mb-1">
                    <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{background:SEV_COL[r.severity]||'#9ca3af'}}/>
                    <p className="text-sm font-semibold text-gray-900 truncate flex-1">{r.title}</p>
                    <span className={`text-xs px-2 py-0.5 rounded-md font-medium border ${STA_STYLE[r.status]||STA_STYLE.pending}`}>
                      {STA_LBL[r.status]||r.status}
                    </span>
                  </div>
                  {r.address && <p className="text-xs text-gray-400 ml-5">📍 {r.address}</p>}
                </button>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}