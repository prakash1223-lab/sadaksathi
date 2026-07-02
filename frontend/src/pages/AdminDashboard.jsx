import { useEffect, useState, useRef } from 'react'
import { useNavigate, Link } from 'react-router-dom'
import { MapContainer, TileLayer, useMap } from 'react-leaflet'
import L from 'leaflet'
import 'leaflet.heat'
import { formatDate } from '../utils/time'
import { useAuth } from '../context/AuthContext'
import { getAdminStats, getAdminReports, updateStatus, exportCsv, getHeatmapData } from '../api/admin'

// ── Heat layer component ──────────────────────────────────────────────────────
function HeatLayer({ points }) {
  const map = useMap()
  const ref = useRef(null)
  useEffect(() => {
    if (!points.length) return
    ref.current = L.heatLayer(
      points.map(p => [p.lat, p.lng, p.intensity]),
      { radius: 35, blur: 20, maxZoom: 17,
        gradient: { 0.2:'#00ff00', 0.5:'#ffff00', 0.8:'#ff6600', 1.0:'#ff0000' } }
    ).addTo(map)
    return () => { if (ref.current) ref.current.remove() }
  }, [points, map])
  return null
}

// ── Helpers ───────────────────────────────────────────────────────────────────
const SEV_STYLE = {
  low:    { bg:'bg-green-100',  text:'text-green-700',  dot:'🟢', label:'Low'    },
  medium: { bg:'bg-yellow-100', text:'text-yellow-700', dot:'🟡', label:'Medium' },
  high:   { bg:'bg-red-100',    text:'text-red-700',    dot:'🔴', label:'High'   },
}
const STA_STYLE = {
  pending:     { bg:'bg-gray-100',  text:'text-gray-600',  label:'Pending'     },
  in_progress: { bg:'bg-blue-100',  text:'text-blue-700',  label:'In Progress' },
  fixed:       { bg:'bg-green-100', text:'text-green-700', label:'Fixed'       },
}

function StatCard({ value, label, sub, color = 'text-red-600', icon }) {
  return (
    <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4 flex items-center gap-3">
      {icon && <span className="text-2xl">{icon}</span>}
      <div>
        <p className={`text-2xl font-extrabold ${color}`}>{value ?? '—'}</p>
        <p className="text-xs font-semibold text-gray-700 leading-tight">{label}</p>
        {sub && <p className="text-xs text-gray-400">{sub}</p>}
      </div>
    </div>
  )
}

// ── Confirm modal ─────────────────────────────────────────────────────────────
function ConfirmModal({ report, onConfirm, onCancel }) {
  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-2xl p-6 max-w-sm w-full">
        <p className="text-lg font-bold text-gray-900 mb-2">Confirm road is fixed?</p>
        <p className="text-sm text-gray-500 mb-1">
          <span className="font-medium text-gray-700">{report.title}</span>
        </p>
        <p className="text-xs text-gray-400 mb-5">This will mark the report as fixed and notify the reporter.</p>
        <div className="flex gap-3">
          <button onClick={onConfirm}
            className="flex-1 bg-green-600 hover:bg-green-700 text-white font-semibold py-2.5 rounded-xl text-sm transition-colors">
            ✅ Yes, Mark Fixed
          </button>
          <button onClick={onCancel}
            className="flex-1 border border-gray-200 text-gray-600 font-semibold py-2.5 rounded-xl text-sm hover:bg-gray-50 transition-colors">
            Cancel
          </button>
        </div>
      </div>
    </div>
  )
}

// ── Main ──────────────────────────────────────────────────────────────────────
export default function AdminDashboard() {
  const { user, logout } = useAuth()
  const navigate = useNavigate()

  const [stats,     setStats]     = useState(null)
  const [reports,   setReports]   = useState([])
  const [heat,      setHeat]      = useState([])
  const [loading,   setLoading]   = useState(true)
  const [updating,  setUpdating]  = useState(null)
  const [confirm,   setConfirm]   = useState(null)   // report to confirm fix
  const [exporting, setExporting] = useState(false)

  // Filters
  const [sevFilter,  setSevFilter]  = useState('')
  const [staFilter,  setStaFilter]  = useState('')
  const [sortBy,     setSortBy]     = useState('newest')
  const [search,     setSearch]     = useState('')
  const [page,       setPage]       = useState(1)

  const fetchReports = () => {
    const params = { sort: sortBy, page, limit: 20 }
    if (sevFilter) params.severity = sevFilter
    if (staFilter) params.status   = staFilter
    if (search)    params.search   = search
    getAdminReports(params).then(r => setReports(r.data)).catch(() => {})
  }

  useEffect(() => {
    Promise.all([
      getAdminStats().then(r => setStats(r.data)),
      getHeatmapData().then(r => setHeat(r.data)),
    ]).finally(() => setLoading(false))
  }, [])

  useEffect(() => { fetchReports() }, [sevFilter, staFilter, sortBy, search, page])

  const doStatusUpdate = async (report, status) => {
    setUpdating(report.id)
    try {
      const res = await updateStatus(report.id, status)
      setReports(prev => prev.map(r => r.id === report.id ? res.data : r))
      if (stats) {
        getAdminStats().then(r => setStats(r.data))
      }
    } finally {
      setUpdating(null)
      setConfirm(null)
    }
  }

  const handleExport = async () => {
    setExporting(true)
    try {
      const res = await exportCsv()
      const url = URL.createObjectURL(new Blob([res.data]))
      const a   = document.createElement('a')
      a.href    = url
      a.download = `sadaksathi_reports_${new Date().toISOString().slice(0,10)}.csv`
      a.click()
      URL.revokeObjectURL(url)
    } finally { setExporting(false) }
  }

  // Top 5 critical reports — (severity_score × 2) + upvotes
  const sevScore = { high: 3, medium: 2, low: 1 }
  const topProblems = [...reports]
    .sort((a, b) =>
      ((sevScore[b.severity] || 0) * 2 + b.upvotes) -
      ((sevScore[a.severity] || 0) * 2 + a.upvotes)
    ).slice(0, 5)

  if (loading) return (
    <div className="flex items-center justify-center min-h-screen">
      <div className="text-gray-400 text-sm">Loading admin dashboard...</div>
    </div>
  )

  return (
    <div className="min-h-screen bg-gray-50">
      {confirm && (
        <ConfirmModal
          report={confirm}
          onConfirm={() => doStatusUpdate(confirm, 'fixed')}
          onCancel={() => setConfirm(null)}
        />
      )}

      {/* ── Admin Navbar ── */}
      <header className="bg-gray-900 text-white shadow-md">
        <div className="max-w-7xl mx-auto px-4 h-12 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <span className="text-lg font-bold">🛣️ SadakSathi</span>
            <span className="text-gray-400 text-xs hidden sm:inline">|</span>
            <span className="text-gray-300 text-xs hidden sm:inline font-medium">KMC Admin Dashboard</span>
          </div>
          <div className="flex items-center gap-3 text-xs">
            <Link to="/map" className="text-gray-400 hover:text-white transition-colors">← Live Map</Link>
            <span className="text-gray-500">|</span>
            <span className="text-gray-300">👤 {user?.name}</span>
            <button onClick={() => { logout(); navigate('/login') }}
              className="text-red-400 hover:text-red-300 transition-colors">Logout</button>
          </div>
        </div>
      </header>

      <div className="max-w-7xl mx-auto px-4 py-6 space-y-6">

        {/* ── SECTION 1: Stats ── */}
        <div>
          <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wide mb-3">Overview</h2>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <StatCard value={stats?.total_reports}    label="Total Reports"   icon="📋" color="text-gray-800" />
            <StatCard value={stats?.pending}          label="Pending"         icon="⏳" color="text-yellow-600" />
            <StatCard value={stats?.in_progress}      label="In Progress"     icon="🔧" color="text-blue-600" />
            <StatCard value={stats?.fixed}            label="Fixed"           icon="✅" color="text-green-600" />
            <StatCard value={stats?.total_users}      label="Total Users"     icon="👥" color="text-indigo-600" />
            <StatCard value={stats?.reports_today}    label="Today's Reports" icon="📅" color="text-red-600" />
            <StatCard value={stats?.reports_this_week} label="This Week"      icon="📊" color="text-purple-600" />
            <StatCard
              value={stats?.avg_fix_time_days != null ? `${stats.avg_fix_time_days}d` : 'N/A'}
              label="Avg Fix Time" icon="⏱️" color="text-teal-600"
            />
          </div>

          {/* Severity breakdown */}
          <div className="grid grid-cols-3 gap-3 mt-3">
            <div className="bg-red-50 border border-red-200 rounded-2xl p-3 text-center">
              <p className="text-2xl font-extrabold text-red-600">{stats?.high_severity}</p>
              <p className="text-xs font-semibold text-red-700">🔴 High Severity</p>
            </div>
            <div className="bg-yellow-50 border border-yellow-200 rounded-2xl p-3 text-center">
              <p className="text-2xl font-extrabold text-yellow-600">{stats?.medium_severity}</p>
              <p className="text-xs font-semibold text-yellow-700">🟡 Medium Severity</p>
            </div>
            <div className="bg-green-50 border border-green-200 rounded-2xl p-3 text-center">
              <p className="text-2xl font-extrabold text-green-600">{stats?.low_severity}</p>
              <p className="text-xs font-semibold text-green-700">🟢 Low Severity</p>
            </div>
          </div>

          {stats?.most_affected_area && (
            <p className="text-xs text-gray-500 mt-2">
              📍 Most affected area: <span className="font-semibold text-gray-700">{stats.most_affected_area}</span>
            </p>
          )}
        </div>

        {/* ── SECTION 2: Heatmap ── */}
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
          <div className="px-5 py-3 border-b border-gray-100">
            <h2 className="font-bold text-gray-900">📍 Problem Hotspots in Kathmandu</h2>
            <p className="text-xs text-gray-500 mt-0.5">Concentration of road damage reports</p>
          </div>
          <div style={{ height: 400 }}>
            <MapContainer center={[27.7172, 85.324]} zoom={12}
              style={{ height: '100%', width: '100%' }}
              scrollWheelZoom={false} zoomControl={true}>
              <TileLayer
                attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
                url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
              />
              {heat.length > 0 && <HeatLayer points={heat} />}
            </MapContainer>
          </div>
        </div>

        {/* ── SECTION 3 + 4 side-by-side on large screens ── */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">

          {/* SECTION 3: Reports table — takes 2/3 */}
          <div className="lg:col-span-2 bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
            {/* Filter bar */}
            <div className="px-4 py-3 border-b border-gray-100 flex flex-wrap gap-2 items-center">
              <h2 className="font-bold text-gray-900 text-sm mr-2">All Reports</h2>

              {/* Severity filter */}
              {[['','All'],['high','🔴 High'],['medium','🟡 Medium'],['low','🟢 Low']].map(([v,l]) => (
                <button key={v} onClick={() => { setSevFilter(v); setPage(1) }}
                  className={`px-2.5 py-1 rounded-full text-xs font-semibold transition-colors ${
                    sevFilter === v ? 'bg-red-600 text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                  }`}>
                  {l}
                </button>
              ))}

              <div className="w-px h-4 bg-gray-200 mx-1" />

              {/* Status filter */}
              {[['','All'],['pending','Pending'],['in_progress','Working'],['fixed','Fixed']].map(([v,l]) => (
                <button key={v} onClick={() => { setStaFilter(v); setPage(1) }}
                  className={`px-2.5 py-1 rounded-full text-xs font-semibold transition-colors ${
                    staFilter === v ? 'bg-gray-800 text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                  }`}>
                  {l}
                </button>
              ))}

              <div className="ml-auto flex items-center gap-2">
                {/* Search */}
                <input value={search} onChange={e => { setSearch(e.target.value); setPage(1) }}
                  placeholder="🔍 Search location…"
                  className="border border-gray-200 rounded-xl px-3 py-1.5 text-xs focus:outline-none focus:ring-2 focus:ring-red-500 w-36" />

                {/* Sort */}
                <select value={sortBy} onChange={e => setSortBy(e.target.value)}
                  className="border border-gray-200 rounded-xl px-2 py-1.5 text-xs bg-white focus:outline-none focus:ring-2 focus:ring-red-500">
                  <option value="newest">Newest</option>
                  <option value="oldest">Oldest</option>
                  <option value="most_upvoted">Most Upvoted</option>
                  <option value="highest_severity">Highest Severity</option>
                </select>

                {/* Export */}
                <button onClick={handleExport} disabled={exporting}
                  className="flex items-center gap-1 bg-gray-800 hover:bg-gray-700 text-white px-3 py-1.5 rounded-xl text-xs font-semibold transition-colors disabled:opacity-60">
                  {exporting ? '⏳' : '📥'} CSV
                </button>
              </div>
            </div>

            {/* Table */}
            <div className="overflow-x-auto">
              <table className="w-full text-sm min-w-[700px]">
                <thead className="bg-gray-50 text-gray-500 text-xs uppercase tracking-wide">
                  <tr>
                    <th className="px-3 py-2.5 text-left">#</th>
                    <th className="px-3 py-2.5 text-left">Title / Location</th>
                    <th className="px-3 py-2.5 text-left">⚠️</th>
                    <th className="px-3 py-2.5 text-left">Status</th>
                    <th className="px-3 py-2.5 text-left">👍</th>
                    <th className="px-3 py-2.5 text-left">Reporter</th>
                    <th className="px-3 py-2.5 text-left">Date</th>
                    <th className="px-3 py-2.5 text-left">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-50">
                  {reports.map(r => {
                    const sev = SEV_STYLE[r.severity] || SEV_STYLE.medium
                    const sta = STA_STYLE[r.status]   || STA_STYLE.pending
                    const busy = updating === r.id
                    return (
                      <tr key={r.id} className="hover:bg-gray-50">
                        <td className="px-3 py-2.5 text-gray-400 text-xs">{r.id}</td>
                        <td className="px-3 py-2.5">
                          <Link to={`/reports/${r.id}`} className="font-medium text-gray-900 hover:text-red-600 text-xs line-clamp-1">
                            {r.title}
                          </Link>
                          {r.address && <p className="text-xs text-gray-400 truncate max-w-[160px]">{r.address}</p>}
                        </td>
                        <td className="px-3 py-2.5">
                          <span className={`text-xs px-1.5 py-0.5 rounded-full font-medium ${sev.bg} ${sev.text}`}>
                            {sev.dot}
                          </span>
                        </td>
                        <td className="px-3 py-2.5">
                          <span className={`text-xs px-2 py-0.5 rounded-full font-medium capitalize ${sta.bg} ${sta.text}`}>
                            {sta.label}
                          </span>
                        </td>
                        <td className="px-3 py-2.5 text-gray-600 text-xs">{r.upvotes}</td>
                        <td className="px-3 py-2.5">
                          <p className="text-xs text-gray-700 font-medium">{r.reporter?.name}</p>
                          <p className="text-xs text-gray-400">{r.reporter?.phone}</p>
                        </td>
                        <td className="px-3 py-2.5 text-gray-400 text-xs whitespace-nowrap">
                          {formatDate(r.created_at)}
                        </td>
                        <td className="px-3 py-2.5">
                          <div className="flex items-center gap-1">
                            {r.status === 'pending' && (
                              <button onClick={() => doStatusUpdate(r, 'in_progress')} disabled={busy}
                                className="text-xs bg-yellow-100 hover:bg-yellow-200 text-yellow-700 font-semibold px-2 py-1 rounded-lg transition-colors disabled:opacity-50 whitespace-nowrap">
                                🔧 Start
                              </button>
                            )}
                            {r.status === 'in_progress' && (
                              <button onClick={() => setConfirm(r)} disabled={busy}
                                className="text-xs bg-green-100 hover:bg-green-200 text-green-700 font-semibold px-2 py-1 rounded-lg transition-colors disabled:opacity-50 whitespace-nowrap">
                                ✅ Fixed
                              </button>
                            )}
                            {r.status === 'fixed' && (
                              <span className="text-xs text-green-600 font-semibold">✅</span>
                            )}
                            <a href={`/map`} className="text-xs text-gray-400 hover:text-red-600 px-1 py-1 transition-colors" title="View on map">
                              🗺️
                            </a>
                          </div>
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
              {reports.length === 0 && (
                <div className="text-center py-10 text-gray-400 text-sm">No reports match your filters</div>
              )}
            </div>

            {/* Pagination */}
            <div className="px-4 py-3 border-t border-gray-100 flex items-center justify-between text-xs text-gray-500">
              <span>{reports.length} reports shown</span>
              <div className="flex gap-2">
                <button onClick={() => setPage(p => Math.max(1, p - 1))} disabled={page === 1}
                  className="px-3 py-1 border border-gray-200 rounded-lg hover:bg-gray-50 disabled:opacity-40 transition-colors">
                  ← Prev
                </button>
                <span className="px-3 py-1">Page {page}</span>
                <button onClick={() => setPage(p => p + 1)} disabled={reports.length < 20}
                  className="px-3 py-1 border border-gray-200 rounded-lg hover:bg-gray-50 disabled:opacity-40 transition-colors">
                  Next →
                </button>
              </div>
            </div>
          </div>

          {/* SECTION 4: Top Problems — takes 1/3 */}
          <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
            <div className="px-5 py-3 border-b border-gray-100">
              <h2 className="font-bold text-gray-900 text-sm">🚨 Most Critical Roads</h2>
              <p className="text-xs text-gray-500 mt-0.5">Ranked by severity × 2 + upvotes</p>
            </div>
            <div className="divide-y divide-gray-50">
              {topProblems.length === 0 && (
                <p className="text-center py-8 text-sm text-gray-400">No reports yet</p>
              )}
              {topProblems.map((r, i) => {
                const sev  = SEV_STYLE[r.severity] || SEV_STYLE.medium
                const score = (sevScore[r.severity] || 0) * 2 + r.upvotes
                return (
                  <div key={r.id} className="px-5 py-3 hover:bg-gray-50 transition-colors">
                    <div className="flex items-start gap-3">
                      <span className="text-lg font-black text-gray-300 w-6 shrink-0">#{i + 1}</span>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-1.5 mb-0.5">
                          <span className="text-sm">{sev.dot}</span>
                          <p className="font-semibold text-gray-900 text-xs leading-snug truncate">{r.title}</p>
                        </div>
                        {r.address && <p className="text-xs text-gray-400 truncate">{r.address}</p>}
                        <div className="flex items-center gap-2 mt-1">
                          <span className="text-xs text-gray-500">👍 {r.upvotes} upvotes</span>
                          <span className="text-xs font-semibold text-purple-600">Score: {score}</span>
                        </div>
                      </div>
                    </div>
                  </div>
                )
              })}
            </div>
          </div>

        </div>
      </div>
    </div>
  )
}
