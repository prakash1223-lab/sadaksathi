import { useEffect, useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { MapContainer, TileLayer, Marker } from 'react-leaflet'
import L from 'leaflet'
import { getReport, upvoteReport } from '../api/reports'
import { useAuth } from '../context/AuthContext'
import { API_BASE } from '../api/client'
import { timeAgo, formatDateTime } from '../utils/time'

delete L.Icon.Default.prototype._getIconUrl
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png',
  iconUrl:       'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png',
  shadowUrl:     'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
})

function avatarCol(n = '') {
  const c = ['#ef4444','#f97316','#f59e0b','#16a34a','#0284c7','#6366f1','#9333ea','#ec4899']
  let h = 0
  for (let i = 0; i < n.length; i++) h = n.charCodeAt(i) + ((h << 5) - h)
  return c[Math.abs(h) % c.length]
}

function initials(n = '') {
  const p = n.trim().split(' ')
  return p.length >= 2
    ? (p[0][0] + p[p.length-1][0]).toUpperCase()
    : n.slice(0, 2).toUpperCase()
}

const SEV_CONFIG = {
  high:   { bg:'#fef2f2', text:'#b91c1c', border:'#fca5a5', label:'⚠️ High Severity'   },
  medium: { bg:'#fefce8', text:'#92400e', border:'#fcd34d', label:'🟡 Medium Severity' },
  low:    { bg:'#f0fdf4', text:'#15803d', border:'#86efac', label:'🟢 Low Severity'    },
}

const STA_CONFIG = {
  pending:     { bg:'#f9fafb', text:'#374151', border:'#e5e7eb', label:'Pending',     dot:'#9ca3af' },
  in_progress: { bg:'#fffbeb', text:'#92400e', border:'#fcd34d', label:'In Progress', dot:'#f59e0b' },
  fixed:       { bg:'#f0fdf4', text:'#15803d', border:'#86efac', label:'Fixed ✅',    dot:'#16a34a' },
}

export default function ReportDetail() {
  const { id }       = useParams()
  const navigate     = useNavigate()
  const { user }     = useAuth()
  const [report,   setReport]   = useState(null)
  const [loading,  setLoading]  = useState(true)
  const [upvoting, setUpvoting] = useState(false)
  const [upvoted,  setUpvoted]  = useState(false)
  const [toast,    setToast]    = useState(null)
  const [deleteConfirm, setDeleteConfirm] = useState(false)

  useEffect(() => {
    getReport(id)
      .then(res => setReport(res.data))
      .catch(() => navigate('/map'))
      .finally(() => setLoading(false))
  }, [id])

  const showToast = msg => {
    setToast(msg)
    setTimeout(() => setToast(null), 3000)
  }

  const handleUpvote = async () => {
    if (!user)    return navigate('/login')
    if (upvoting || upvoted) return
    // Cannot upvote own report
    if (report.reporter_id === user?.id) return
    setUpvoting(true)
    try {
      const res = await upvoteReport(report.id)
      setReport(res.data)
      setUpvoted(true)
      showToast('Thanks for confirming! 🙏')
    } catch (err) {
      const detail = err.response?.data?.detail || ''
      if (err.response?.status === 400 && detail.toLowerCase().includes('already')) {
        setUpvoted(true)
        showToast('✅ Already confirmed!')
      } else {
        showToast('Could not upvote. Try again.')
      }
    } finally {
      setUpvoting(false)
    }
  }

  // ── Loading ──
  if (loading) return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50">
      <div className="text-center">
        <div className="animate-spin w-8 h-8 border-4 border-red-600 border-t-transparent rounded-full mx-auto mb-3"/>
        <p className="text-gray-400 text-sm">Loading report…</p>
      </div>
    </div>
  )

  if (!report) return null

  const sev = SEV_CONFIG[report.severity] || SEV_CONFIG.low
  const sta = STA_CONFIG[report.status]   || STA_CONFIG.pending

  return (
    <div className="min-h-screen bg-gray-50" style={{fontFamily:"'Inter',system-ui,sans-serif"}}>

      {/* Toast */}
      {toast && (
        <div className="fixed bottom-6 right-6 z-[9999] bg-gray-900 text-white px-4 py-3 rounded-2xl shadow-2xl text-sm font-medium"
          style={{animation:'slideUp .3s ease-out'}}>
          {toast}
        </div>
      )}

      <style>{`
        @keyframes slideUp{from{opacity:0;transform:translateY(12px)}to{opacity:1;transform:translateY(0)}}
      `}</style>

      {/* ── Navbar ── */}
      <header className="bg-red-600 text-white sticky top-0 z-30 shadow-md" style={{height:52}}>
        <div className="h-full flex items-center gap-3 px-4 max-w-4xl mx-auto">
          <button
            onClick={() => navigate(-1)}
            className="flex items-center gap-1.5 text-white/80 hover:text-white text-sm font-medium transition-colors"
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7"/>
            </svg>
            Back
          </button>
          <span className="text-white/40 text-sm">|</span>
          <span className="text-sm font-semibold text-white truncate flex-1">Report Detail</span>
          <button
            onClick={() => navigate('/map')}
            className="text-xs bg-white/15 hover:bg-white/25 border border-white/25 text-white font-medium px-3 py-1.5 rounded-lg transition-colors"
          >
            🗺️ View Map
          </button>
        </div>
      </header>

      <div className="max-w-3xl mx-auto px-4 py-6">

        {/* ── Photo ── */}
        {report.photo_url && (
          <div className="relative rounded-2xl overflow-hidden mb-5 shadow-md" style={{height:260}}>
            <img
              src={report.photo_url.startsWith('http') ? report.photo_url : `${API_BASE}${report.photo_url}`}
              alt={report.title}
              className="w-full h-full object-cover"
              onError={e => { e.target.style.display='none' }}
            />
            {/* Severity overlay badge on photo */}
            <div className="absolute top-3 left-3">
              <span
                className="text-xs font-bold px-3 py-1.5 rounded-full border shadow-sm"
                style={{background:sev.bg, color:sev.text, borderColor:sev.border}}
              >
                {sev.label}
              </span>
            </div>
          </div>
        )}

        {/* ── Main Card ── */}
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden mb-4">

          {/* Severity bar at top */}
          <div className="h-1" style={{background: report.severity==='high'?'#ef4444':report.severity==='medium'?'#f59e0b':'#22c55e'}}/>

          <div className="p-5">

            {/* Title + upvote */}
            <div className="flex items-start justify-between gap-3 mb-3">
              <h1 className="text-lg font-bold text-gray-900 leading-tight flex-1">
                {report.title}
              </h1>
              {report.reporter_id === user?.id ? (
                <span className="flex items-center gap-1.5 px-4 py-2 rounded-full text-sm font-semibold border bg-gray-50 text-gray-500 border-gray-200 shrink-0">
                  👤 Your report
                </span>
              ) : (
                <button
                  onClick={handleUpvote}
                  disabled={!user || upvoting || upvoted}
                  className={`flex items-center gap-1.5 px-4 py-2 rounded-full text-sm font-semibold border transition-all shrink-0
                    ${upvoted
                      ? 'bg-green-50 text-green-700 border-green-200 cursor-default'
                      : 'bg-red-50 text-red-600 border-red-200 hover:bg-red-100 active:scale-95'
                    } disabled:opacity-60`}
                >
                  {upvoting
                    ? <span className="animate-spin w-3 h-3 border-2 border-red-600 border-t-transparent rounded-full"/>
                    : upvoted ? '✅' : '👍'
                  }
                  {report.upvotes}
                </button>
              )}
            </div>

            {/* Badges row */}
            <div className="flex items-center gap-2 flex-wrap mb-4">
              {!report.photo_url && (
                <span
                  className="text-xs font-semibold px-2.5 py-1 rounded-full border"
                  style={{background:sev.bg, color:sev.text, borderColor:sev.border}}
                >
                  {sev.label}
                </span>
              )}
              <span
                className="text-xs font-semibold px-2.5 py-1 rounded-full border flex items-center gap-1"
                style={{background:sta.bg, color:sta.text, borderColor:sta.border}}
              >
                <span className="w-1.5 h-1.5 rounded-full" style={{background:sta.dot}}/>
                {sta.label}
              </span>
              {report.damage_type && (
                <span className="text-xs font-semibold px-2.5 py-1 rounded-full bg-purple-50 text-purple-700 border border-purple-200">
                  🤖 {report.damage_type.replace(/_/g,' ')}
                  {report.ai_confidence ? ` · ${Math.round(report.ai_confidence*100)}%` : ''}
                </span>
              )}
            </div>

            {/* Divider */}
            <div className="border-t border-gray-100 mb-4"/>

            {/* Info rows */}
            <div className="space-y-2.5">
              {report.address && (
                <div className="flex items-center gap-2.5 text-sm text-gray-600">
                  <span className="w-7 h-7 bg-red-50 rounded-lg flex items-center justify-center text-base shrink-0">📍</span>
                  {report.address}
                </div>
              )}
              <div className="flex items-center gap-2.5 text-sm text-gray-600">
                <span className="w-7 h-7 bg-blue-50 rounded-lg flex items-center justify-center text-base shrink-0">🕐</span>
                {timeAgo(report.created_at)} · {formatDateTime(report.created_at)}
              </div>
              <div className="flex items-center gap-2.5 text-sm text-gray-600">
                <span className="w-7 h-7 bg-gray-50 rounded-lg flex items-center justify-center text-base shrink-0">👤</span>
                <div className="flex items-center gap-2">
                  <div
                    className="w-5 h-5 rounded-full flex items-center justify-center text-white text-xs font-bold"
                    style={{background: avatarCol(report.reporter?.name || '')}}
                  >
                    {initials(report.reporter?.name || '?')}
                  </div>
                  <span>{report.reporter?.name || 'Anonymous'}</span>
                </div>
              </div>
              <div className="flex items-center gap-2.5 text-sm text-gray-600">
                <span className="w-7 h-7 bg-yellow-50 rounded-lg flex items-center justify-center text-base shrink-0">👍</span>
                <span><strong className="text-gray-900">{report.upvotes}</strong> citizens confirmed this problem</span>
              </div>
            </div>

            {/* Description */}
            {report.description && (
              <>
                <div className="border-t border-gray-100 mt-4 mb-3"/>
                <p className="text-sm text-gray-600 leading-relaxed">{report.description}</p>
              </>
            )}
          </div>
        </div>

        {/* ── AI Detection Card ── */}
        {report.damage_type && (
          <div className="bg-white rounded-2xl border border-purple-100 shadow-sm p-4 mb-4">
            <div className="flex items-center gap-2 mb-3">
              <span className="w-7 h-7 bg-purple-100 rounded-lg flex items-center justify-center text-base">🤖</span>
              <p className="text-sm font-semibold text-purple-900">AI Detection Result</p>
              
            </div>
            <div className="grid grid-cols-3 gap-3">
              <div className="bg-purple-50 rounded-xl p-3 text-center">
                <p className="text-xs text-purple-500 mb-1">Type</p>
                <p className="text-sm font-bold text-purple-900 capitalize">
                  {report.damage_type.replace(/_/g,' ')}
                </p>
              </div>
              {report.ai_confidence && (
                <div className="bg-purple-50 rounded-xl p-3 text-center">
                  <p className="text-xs text-purple-500 mb-1">Confidence</p>
                  <p className="text-sm font-bold text-purple-900">
                    {Math.round(report.ai_confidence*100)}%
                  </p>
                </div>
              )}
              <div className="bg-purple-50 rounded-xl p-3 text-center">
                <p className="text-xs text-purple-500 mb-1">Severity</p>
                <p className="text-sm font-bold capitalize" style={{color:sev.text}}>
                  {report.severity}
                </p>
              </div>
            </div>
          </div>
        )}

        {/* ── Status Timeline Card ── */}
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4 mb-4">
          <p className="text-sm font-semibold text-gray-800 mb-3 flex items-center gap-2">
            <span className="w-6 h-6 bg-gray-100 rounded-lg flex items-center justify-center text-sm">📋</span>
            Status Timeline
          </p>
          <div className="space-y-3">
            {[
              { key:'pending',     icon:'📍', label:'Report submitted',         done: true },
              { key:'in_progress', icon:'🔧', label:'Municipality working on it', done: report.status==='in_progress'||report.status==='fixed' },
              { key:'fixed',       icon:'✅', label:'Road fixed!',               done: report.status==='fixed' },
            ].map((step, i) => (
              <div key={step.key} className="flex items-center gap-3">
                <div className={`w-7 h-7 rounded-full flex items-center justify-center text-sm border-2 shrink-0
                  ${step.done
                    ? 'border-green-400 bg-green-50'
                    : 'border-gray-200 bg-gray-50'}`}>
                  {step.done ? '✓' : <span className="text-gray-300 text-xs">{i+1}</span>}
                </div>
                <p className={`text-sm ${step.done ? 'text-gray-800 font-medium' : 'text-gray-400'}`}>
                  {step.label}
                </p>
                {report.status === step.key && (
                  <span className="text-xs bg-blue-50 text-blue-600 border border-blue-100 px-2 py-0.5 rounded-full ml-auto">
                    Current
                  </span>
                )}
              </div>
            ))}
          </div>
        </div>

        {/* ── Mini Map ── */}
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden mb-4">
          <div className="px-4 py-3 border-b border-gray-100 flex items-center justify-between">
            <p className="text-sm font-semibold text-gray-800 flex items-center gap-2">
              <span>🗺️</span> Location
            </p>
            <a
              href={`https://www.google.com/maps?q=${report.latitude},${report.longitude}`}
              target="_blank" rel="noreferrer"
              className="text-xs text-red-600 font-medium hover:underline flex items-center gap-1"
            >
              Open in Google Maps ↗
            </a>
          </div>
          <div style={{height:240}}>
            <MapContainer
              center={[report.latitude, report.longitude]}
              zoom={16}
              style={{height:'100%', width:'100%'}}
              dragging={false}
              zoomControl={false}
              scrollWheelZoom={false}
            >
              <TileLayer
                attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
                url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
              />
              <Marker position={[report.latitude, report.longitude]}/>
            </MapContainer>
          </div>
        </div>

        {/* ── Confirm Button (bottom) ── */}
        {report.status !== 'fixed' && report.reporter_id !== user?.id && (
          <button
            onClick={handleUpvote}
            disabled={!user || upvoting || upvoted}
            className={`w-full py-3.5 rounded-2xl text-sm font-bold transition-all active:scale-[0.98] flex items-center justify-center gap-2
              ${upvoted
                ? 'bg-green-50 text-green-700 border-2 border-green-200'
                : 'bg-red-600 hover:bg-red-700 text-white shadow-lg'
              } disabled:opacity-60`}
          >
            {upvoting
              ? <><span className="animate-spin w-4 h-4 border-2 border-white border-t-transparent rounded-full"/>Confirming…</>
              : upvoted
              ? '✅ You confirmed this problem'
              : '👍 Confirm this road problem'
            }
          </button>
        )}

        {!user && (
          <p className="text-center text-xs text-gray-400 mt-2">
            <button onClick={()=>navigate('/login')} className="text-red-600 font-medium hover:underline">
              Login
            </button>{' '}
            to confirm this road problem
          </p>
        )}
      </div>
    </div>
  )
}