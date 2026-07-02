import { useState } from 'react'
import { Link, useNavigate, useLocation } from 'react-router-dom'
import { login as loginApi } from '../api/auth'
import { useAuth } from '../context/AuthContext'

export default function Login() {
  const [form,        setForm]        = useState({ phone: '', password: '' })
  const [errors,      setErrors]      = useState({})
  const [serverError, setServerError] = useState('')
  const [loading,     setLoading]     = useState(false)
  const [showPw,      setShowPw]      = useState(false)
  const { login } = useAuth()
  const navigate   = useNavigate()
  const location   = useLocation()

  const validate = () => {
    const e     = {}
    const phone = form.phone.trim().replace(/^\+?977/, '')
    if (!/^9[6-9]\d{8}$/.test(phone)) e.phone = 'Enter a valid Nepal number (98XXXXXXXX)'
    if (!form.password)                e.password = 'Password is required'
    return e
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    setServerError('')
    const e2 = validate()
    if (Object.keys(e2).length) { setErrors(e2); return }
    setErrors({})
    setLoading(true)
    try {
      const res = await loginApi(form.phone, form.password)
      login(res.data.access_token, res.data.user)
      navigate(location.state?.from || '/map')
    } catch (err) {
      setServerError(err.response?.data?.detail || 'Wrong phone or password. Please try again.')
    } finally {
      setLoading(false)
    }
  }

  const field = (name) => ({
    value: form[name],
    onChange: (e) => {
      setForm(f => ({ ...f, [name]: e.target.value }))
      setErrors(prev => ({ ...prev, [name]: undefined }))
      setServerError('')
    },
  })

  return (
    <div
      className="min-h-screen flex items-center justify-center px-4 py-12"
      style={{
        fontFamily: "'Inter',system-ui,sans-serif",
        background: 'linear-gradient(135deg, #fff1f1 0%, #fff 50%, #fef2f2 100%)',
      }}
    >
      <style>{`
        @keyframes fadeUp{from{opacity:0;transform:translateY(16px)}to{opacity:1;transform:translateY(0)}}
        @keyframes blink{0%,100%{opacity:1;transform:scale(1)}50%{opacity:.4;transform:scale(1.5)}}
        .fade-up{animation:fadeUp .5s ease-out forwards}
        .live-dot{animation:blink 1.8s ease-in-out infinite}
        .field-box{border:1px solid #e5e7eb;border-radius:12px;overflow:hidden;display:flex;transition:border-color .15s,box-shadow .15s}
        .field-box:focus-within{border-color:#DC2626;box-shadow:0 0 0 3px rgba(220,38,38,.1)}
        .field-box.error{border-color:#f87171}
        .field-input{flex:1;padding:11px 14px;font-size:14px;color:#111827;background:#fff;border:none;outline:none}
        .field-input::placeholder{color:#d1d5db}
        .btn-red{width:100%;background:#DC2626;color:#fff;font-weight:700;padding:12px;border-radius:12px;font-size:14px;border:none;cursor:pointer;transition:background .15s,transform .15s,box-shadow .15s;display:flex;align-items:center;justify-content:center;gap:8px}
        .btn-red:hover:not(:disabled){background:#b91c1c;transform:translateY(-1px);box-shadow:0 6px 20px rgba(220,38,38,.3)}
        .btn-red:disabled{opacity:.6;cursor:not-allowed}
      `}</style>

      <div className="w-full max-w-sm fade-up">

        {/* Logo */}
        <div className="text-center mb-8">
          <Link to="/" className="inline-flex items-center gap-2.5 mb-2">
            <div className="w-10 h-10 bg-red-600 rounded-xl flex items-center justify-center shadow-sm">
              <span className="text-xl">🛣️</span>
            </div>
            <div className="text-left">
              <p className="font-extrabold text-gray-900 text-lg leading-none">SadakSathi</p>
              <p className="text-xs text-gray-400 mt-0.5">सडक साथी</p>
            </div>
          </Link>
          <div className="flex items-center justify-center gap-1.5 mt-2">
            <span className="live-dot w-2 h-2 rounded-full bg-red-500 inline-block"/>
            <span className="text-xs text-gray-400">Nepal's road reporting platform 🇳🇵</span>
          </div>
        </div>

        {/* Card */}
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-7">

          <div className="mb-6">
            <h1 className="text-xl font-bold text-gray-900 mb-1">Welcome back 👋</h1>
            <p className="text-sm text-gray-400">Sign in to your account</p>
          </div>

          {/* Server error */}
          {serverError && (
            <div className="flex items-start gap-2.5 bg-red-50 border border-red-200 text-red-700 text-xs px-4 py-3 rounded-xl mb-5">
              <span className="shrink-0 mt-0.5">⚠️</span>
              <span className="leading-relaxed">{serverError}</span>
            </div>
          )}

          <form onSubmit={handleSubmit} noValidate className="space-y-4">

            {/* Phone */}
            <div>
              <label className="block text-xs font-semibold text-gray-700 mb-1.5">
                Phone Number
              </label>
              <div className={`field-box ${errors.phone ? 'error' : ''}`}>
                <span className="inline-flex items-center px-3 text-xs text-gray-500 bg-gray-50 border-r border-gray-200 shrink-0 select-none whitespace-nowrap">
                  🇳🇵 +977
                </span>
                <input
                  type="tel"
                  inputMode="numeric"
                  maxLength={10}
                  placeholder="98XXXXXXXX"
                  autoComplete="tel"
                  className="field-input"
                  {...field('phone')}
                />
              </div>
              {errors.phone && (
                <p className="text-red-500 text-xs mt-1.5 flex items-center gap-1">
                  <span>⚠</span> {errors.phone}
                </p>
              )}
            </div>

            {/* Password */}
            <div>
              <label className="block text-xs font-semibold text-gray-700 mb-1.5">
                Password
              </label>
              <div className={`field-box ${errors.password ? 'error' : ''}`}>
                <input
                  type={showPw ? 'text' : 'password'}
                  autoComplete="current-password"
                  placeholder="••••••••"
                  className="field-input"
                  {...field('password')}
                />
                <button
                  type="button"
                  onClick={() => setShowPw(s => !s)}
                  className="px-3 text-gray-400 hover:text-gray-600 bg-white border-l border-gray-100 shrink-0 transition-colors text-base"
                  tabIndex={-1}
                >
                  {showPw ? '🙈' : '👁️'}
                </button>
              </div>
              {errors.password && (
                <p className="text-red-500 text-xs mt-1.5 flex items-center gap-1">
                  <span>⚠</span> {errors.password}
                </p>
              )}
            </div>

            {/* Submit */}
            <button type="submit" disabled={loading} className="btn-red mt-2">
              {loading ? (
                <>
                  <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24" fill="none">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/>
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z"/>
                  </svg>
                  Signing in…
                </>
              ) : (
                <>
                  Sign In
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M13 7l5 5m0 0l-5 5m5-5H6"/>
                  </svg>
                </>
              )}
            </button>
          </form>

          <div className="flex items-center gap-3 my-5">
            <div className="flex-1 h-px bg-gray-100"/>
            <span className="text-xs text-gray-300">or</span>
            <div className="flex-1 h-px bg-gray-100"/>
          </div>

          <Link
            to="/register"
            className="block w-full text-center border border-gray-200 text-gray-600 font-semibold py-2.5 rounded-xl text-sm hover:bg-gray-50 transition-colors"
          >
            Create a new account
          </Link>
        </div>

        <p className="text-center text-xs text-gray-400 mt-5">
          <Link to="/" className="hover:text-red-600 transition-colors">← Back to home</Link>
        </p>
      </div>
    </div>
  )
}