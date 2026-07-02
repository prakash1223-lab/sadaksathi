import { useEffect, useState, useRef } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { MapContainer, TileLayer, Marker, Popup } from 'react-leaflet'
import L from 'leaflet'
import api from '../api/client'
import { getReports } from '../api/reports'
import { useAuth } from '../context/AuthContext'

delete L.Icon.Default.prototype._getIconUrl
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png',
  iconUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png',
  shadowUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
})
const mkIcon = (color) => new L.Icon({
  iconUrl: `https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-${color}.png`,
  shadowUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
  iconSize:[25,41], iconAnchor:[12,41], popupAnchor:[1,-34],
})
const ICONS = { high: mkIcon('red'), medium: mkIcon('gold'), low: mkIcon('green'), fixed: mkIcon('green') }
const KATHMANDU = [27.7172, 85.324]

function useCountUp(target, duration = 1800) {
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

function StatNumber({ target, suffix = '' }) {
  const [val, ref] = useCountUp(target)
  return <span ref={ref}>{val.toLocaleString()}{suffix}</span>
}

export default function Landing() {
  const { isLoggedIn } = useAuth()
  const navigate = useNavigate()
  const [stats, setStats] = useState(null)
  const [reports, setReports] = useState([])

  useEffect(() => {
    api.get('/stats').then(r => setStats(r.data)).catch(() => {})
    getReports({ limit: 50 }).then(r => setReports(r.data)).catch(() => {})
  }, [])

  const goReport = () => navigate(isLoggedIn ? '/report/new' : '/login')

  return (
    <div className="min-h-screen bg-white font-sans" style={{fontFamily:"'Inter',system-ui,sans-serif"}}>
      <style>{`
        @keyframes pulse-dot { 0%,100%{opacity:1;transform:scale(1)} 50%{opacity:.6;transform:scale(1.4)} }
        @keyframes fadeUp { from{opacity:0;transform:translateY(20px)} to{opacity:1;transform:translateY(0)} }
        @keyframes float { 0%,100%{transform:translateY(0)} 50%{transform:translateY(-8px)} }
        .fade-up { animation: fadeUp .7s ease-out forwards }
        .float-pin { animation: float 3s ease-in-out infinite }
        .card-lift:hover { transform: translateY(-4px); box-shadow: 0 12px 40px rgba(0,0,0,.08) }
        .card-lift { transition: transform .25s ease, box-shadow .25s ease }
        .live-dot { animation: pulse-dot 1.8s ease-in-out infinite }
        .btn-primary:hover { transform: translateY(-1px); box-shadow: 0 8px 24px rgba(220,38,38,.35) }
        .btn-primary { transition: transform .2s, box-shadow .2s }
        .btn-secondary:hover { background: rgba(255,255,255,.15) }
        .btn-secondary { transition: background .2s }
      `}</style>

      {/* ── NAV ── */}
      <nav className="bg-red-600 text-white">
        <div className="max-w-5xl mx-auto px-6 h-14 flex items-center justify-between">
          <Link to="/" className="flex items-center gap-2 font-bold text-base">
            <span className="text-lg">📍</span> SadakSathi
          </Link>
          <div className="hidden sm:flex items-center gap-6 text-sm opacity-90">
            <a href="#how" className="hover:opacity-100 transition-opacity">How it works</a>
            <a href="#map" className="hover:opacity-100 transition-opacity">Live Map</a>
          </div>
          <div className="flex items-center gap-2">
            <Link to="/login" className="text-sm px-4 py-1.5 rounded-full border border-white/40 hover:bg-white/10 transition-colors">Log in</Link>
            <Link to="/register" className="text-sm px-4 py-1.5 rounded-full bg-white text-red-600 font-semibold hover:bg-red-50 transition-colors">Register</Link>
          </div>
        </div>
      </nav>

      {/* ── HERO ── */}
      <section className="bg-red-600 text-white overflow-hidden relative" style={{minHeight:480}}>
        {/* Subtle road illustration */}
        <div className="absolute inset-0 opacity-10 pointer-events-none" style={{
          backgroundImage:'radial-gradient(ellipse 80% 60% at 70% 60%, rgba(255,255,255,.25) 0%, transparent 70%)',
        }}/>
        <div className="absolute right-0 bottom-0 w-80 h-80 opacity-10 pointer-events-none" style={{
          background:'url("data:image/svg+xml,%3Csvg viewBox=\'0 0 200 200\' xmlns=\'http://www.w3.org/2000/svg\'%3E%3Cpath d=\'M100 20 Q140 80 120 150 Q100 200 80 150 Q60 80 100 20Z\' fill=\'white\'/%3E%3C/svg%3E") center/cover',
        }}/>

        <div className="max-w-5xl mx-auto px-6 pt-10 pb-12 relative">
          {/* Location badge */}
          <div className="inline-flex items-center gap-1.5 bg-white/15 backdrop-blur-sm border border-white/20 rounded-full px-3 py-1 text-xs font-medium mb-6 fade-up">
            <span className="live-dot w-2 h-2 rounded-full bg-white inline-block"/>
            📍 Kathmandu, Nepal
          </div>

          <div className="grid md:grid-cols-2 gap-8 items-center">
            <div>
              <h1 className="text-4xl sm:text-5xl font-extrabold leading-tight mb-2 fade-up" style={{animationDelay:'.1s'}}>
                Fix Nepal's Roads.
              </h1>
              <h1 className="text-4xl sm:text-5xl font-extrabold leading-tight mb-5 fade-up" style={{color:'#fca5a5',animationDelay:'.2s'}}>
                One Report at a Time.
              </h1>
              <p className="text-red-100 text-base leading-relaxed mb-8 max-w-md fade-up" style={{animationDelay:'.3s'}}>
                SadakSathi helps citizens report potholes, road damage, cracks, and landslides directly from their phones using AI-powered image analysis.
              </p>
              <div className="flex flex-wrap gap-3 fade-up" style={{animationDelay:'.4s'}}>
                <button onClick={goReport}
                  className="btn-primary flex items-center gap-2 bg-white text-red-600 font-bold px-6 py-3 rounded-xl text-sm shadow-lg">
                  📍 Report an Issue
                </button>
                <Link to="/map"
                  className="btn-secondary flex items-center gap-2 border border-white/40 text-white font-semibold px-6 py-3 rounded-xl text-sm">
                  🗺️ View Live Map
                </Link>
              </div>
            </div>

            {/* Floating pin illustration */}
            <div className="hidden md:flex items-center justify-center">
              <div className="float-pin">
                <div className="w-32 h-32 rounded-full bg-white/10 border-4 border-white/30 flex items-center justify-center backdrop-blur-sm">
                  <span style={{fontSize:64}}>📍</span>
                </div>
              </div>
            </div>
          </div>

          {/* Stats row */}
          {stats && (
            <div className="grid grid-cols-3 gap-4 mt-10 pt-8 border-t border-white/20 fade-up" style={{animationDelay:'.5s'}}>
              {[
                { icon:'📋', val: stats.total_reports, label:'Reports Submitted' },
                { icon:'✅', val: stats.active_users,  label:'Verified Issues'   },
                { icon:'👥', val: stats.fixed_roads,   label:'Active Citizens'   },
              ].map(s => (
                <div key={s.label} className="text-center">
                  <p className="text-2xl font-extrabold"><StatNumber target={s.val}/></p>
                  <p className="text-red-200 text-xs mt-0.5">{s.label}</p>
                </div>
              ))}
            </div>
          )}
        </div>
      </section>

      {/* ── HOW IT WORKS ── */}
      <section id="how" className="bg-white py-16">
        <div className="max-w-5xl mx-auto px-6">
          <p className="text-xs font-semibold text-red-500 uppercase tracking-widest text-center mb-2">Simple Process</p>
          <h2 className="text-2xl font-semibold text-gray-900 text-center mb-10">How it works</h2>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-5">
            {[
              { n:'1', icon:'📸', title:'Upload a Photo',     sub:'Take a picture of the road issue using your phone.', ai:false },
              { n:'2', icon:'🤖', title:'AI Analyzes It',     sub:'Google Gemini Vision automatically detects potholes, cracks, road damage, and landslides.', ai:true },
              { n:'3', icon:'📍', title:'Community Tracking', sub:'The issue appears on the live map and can be monitored by everyone.', ai:false },
            ].map(c => (
              <div key={c.n} className={`card-lift relative pt-8 px-5 pb-5 rounded-2xl border ${c.ai?'border-red-200 bg-red-50':'border-gray-100 bg-gray-50'}`}>
                <div className={`absolute -top-4 left-5 w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold text-white shadow-md ${c.ai?'bg-red-600':'bg-gray-700'}`}>{c.n}</div>
                <div className="text-3xl mb-3">{c.icon}</div>
                <p className={`font-semibold text-sm mb-1.5 ${c.ai?'text-red-700':'text-gray-900'}`}>{c.title}</p>
                <p className="text-xs text-gray-500 leading-relaxed">{c.sub}</p>
                {c.ai && <div className="mt-3 inline-flex items-center gap-1 text-xs text-red-600 font-medium bg-red-100 px-2.5 py-1 rounded-full">🤖 Powered by Gemini Vision</div>}
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── LIVE MAP ── */}
      <section id="map" className="bg-gray-50 py-16">
        <div className="max-w-5xl mx-auto px-6">
          <p className="text-xs font-semibold text-red-500 uppercase tracking-widest text-center mb-2">Real-time Data</p>
          <h2 className="text-2xl font-semibold text-gray-900 text-center mb-8">Live Map</h2>
          <div className="rounded-2xl overflow-hidden border border-gray-200 shadow-sm relative" style={{height:340}}>
            {/* Live badge */}
            <div className="absolute top-3 left-3 z-[999] flex items-center gap-1.5 bg-white/90 backdrop-blur-sm border border-gray-200 rounded-full px-3 py-1 text-xs font-semibold text-gray-700 shadow-sm">
              <span className="live-dot w-2 h-2 rounded-full bg-red-500 inline-block"/>
              🔴 Live
            </div>
            {/* Legend */}
            <div className="absolute top-3 right-3 z-[999] bg-white/90 backdrop-blur-sm border border-gray-200 rounded-xl px-3 py-2 text-xs shadow-sm">
              {[{l:'High',c:'#ef4444'},{l:'Medium',c:'#f59e0b'},{l:'Low',c:'#22c55e'}].map(({l,c})=>(
                <div key={l} className="flex items-center gap-1.5 mb-0.5"><span className="w-2 h-2 rounded-full" style={{background:c}}/><span className="text-gray-600">{l}</span></div>
              ))}
            </div>
            <MapContainer center={KATHMANDU} zoom={12} style={{height:'100%',width:'100%'}} zoomControl={false} scrollWheelZoom={false} dragging={false}>
              <TileLayer attribution='&copy; OpenStreetMap' url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"/>
              {reports.map(r=>(
                <Marker key={r.id} position={[r.latitude,r.longitude]} icon={ICONS[r.status==='fixed'?'fixed':r.severity]||ICONS.medium}>
                  <Popup><p className="font-semibold text-sm">{r.title}</p>{r.address&&<p className="text-xs text-gray-500">📍 {r.address}</p>}</Popup>
                </Marker>
              ))}
            </MapContainer>
          </div>
          <div className="text-center mt-4 text-sm text-gray-500">
            {reports.length} road issues reported · <button onClick={goReport} className="text-red-600 font-semibold hover:underline">Want to add yours? →</button>
          </div>
        </div>
      </section>

      {/* ── SAMPLE REPORT CARD ── */}
      <section className="bg-white py-16">
        <div className="max-w-5xl mx-auto px-6">
          <p className="text-xs font-semibold text-red-500 uppercase tracking-widest text-center mb-2">See it in action</p>
          <h2 className="text-2xl font-semibold text-gray-900 text-center mb-8">A real report looks like this</h2>
          <div className="max-w-lg mx-auto">
            <div className="card-lift bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden">
              <div className="p-5">
                <div className="flex items-start justify-between mb-3">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-full bg-red-600 flex items-center justify-center text-white font-bold text-sm shrink-0">PB</div>
                    <div>
                      <p className="font-semibold text-gray-900 text-sm">Prakash Bhandari</p>
                      <p className="text-xs text-gray-400">6 hours ago · Chabahil</p>
                    </div>
                  </div>
                  <span className="text-gray-300 text-lg">⋯</span>
                </div>

                <div className="flex gap-4 items-start">
                  <div className="flex-1">
                    <h3 className="font-bold text-gray-900 text-base mb-3 leading-snug">Large pothole blocking left lane</h3>
                    <div className="flex flex-wrap gap-2 mb-4">
                      <span className="flex items-center gap-1 text-xs bg-red-100 text-red-700 px-2.5 py-1 rounded-full font-medium">🔴 High Severity</span>
                      <span className="flex items-center gap-1 text-xs bg-gray-100 text-gray-600 px-2.5 py-1 rounded-full">Pothole · गड्ढा</span>
                      <span className="flex items-center gap-1 text-xs bg-blue-50 text-blue-600 px-2.5 py-1 rounded-full font-medium">🤖 AI: 84% confident</span>
                    </div>
                  </div>
                  {/* Placeholder road image */}
                  <div className="w-20 h-20 rounded-xl bg-gradient-to-br from-gray-300 to-gray-400 shrink-0 flex items-center justify-center text-2xl overflow-hidden">
                    🕳️
                  </div>
                </div>

                <div className="flex items-center justify-between pt-3 border-t border-gray-100">
                  <span className="text-xs text-gray-500">👍 23 confirmed</span>
                  <span className="text-xs bg-yellow-50 text-yellow-700 border border-yellow-200 px-2.5 py-1 rounded-full font-medium">⏳ Pending Repair</span>
                </div>
              </div>
              <div className="bg-blue-50 border-t border-blue-100 px-5 py-2.5 flex items-center gap-2">
                <span className="text-blue-500 text-sm">🤖</span>
                <span className="text-xs text-blue-700 font-medium">AI-powered damage detection via Google Gemini Vision</span>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ── WHY IT MATTERS ── */}
      <section className="bg-gray-50 py-16">
        <div className="max-w-5xl mx-auto px-6">
          <p className="text-xs font-semibold text-red-500 uppercase tracking-widest text-center mb-2">Impact</p>
          <h2 className="text-2xl font-semibold text-gray-900 text-center mb-8">Why it matters</h2>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-5 mb-8">
            {[
              { icon:'🛡️', title:'Safer Roads',       body:'Your reports help prevent accidents and save lives.' },
              { icon:'⚡', title:'Faster Awareness',  body:'Issues become visible immediately to authorities and communities.' },
              { icon:'🤝', title:'Community Impact',  body:'Together, we build better roads and stronger communities.' },
            ].map(c=>(
              <div key={c.title} className="card-lift bg-white rounded-2xl border border-gray-100 p-5">
                <div className="w-10 h-10 rounded-xl bg-red-50 flex items-center justify-center text-xl mb-3">{c.icon}</div>
                <p className="font-semibold text-gray-900 text-sm mb-1">{c.title}</p>
                <p className="text-xs text-gray-500 leading-relaxed">{c.body}</p>
              </div>
            ))}
          </div>

          {/* Trust stats */}
          <div className="grid grid-cols-3 gap-4">
            {[
              { val:'30s',  sub:'To submit a report',   icon:'⏱️' },
              { val:'3.5M', sub:'Kathmandu residents',  icon:'👥' },
              { val:'Free', sub:'Always for citizens',  icon:'❤️' },
            ].map(s=>(
              <div key={s.val} className="card-lift bg-white rounded-2xl border border-gray-100 p-4 text-center">
                <p className="text-xl mb-0.5">{s.icon}</p>
                <p className="text-xl font-extrabold text-gray-900">{s.val}</p>
                <p className="text-xs text-gray-400 mt-0.5">{s.sub}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── CTA ── */}
      <section className="bg-red-500 text-white py-16 text-center">
        <div className="max-w-xl mx-auto px-6">
          <h2 className="text-3xl font-extrabold mb-3">Ready to make a difference?</h2>
          <p className="text-red-100 mb-8">Join thousands of citizens improving Kathmandu's roads 🇳🇵</p>
          <Link to={isLoggedIn?'/report/new':'/register'}
            className="btn-primary inline-block bg-white text-red-600 font-bold px-10 py-4 rounded-xl shadow-lg text-base">
            {isLoggedIn?'📍 Report a Problem':'Get Started Free →'}
          </Link>
        </div>
      </section>

      {/* ── FOOTER ── */}
      <footer className="bg-white border-t border-gray-100 py-8 text-center">
        <Link to="/" className="inline-flex items-center gap-2 font-bold text-gray-900 text-base mb-2">
          <span>📍</span> SadakSathi
        </Link>
        <p className="text-sm text-gray-400">Made with ❤️ for Nepal</p>
      </footer>
    </div>
  )
}
