import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { register as registerApi } from '../api/auth'
import { useAuth } from '../context/AuthContext'

export default function Register() {
  const [form, setForm] = useState({
    name: '',
    phone: '',
    email: '',
    password: '',
    confirmPassword: '',
  })
  const [errors, setErrors] = useState({})
  const [serverError, setServerError] = useState('')
  const [loading, setLoading] = useState(false)
  const { login } = useAuth()
  const navigate = useNavigate()

  const validate = () => {
    const e = {}
    if (form.name.trim().length < 2) e.name = 'Name must be at least 2 characters'
    const phone = form.phone.trim().replace(/^\+?977/, '')
    if (!/^9[6-9]\d{8}$/.test(phone)) e.phone = 'Enter a valid Nepal number (98XXXXXXXX)'
    if (form.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email))
      e.email = 'Enter a valid email address'
    if (form.password.length < 6) e.password = 'Password must be at least 6 characters'
    if (form.password !== form.confirmPassword) e.confirmPassword = 'Passwords do not match'
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
      const payload = {
        name: form.name.trim(),
        phone: form.phone.trim(),
        password: form.password,
        ...(form.email ? { email: form.email.trim() } : {}),
      }
      const res = await registerApi(payload)
      login(res.data.access_token, res.data.user)
      navigate('/map')
    } catch (err) {
      setServerError(err.response?.data?.detail || 'Registration failed. Please try again.')
    } finally {
      setLoading(false)
    }
  }

  const field = (name) => ({
    value: form[name],
    onChange: (e) => {
      setForm((f) => ({ ...f, [name]: e.target.value }))
      setErrors((prev) => ({ ...prev, [name]: undefined }))
    },
  })

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 px-4 py-12">
      <div className="w-full max-w-sm">
        {/* Logo */}
        <div className="text-center mb-8">
          <span className="text-5xl">🇳🇵</span>
          <h1 className="mt-3 text-2xl font-bold text-gray-900">SadakSathi</h1>
          <p className="text-sm text-gray-500 mt-1">सडक साथी · Road Quality Reporter</p>
        </div>

        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-8">
          <h2 className="text-lg font-semibold text-gray-800 mb-6">Create your account</h2>

          {serverError && (
            <div className="flex items-start gap-2 bg-red-50 border border-red-200 text-red-700 text-sm px-4 py-3 rounded-xl mb-5">
              <span className="mt-0.5">⚠️</span>
              <span>{serverError}</span>
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4" noValidate>
            {/* Full Name */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">Full Name</label>
              <input
                type="text"
                autoComplete="name"
                placeholder="Ramesh Shrestha"
                {...field('name')}
                className={`w-full border rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-red-500 focus:border-transparent transition ${
                  errors.name ? 'border-red-400 bg-red-50' : 'border-gray-300'
                }`}
              />
              {errors.name && <p className="text-red-500 text-xs mt-1">{errors.name}</p>}
            </div>

            {/* Phone */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">
                Phone Number
              </label>
              <div className="flex">
                <span className="inline-flex items-center px-3 text-sm text-gray-500 bg-gray-50 border border-r-0 border-gray-300 rounded-l-lg select-none">
                  🇳🇵 +977
                </span>
                <input
                  type="tel"
                  inputMode="numeric"
                  maxLength={10}
                  autoComplete="tel"
                  placeholder="98XXXXXXXX"
                  {...field('phone')}
                  className={`flex-1 border rounded-r-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-red-500 focus:border-transparent transition ${
                    errors.phone ? 'border-red-400 bg-red-50' : 'border-gray-300'
                  }`}
                />
              </div>
              {errors.phone && <p className="text-red-500 text-xs mt-1">{errors.phone}</p>}
            </div>

            {/* Email (optional) */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">
                Email{' '}
                <span className="text-gray-400 font-normal text-xs">(optional)</span>
              </label>
              <input
                type="email"
                autoComplete="email"
                placeholder="you@example.com"
                {...field('email')}
                className={`w-full border rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-red-500 focus:border-transparent transition ${
                  errors.email ? 'border-red-400 bg-red-50' : 'border-gray-300'
                }`}
              />
              {errors.email && <p className="text-red-500 text-xs mt-1">{errors.email}</p>}
            </div>

            {/* Password */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">Password</label>
              <input
                type="password"
                autoComplete="new-password"
                placeholder="Min. 6 characters"
                {...field('password')}
                className={`w-full border rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-red-500 focus:border-transparent transition ${
                  errors.password ? 'border-red-400 bg-red-50' : 'border-gray-300'
                }`}
              />
              {errors.password && <p className="text-red-500 text-xs mt-1">{errors.password}</p>}
            </div>

            {/* Confirm Password */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">
                Confirm Password
              </label>
              <input
                type="password"
                autoComplete="new-password"
                placeholder="Repeat your password"
                {...field('confirmPassword')}
                className={`w-full border rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-red-500 focus:border-transparent transition ${
                  errors.confirmPassword ? 'border-red-400 bg-red-50' : 'border-gray-300'
                }`}
              />
              {errors.confirmPassword && (
                <p className="text-red-500 text-xs mt-1">{errors.confirmPassword}</p>
              )}
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full bg-red-600 hover:bg-red-700 active:bg-red-800 text-white font-semibold py-2.5 rounded-xl transition-colors disabled:opacity-60 disabled:cursor-not-allowed text-sm mt-2"
            >
              {loading ? (
                <span className="flex items-center justify-center gap-2">
                  <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24" fill="none">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" />
                  </svg>
                  Creating account...
                </span>
              ) : 'Create Account'}
            </button>
          </form>
        </div>

        <p className="text-sm text-center text-gray-500 mt-5">
          Already have an account?{' '}
          <Link to="/login" className="text-red-600 font-semibold hover:underline">
            Sign in
          </Link>
        </p>
      </div>
    </div>
  )
}
