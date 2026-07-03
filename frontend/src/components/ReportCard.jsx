import { Link } from 'react-router-dom'
import { upvoteReport } from '../api/reports'
import { useAuth } from '../context/AuthContext'
import { useState } from 'react'
import { API_BASE } from '../api/client'

const severityColor = {
  low: 'bg-yellow-100 text-yellow-800',
  medium: 'bg-orange-100 text-orange-800',
  high: 'bg-red-100 text-red-800',
}

const statusColor = {
  pending: 'bg-gray-100 text-gray-700',
  in_progress: 'bg-blue-100 text-blue-700',
  fixed: 'bg-green-100 text-green-700',
}

export default function ReportCard({ report, onUpvote }) {
  const { user } = useAuth()
  const [upvoting, setUpvoting] = useState(false)

  const handleUpvote = async (e) => {
    e.preventDefault()
    if (!user || upvoting) return
    setUpvoting(true)
    try {
      const res = await upvoteReport(report.id)
      onUpvote && onUpvote(res.data)
    } finally {
      setUpvoting(false)
    }
  }

  return (
    <Link to={`/reports/${report.id}`} className="block">
      <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden hover:shadow-md transition-shadow">
        {report.photo_url && (
          <img
            src={
              report.photo_url.startsWith('data:') || report.photo_url.startsWith('http')
                ? report.photo_url
                : `${API_BASE}${report.photo_url}`
            }
            alt={report.title}
            className="w-full h-40 object-cover"
            onError={e => { e.target.style.display = 'none' }}
          />
        )}
        <div className="p-4">
          <div className="flex items-start justify-between gap-2">
            <h3 className="font-semibold text-gray-900 text-sm leading-snug">{report.title}</h3>
            <button
              onClick={handleUpvote}
              className="flex items-center gap-1 text-xs text-gray-500 hover:text-red-600 transition-colors shrink-0"
            >
              👍 {report.upvotes}
            </button>
          </div>

          {report.address && (
            <p className="text-xs text-gray-500 mt-1 truncate">📍 {report.address}</p>
          )}

          <div className="flex items-center gap-2 mt-3 flex-wrap">
            <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${severityColor[report.severity]}`}>
              {report.severity}
            </span>
            <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${statusColor[report.status]}`}>
              {report.status.replace('_', ' ')}
            </span>
          </div>

          <p className="text-xs text-gray-400 mt-2">
            {new Date(report.created_at).toLocaleDateString()}
          </p>
        </div>
      </div>
    </Link>
  )
}
