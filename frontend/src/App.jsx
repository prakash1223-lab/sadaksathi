import { Routes, Route, Navigate, useLocation } from 'react-router-dom'
import Navbar from './components/Navbar'
import Landing from './pages/Landing'
import MapView from './pages/MapView'
import ReportForm from './pages/ReportForm'
import ReportDetail from './pages/ReportDetail'
import Login from './pages/Login'
import Register from './pages/Register'
import AdminDashboard from './pages/AdminDashboard'
import Profile from './pages/Profile'
import MyReports from './pages/MyReports'
import Leaderboard from './pages/Leaderboard'
import Settings from './pages/Settings'
import { useAuth } from './context/AuthContext'

function ProtectedRoute({ children }) {
  const { isLoggedIn, loading } = useAuth()
  const location = useLocation()
  if (loading) return null
  return isLoggedIn ? children : <Navigate to="/login" state={{ from: location }} replace />
}

function AdminRoute({ children }) {
  const { user, isLoggedIn, loading } = useAuth()
  if (loading) return null
  if (!isLoggedIn) return <Navigate to="/login" replace />
  if (!user?.is_admin) return <Navigate to="/map" replace />
  return children
}

// Logged-in users skip login/register → go to /map
function GuestRoute({ children }) {
  const { isLoggedIn } = useAuth()
  return isLoggedIn ? <Navigate to="/map" replace /> : children
}

// Pages with their own full-screen layout (no shared Navbar)
const STANDALONE = ['/login', '/register', '/map', '/admin', '/', '/my-reports']

export default function App() {
  const location = useLocation()
  const isStandalone = STANDALONE.includes(location.pathname)

  return (
    <div className="min-h-screen bg-gray-50">
      {!isStandalone && <Navbar />}
      <Routes>
        {/* Public */}
        <Route path="/"            element={<Landing />} />
        <Route path="/map"         element={<MapView />} />          {/* public — viewers don't need login */}
        <Route path="/reports/:id" element={<ReportDetail />} />
        <Route path="/leaderboard" element={<Leaderboard />} />

        {/* Auth */}
        <Route path="/login"    element={<GuestRoute><Login /></GuestRoute>} />
        <Route path="/register" element={<GuestRoute><Register /></GuestRoute>} />

        {/* Protected */}
        <Route path="/report/new" element={<ProtectedRoute><ReportForm /></ProtectedRoute>} />
        <Route path="/profile"    element={<ProtectedRoute><Profile /></ProtectedRoute>} />
        <Route path="/my-reports" element={<ProtectedRoute><MyReports /></ProtectedRoute>} />
        <Route path="/settings"   element={<ProtectedRoute><Settings /></ProtectedRoute>} />
        <Route path="/admin"      element={<AdminRoute><AdminDashboard /></AdminRoute>} />

        {/* Fallback */}
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </div>
  )
}
