const colors = {
  low: 'bg-yellow-100 text-yellow-800 border-yellow-200',
  medium: 'bg-orange-100 text-orange-800 border-orange-200',
  high: 'bg-red-100 text-red-800 border-red-200',
}

export default function SeverityBadge({ severity }) {
  return (
    <span className={`inline-block text-xs px-2 py-0.5 rounded-full border font-semibold ${colors[severity] || colors.medium}`}>
      {severity}
    </span>
  )
}
