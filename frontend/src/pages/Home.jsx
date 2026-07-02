import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { getReports } from '../api/reports'
import ReportCard from '../components/ReportCard'

export default function Home() {
  const [reports, setReports] = useState([])
  const [loading, setLoading] = useState(true)
  const [filter, setFilter] = useState({ severity: '', status: '' })

  const fetchReports = async () => {
    setLoading(true)
    try {
      const params = {}
      if (filter.severity) params.severity = filter.severity
      if (filter.status) params.status = filter.status
      const res = await getReports(params)
      setReports(res.data)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { fetchReports() }, [filter])

  const handleUpvote = (updated) => {
    setReports((prev) => prev.map((r) => (r.id === updated.id ? updated : r)))
  }

  return (
    <div className="max-w-6xl mx-auto px-4 py-8">
      {/* Hero */}
      <div className="bg-gradient-to-r from-red-600 to-red-700 text-white rounded-2xl p-8 mb-8">
        <h1 className="text-3xl font-bold mb-2">सडक साथी</h1>
        <p className="text-red-100 mb-4 max-w-lg">
          Report road damage in Kathmandu. Together we can fix our streets.
        </p>
        <div className="flex gap-3">
          <Link
            to="/report/new"
            className="bg-white text-red-600 px-5 py-2 rounded-full font-semibold hover:bg-red-50 transition-colors text-sm"
          >
            + Report Damage
          </Link>
          <Link
            to="/map"
            className="border border-white text-white px-5 py-2 rounded-full font-semibold hover:bg-red-600 transition-colors text-sm"
          >
            View Map
          </Link>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-3 gap-4 mb-8">
        {[
          { label: 'Total Reports', value: reports.length },
          { label: 'Pending', value: reports.filter((r) => r.status === 'pending').length },
          { label: 'Fixed', value: reports.filter((r) => r.status === 'fixed').length },
        ].map((s) => (
          <div key={s.label} className="bg-white rounded-xl p-4 text-center shadow-sm border border-gray-100">
            <div className="text-2xl font-bold text-gray-900">{s.value}</div>
            <div className="text-xs text-gray-500 mt-1">{s.label}</div>
          </div>
        ))}
      </div>

      {/* Filters */}
      <div className="flex gap-3 mb-6 flex-wrap">
        <select
          value={filter.severity}
          onChange={(e) => setFilter({ ...filter, severity: e.target.value })}
          className="border border-gray-200 rounded-lg px-3 py-2 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-red-500"
        >
          <option value="">All Severities</option>
          <option value="low">Low</option>
          <option value="medium">Medium</option>
          <option value="high">High</option>
        </select>
        <select
          value={filter.status}
          onChange={(e) => setFilter({ ...filter, status: e.target.value })}
          className="border border-gray-200 rounded-lg px-3 py-2 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-red-500"
        >
          <option value="">All Statuses</option>
          <option value="pending">Pending</option>
          <option value="in_progress">In Progress</option>
          <option value="fixed">Fixed</option>
        </select>
      </div>

      {/* Reports grid */}
      {loading ? (
        <div className="text-center py-12 text-gray-400">Loading reports...</div>
      ) : reports.length === 0 ? (
        <div className="text-center py-12 text-gray-400">
          <p className="text-lg">No reports yet.</p>
          <Link to="/report/new" className="text-red-600 font-medium hover:underline text-sm mt-2 inline-block">
            Be the first to report a road issue
          </Link>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {reports.map((r) => (
            <ReportCard key={r.id} report={r} onUpvote={handleUpvote} />
          ))}
        </div>
      )}
    </div>
  )
}
