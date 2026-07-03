import { useEffect, useState, useRef } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { MapContainer, TileLayer, Marker, Popup } from 'react-leaflet'
import L from 'leaflet'
import api from '../api/client'
import { getReports } from '../api/reports'
import { useAuth } from '../context/AuthContext'
import { timeAgo } from '../utils/time'
import { API_BASE } from '../api/client'

delete L.Icon.Default.prototype._getIconUrl
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png',
  iconUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png',
  shadowUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
})

const mkIcon = (color) => new L.Icon({
  iconUrl: `https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-${color}.png`,
  shadowUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
  iconSize: [25, 41], iconAnchor: [12, 41], popupAnchor: [1, -34],
})
const ICONS = { high: mkIcon('red'), medium: mkIcon('gold'), low: mkIcon('green'), fixed: mkIcon('green') }
const KATHMANDU = [27.7172, 85.324]

function useCountUp(target, duration = 2000) {
  const [val, setVal] = useState(0)
  const started = useRef(false)
  const ref = useRef(null)
  useEffect(() => {
    const obs = new IntersectionObserver(([e]) => {
      if (e.isIntersecting && !started.current) {
        started.current = true
        const step = Math.ceil(target / (duration / 30))
        const t = setInterval(() => {
          setVal(v => { if (v + step >= target) { clearInterval(t); return target } return v + step })
        }, 30)
      }
    }, { threshold: 0.3 })
    if (ref.current) obs.observe(ref.current)
    return () => obs.disconnect()
  }, [target, duration])
  return [val, ref]
}

function StatCard({ icon, value, suffix = '', label }) {
  const [val, ref] = useCountUp(value)
  return (
    <div ref={ref} className="bg-white rounded-2xl p-5 shadow-sm border border-gray-100 text-center">
      <div className="text-2xl mb-2">{icon}</div>
      <p className="text-2xl font-extrabold text-gray-900">{val.toLocaleString()}{suffix}</p>
      <p className="text-xs text-gray-500 mt-1">{label}</p>
    </div>
  )
}

const SEV_COLORS = { high: { bg: 'bg-red-100', text: 'text-red-700', label: 'High' }, medium: { bg: 'bg-yellow-100', text: 'text-yellow-700', label: 'Medium' }, low: { bg: 'bg-green-100', text: 'text-green-700', label: 'Low' } }

function avatarInitials(name = '') {
  const p = name.trim().split(' ')
  return p.length >= 2 ? (p[0][0] + p[p.length - 1][0]).toUpperCase() : name.slice(0, 2).toUpperCase()
}
function avatarColor(name = '') {
  const c = ['#ef4444','#f97316','#f59e0b','#16a34a','#0284c7','#6366f1','#9333ea','#ec4899']
  let h = 0; for (let i = 0; i < name.length; i++) h = name.charCodeAt(i) + ((h << 5) - h)
  return c[Math.abs(h) % c.length]
}

export default function Landing() {
  const { isLoggedIn } = useAuth()
  const navigate = useNavigate()
  const [stats, setStats] = useState(null)
  const [reports, setReports] = useState([])
  const [menuOpen, setMenuOpen] = useState(false)

  useEffect(() => {
    api.get('/stats').then(r => setStats(r.data)).catch(() => {})
    getReports({ limit: 20 }).then(r => setReports(r.data)).catch(() => {})
  }, [])

  const goReport = () => navigate(isLoggedIn ? '/report/new' : '/login')
  const recentReports = reports.slice(0, 3)
  const topContributors = [...reports]
    .reduce((acc, r) => {
      if (!r.reporter) return acc
      const ex = acc.find(a => a.id === r.reporter.id)
      if (ex) ex.count++
      else acc.push({ id: r.reporter.id, name: r.reporter.name, count: 1 })
      return acc
    }, [])
    .sort((a, b) => b.count - a.count)
    .slice(0, 3)

  return (
    <div className="min-h-screen bg-gray-50" style={{ fontFamily: "'Inter',system-ui,sans-serif" }}>
      <style>{`
        @keyframes fadeUp { from{opacity:0;transform:translateY(20px)} to{opacity:1;transform:translateY(0)} }
        @keyframes pulse-dot { 0%,100%{opacity:1;transform:scale(1)} 50%{opacity:.6;transform:scale(1.4)} }
        .fade-up { animation: fadeUp .6s ease-out forwards }
        .card-hover { transition: transform .2s ease, box-shadow .2s ease }
        .card-hover:hover { transform: translateY(-3px); box-shadow: 0 8px 30px rgba(0,0,0,.1) }
        .live-dot { animation: pulse-dot 1.8s ease-in-out infinite }
      `}</style>

      {/* ── NAVBAR ── */}
      <nav className="bg-white border-b border-gray-100 sticky top-0 z-50 shadow-sm">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 h-14 flex items-center justify-between">
          <Link to="/" className="flex items-center gap-2 font-bold text-gray-900 text-base shrink-0">
            <span className="w-7 h-7 bg-red-600 rounded-lg flex items-center justify-center text-white text-sm">📍</span>
            SadakSathi
          </Link>
          <div className="hidden md:flex items-center gap-6 text-sm text-gray-600">
            <Link to="/" className="text-red-600 font-semibold border-b-2 border-red-600 pb-0.5">Home</Link>
            <Link to="/map" className="hover:text-gray-900 transition-colors">Map</Link>
            <Link to="/leaderboard" className="hover:text-gray-900 transition-colors">Leaderboard</Link>
            {isLoggedIn && <Link to="/profile" className="hover:text-gray-900 transition-colors">Profile</Link>}
          </div>
          <div className="hidden md:flex items-center gap-2">
            {isLoggedIn ? (
              <button onClick={goReport} className="flex items-center gap-1.5 bg-red-600 hover:bg-red-700 text-white font-semibold text-sm px-4 py-2 rounded-lg transition-colors">
                + Report Issue
              </button>
            ) : (
              <>
                <Link to="/login" className="text-sm text-gray-600 hover:text-gray-900 px-3 py-1.5 rounded-lg hover:bg-gray-100 transition-colors">Log in</Link>
                <Link to="/register" className="text-sm bg-red-600 hover:bg-red-700 text-white font-semibold px-4 py-2 rounded-lg transition-colors">Register</Link>
              </>
            )}
          </div>
          <button onClick={() => setMenuOpen(o => !o)} className="md:hidden p-2 rounded-lg hover:bg-gray-100">
            <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
              {menuOpen ? <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12"/> : <path strokeLinecap="round" strokeLinejoin="round" d="M4 6h16M4 12h16M4 18h16"/>}
            </svg>
          </button>
        </div>
        {menuOpen && (
          <div className="md:hidden border-t border-gray-100 bg-white px-4 py-3 flex flex-col gap-2 text-sm">
            <Link to="/map" className="py-2 text-gray-700 hover:text-red-600" onClick={() => setMenuOpen(false)}>🗺️ Map</Link>
            <Link to="/leaderboard" className="py-2 text-gray-700 hover:text-red-600" onClick={() => setMenuOpen(false)}>🏆 Leaderboard</Link>
            <button onClick={() => { setMenuOpen(false); goReport() }} className="bg-red-600 text-white font-semibold py-2.5 rounded-lg mt-1">+ Report Issue</button>
            {!isLoggedIn && <Link to="/login" className="text-center py-2 text-gray-600 hover:text-gray-900" onClick={() => setMenuOpen(false)}>Log in</Link>}
          </div>
        )}
      </nav>

      {/* ── HERO ── */}
      <section className="bg-white overflow-hidden">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 py-12 sm:py-16 grid md:grid-cols-2 gap-10 items-center">
          <div className="fade-up">
            <div className="inline-flex items-center gap-1.5 bg-blue-50 text-blue-700 text-xs font-semibold px-3 py-1 rounded-full mb-5">
              🤝 Together for Better Roads
            </div>
            <h1 className="text-4xl sm:text-5xl font-extrabold text-gray-900 leading-tight mb-4">
              Better Roads,<br/>
              Safer <span className="text-red-600">Nepal</span>.
            </h1>
            <p className="text-gray-500 text-base leading-relaxed mb-8 max-w-md">
              Report road issues, help your community, and make Nepal a better place to travel.
            </p>
            <div className="flex flex-wrap gap-3 mb-8">
              <button onClick={goReport}
                className="flex items-center gap-2 bg-red-600 hover:bg-red-700 text-white font-bold px-6 py-3 rounded-xl shadow-lg shadow-red-100 transition-all hover:shadow-red-200 text-sm">
                📍 Report Road Issue
              </button>
              <Link to="/map"
                className="flex items-center gap-2 bg-gray-100 hover:bg-gray-200 text-gray-700 font-semibold px-6 py-3 rounded-xl text-sm transition-colors">
                🔍 Explore Reports
              </Link>
            </div>
            <div className="flex items-center gap-2">
              <div className="flex -space-x-2">
                {['#ef4444','#3b82f6','#22c55e'].map((c, i) => (
                  <div key={i} className="w-8 h-8 rounded-full border-2 border-white flex items-center justify-center text-white text-xs font-bold" style={{ background: c }}>
                    {['R','S','P'][i]}
                  </div>
                ))}
              </div>
              <p className="text-xs text-gray-500">Trusted by <strong className="text-gray-800">1,000+</strong> citizens</p>
            </div>
          </div>
          <div className="hidden md:block relative">
            <div className="relative rounded-2xl overflow-hidden shadow-2xl" style={{ height: 320, background: 'linear-gradient(135deg, #e0f2fe, #fef9c3)' }}>
              <MapContainer center={KATHMANDU} zoom={12} style={{ height: '100%', width: '100%' }} zoomControl={false} scrollWheelZoom={false} dragging={false} attributionControl={false}>
                <TileLayer url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"/>
                {reports.slice(0, 8).map(r => (
                  <Marker key={r.id} position={[r.latitude, r.longitude]} icon={ICONS[r.status === 'fixed' ? 'fixed' : r.severity] || ICONS.medium}>
                    <Popup><p className="font-semibold text-sm">{r.title}</p></Popup>
                  </Marker>
                ))}
              </MapContainer>
              <div className="absolute top-3 left-3 bg-white/90 backdrop-blur-sm rounded-full px-3 py-1 text-xs font-semibold text-gray-700 flex items-center gap-1.5 shadow">
                <span className="live-dot w-2 h-2 rounded-full bg-red-500 inline-block"/>Live Reports
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ── STATS ── */}
      <section className="bg-gray-50 py-10">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 grid grid-cols-2 sm:grid-cols-4 gap-4">
          <StatCard icon="📋" value={stats?.total_reports || 540} suffix="+" label="Road Reports Submitted"/>
          <StatCard icon="👥" value={stats?.active_users || 1200} suffix="+" label="Active Users Community"/>
          <StatCard icon="✅" value={stats?.fixed_roads || 300} suffix="+" label="Resolved Issues Fixed"/>
          <StatCard icon="🚀" value={95} suffix="%" label="Response Rate from Authorities"/>
        </div>
      </section>

      {/* ── HOW IT WORKS ── */}
      <section className="bg-white py-16">
        <div className="max-w-6xl mx-auto px-4 sm:px-6">
          <p className="text-center text-sm text-gray-500 mb-1">Simple steps to create a better community</p>
          <h2 className="text-2xl font-bold text-gray-900 text-center mb-10">How It Works</h2>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-5">
            {[
              { n: '1', icon: '📸', title: 'Capture', sub: 'Take a photo of the road issue' },
              { n: '2', icon: '📍', title: 'Report', sub: 'Add location and details about the issue' },
              { n: '3', icon: '🤖', title: 'Submit', sub: 'Send your report to the community' },
              { n: '4', icon: '🔧', title: 'Improve', sub: 'Track progress and see the change' },
            ].map(s => (
              <div key={s.n} className="card-hover bg-white rounded-2xl border border-gray-100 p-5 text-center shadow-sm">
                <div className="w-12 h-12 rounded-2xl bg-blue-50 flex items-center justify-center text-2xl mx-auto mb-3">{s.icon}</div>
                <p className="text-xs font-semibold text-gray-400 mb-1">{s.n}. {s.title}</p>
                <p className="text-xs text-gray-500 leading-relaxed">{s.sub}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── RECENT REPORTS ── */}
      <section className="bg-gray-50 py-16">
        <div className="max-w-6xl mx-auto px-4 sm:px-6">
          <div className="flex items-center justify-between mb-8">
            <h2 className="text-2xl font-bold text-gray-900">Recent Reports</h2>
            <Link to="/map" className="text-sm text-red-600 font-semibold hover:underline flex items-center gap-1">
              View all reports →
            </Link>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-5">
            {recentReports.length > 0 ? recentReports.map(r => {
              const sev = SEV_COLORS[r.severity] || SEV_COLORS.medium
              const photoUrl = r.photo_url ? (r.photo_url.startsWith('http') ? r.photo_url : `${API_BASE}${r.photo_url}`) : null
              return (
                <Link key={r.id} to={`/reports/${r.id}`} className="card-hover bg-white rounded-2xl border border-gray-100 overflow-hidden shadow-sm block">
                  <div className="relative h-36 bg-gradient-to-br from-gray-200 to-gray-300 flex items-center justify-center text-4xl">
                    {photoUrl ? (
                      <img src={photoUrl} alt={r.title} className="w-full h-full object-cover" onError={e => { e.target.style.display='none' }}/>
                    ) : '🛣️'}
                    <span className={`absolute top-2 left-2 text-xs font-bold px-2 py-0.5 rounded-full ${sev.bg} ${sev.text}`}>
                      {sev.label}
                    </span>
                  </div>
                  <div className="p-4">
                    <h3 className="font-semibold text-gray-900 text-sm mb-1 truncate">{r.title}</h3>
                    {r.address && <p className="text-xs text-gray-400 mb-2 truncate">📍 {r.address}</p>}
                    <div className="flex items-center justify-between text-xs text-gray-400">
                      <span>👍 {r.upvotes} · 🕐 {timeAgo(r.created_at)}</span>
                      <span className={`px-2 py-0.5 rounded-full ${r.status === 'fixed' ? 'bg-green-100 text-green-700' : r.status === 'in_progress' ? 'bg-yellow-100 text-yellow-700' : 'bg-gray-100 text-gray-600'}`}>
                        {r.status === 'fixed' ? 'Fixed' : r.status === 'in_progress' ? 'Working' : 'Pending'}
                      </span>
                    </div>
                  </div>
                </Link>
              )
            }) : [1,2,3].map(i => (
              <div key={i} className="bg-white rounded-2xl border border-gray-100 overflow-hidden shadow-sm">
                <div className="h-36 bg-gray-100 animate-pulse"/>
                <div className="p-4 space-y-2">
                  <div className="h-3 bg-gray-100 rounded animate-pulse"/>
                  <div className="h-3 bg-gray-100 rounded w-2/3 animate-pulse"/>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── MAP SECTION ── */}
      <section className="bg-white py-16">
        <div className="max-w-6xl mx-auto px-4 sm:px-6">
          <div className="grid md:grid-cols-2 gap-10 items-center">
            <div>
              <h2 className="text-2xl font-bold text-gray-900 mb-3">Explore Issues on Map</h2>
              <p className="text-gray-500 text-sm mb-6 leading-relaxed">View road issues across Nepal in real-time. Zoom, filter, and explore your area.</p>
              <div className="space-y-3 mb-8">
                {[
                  { icon: '🔴', text: 'Real-time updates' },
                  { icon: '🔽', text: 'Filter by severity' },
                  { icon: '📍', text: 'Explore nearby issues' },
                ].map(f => (
                  <div key={f.text} className="flex items-center gap-3 text-sm text-gray-700">
                    <span className="w-7 h-7 bg-blue-50 rounded-lg flex items-center justify-center text-base shrink-0">{f.icon}</span>
                    {f.text}
                  </div>
                ))}
              </div>
              <Link to="/map" className="inline-flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white font-semibold px-6 py-3 rounded-xl text-sm transition-colors shadow-lg shadow-blue-100">
                🗺️ Open Interactive Map
              </Link>
            </div>
            <div className="rounded-2xl overflow-hidden border border-gray-200 shadow-lg" style={{ height: 280 }}>
              <MapContainer center={KATHMANDU} zoom={11} style={{ height: '100%', width: '100%' }} zoomControl={true} scrollWheelZoom={false} attributionControl={false}>
                <TileLayer url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"/>
                {reports.map(r => (
                  <Marker key={r.id} position={[r.latitude, r.longitude]} icon={ICONS[r.status === 'fixed' ? 'fixed' : r.severity] || ICONS.medium}>
                    <Popup><p className="font-semibold text-sm">{r.title}</p></Popup>
                  </Marker>
                ))}
              </MapContainer>
            </div>
          </div>
        </div>
      </section>

      {/* ── TOP CONTRIBUTORS ── */}
      <section className="bg-gray-50 py-16">
        <div className="max-w-6xl mx-auto px-4 sm:px-6">
          <div className="flex items-center justify-between mb-8">
            <h2 className="text-2xl font-bold text-gray-900">Top Contributors</h2>
            <Link to="/leaderboard" className="text-sm text-red-600 font-semibold hover:underline flex items-center gap-1">
              View leaderboard →
            </Link>
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
            {topContributors.map((c, i) => (
              <div key={c.id} className="card-hover bg-white rounded-2xl border border-gray-100 p-4 flex items-center gap-3 shadow-sm">
                <span className="text-sm font-bold text-gray-400 w-4 shrink-0">{i + 1}</span>
                <div className="w-10 h-10 rounded-full flex items-center justify-center text-white text-sm font-bold shrink-0" style={{ background: avatarColor(c.name) }}>
                  {avatarInitials(c.name)}
                </div>
                <div className="min-w-0">
                  <p className="text-sm font-semibold text-gray-900 truncate">{c.name}</p>
                  <p className="text-xs text-gray-400">{c.count} Reports</p>
                </div>
              </div>
            ))}
            <div className="card-hover bg-white rounded-2xl border border-dashed border-gray-200 p-4 flex flex-col items-center justify-center gap-1 text-center">
              <span className="text-2xl">👤</span>
              <p className="text-xs font-semibold text-gray-700">Join the community</p>
              <p className="text-xs text-gray-400">Make a difference today!</p>
            </div>
          </div>
        </div>
      </section>

      {/* ── CTA BANNER ── */}
      <section className="bg-white py-12">
        <div className="max-w-6xl mx-auto px-4 sm:px-6">
          <div className="bg-gradient-to-r from-blue-600 to-blue-700 rounded-3xl px-8 py-10 flex flex-col sm:flex-row items-center justify-between gap-6">
            <div className="flex items-center gap-5">
              <div className="w-14 h-14 bg-white/20 rounded-2xl flex items-center justify-center text-3xl shrink-0">📍</div>
              <div>
                <h3 className="text-xl font-bold text-white mb-1">Be a Road Hero</h3>
                <p className="text-blue-100 text-sm">Your small report can prevent accidents and improve lives.</p>
              </div>
            </div>
            <button onClick={goReport}
              className="bg-white hover:bg-blue-50 text-blue-700 font-bold px-8 py-3 rounded-xl text-sm transition-colors shadow-lg whitespace-nowrap shrink-0">
              Report Now →
            </button>
          </div>
        </div>
      </section>

      {/* ── FOOTER ── */}
      <footer className="bg-gray-900 text-gray-400 pt-12 pb-6">
        <div className="max-w-6xl mx-auto px-4 sm:px-6">
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-8 mb-10">
            {/* Brand */}
            <div className="col-span-2 sm:col-span-1">
              <Link to="/" className="flex items-center gap-2 font-bold text-white text-base mb-3">
                <span className="w-7 h-7 bg-red-600 rounded-lg flex items-center justify-center text-sm">📍</span>
                SadakSathi
              </Link>
              <p className="text-xs leading-relaxed mb-4">A community-driven platform to make Nepal's roads safer for everyone.</p>
              <div className="flex gap-3">
                {['𝕏','f','in','📷'].map(s => (
                  <span key={s} className="w-8 h-8 bg-gray-800 hover:bg-gray-700 rounded-lg flex items-center justify-center text-xs cursor-pointer transition-colors">{s}</span>
                ))}
              </div>
            </div>
            {/* Quick Links */}
            <div>
              <p className="text-white font-semibold text-sm mb-4">Quick Links</p>
              <div className="space-y-2 text-xs">
                {[['/', 'Home'], ['/map', 'Map'], ['/leaderboard', 'Leaderboard'], ['/report/new', 'Report Issue']].map(([to, label]) => (
                  <div key={to}><Link to={to} className="hover:text-white transition-colors">{label}</Link></div>
                ))}
              </div>
            </div>
            {/* Resources */}
            <div>
              <p className="text-white font-semibold text-sm mb-4">Resources</p>
              <div className="space-y-2 text-xs">
                {['Help Center', 'Guidelines', 'Privacy Policy', 'Terms of Service', 'Contact Us'].map(l => (
                  <div key={l}><span className="hover:text-white transition-colors cursor-pointer">{l}</span></div>
                ))}
              </div>
            </div>
            {/* Contact */}
            <div>
              <p className="text-white font-semibold text-sm mb-4">Contact</p>
              <div className="space-y-2 text-xs">
                <div className="flex items-center gap-2">📧 <span>hello@sadaksathi.np</span></div>
                <div className="flex items-center gap-2">📍 <span>Kathmandu, Nepal</span></div>
              </div>
            </div>
          </div>
          <div className="border-t border-gray-800 pt-6 flex flex-col sm:flex-row items-center justify-between gap-2 text-xs">
            <p>© 2026 SadakSathi. All rights reserved.</p>
            <p>Made with ❤️ in Nepal</p>
          </div>
        </div>
      </footer>

    </div>
  )
}
