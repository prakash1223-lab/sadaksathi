import { useEffect, useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { MapContainer, TileLayer, Marker } from 'react-leaflet'
import L from 'leaflet'
import {
  getReport, upvoteReport,
  getComments, addComment, deleteComment,
  getReviews, addReview,
} from '../api/reports'
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
  return p.length >= 2 ? (p[0][0] + p[p.length-1][0]).toUpperCase() : n.slice(0, 2).toUpperCase()
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

// ── Star row helper ────────────────────────────────────────────────────────────
function Stars({ rating, interactive = false, onSelect }) {
  return (
    <div className="flex gap-0.5">
      {[1,2,3,4,5].map(s => (
        <button
          key={s}
          type="button"
          onClick={() => interactive && onSelect?.(s)}
          className={`leading-none transition-transform ${interactive ? 'hover:scale-125 cursor-pointer text-xl' : 'text-sm cursor-default'}`}
        >
          {s <= rating ? '⭐' : '☆'}
        </button>
      ))}
    </div>
  )
}

export default function ReportDetail() {
  const { id }     = useParams()
  const navigate   = useNavigate()
  const { user }   = useAuth()

  const [report,   setReport]   = useState(null)
  const [loading,  setLoading]  = useState(true)
  const [upvoting, setUpvoting] = useState(false)
  const [upvoted,  setUpvoted]  = useState(false)
  const [toast,    setToast]    = useState(null)

  // ── comments state ──
  const [showComments,       setShowComments]       = useState(false)
  const [activeTab,          setActiveTab]          = useState('comments')
  const [comments,           setComments]           = useState([])
  const [newComment,         setNewComment]         = useState('')
  const [submittingComment,  setSubmittingComment]  = useState(false)

  // ── reviews state ──
  const [reviews,           setReviews]           = useState([])
  const [avgRating,         setAvgRating]         = useState(0)
  const [newRating,         setNewRating]         = useState(0)
  const [newReview,         setNewReview]         = useState('')
  const [submittingReview,  setSubmittingReview]  = useState(false)
  const [hasReviewed,       setHasReviewed]       = useState(false)

  // ── load report ──
  useEffect(() => {
    getReport(id)
      .then(res => setReport(res.data))
      .catch(() => navigate('/map'))
      .finally(() => setLoading(false))
  }, [id])

  // ── load comments + reviews once report is known ──
  useEffect(() => {
    if (!report) return
    getComments(report.id)
      .then(r => setComments(r.data))
      .catch(() => {})
    getReviews(report.id)
      .then(r => {
        setReviews(r.data.reviews)
        setAvgRating(r.data.average_rating || 0)
        if (user) {
          const already = r.data.reviews.some(rv => rv.user?.name === user.name)
          setHasReviewed(already)
        }
      })
      .catch(() => {})
  }, [report])

  const showToast = msg => { setToast(msg); setTimeout(() => setToast(null), 3000) }

  const handleUpvote = async () => {
    if (!user) return navigate('/login')
    if (upvoting || upvoted) return
    if (report.reporter_id === user?.id) return
    setUpvoting(true)
    try {
      const res = await upvoteReport(report.id)
      setReport(res.data); setUpvoted(true); showToast('Thanks for confirming! 🙏')
    } catch (err) {
      const detail = err.response?.data?.detail || ''
      if (err.response?.status === 400 && detail.toLowerCase().includes('already')) {
        setUpvoted(true); showToast('✅ Already confirmed!')
      } else {
        showToast('Could not upvote. Try again.')
      }
    } finally { setUpvoting(false) }
  }

  const handleAddComment = async () => {
    if (!newComment.trim()) return
    setSubmittingComment(true)
    try {
      const res = await addComment(report.id, newComment.trim())
      setComments(prev => [...prev, res.data])
      setNewComment('')
    } catch (err) {
      showToast(err.response?.data?.detail || 'Failed to post comment')
    } finally { setSubmittingComment(false) }
  }

  const handleDeleteComment = async (commentId) => {
    if (!window.confirm('Delete this comment?')) return
    try {
      await deleteComment(commentId)
      setComments(prev => prev.filter(c => c.id !== commentId))
    } catch { showToast('Could not delete comment') }
  }

  const handleAddReview = async () => {
    if (newRating === 0) { showToast('Please select a star rating'); return }
    setSubmittingReview(true)
    try {
      const res = await addReview(report.id, { rating: newRating, content: newReview.trim() || null })
      setReviews(prev => [res.data, ...prev])
      setHasReviewed(true)
      showToast('Review submitted! Thank you 🙏')
      // Refresh average
      const r = await getReviews(report.id)
      setAvgRating(r.data.average_rating || 0)
    } catch (err) {
      showToast(err.response?.data?.detail || 'Failed to submit review')
    } finally { setSubmittingReview(false) }
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
        @keyframes fadeIn{from{opacity:0;transform:translateY(6px)}to{opacity:1;transform:translateY(0)}}
        .comment-item{animation:fadeIn .25s ease-out}
      `}</style>

      {/* ── Navbar ── */}
      <header className="bg-red-600 text-white sticky top-0 z-30 shadow-md" style={{height:52}}>
        <div className="h-full flex items-center gap-3 px-4 max-w-4xl mx-auto">
          <button onClick={() => navigate(-1)}
            className="flex items-center gap-1.5 text-white/80 hover:text-white text-sm font-medium transition-colors">
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7"/>
            </svg>
            Back
          </button>
          <span className="text-white/40 text-sm">|</span>
          <span className="text-sm font-semibold text-white truncate flex-1">Report Detail</span>
          <button onClick={() => navigate('/map')}
            className="text-xs bg-white/15 hover:bg-white/25 border border-white/25 text-white font-medium px-3 py-1.5 rounded-lg transition-colors">
            🗺️ View Map
          </button>
        </div>
      </header>

      <div className="max-w-3xl mx-auto px-4 py-6">

        {/* ── Photo ── */}
        {report.photo_url && (
          <div className="relative rounded-2xl overflow-hidden mb-5 shadow-md" style={{height:260}}>
            <img
              src={
                report.photo_url.startsWith('data:') || report.photo_url.startsWith('http')
                  ? report.photo_url
                  : `${API_BASE}${report.photo_url}`
              }
              alt={report.title}
              className="w-full h-full object-cover"
              onError={e => {
                e.target.style.display = 'none'
                e.target.nextSibling.style.display = 'flex'
              }}
            />
            {/* Fallback shown when image fails to load */}
            <div className="w-full h-full bg-gray-100 items-center justify-center flex-col gap-2 text-gray-400"
              style={{display:'none', position:'absolute', inset:0}}>
              <span className="text-4xl">🖼️</span>
              <p className="text-xs">Image unavailable</p>
            </div>
            <div className="absolute top-3 left-3">
              <span className="text-xs font-bold px-3 py-1.5 rounded-full border shadow-sm"
                style={{background:sev.bg, color:sev.text, borderColor:sev.border}}>
                {sev.label}
              </span>
            </div>
          </div>
        )}

        {/* ── Main Card ── */}
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden mb-4">
          <div className="h-1" style={{background: report.severity==='high'?'#ef4444':report.severity==='medium'?'#f59e0b':'#22c55e'}}/>
          <div className="p-5">
            <div className="flex items-start justify-between gap-3 mb-3">
              <h1 className="text-lg font-bold text-gray-900 leading-tight flex-1">{report.title}</h1>
              {report.reporter_id === user?.id ? (
                <span className="flex items-center gap-1.5 px-4 py-2 rounded-full text-sm font-semibold border bg-gray-50 text-gray-500 border-gray-200 shrink-0">
                  👤 Your report
                </span>
              ) : (
                <button onClick={handleUpvote} disabled={!user || upvoting || upvoted}
                  className={`flex items-center gap-1.5 px-4 py-2 rounded-full text-sm font-semibold border transition-all shrink-0
                    ${upvoted ? 'bg-green-50 text-green-700 border-green-200 cursor-default'
                              : 'bg-red-50 text-red-600 border-red-200 hover:bg-red-100 active:scale-95'
                    } disabled:opacity-60`}>
                  {upvoting ? <span className="animate-spin w-3 h-3 border-2 border-red-600 border-t-transparent rounded-full"/> : upvoted ? '✅' : '👍'}
                  {report.upvotes}
                </button>
              )}
            </div>

            <div className="flex items-center gap-2 flex-wrap mb-4">
              {!report.photo_url && (
                <span className="text-xs font-semibold px-2.5 py-1 rounded-full border"
                  style={{background:sev.bg, color:sev.text, borderColor:sev.border}}>{sev.label}</span>
              )}
              <span className="text-xs font-semibold px-2.5 py-1 rounded-full border flex items-center gap-1"
                style={{background:sta.bg, color:sta.text, borderColor:sta.border}}>
                <span className="w-1.5 h-1.5 rounded-full" style={{background:sta.dot}}/>{sta.label}
              </span>
              {report.damage_type && (
                <span className="text-xs font-semibold px-2.5 py-1 rounded-full bg-purple-50 text-purple-700 border border-purple-200">
                  🤖 {report.damage_type.replace(/_/g,' ')}{report.ai_confidence ? ` · ${Math.round(report.ai_confidence*100)}%` : ''}
                </span>
              )}
              {avgRating > 0 && (
                <span className="text-xs font-semibold px-2.5 py-1 rounded-full bg-yellow-50 text-yellow-700 border border-yellow-200 flex items-center gap-1">
                  ⭐ {avgRating.toFixed(1)} <span className="text-yellow-500 font-normal">({reviews.length})</span>
                </span>
              )}
            </div>

            <div className="border-t border-gray-100 mb-4"/>
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
                  <div className="w-5 h-5 rounded-full flex items-center justify-center text-white text-xs font-bold"
                    style={{background: avatarCol(report.reporter?.name || '')}}>
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
            {report.description && (
              <><div className="border-t border-gray-100 mt-4 mb-3"/>
              <p className="text-sm text-gray-600 leading-relaxed">{report.description}</p></>
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
                <p className="text-sm font-bold text-purple-900 capitalize">{report.damage_type.replace(/_/g,' ')}</p>
              </div>
              {report.ai_confidence && (
                <div className="bg-purple-50 rounded-xl p-3 text-center">
                  <p className="text-xs text-purple-500 mb-1">Confidence</p>
                  <p className="text-sm font-bold text-purple-900">{Math.round(report.ai_confidence*100)}%</p>
                </div>
              )}
              <div className="bg-purple-50 rounded-xl p-3 text-center">
                <p className="text-xs text-purple-500 mb-1">Severity</p>
                <p className="text-sm font-bold capitalize" style={{color:sev.text}}>{report.severity}</p>
              </div>
            </div>
          </div>
        )}

        {/* ── Status Timeline ── */}
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4 mb-4">
          <p className="text-sm font-semibold text-gray-800 mb-3 flex items-center gap-2">
            <span className="w-6 h-6 bg-gray-100 rounded-lg flex items-center justify-center text-sm">📋</span>
            Status Timeline
          </p>
          <div className="space-y-3">
            {[
              { key:'pending',     icon:'📍', label:'Report submitted'            },
              { key:'in_progress', icon:'🔧', label:'Municipality working on it'  },
              { key:'fixed',       icon:'✅', label:'Road fixed!'                 },
            ].map((step, i) => {
              const done = step.key==='pending' || step.key==='in_progress'&&(report.status==='in_progress'||report.status==='fixed') || step.key==='fixed'&&report.status==='fixed'
              return (
                <div key={step.key} className="flex items-center gap-3">
                  <div className={`w-7 h-7 rounded-full flex items-center justify-center text-sm border-2 shrink-0
                    ${done ? 'border-green-400 bg-green-50' : 'border-gray-200 bg-gray-50'}`}>
                    {done ? '✓' : <span className="text-gray-300 text-xs">{i+1}</span>}
                  </div>
                  <p className={`text-sm ${done ? 'text-gray-800 font-medium' : 'text-gray-400'}`}>{step.label}</p>
                  {report.status === step.key && (
                    <span className="text-xs bg-blue-50 text-blue-600 border border-blue-100 px-2 py-0.5 rounded-full ml-auto">Current</span>
                  )}
                </div>
              )
            })}
          </div>
        </div>

        {/* ── Mini Map ── */}
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden mb-4">
          <div className="px-4 py-3 border-b border-gray-100 flex items-center justify-between">
            <p className="text-sm font-semibold text-gray-800 flex items-center gap-2"><span>🗺️</span> Location</p>
            <a href={`https://www.google.com/maps?q=${report.latitude},${report.longitude}`}
              target="_blank" rel="noreferrer"
              className="text-xs text-red-600 font-medium hover:underline flex items-center gap-1">
              Open in Google Maps ↗
            </a>
          </div>
          <div style={{height:240}}>
            <MapContainer center={[report.latitude, report.longitude]} zoom={16}
              style={{height:'100%', width:'100%'}} dragging={false} zoomControl={false} scrollWheelZoom={false}>
              <TileLayer attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
                url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"/>
              <Marker position={[report.latitude, report.longitude]}/>
            </MapContainer>
          </div>
        </div>

        {/* ── Confirm button ── */}
        {report.status !== 'fixed' && report.reporter_id !== user?.id && (
          <button onClick={handleUpvote} disabled={!user || upvoting || upvoted}
            className={`w-full py-3.5 rounded-2xl text-sm font-bold transition-all active:scale-[0.98] flex items-center justify-center gap-2 mb-4
              ${upvoted ? 'bg-green-50 text-green-700 border-2 border-green-200'
                        : 'bg-red-600 hover:bg-red-700 text-white shadow-lg'
              } disabled:opacity-60`}>
            {upvoting
              ? <><span className="animate-spin w-4 h-4 border-2 border-white border-t-transparent rounded-full"/>Confirming…</>
              : upvoted ? '✅ You confirmed this problem' : '👍 Confirm this road problem'}
          </button>
        )}
        {!user && (
          <p className="text-center text-xs text-gray-400 mt-2 mb-4">
            <button onClick={()=>navigate('/login')} className="text-red-600 font-medium hover:underline">Login</button>{' '}
            to confirm this road problem
          </p>
        )}

        {/* ══════════════════════════════════════════════
            COMMENTS & REVIEWS — COLLAPSIBLE
        ══════════════════════════════════════════════ */}

        {/* Toggle button */}
        <button
          onClick={() => setShowComments(s => !s)}
          className="w-full bg-white rounded-2xl border border-gray-100 shadow-sm px-5 py-4 flex items-center justify-between hover:bg-gray-50 active:scale-[0.99] transition-all mt-0 mb-2"
        >
          <div className="flex items-center gap-3">
            <span className="w-9 h-9 bg-red-50 rounded-xl flex items-center justify-center text-base shrink-0">💬</span>
            <div className="text-left">
              <p className="text-sm font-semibold text-gray-800">Comments &amp; Reviews</p>
              <p className="text-xs text-gray-400 mt-0.5">
                {comments.length} comment{comments.length !== 1 ? 's' : ''}
                {' · '}
                {reviews.length} review{reviews.length !== 1 ? 's' : ''}
                {avgRating > 0 ? ` · ⭐ ${avgRating.toFixed(1)}` : ''}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <span className="text-xs text-red-600 font-semibold">{showComments ? 'Hide' : 'Show'}</span>
            <svg
              className={`w-4 h-4 text-gray-400 transition-transform duration-200 ${showComments ? 'rotate-180' : ''}`}
              fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7"/>
            </svg>
          </div>
        </button>

        {/* Collapsible content */}
        {showComments && (
          <div className="comments-expand bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden mb-6">

            {/* Tab bar */}
            <div className="flex border-b border-gray-100">
              <button
                onClick={() => setActiveTab('comments')}
                className={`flex-1 flex items-center justify-center gap-2 py-3.5 text-sm font-semibold transition-colors
                  ${activeTab === 'comments'
                    ? 'text-red-600 border-b-2 border-red-600 bg-red-50/40'
                    : 'text-gray-400 hover:text-gray-600 hover:bg-gray-50'}`}>
                💬 Comments
                <span className={`text-xs px-2 py-0.5 rounded-full font-bold
                  ${activeTab === 'comments' ? 'bg-red-100 text-red-600' : 'bg-gray-100 text-gray-500'}`}>
                  {comments.length}
                </span>
              </button>
              <button
                onClick={() => setActiveTab('reviews')}
                className={`flex-1 flex items-center justify-center gap-2 py-3.5 text-sm font-semibold transition-colors
                  ${activeTab === 'reviews'
                    ? 'text-red-600 border-b-2 border-red-600 bg-red-50/40'
                    : 'text-gray-400 hover:text-gray-600 hover:bg-gray-50'}`}>
                ⭐ Reviews
                <span className={`text-xs px-2 py-0.5 rounded-full font-bold
                  ${activeTab === 'reviews' ? 'bg-red-100 text-red-600' : 'bg-gray-100 text-gray-500'}`}>
                  {reviews.length}
                </span>
              </button>
            </div>

            {/* ─── COMMENTS TAB ─────────────────────────────── */}
            {activeTab === 'comments' && (
              <div>
                {/* Input box */}
                {user ? (
                  <div className="p-4 border-b border-gray-100 bg-gray-50/50">
                    <div className="flex gap-3">
                      <div className="w-8 h-8 rounded-full flex items-center justify-center text-white text-xs font-bold shrink-0"
                        style={{background: avatarCol(user.name || '')}}>
                        {initials(user.name || '')}
                      </div>
                      <div className="flex-1">
                        <textarea
                          value={newComment}
                          onChange={e => setNewComment(e.target.value)}
                          onKeyDown={e => { if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) handleAddComment() }}
                          placeholder="Add a comment… e.g. Still not fixed! Road is getting worse."
                          maxLength={500}
                          rows={2}
                          className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-red-500/50 focus:border-red-400 bg-white transition-all"
                        />
                        <div className="flex items-center justify-between mt-1.5">
                          <span className="text-xs text-gray-400">{newComment.length}/500</span>
                          <button
                            onClick={handleAddComment}
                            disabled={!newComment.trim() || submittingComment}
                            className="bg-red-600 hover:bg-red-700 text-white text-xs font-bold px-4 py-1.5 rounded-full disabled:opacity-50 transition-colors">
                            {submittingComment ? 'Posting…' : 'Post'}
                          </button>
                        </div>
                      </div>
                    </div>
                  </div>
                ) : (
                  <div className="p-4 border-b border-gray-100 text-center">
                    <p className="text-sm text-gray-500">
                      <button onClick={() => navigate('/login')} className="text-red-600 font-semibold hover:underline">Login</button>
                      {' '}to join the conversation
                    </p>
                  </div>
                )}

                {/* Comments list */}
                <div className="divide-y divide-gray-50">
                  {comments.length === 0 ? (
                    <div className="py-10 text-center">
                      <p className="text-3xl mb-2">💬</p>
                      <p className="text-sm text-gray-400 font-medium">No comments yet</p>
                      <p className="text-xs text-gray-400 mt-1">Be the first to comment!</p>
                    </div>
                  ) : comments.map(c => (
                    <div key={c.id}
                      className="comment-item px-4 py-3 border-b border-gray-50 last:border-b-0 hover:bg-gray-50 transition-colors">
                      <div className="flex items-start gap-3">
                        {/* Avatar */}
                        <div className="w-8 h-8 rounded-full flex items-center justify-center text-white text-xs font-bold shrink-0"
                          style={{background: avatarCol(c.user?.name || '')}}>
                          {c.user?.avatar_initials || '?'}
                        </div>
                        <div className="flex-1 min-w-0">
                          {/* Name + time row */}
                          <div className="flex items-center justify-between gap-2 mb-1">
                            <div className="flex items-center gap-2">
                              <p className="text-xs font-bold text-gray-900">{c.user?.name}</p>
                            </div>
                            <div className="flex items-center gap-2 shrink-0">
                              <p className="text-xs text-gray-400">{c.time_ago}</p>
                              {c.is_mine && (
                                <button
                                  onClick={async () => {
                                    if (!window.confirm('Delete this comment?')) return
                                    try {
                                      await deleteComment(c.id)
                                      setComments(prev => prev.filter(x => x.id !== c.id))
                                    } catch {}
                                  }}
                                  className="text-gray-300 hover:text-red-500 transition-colors p-1"
                                  title="Delete comment">
                                  🗑️
                                </button>
                              )}
                            </div>
                          </div>
                          {/* Comment text */}
                          <p className="text-sm text-gray-700 leading-relaxed">{c.content}</p>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* ─── REVIEWS TAB ──────────────────────────────── */}
            {activeTab === 'reviews' && (
              <div>
                {/* Rating summary bar */}
                {reviews.length > 0 && (
                  <div className="p-4 border-b border-gray-100 bg-yellow-50/40 flex items-center gap-5">
                    <div className="text-center shrink-0">
                      <p className="text-4xl font-extrabold text-gray-900 leading-none">{avgRating.toFixed(1)}</p>
                      <Stars rating={Math.round(avgRating)} />
                      <p className="text-xs text-gray-400 mt-1">{reviews.length} review{reviews.length !== 1 ? 's' : ''}</p>
                    </div>
                    <div className="flex-1 space-y-1">
                      {[5,4,3,2,1].map(star => {
                        const count = reviews.filter(r => r.rating === star).length
                        const pct   = reviews.length ? Math.round((count / reviews.length) * 100) : 0
                        return (
                          <div key={star} className="flex items-center gap-2">
                            <span className="text-xs text-gray-500 w-3 shrink-0">{star}</span>
                            <div className="flex-1 h-1.5 bg-gray-200 rounded-full overflow-hidden">
                              <div className="h-full bg-yellow-400 rounded-full transition-all duration-500"
                                style={{width: `${pct}%`}}/>
                            </div>
                            <span className="text-xs text-gray-400 w-5 text-right">{count}</span>
                          </div>
                        )
                      })}
                    </div>
                  </div>
                )}

                {/* Add review form */}
                {user && report?.status === 'fixed' && !hasReviewed && (
                  <div className="p-4 border-b border-gray-100 bg-gray-50/50">
                    <p className="text-xs font-bold text-gray-700 uppercase tracking-wide mb-3">Rate this repair</p>
                    <div className="flex items-center gap-3 mb-3">
                      <Stars rating={newRating} interactive onSelect={setNewRating} />
                      {newRating > 0 && (
                        <span className="text-xs text-gray-500 font-medium">
                          {['','Very bad 😞','Bad 😕','Okay 😐','Good 😊','Excellent! 🎉'][newRating]}
                        </span>
                      )}
                    </div>
                    <textarea
                      value={newReview}
                      onChange={e => setNewReview(e.target.value)}
                      placeholder="How was the repair quality? (optional)"
                      maxLength={300}
                      rows={2}
                      className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-red-500/50 focus:border-red-400 bg-white transition-all"
                    />
                    <button
                      onClick={handleAddReview}
                      disabled={newRating === 0 || submittingReview}
                      className="mt-2 w-full bg-red-600 hover:bg-red-700 text-white font-bold py-2.5 rounded-xl text-sm disabled:opacity-50 transition-colors">
                      {submittingReview ? 'Submitting…' : '⭐ Submit Review'}
                    </button>
                  </div>
                )}

                {user && report?.status === 'fixed' && hasReviewed && (
                  <div className="p-4 border-b border-gray-100 flex items-center gap-2 text-sm text-green-700 bg-green-50/60">
                    <span>✅</span> You've already reviewed this repair. Thank you!
                  </div>
                )}

                {report?.status !== 'fixed' && (
                  <div className="p-4 border-b border-gray-100 flex items-center justify-center gap-2 text-sm text-gray-400 bg-gray-50/40">
                    <span>🔒</span>
                    <span>Reviews are unlocked once the road is marked as fixed</span>
                  </div>
                )}

                {!user && report?.status === 'fixed' && (
                  <div className="p-4 border-b border-gray-100 text-center">
                    <p className="text-sm text-gray-500">
                      <button onClick={() => navigate('/login')} className="text-red-600 font-semibold hover:underline">Login</button>
                      {' '}to leave a review
                    </p>
                  </div>
                )}

                {/* Reviews list */}
                <div className="divide-y divide-gray-50">
                  {reviews.length === 0 ? (
                    <div className="py-10 text-center">
                      <p className="text-3xl mb-2">⭐</p>
                      <p className="text-sm text-gray-400 font-medium">No reviews yet</p>
                      {report?.status === 'fixed' && (
                        <p className="text-xs text-gray-400 mt-1">Be the first to review this repair!</p>
                      )}
                    </div>
                  ) : reviews.map(r => (
                    <div key={r.id} className="comment-item flex items-start gap-3 px-4 py-3.5 hover:bg-gray-50/60 transition-colors">
                      <div className="w-7 h-7 rounded-full flex items-center justify-center text-white text-xs font-bold shrink-0"
                        style={{background: avatarCol(r.user?.name || '')}}>
                        {r.user?.avatar_initials || '?'}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center justify-between gap-2">
                          <p className="text-xs font-bold text-gray-800">{r.user?.name}</p>
                          <p className="text-xs text-gray-400 shrink-0">{r.time_ago}</p>
                        </div>
                        <div className="my-0.5"><Stars rating={r.rating} /></div>
                        {r.content && (
                          <p className="text-sm text-gray-700 leading-relaxed mt-0.5">{r.content}</p>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

          </div>
        )}{/* end showComments */}

      </div>{/* end max-w container */}
    </div>
  )
}
