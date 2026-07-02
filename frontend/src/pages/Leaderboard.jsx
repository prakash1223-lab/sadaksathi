import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { getLeaderboard } from '../api/auth'
import { useAuth } from '../context/AuthContext'
import { useSettings } from '../context/SettingsContext'

function avatarColor(name = '') {
  const colors = [
    'bg-red-500','bg-orange-500','bg-amber-500','bg-green-600',
    'bg-teal-500','bg-blue-600','bg-indigo-500','bg-purple-600',
    'bg-pink-500','bg-rose-500',
  ]
  let hash = 0
  for (let i = 0; i < name.length; i++) hash = name.charCodeAt(i) + ((hash << 5) - hash)
  return colors[Math.abs(hash) % colors.length]
}

const RANK_STYLE = {
  1: { bg: 'bg-yellow-50 border-yellow-200', badge: '🥇', text: 'text-yellow-700' },
  2: { bg: 'bg-gray-50  border-gray-200',    badge: '🥈', text: 'text-gray-600'   },
  3: { bg: 'bg-orange-50 border-orange-200', badge: '🥉', text: 'text-orange-700' },
}

export default function Leaderboard() {
  const { user } = useAuth()
  const { settings } = useSettings()
  const leaderboardEnabled = settings?.privacy?.leaderboard !== false
  const [entries, setEntries] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    getLeaderboard()
      .then(res => setEntries(res.data))
      .finally(() => setLoading(false))
  }, [])

  return (
    <div className="max-w-lg mx-auto px-4 py-8">
      <div className="flex items-center gap-3 mb-6">
        <Link to="/profile" className="text-gray-400 hover:text-gray-600 text-sm">← Back</Link>
        <h1 className="text-xl font-bold text-gray-900">🏆 Kathmandu Leaderboard</h1>
      </div>

      {/* Banner if user has hidden themselves from leaderboard */}
      {!leaderboardEnabled && (
        <div className="bg-yellow-50 border border-yellow-200 rounded-xl px-4 py-3 mb-5 flex items-start gap-3">
          <span className="text-lg shrink-0">👁️</span>
          <div>
            <p className="text-sm font-semibold text-yellow-800">You are hidden from the leaderboard.</p>
            <p className="text-xs text-yellow-700 mt-0.5">
              Enable in <Link to="/settings" className="underline font-medium">Settings → Privacy</Link> to appear in rankings.
            </p>
          </div>
        </div>
      )}

      <p className="text-sm text-gray-500 mb-6">
        Top reporters ranked by impact score — (fixed × 20) + (upvotes × 2) + (reports × 5)
      </p>

      {loading ? (
        <div className="text-center py-20 text-gray-400 text-sm">Loading...</div>
      ) : (
        <div className="space-y-3">
          {entries.map((entry) => {
            const style = RANK_STYLE[entry.rank] || { bg: 'bg-white border-gray-100', badge: `#${entry.rank}`, text: 'text-gray-500' }
            const isMe = user && entry.user_id === user.id

            return (
              <div
                key={entry.user_id}
                className={`flex items-center gap-4 border rounded-2xl px-4 py-3 shadow-sm transition-all ${style.bg} ${isMe ? 'ring-2 ring-red-400' : ''}`}
              >
                {/* Rank badge */}
                <span className={`text-xl w-8 text-center font-bold shrink-0 ${style.text}`}>
                  {style.badge}
                </span>

                {/* Avatar */}
                <div className={`${avatarColor(entry.name)} w-10 h-10 rounded-full flex items-center justify-center text-white text-sm font-bold shrink-0`}>
                  {entry.avatar_initials}
                </div>

                {/* Name + stats */}
                <div className="flex-1 min-w-0">
                  <p className="font-semibold text-gray-900 text-sm flex items-center gap-1.5">
                    {entry.name}
                    {isMe && <span className="text-xs bg-red-100 text-red-600 px-1.5 py-0.5 rounded-full font-medium">You</span>}
                  </p>
                  <p className="text-xs text-gray-500 mt-0.5">
                    {entry.total_reports} reports · {entry.fixed} fixed
                  </p>
                </div>

                {/* Impact score */}
                <div className="text-right shrink-0">
                  <p className="font-bold text-purple-600 text-sm">{entry.impact_score}</p>
                  <p className="text-xs text-gray-400">impact</p>
                </div>
              </div>
            )
          })}

          {entries.length === 0 && (
            <div className="text-center py-12 text-gray-400 text-sm">
              No reporters yet. Be the first!
            </div>
          )}
        </div>
      )}

      <div className="mt-8 text-center">
        <Link
          to="/report/new"
          className="inline-block bg-red-600 hover:bg-red-700 text-white font-semibold px-6 py-3 rounded-full text-sm transition-colors"
        >
          📍 Report a Problem to Climb the Rankings
        </Link>
      </div>
    </div>
  )
}
