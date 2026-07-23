import { useEffect, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { getProfile } from '../api/auth'
import api from '../api/client'
import { timeAgo, formatDate } from '../utils/time'
import { API_BASE } from '../api/client'

function avatarCol(n = '') {
  const c = ['#ef4444','#f97316','#f59e0b','#16a34a','#0284c7','#6366f1','#9333ea','#ec4899']
  let h = 0
  for (let i = 0; i < n.length; i++) h = n.charCodeAt(i) + ((h << 5) - h)
  return c[Math.abs(h) % c.length]
}
function initials(n = '') {
  const p = n.trim().split(' ')
  return p.length >= 2 ? (p[0][0] + p[p.length-1][0]).toUpperCase() : n.slice(0, 2).toUpperCase()
}

const STA = {
  pending:     { bg:'bg-gray-100',   text:'text-gray-600',   dot:'bg-gray-400',   label:'Pending',   icon:'⏳' },
  in_progress: { bg:'bg-amber-100',  text:'text-amber-700',  dot:'bg-amber-500',  label:'Working',   icon:'🔧' },
  fixed:       { bg:'bg-green-100',  text:'text-green-700',  dot:'bg-green-500',  label:'Fixed',     icon:'✅' },
}
const SEV = {
  high:   { bar:'bg-red-500',    badge:'bg-red-100 text-red-700',    label:'High'   },
  medium: { bar:'bg-amber-500',  badge:'bg-amber-100 text-amber-700', label:'Medium' },
  low:    { bar:'bg-green-500',  badge:'bg-green-100 text-green-700', label:'Low'    },
}
const TABS = ['all','pending','in_progress','fixed']
const TAB_LABEL = { all:'All', pending:'Pending', in_progress:'Working', fixed:'Fixed' }

export default function MyReports() {
  const { user } = useAuth()
  const navigate = useNavigate()

  const [reports,  setReports]  = useState([])
  const [stats,    setStats]    = useState(null)
  const [loading,  setLoading]  = useState(true)
  const [tab,      setTab]      = useState('all')
  const [search,   setSearch]   = useState('')
  const [toast,    setToast]    = useState(null)
  const [delConfirm, setDel]    = useState(null)
  const [deleting, setDeleting] = useState(null)

  useEffect(() => {
    getProfile()
      .then(r => { setReports(r.data.reports); setStats(r.data.stats) })
      .catch(() => navigate('/login'))
      .finally(() => setLoading(false))
  }, [])

  const showToast = (msg, type = 'success') => {
    setToast({ msg, type })
    setTimeout(() => setToast(null), 3000)
  }

  const handleDelete = async (report) => {
    setDeleting(report.id)
    try {
      await api.delete(`/reports/${report.id}`)
      setReports(prev => prev.filter(r => r.id !== report.id))
      setDel(null)
      showToast('Report deleted')
    } catch (err) {
      showToast(err.response?.data?.detail || 'Delete failed', 'error')
      setDel(null)
    } finally { setDeleting(null) }
  }

  const filtered = reports.filter(r => {
    if (tab !== 'all' && r.status !== tab) return false
    if (search && !r.title.toLowerCase().includes(search.toLowerCase()) &&
        !(r.address || '').toLowerCase().includes(search.toLowerCase())) return false
    return true
  })

  const counts = {
    all:         reports.length,
    pending:     reports.filter(r => r.status === 'pending').length,
    in_progress: reports.filter(r => r.status === 'in_progress').length,
    fixed:       reports.filter(r => r.status === 'fixed').length,
  }

  return (
    <div className="min-h-screen bg-gray-50" style={{fontFamily:"'Inter',system-ui,sans-serif"}}>

      {/* Toast */}
      {toast && (
        <div className={`fixed bottom-6 right-6 z-[9999] px-4 py-3 rounded-2xl shadow-2xl text-sm font-medium text-white
          ${toast.type === 'error' ? 'bg-red-600' : 'bg-gray-900'}`}
          style={{animation:'slideUp .3s ease-out'}}>
          {toast.msg}
        </div>
      )}
      <style>{`@keyframes slideUp{from{opacity:0;transform:translateY(12px)}to{opacity:1;transform:translateY(0)}}`}</style>

      {/* Header */}
      <header className="bg-red-600 text-white sticky top-0 z-30 shadow-md" style={{height:52}}>
        <div className="h-full flex items-center gap-3 px-4 max-w-3xl mx-auto">
          <button onClick={() => navigate('/profile')}
            className="flex items-center gap-1.5 text-white/80 hover:text-white text-sm font-medium transition-colors">
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7"/>
            </svg>
            Profile
          </button>
          <span className="text-white/40">|</span>
          <span className="text-sm font-semibold flex-1">My Reports</span>
          <Link to="/report/new"
            className="text-xs bg-white text-red-600 font-bold px-3 py-1.5 rounded-lg hover:bg-red-50 transition-colors">
            + New
          </Link>
        </div>
      </header>

      <div className="max-w-3xl mx-auto px-4 py-6">

        {/* Stats row */}
        {stats && (
          <div className="grid grid-cols-4 gap-3 mb-5">
            {[
              { label:'Total',    val: stats.total_reports,   color:'#ef4444', bg:'bg-red-50'   },
              { label:'Pending',  val: stats.pending,         color:'#9ca3af', bg:'bg-gray-50'  },
              { label:'Working',  val: stats.in_progress,     color:'#f59e0b', bg:'bg-amber-50' },
              { label:'Fixed',    val: stats.fixed,           color:'#16a34a', bg:'bg-green-50' },
            ].map(s => (
              <div key={s.label} className={`${s.bg} rounded-2xl p-3 text-center border border-white shadow-sm`}>
                <p className="text-xl font-extrabold" style={{color: s.color}}>{s.val}</p>
                <p className="text-xs text-gray-500 mt-0.5 font-medium">{s.label}</p>
              </div>
            ))}
          </div>
        )}

        {/* Search */}
        <div className="relative mb-4">
          <svg className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"/>
          </svg>
          <input value={search} onChange={e => setSearch(e.target.value)}
            placeholder="Search reports by title or address…"
            className="w-full bg-white border border-gray-200 rounded-xl pl-10 pr-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-red-500/40 focus:border-red-400 transition-all"/>
          {search && (
            <button onClick={() => setSearch('')} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600">✕</button>
          )}
        </div>

        {/* Tab bar */}
        <div className="flex gap-1 bg-white rounded-xl border border-gray-100 p-1 mb-4 shadow-sm">
          {TABS.map(t => (
            <button key={t} onClick={() => setTab(t)}
              className={`flex-1 py-2 rounded-lg text-xs font-semibold transition-all ${
                tab === t ? 'bg-red-600 text-white shadow-sm' : 'text-gray-500 hover:text-gray-700 hover:bg-gray-50'
              }`}>
              {TAB_LABEL[t]}
              <span className={`ml-1 ${tab === t ? 'text-white/80' : 'text-gray-400'}`}>({counts[t]})</span>
            </button>
          ))}
        </div>

        {/* List */}
        {loading ? (
          <div className="text-center py-16">
            <div className="animate-spin w-7 h-7 border-4 border-red-600 border-t-transparent rounded-full mx-auto mb-3"/>
            <p className="text-gray-400 text-sm">Loading your reports…</p>
          </div>
        ) : filtered.length === 0 ? (
          <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-12 text-center">
            <p className="text-3xl mb-3">📋</p>
            <p className="text-gray-500 font-medium text-sm">
              {search ? 'No reports match your search' : tab === 'all' ? "You haven't reported anything yet" : `No ${TAB_LABEL[tab].toLowerCase()} reports`}
            </p>
            {tab === 'all' && !search && (
              <Link to="/report/new" className="inline-block mt-4 bg-red-600 text-white text-sm font-semibold px-5 py-2.5 rounded-xl hover:bg-red-700 transition-colors">
                Report your first road issue →
              </Link>
            )}
          </div>
        ) : (
          <div className="space-y-3">
            {filtered.map(r => {
              const sta = STA[r.status] || STA.pending
              const sev = SEV[r.severity] || SEV.medium
              return (
                <div key={r.id} className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
                  {/* Severity colour bar */}
                  <div className={`h-1 ${sev.bar}`}/>
                  <div className="p-4">
                    <div className="flex items-start gap-3">
                      {/* Photo thumbnail or placeholder */}
                      <div className="w-14 h-14 rounded-xl bg-gray-100 shrink-0 overflow-hidden flex items-center justify-center">
                        {r.photo_url ? (
                          <img
                            src={r.photo_url.startsWith('data:') || r.photo_url.startsWith('http') ? r.photo_url : `${API_BASE}${r.photo_url}`}
                            alt={r.title}
                            className="w-full h-full object-cover"
                            onError={e => { e.target.style.display='none' }}
                          />
                        ) : (
                          <span className="text-2xl">🛣️</span>
                        )}
                      </div>

                      <div className="flex-1 min-w-0">
                        <div className="flex items-start justify-between gap-2 mb-1">
                          <h3 className="text-sm font-bold text-gray-900 leading-snug truncate">{r.title}</h3>
                          <div className="flex items-center gap-1.5 shrink-0">
                            <span className={`text-xs px-2 py-0.5 rounded-full font-semibold ${sta.bg} ${sta.text}`}>
                              {sta.icon} {sta.label}
                            </span>
                            {r.status !== 'fixed' && (
                              <button onClick={() => setDel(r.id)}
                                className="text-gray-300 hover:text-red-500 transition-colors p-0.5"
                                title="Delete">
                                <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                                  <path strokeLinecap="round" strokeLinejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"/>
                                </svg>
                              </button>
                            )}
                          </div>
                        </div>

                        {r.address && (
                          <p className="text-xs text-gray-400 truncate mb-1.5">📍 {r.address}</p>
                        )}

                        <div className="flex items-center gap-3 flex-wrap">
                          <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${sev.badge}`}>
                            {sev.label}
                          </span>
                          <span className="text-xs text-gray-400">👍 {r.upvotes} confirmed</span>
                          <span className="text-xs text-gray-400">{timeAgo(r.created_at)}</span>
                          {r.damage_type && (
                            <span className="text-xs bg-purple-50 text-purple-600 px-2 py-0.5 rounded-full">
                              🤖 {r.damage_type.replace(/_/g,' ')}
                            </span>
                          )}
                        </div>

                        {r.status === 'fixed' && (
                          <div className="mt-2 text-xs text-green-700 bg-green-50 border border-green-100 rounded-lg px-3 py-1.5 flex items-center gap-1.5">
                            🎉 Fixed on {formatDate(r.updated_at)} — You made a difference!
                          </div>
                        )}
                      </div>
                    </div>

                    {/* Delete confirmation */}
                    {delConfirm === r.id && (
                      <div className="mt-3 p-3 bg-red-50 border border-red-100 rounded-xl">
                        <p className="text-xs text-red-700 font-medium mb-2">Delete this report? Cannot be undone.</p>
                        <div className="flex gap-2">
                          <button onClick={() => handleDelete(r)} disabled={deleting === r.id}
                            className="text-xs bg-red-600 text-white font-semibold px-3 py-1.5 rounded-lg disabled:opacity-60">
                            {deleting === r.id ? 'Deleting…' : 'Yes, delete'}
                          </button>
                          <button onClick={() => setDel(null)}
                            className="text-xs border border-gray-200 text-gray-600 font-semibold px-3 py-1.5 rounded-lg hover:bg-gray-50">
                            Cancel
                          </button>
                        </div>
                      </div>
                    )}

                    <Link to={`/reports/${r.id}`}
                      className="mt-3 flex items-center gap-1 text-xs text-red-600 font-semibold hover:underline">
                      View full report →
                    </Link>
                  </div>
                </div>
              )
            })}
          </div>
        )}

      </div>
    </div>
  )
}
