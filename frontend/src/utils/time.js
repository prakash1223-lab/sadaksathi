const NP_TZ = 'Asia/Kathmandu'

function parseDate(d) {
  if (!d) return null
  // If no timezone marker, treat as UTC by appending Z
  if (typeof d === 'string' && !d.includes('Z') && !d.includes('+') && !d.match(/\d{2}:\d{2}:\d{2}[+-]/)) {
    return new Date(d + 'Z')
  }
  return new Date(d)
}

export function timeAgo(d) {
  if (!d) return ''
  const date = parseDate(d)
  if (!date) return ''
  const s = (Date.now() - date) / 1000
  if (s < 0)        return 'just now'
  if (s < 60)       return 'just now'
  if (s < 3600)     return `${Math.floor(s / 60)}m ago`
  if (s < 86400)    return `${Math.floor(s / 3600)}h ago`
  if (s < 2592000)  return `${Math.floor(s / 86400)}d ago`
  return formatDate(date)
}

export function formatDate(d) {
  if (!d) return ''
  return parseDate(d).toLocaleDateString('en-NP', {
    timeZone: NP_TZ, year: 'numeric', month: 'short', day: 'numeric',
  })
}

export function formatDateTime(d) {
  if (!d) return ''
  return parseDate(d).toLocaleString('en-NP', {
    timeZone: NP_TZ, year: 'numeric', month: 'short',
    day: 'numeric', hour: '2-digit', minute: '2-digit',
  })
}

export function formatMonthYear(d) {
  if (!d) return ''
  return parseDate(d).toLocaleDateString('en-NP', {
    timeZone: NP_TZ, month: 'long', year: 'numeric',
  })
}

export function formatTime(d) {
  if (!d) return ''
  return parseDate(d).toLocaleTimeString('en-NP', {
    timeZone: NP_TZ, hour: '2-digit', minute: '2-digit',
  })
}
