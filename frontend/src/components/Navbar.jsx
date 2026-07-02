import { useState, useRef, useEffect, useCallback } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { getUnreadCount, getNotifications, markRead, markAllRead } from '../api/notifications'
import { timeAgo } from '../utils/time'

// ── Helpers ───────────────────────────────────────────────────────────────────
function avatarColor(name = '') {
  const colors = ['bg-red-500','bg-orange-500','bg-amber-500','bg-green-600',
    'bg-teal-500','bg-blue-600','bg-indigo-500','bg-purple-600','bg-pink-500','bg-rose-500']
  let h = 0
  for (let i = 0; i < name.length; i++) h = name.charCodeAt(i) + ((h << 5) - h)
  return colors[Math.abs(h) % colors.length]
}
function initials(name = '') {
  const p = name.trim().split(' ')
  return p.length >= 2 ? (p[0][0] + p[p.length - 1][0]).toUpperCase() : name.slice(0,2).toUpperCase()
}


// ── Toast component ───────────────────────────────────────────────────────────
function Toast({ msg, onClose }) {
  useEffect(() => { const t = setTimeout(onClose, 4000); return () => clearTimeout(t) }, [onClose])
  return (
    <div className="fixed bottom-6 right-6 z-[9999] bg-gray-900 text-white px-5 py-3 rounded-2xl shadow-2xl text-sm font-medium flex items-center gap-3 max-w-xs"
      style={{ animation: 'slideUp 0.3s ease-out' }}>
      <span className="text-lg">🔔</span>
      <span>{msg}</span>
      <button onClick={onClose} className="ml-auto text-gray-400 hover:text-white text-xs">✕</button>
    </div>
  )
}

// ── Notification bell dropdown ────────────────────────────────────────────────
function NotificationBell({ user }) {
  const navigate = useNavigate()
  const [open,        setOpen]        = useState(false)
  const [unread,      setUnread]      = useState(0)
  const [notifs,      setNotifs]      = useState([])
  const [toast,       setToast]       = useState(null)
  const [prevUnread,  setPrevUnread]  = useState(0)
  const ref = useRef(null)

  const fetchCount = useCallback(async () => {
    try {
      const res = await getUnreadCount()
      const count = res.data.count
      // Show toast if new notifications arrived
      if (count > prevUnread && prevUnread !== 0) {
        const diff = count - prevUnread
        setToast(`You have ${diff} new notification${diff > 1 ? 's' : ''}!`)
      }
      setPrevUnread(count)
      setUnread(count)
    } catch {}
  }, [prevUnread])

  // Poll every 30 seconds
  useEffect(() => {
    fetchCount()
    const interval = setInterval(fetchCount, 30000)
    return () => clearInterval(interval)
  }, [fetchCount])

  // Close on outside click
  useEffect(() => {
    const h = (e) => { if (ref.current && !ref.current.contains(e.target)) setOpen(false) }
    document.addEventListener('mousedown', h)
    return () => document.removeEventListener('mousedown', h)
  }, [])

  const openBell = async () => {
    setOpen(o => !o)
    if (!open) {
      try {
        const res = await getNotifications()
        setNotifs(res.data)
      } catch {}
    }
  }

  const handleMarkAllRead = async () => {
    await markAllRead()
    setNotifs(prev => prev.map(n => ({ ...n, is_read: true })))
    setUnread(0)
  }

  const handleClickNotif = async (n) => {
    if (!n.is_read) {
      await markRead(n.id)
      setNotifs(prev => prev.map(x => x.id === n.id ? { ...x, is_read: true } : x))
      setUnread(c => Math.max(0, c - 1))
    }
    setOpen(false)
    if (n.report_id) navigate('/map')
  }

  return (
    <>
      {toast && <Toast msg={toast} onClose={() => setToast(null)} />}

      <div className="relative" ref={ref}>
        <button onClick={openBell}
          className="relative flex items-center justify-center w-8 h-8 rounded-full hover:bg-red-700 transition-colors"
          aria-label="Notifications">
          <span className="text-lg">🔔</span>
          {unread > 0 && (
            <span className="absolute -top-0.5 -right-0.5 bg-white text-red-600 text-xs font-extrabold rounded-full min-w-[16px] h-4 flex items-center justify-center px-0.5 leading-none">
              {unread > 9 ? '9+' : unread}
            </span>
          )}
        </button>

        {open && (
          <div className="absolute right-0 top-full mt-2 w-80 bg-white rounded-2xl shadow-2xl border border-gray-100 overflow-hidden z-50"
            style={{ animation: 'dd-fade 0.15s ease-out' }}>
            {/* Header */}
            <div className="flex items-center justify-between px-4 py-3 border-b border-gray-100 bg-gray-50">
              <p className="font-bold text-gray-900 text-sm">🔔 Notifications</p>
              {unread > 0 && (
                <button onClick={handleMarkAllRead}
                  className="text-xs text-red-600 font-semibold hover:underline">
                  Mark all read
                </button>
              )}
            </div>

            {/* List */}
            <div className="max-h-80 overflow-y-auto divide-y divide-gray-50">
              {notifs.length === 0 ? (
                <div className="text-center py-8 text-gray-400 text-sm">
                  <p className="text-2xl mb-2">🔔</p>
                  No notifications yet
                </div>
              ) : notifs.map(n => (
                <button key={n.id} onClick={() => handleClickNotif(n)}
                  className={`w-full text-left px-4 py-3 hover:bg-gray-50 transition-colors ${
                    !n.is_read ? 'bg-blue-50' : 'bg-white'
                  }`}>
                  <div className="flex items-start gap-2">
                    {!n.is_read && (
                      <span className="w-2 h-2 rounded-full bg-blue-500 mt-1.5 shrink-0" />
                    )}
                    <div className={!n.is_read ? '' : 'ml-4'}>
                      <p className="text-sm text-gray-800 leading-snug">{n.message}</p>
                      {n.report_title && (
                        <p className="text-xs text-gray-500 mt-0.5 truncate">{n.report_title}</p>
                      )}
                      <p className="text-xs text-gray-400 mt-0.5">{timeAgo(n.created_at)}</p>
                    </div>
                  </div>
                </button>
              ))}
            </div>
          </div>
        )}
      </div>
    </>
  )
}

// ── Main Navbar ───────────────────────────────────────────────────────────────
export default function Navbar() {
  const { user, logout } = useAuth()
  const navigate = useNavigate()
  const [open, setOpen] = useState(false)
  const ref = useRef(null)

  useEffect(() => {
    const h = (e) => { if (ref.current && !ref.current.contains(e.target)) setOpen(false) }
    document.addEventListener('mousedown', h)
    return () => document.removeEventListener('mousedown', h)
  }, [])

  const handleLogout = () => { setOpen(false); logout(); navigate('/login') }
  const go = (path) => { setOpen(false); navigate(path) }

  return (
    <>
      <style>{`
        @keyframes dd-fade {
          from { opacity: 0; transform: translateY(-6px) scale(0.97); }
          to   { opacity: 1; transform: translateY(0) scale(1); }
        }
        .dd-animate { animation: dd-fade 0.15s ease-out forwards; }
        @keyframes slideUp {
          from { opacity: 0; transform: translateY(16px); }
          to   { opacity: 1; transform: translateY(0); }
        }
      `}</style>

      <nav className="bg-red-600 text-white shadow-md">
        <div className="max-w-6xl mx-auto px-4 py-3 flex items-center justify-between">
          <Link to="/" className="flex items-center gap-2 font-bold text-xl shrink-0">
            🛣️ SadakSathi
            <span className="text-sm font-normal opacity-80 hidden sm:inline">सडक साथी</span>
          </Link>

          <div className="flex items-center gap-3 text-sm">
            {user ? (
              <>
                <Link to="/report/new"
                  className="bg-white text-red-600 px-3 py-1.5 rounded-full font-semibold hover:bg-red-50 transition-colors text-xs whitespace-nowrap">
                  + Report Problem
                </Link>

                {user.is_admin && (
                  <Link to="/admin" className="hover:text-red-100 transition-colors text-xs hidden sm:inline">
                    Admin
                  </Link>
                )}

                {/* Notification bell */}
                <NotificationBell user={user} />

                {/* User dropdown */}
                <div className="relative" ref={ref}>
                  <button onClick={() => setOpen(o => !o)}
                    aria-expanded={open}
                    className="flex items-center gap-1.5 bg-red-700 hover:bg-red-800 px-2.5 py-1.5 rounded-full transition-colors">
                    <div className={`${avatarColor(user.name)} w-6 h-6 rounded-full flex items-center justify-center text-white text-xs font-bold shrink-0`}>
                      {initials(user.name)}
                    </div>
                    <span className="hidden sm:inline text-sm font-medium leading-none">
                      {user.name.split(' ')[0]}
                    </span>
                    <svg className={`w-3 h-3 opacity-70 transition-transform duration-200 ${open ? 'rotate-180' : ''}`}
                      fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
                    </svg>
                  </button>

                  {open && (
                    <div className="dd-animate absolute right-0 top-full mt-2 w-56 bg-white rounded-2xl shadow-xl border border-gray-100 overflow-hidden z-50">
                      <div className="flex items-center gap-3 px-4 py-3 bg-gray-50 border-b border-gray-100">
                        <div className={`${avatarColor(user.name)} w-9 h-9 rounded-full flex items-center justify-center text-white text-sm font-bold shrink-0`}>
                          {initials(user.name)}
                        </div>
                        <div className="min-w-0">
                          <p className="font-semibold text-gray-900 text-sm truncate">{user.name}</p>
                          <p className="text-xs text-gray-400 truncate">{user.phone}</p>
                        </div>
                      </div>
                      <div className="py-1">
                        {[
                          { icon:'👤', label:'My Profile',     path:'/profile'   },
                          { icon:'⚙️', label:'Settings',       path:'/settings'  },
                          { icon:'🗺️', label:'View Map',       path:'/map'       },
                          { icon:'📍', label:'Report Problem', path:'/report/new'},
                        ].map(item => (
                          <button key={item.path} onClick={() => go(item.path)}
                            className="flex items-center gap-3 w-full px-4 py-2.5 text-sm text-gray-700 hover:bg-gray-50 transition-colors text-left">
                            <span className="text-base">{item.icon}</span> {item.label}
                          </button>
                        ))}
                      </div>
                      <div className="border-t border-gray-100">
                        <button onClick={handleLogout}
                          className="flex items-center gap-3 w-full px-4 py-2.5 text-sm text-red-600 font-medium hover:bg-red-50 transition-colors text-left">
                          <span className="text-base">🚪</span> Logout
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              </>
            ) : (
              <>
                <Link to="/login" className="hover:text-red-100 transition-colors">Login</Link>
                <Link to="/register"
                  className="bg-white text-red-600 px-3 py-1.5 rounded-full font-semibold hover:bg-red-50 transition-colors text-xs">
                  Register
                </Link>
              </>
            )}
          </div>
        </div>
      </nav>
    </>
  )
}
