import { useState, useEffect, useRef, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import { MapContainer, TileLayer, Marker, useMapEvents, useMap } from 'react-leaflet'
import L from 'leaflet'
import { createReport, analyzePhoto } from '../api/reports'
import { useSettings } from '../context/SettingsContext'

/* ─── Custom Map Marker ─── */
const customMarker = new L.Icon({
  iconUrl: 'https://cdn-icons-png.flaticon.com/512/684/684908.png',
  iconSize: [36, 36],
  iconAnchor: [18, 36],
  popupAnchor: [0, -36],
})

const userLocationIcon = new L.Icon({
  iconUrl: 'https://cdn-icons-png.flaticon.com/512/9356/9356230.png',
  iconSize: [32, 32],
  iconAnchor: [16, 32],
})

delete L.Icon.Default.prototype._getIconUrl
L.Icon.Default.mergeOptions({
  iconRetinaUrl:'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png',
  iconUrl:'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png',
  shadowUrl:'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
})

const KATHMANDU = [27.7172, 85.324]
const STEPS = [
  { label: 'Location', icon: '📍', desc: 'Pin the damage spot' },
  { label: 'Details',  icon: '📝', desc: 'Describe the issue' },
  { label: 'Photo',    icon: '📸', desc: 'Add visual proof' },
]
const SEVERITY = [
  { value:'low',    label:'Low',    sub:'Minor crack or surface wear',       icon: '🟢', color:'#22c55e', bg:'bg-green-50',  border:'border-green-300',  text:'text-green-800',  ring:'ring-green-400',  fill:'fill-green-500' },
  { value:'medium', label:'Medium', sub:'Pothole or broken road surface',     icon: '🟡', color:'#eab308', bg:'bg-yellow-50', border:'border-yellow-300', text:'text-yellow-800', ring:'ring-yellow-400', fill:'fill-yellow-500' },
  { value:'high',   label:'High',   sub:'Dangerous / Landslide risk',         icon: '🔴', color:'#ef4444', bg:'bg-red-50',    border:'border-red-300',   text:'text-red-800',   ring:'ring-red-400',   fill:'fill-red-500' },
]

/* ─── Helper Components ─── */

function Spinner({ className = 'h-4 w-4' }) {
  return (
    <svg className={`animate-spin ${className}`} viewBox="0 0 24 24" fill="none">
      <circle className="opacity-20" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/>
      <path className="opacity-90" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z"/>
    </svg>
  )
}

function Confetti() {
  const [pieces] = useState(() => Array.from({ length: 40 }, (_, i) => ({
    id: i,
    left: `${Math.random() * 100}%`,
    delay: `${Math.random() * 0.8}s`,
    duration: `${1.2 + Math.random() * 1.5}s`,
    color: ['#ef4444','#3b82f6','#eab308','#22c55e','#a855f7','#f97316'][Math.floor(Math.random() * 6)],
    size: `${6 + Math.random() * 8}px`,
  })))
  return (
    <div className="fixed inset-0 pointer-events-none overflow-hidden z-50">
      {pieces.map(p => (
        <div key={p.id} style={{
          position: 'absolute', left: p.left, top: '-10px',
          width: p.size, height: p.size, backgroundColor: p.color, borderRadius: '2px',
          animation: `confettiFall ${p.duration} ${p.delay} ease-in forwards`,
        }}/>
      ))}
      <style>{`@keyframes confettiFall { 0%{transform:translateY(-10px) rotate(0deg); opacity:1} 100%{transform:translateY(100vh) rotate(720deg); opacity:0} }`}</style>
    </div>
  )
}

function Toast({ message, type = 'error', onClose }) {
  useEffect(() => { const t = setTimeout(onClose, 4000); return () => clearTimeout(t) }, [onClose])
  const colors = { error: 'bg-red-500', success: 'bg-green-500', warning: 'bg-orange-500', info: 'bg-blue-500' }
  const icons = { error: '⚠️', success: '✅', warning: '🔔', info: 'ℹ️' }
  return (
    <div className={`fixed top-4 left-1/2 -translate-x-1/2 z-50 ${colors[type]} text-white px-5 py-3 rounded-2xl shadow-xl flex items-center gap-2 text-sm font-medium animate-[slideDown_0.3s_ease-out]`}>
      <span>{icons[type]}</span> {message}
      <style>{`@keyframes slideDown { from { transform: translate(-50%, -20px); opacity: 0 } to { transform: translate(-50%, 0); opacity: 1 } }`}</style>
    </div>
  )
}

function FlyTo({ position }) {
  const map = useMap()
  useEffect(() => { if (position) map.flyTo(position, 16, { duration: 1.2 }) }, [position])
  return null
}

function LocationPicker({ position, onChange }) {
  useMapEvents({ click(e) { onChange(e.latlng) } })
  if (!position) return null
  return <Marker position={position} icon={customMarker} draggable eventHandlers={{ dragend(e) { onChange(e.target.getLatLng()) } }}/>
}

function StepBar({ current }) {
  return (
    <div className="flex items-center justify-center mb-10">
      {STEPS.map((s, i) => {
        const done = i < current, active = i === current
        return (
          <div key={s.label} className="flex items-center">
            <div className="flex flex-col items-center relative">
              <div className={`relative w-12 h-12 rounded-2xl flex items-center justify-center text-lg transition-all duration-500 shadow-sm ${
                done ? 'bg-gradient-to-br from-red-500 to-red-600 text-white shadow-red-200 scale-105' :
                active ? 'bg-gradient-to-br from-red-500 to-red-600 text-white shadow-red-200 shadow-lg ring-4 ring-red-100 scale-110' :
                'bg-gray-100 text-gray-400'
              }`}>
                {done ? (
                  <svg className="w-6 h-6" fill="none" stroke="currentColor" strokeWidth="3" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7"/>
                  </svg>
                ) : s.icon}
                {active && <span className="absolute -bottom-1 w-2 h-2 bg-red-500 rounded-full animate-pulse"/>}
              </div>
              <span className={`text-xs mt-2 font-semibold transition-colors duration-300 ${active ? 'text-red-600' : done ? 'text-gray-700' : 'text-gray-400'}`}>
                {s.label}
              </span>
              <span className={`text-[10px] transition-all duration-300 ${active ? 'text-red-400 opacity-100 max-h-4' : 'opacity-0 max-h-0 overflow-hidden'}`}>
                {s.desc}
              </span>
            </div>
            {i < STEPS.length - 1 && (
              <div className={`w-16 sm:w-20 h-1 mx-2 rounded-full transition-all duration-700 ${done ? 'bg-gradient-to-r from-red-500 to-red-400' : 'bg-gray-200'}`}/>
            )}
          </div>
        )
      })}
    </div>
  )
}

function SuccessScreen({ offline }) {
  const [dots, setDots] = useState('')
  useEffect(() => { const t = setInterval(() => setDots(d => d.length >= 3 ? '' : d + '.'), 500); return () => clearInterval(t) }, [])
  return (
    <div className="flex flex-col items-center justify-center py-24 text-center animate-[fadeIn_0.5s_ease-out]">
      <div className="w-24 h-24 rounded-full bg-gradient-to-br from-red-100 to-red-50 flex items-center justify-center text-5xl mb-6 shadow-inner">
        {offline ? '📶' : '🎉'}
      </div>
      <h2 className="text-2xl font-bold text-gray-900 mb-2">
        {offline ? 'Saved Offline!' : 'Report Submitted!'}
      </h2>
      <p className="text-gray-500 text-sm max-w-xs mx-auto leading-relaxed">
        {offline ? 'Will sync automatically when you reconnect.' : 'Thank you for helping improve Kathmandu\'s roads.'}
      </p>
      <div className="mt-6 flex items-center gap-2 text-gray-400 text-xs">
        <Spinner className="h-3 w-3"/>
        Redirecting to map{dots}
      </div>
    </div>
  )
}

function ConfidenceMeter({ confidence }) {
  const pct = Math.round(confidence * 100)
  const color = pct >= 80 ? '#22c55e' : pct >= 50 ? '#eab308' : '#ef4444'
  return (
    <div className="mt-3">
      <div className="flex justify-between text-xs mb-1">
        <span className="text-gray-500">AI Confidence</span>
        <span className="font-bold" style={{ color }}>{pct}%</span>
      </div>
      <div className="w-full bg-gray-200 rounded-full h-2.5 overflow-hidden">
        <div className="h-full rounded-full transition-all duration-1000 ease-out" style={{ width: `${pct}%`, backgroundColor: color }}/>
      </div>
    </div>
  )
}

/* ─── Main Component ─── */

export default function ReportForm() {
  const navigate = useNavigate()
  const { settings } = useSettings()
  const rep = settings?.reporting || {}
  const priv = settings?.privacy || {}

  const [step, setStep] = useState(0)
  const [direction, setDirection] = useState('next')
  const [success, setSuccess] = useState(false)
  const [savedOffline, setSavedOffline] = useState(false)
  const [toast, setToast] = useState(null)
  const [position, setPosition] = useState(null)
  const [gpsLoading, setGpsL] = useState(false)
  const [gpsError, setGpsE] = useState('')
  const [flyTarget, setFly] = useState(null)
  const [title, setTitle] = useState('')
  const [description, setDesc] = useState('')
  const [address, setAddr] = useState('')
  const [severity, setSeverity] = useState('medium')
  const [photo, setPhoto] = useState(null)
  const [preview, setPreview] = useState(null)
  const photoRef = useRef(null)
  const [aiLoading, setAiL] = useState(false)
  const [aiResult, setAiR] = useState(null)
  const [aiApplied, setAiA] = useState(false)
  const [aiProgress, setAiP] = useState(0)
  const [submitting, setSub] = useState(false)
  const [submitError, setSubE] = useState('')
  const [stepError, setStepE] = useState('')
  const [dragOver, setDragOver] = useState(false)
  const [imageZoom, setImageZoom] = useState(false)

  /* Flush offline reports */
  useEffect(() => {
    const pending = JSON.parse(localStorage.getItem('pendingReports') || '[]')
    if (pending.length > 0) {
      pending.forEach(async (data) => {
        try {
          const fd = new FormData()
          Object.entries(data).forEach(([k, v]) => fd.append(k, v))
          await createReport(fd)
        } catch {}
      })
      localStorage.removeItem('pendingReports')
      setToast({ message: `${pending.length} offline report(s) synced!`, type: 'success' })
    }
  }, [])

  const showToast = useCallback((message, type = 'error') => setToast({ message, type }), [])

  const useGPS = () => {
    if (!navigator.geolocation) { setGpsE('GPS not supported on this device'); return }
    setGpsL(true); setGpsE(''); setFly(null)
    navigator.geolocation.getCurrentPosition(
      pos => {
        const ll = { lat: pos.coords.latitude, lng: pos.coords.longitude }
        setPosition(ll); setFly(ll); setGpsL(false)
        showToast('Location found!', 'success')
      },
      () => { setGpsE('Could not get your location. Try clicking on the map instead.'); setGpsL(false) },
      { timeout: 10000, enableHighAccuracy: true }
    )
  }

  const handlePhotoChange = async (file) => {
    if (!file) return
    setPhoto(file); setPreview(URL.createObjectURL(file)); setAiR(null); setAiA(false); setAiP(0)
    if (rep.auto_ai === false) return
    setAiL(true)
    const tick = setInterval(() => setAiP(p => Math.min(p + 10, 85)), 180)
    try {
      const r = await analyzePhoto(file)
      setAiR(r.data); setAiP(100)
      if (r.data.is_road_image === false) showToast('Please upload a road photo', 'warning')
    } catch {
      setAiR(null); showToast('AI analysis failed — please continue manually', 'warning')
    } finally {
      clearInterval(tick); setAiL(false)
    }
  }

  const onFileInput = async (e) => {
    const file = e.target.files?.[0]
    if (file) handlePhotoChange(file)
  }

  const onDrop = (e) => {
    e.preventDefault(); setDragOver(false)
    const file = e.dataTransfer.files?.[0]
    if (file && file.type.startsWith('image/')) handlePhotoChange(file)
    else if (file) showToast('Please drop an image file', 'warning')
  }

  const removePhoto = () => { setPhoto(null); setPreview(null); setAiR(null); setAiA(false); setAiL(false); setAiP(0); if (photoRef.current) photoRef.current.value = '' }

  const applyAI = () => {
    if (!aiResult) return
    setSeverity(aiResult.severity_suggestion)
    const loc = address || 'road'
    const label = aiResult.damage_type.replace('_', ' ')
    if (!title.trim()) setTitle(`${label.charAt(0).toUpperCase() + label.slice(1)} detected on ${loc}`)
    setAiA(true)
    showToast('AI suggestions applied!', 'success')
  }

  const nextStep = () => {
    setStepE('')
    if (step === 0 && !position) { setStepE('Please pin a location on the map before continuing.'); return }
    if (step === 1 && !title.trim()) { setStepE('Please enter a title for the problem.'); return }
    setDirection('next'); setStep(s => s + 1)
  }

  const prevStep = () => { setDirection('prev'); setStepE(''); setStep(s => s - 1) }

  const handleSubmit = async () => {
    setSubE(''); setSub(true)
    let lat = position.lat, lng = position.lng
    if (priv.blur_location) { lat = lat + (Math.random() - 0.5) * 0.01; lng = lng + (Math.random() - 0.5) * 0.01 }
    const fd = new FormData()
    fd.append('title', title.trim()); fd.append('description', description.trim())
    fd.append('address', address.trim()); fd.append('severity', severity)
    fd.append('latitude', lat); fd.append('longitude', lng)
    if (photo) fd.append('photo', photo)
    try {
      await createReport(fd)
      setSuccess(true)
      setTimeout(() => navigate('/map'), 2500)
    } catch (err) {
      if (rep.offline_mode && !err.response) {
        const pending = JSON.parse(localStorage.getItem('pendingReports') || '[]')
        const payload = { title: title.trim(), description: description.trim(), address: address.trim(), severity, latitude: lat, longitude: lng }
        if (photo) { /* can't store File in localStorage */ }
        pending.push(payload)
        localStorage.setItem('pendingReports', JSON.stringify(pending))
        setSavedOffline(true); setSuccess(true)
        setTimeout(() => navigate('/map'), 3000)
      } else {
        const detail = err.response?.data?.detail, status = err.response?.status
        const msg = `Failed (${status || 'network error'}): ${detail || err.message || 'Please try again.'}`
        setSubE(msg); showToast(msg, 'error')
      }
    } finally { setSub(false) }
  }

  /* Animation classes */
  const stepAnimation = direction === 'next'
    ? 'animate-[slideInRight_0.4s_ease-out]'
    : 'animate-[slideInLeft_0.4s_ease-out]'

  if (success) return (
    <div className="max-w-lg mx-auto px-4 py-12">
      <Confetti/>
      <SuccessScreen offline={savedOffline}/>
    </div>
  )

  return (
    <div className="max-w-lg mx-auto px-4 py-8 min-h-screen relative">
      {toast && <Toast {...toast} onClose={() => setToast(null)}/>}

      {/* Header */}
      <div className="flex items-center gap-3 mb-6">
        <button onClick={() => step > 0 ? prevStep() : navigate(-1)} className="p-2 rounded-xl hover:bg-gray-100 transition-colors text-gray-500">
          <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7"/></svg>
        </button>
        <div>
          <h1 className="text-xl font-bold text-gray-900">Report Road Damage</h1>
          <p className="text-xs text-gray-400">Help improve Kathmandu roads</p>
        </div>
      </div>

      <StepBar current={step}/>

      <style>{`
        @keyframes slideInRight { from { opacity: 0; transform: translateX(24px) } to { opacity: 1; transform: translateX(0) } }
        @keyframes slideInLeft  { from { opacity: 0; transform: translateX(-24px) } to { opacity: 1; transform: translateX(0) } }
        @keyframes fadeIn       { from { opacity: 0 } to { opacity: 1 } }
        @keyframes pulse-soft   { 0%,100%{opacity:1} 50%{opacity:.7} }
        .animate-pulse-soft { animation: pulse-soft 2s ease-in-out infinite }
      `}</style>

      {/* ═══════════════════ STEP 1: LOCATION ═══════════════════ */}
      {step === 0 && (
        <div className={`space-y-5 ${stepAnimation}`}>
          <div className="bg-white rounded-2xl p-1 shadow-sm border border-gray-100">
            <div className="rounded-xl overflow-hidden" style={{ height: 340 }}>
              <MapContainer center={position || KATHMANDU} zoom={13} zoomControl={false} style={{ height: '100%', width: '100%' }}>
                <TileLayer attribution='&copy; OpenStreetMap' url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"/>
                <LocationPicker position={position} onChange={(ll) => { setPosition(ll); setFly(null); setGpsE('') }}/>
                {flyTarget && <FlyTo position={flyTarget}/>}
              </MapContainer>
            </div>
          </div>

          <div className="space-y-3">
            <button type="button" onClick={useGPS} disabled={gpsLoading}
              className="flex items-center gap-2.5 w-full justify-center bg-gradient-to-r from-red-500 to-red-600 text-white font-semibold text-sm py-3.5 rounded-xl shadow-lg shadow-red-200 hover:shadow-red-300 hover:scale-[1.01] active:scale-[0.99] transition-all disabled:opacity-60 disabled:hover:scale-100">
              {gpsLoading ? <><Spinner className="h-4 w-4"/> Getting your location... </> : <><span className="text-lg">📍</span> Use my current location</>}
            </button>

            {gpsError && (
              <div className="flex items-center gap-2 bg-red-50 border border-red-200 rounded-xl px-4 py-3">
                <span className="text-red-500 text-lg">⚠️</span>
                <p className="text-xs text-red-700 font-medium">{gpsError}</p>
              </div>
            )}

            {priv.blur_location && (
              <div className="flex items-center gap-2.5 bg-blue-50 border border-blue-200 rounded-xl px-4 py-3">
                <span className="text-lg">🔒</span>
                <p className="text-xs text-blue-700 font-medium">Privacy mode on: location will be approximate (±500m)</p>
              </div>
            )}
          </div>

          {position && (
            <div className="bg-green-50 border border-green-200 rounded-xl px-4 py-3 flex items-center gap-3 animate-[fadeIn_0.3s_ease-out]">
              <div className="w-8 h-8 rounded-full bg-green-100 flex items-center justify-center text-green-600 shrink-0">
                <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="3" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7"/></svg>
              </div>
              <div>
                <p className="text-xs font-semibold text-green-800">Location pinned</p>
                <p className="text-[11px] text-green-600 font-mono">{position.lat.toFixed(6)}, {position.lng.toFixed(6)}</p>
              </div>
            </div>
          )}

          <div className="relative">
            <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wider mb-1.5">Address <span className="text-gray-400 font-normal normal-case">(optional)</span></label>
            <div className="relative">
              <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400 text-sm">📍</span>
              <input type="text" value={address} onChange={e => setAddr(e.target.value)} placeholder="e.g. New Road, Kathmandu"
                className="w-full border border-gray-200 rounded-xl pl-10 pr-3 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-red-500/50 focus:border-red-400 transition-all bg-gray-50/50 hover:bg-white"/>
            </div>
          </div>
        </div>
      )}

      {/* ═══════════════════ STEP 2: DETAILS ═══════════════════ */}
      {step === 1 && (
        <div className={`space-y-6 ${stepAnimation}`}>
          <div className="relative">
            <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wider mb-1.5">Title <span className="text-red-500">*</span></label>
            <input type="text" value={title} onChange={e => setTitle(e.target.value)} placeholder="e.g. Large pothole near Ratnapark" maxLength={120}
              className="w-full border border-gray-200 rounded-xl px-4 py-3 text-sm font-medium focus:outline-none focus:ring-2 focus:ring-red-500/50 focus:border-red-400 transition-all bg-gray-50/50 hover:bg-white"/>
            <div className="text-right text-[10px] text-gray-400 mt-1">{title.length}/120</div>
          </div>

          <div className="relative">
            <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wider mb-1.5">Description <span className="text-gray-400 font-normal normal-case">(optional)</span></label>
            <textarea rows={4} value={description} onChange={e => setDesc(e.target.value)} placeholder="Size, hazard to vehicles, when it started, etc."
              className="w-full border border-gray-200 rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-red-500/50 focus:border-red-400 transition-all bg-gray-50/50 hover:bg-white resize-none leading-relaxed"/>
          </div>

          <div>
            <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wider mb-3">Severity <span className="text-red-500">*</span></label>
            <div className="grid gap-3">
              {SEVERITY.map(s => (
                <button key={s.value} type="button" onClick={() => setSeverity(s.value)}
                  className={`group relative flex items-center gap-4 px-4 py-4 rounded-2xl border-2 transition-all duration-300 text-left ${
                    severity === s.value ? `${s.bg} ${s.border} shadow-md` : 'border-gray-200 hover:border-gray-300 bg-white hover:shadow-sm'
                  }`}>
                  <div className={`w-12 h-12 rounded-xl flex items-center justify-center text-2xl transition-transform duration-300 ${severity === s.value ? 'scale-110' : 'group-hover:scale-105'}`}
                    style={{ backgroundColor: `${s.color}15` }}>{s.icon}</div>
                  <div className="flex-1">
                    <p className={`font-bold text-sm ${severity === s.value ? s.text : 'text-gray-800'}`}>{s.label}</p>
                    <p className="text-xs text-gray-500 mt-0.5">{s.sub}</p>
                  </div>
                  {severity === s.value && (
                    <div className={`w-6 h-6 rounded-full ${s.bg} ${s.border} flex items-center justify-center border-2`}>
                      <svg className="w-3.5 h-3.5" style={{ color: s.color }} fill="none" stroke="currentColor" strokeWidth="3" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7"/></svg>
                    </div>
                  )}
                </button>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* ═══════════════════ STEP 3: PHOTO ═══════════════════ */}
      {step === 2 && (
        <div className={`space-y-6 ${stepAnimation}`}>
          {!preview ? (
            <div className="space-y-3">
              <div
                onClick={() => photoRef.current?.click()}
                onDragOver={(e) => { e.preventDefault(); setDragOver(true) }}
                onDragLeave={() => setDragOver(false)}
                onDrop={onDrop}
                className={`relative flex flex-col items-center justify-center gap-2 cursor-pointer w-full border-2 border-dashed rounded-2xl py-12 transition-all duration-300 ${
                  dragOver ? 'border-red-400 bg-red-50 scale-[1.01] shadow-lg shadow-red-100' : 'border-gray-300 hover:border-red-400 hover:bg-red-50/50'
                }`}>
                <input ref={photoRef} type="file" accept="image/*" capture="environment" className="hidden" onChange={onFileInput}/>
                <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-red-100 to-red-50 flex items-center justify-center text-3xl mb-2 shadow-inner">
                  📸
                </div>
                <p className="text-sm font-bold text-gray-800">{dragOver ? 'Drop photo here' : 'Take a photo'}</p>
                <p className="text-xs text-gray-400">Opens camera on mobile</p>
                <p className="text-[10px] text-gray-400 mt-1">or click to browse</p>
              </div>
              <label className="flex items-center justify-center gap-2 cursor-pointer w-full border border-gray-200 rounded-xl py-3 hover:bg-gray-50 transition-colors active:scale-[0.99]">
                <input type="file" accept="image/*" className="hidden" onChange={onFileInput}/>
                <span className="text-sm font-medium text-gray-600">🖼️ Choose from gallery</span>
              </label>
            </div>
          ) : (
            <div className="relative rounded-2xl overflow-hidden border border-gray-200 shadow-lg group animate-[fadeIn_0.3s_ease-out]">
              <img src={preview} alt="preview" className="w-full h-64 object-cover transition-transform duration-500 group-hover:scale-105" onClick={() => setImageZoom(true)}/>
              <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent"/>
              <button type="button" onClick={removePhoto} className="absolute top-3 right-3 bg-white/20 backdrop-blur-md hover:bg-white/40 text-white rounded-full w-9 h-9 flex items-center justify-center transition-all hover:scale-110 border border-white/30">
                <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12"/></svg>
              </button>
              <div className="absolute bottom-0 left-0 right-0 px-5 py-4">
                <p className="text-white text-sm font-medium truncate">{photo?.name}</p>
                <p className="text-white/70 text-xs mt-0.5">Tap image to enlarge</p>
              </div>
            </div>
          )}

          {/* Zoom Modal */}
          {imageZoom && preview && (
            <div className="fixed inset-0 z-50 bg-black/90 flex items-center justify-center p-4 animate-[fadeIn_0.2s_ease-out]" onClick={() => setImageZoom(false)}>
              <img src={preview} alt="enlarged" className="max-w-full max-h-full rounded-xl shadow-2xl"/>
              <button className="absolute top-4 right-4 text-white/80 hover:text-white p-2" onClick={() => setImageZoom(false)}>
                <svg className="w-6 h-6" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12"/></svg>
              </button>
            </div>
          )}

          {/* AI Disabled */}
          {rep.auto_ai === false && photo && (
            <div className="bg-gray-50 border border-gray-200 rounded-xl px-4 py-3 flex items-center gap-3">
              <span className="text-lg">🤖</span>
              <p className="text-xs text-gray-600">AI analysis is disabled in Settings. Please set severity manually.</p>
            </div>
          )}

          {/* AI Loading */}
          {aiLoading && (
            <div className="bg-gradient-to-br from-purple-50 to-purple-100/50 border border-purple-200 rounded-2xl p-5 animate-[fadeIn_0.3s_ease-out]">
              <div className="flex items-center gap-3 mb-4">
                <div className="w-10 h-10 rounded-xl bg-purple-200 flex items-center justify-center text-lg animate-pulse">🤖</div>
                <div>
                  <p className="text-sm font-bold text-purple-900">AI is analyzing your photo...</p>
                  <p className="text-[11px] text-purple-600">Detecting damage type and severity</p>
                </div>
              </div>
              <div className="w-full bg-purple-200 rounded-full h-2.5 overflow-hidden">
                <div className="bg-gradient-to-r from-purple-500 to-purple-600 h-full rounded-full transition-all duration-300 ease-out" style={{ width: `${aiProgress}%` }}/>
              </div>
              <p className="text-xs text-purple-600 mt-2 font-medium">{aiProgress}% complete</p>
            </div>
          )}

          {/* AI Results */}
          {aiResult && !aiLoading && (
            <div className="animate-[fadeIn_0.4s_ease-out]">
              {aiResult.is_road_image === false ? (
                <div className="bg-gradient-to-br from-orange-50 to-orange-100/50 border-2 border-orange-300 rounded-2xl p-6">
                  <div className="w-14 h-14 rounded-2xl bg-orange-200 flex items-center justify-center text-2xl mb-4 mx-auto">⚠️</div>
                  <h3 className="font-bold text-orange-800 text-center mb-2">Not a Road Image</h3>
                  <p className="text-sm text-orange-700 text-center mb-5 leading-relaxed">Our AI detected this is not a road photo. Please upload a clear photo of the actual road damage.</p>
                  <button type="button" onClick={removePhoto} className="w-full bg-gradient-to-r from-orange-500 to-orange-600 hover:from-orange-600 hover:to-orange-700 text-white font-bold py-3 rounded-xl text-sm shadow-lg shadow-orange-200 transition-all hover:scale-[1.01] active:scale-[0.99]">
                    📷 Upload Different Photo
                  </button>
                </div>
              ) : (
                <div className={`rounded-2xl p-5 border-2 transition-all duration-300 ${
                  aiApplied ? 'bg-green-50/70 border-green-300 shadow-md shadow-green-100' :
                  aiResult.confidence < 0.5 ? 'bg-yellow-50/70 border-yellow-300' : 'bg-blue-50/70 border-blue-300'
                }`}>
                  <div className="flex items-center gap-3 mb-4">
                    <div className={`w-10 h-10 rounded-xl flex items-center justify-center text-lg ${aiApplied ? 'bg-green-200' : 'bg-blue-200'}`}>🤖</div>
                    <div>
                      <p className="text-sm font-bold text-gray-900">AI Detection Result</p>
                      <p className="text-[11px] text-gray-500">{aiApplied ? 'Applied to your report' : 'Review before applying'}</p>
                    </div>
                  </div>

                  <div className="bg-white/60 rounded-xl p-3 mb-4 space-y-2 text-sm">
                    <div className="flex items-center gap-3">
                      <span className="text-gray-500 text-xs w-24 shrink-0">Damage Type</span>
                      <span className="font-semibold text-gray-900 capitalize">{aiResult.damage_type.replace('_', ' ')}</span>
                      <span className="text-[10px] text-gray-500 bg-gray-100 px-2 py-0.5 rounded-full">{aiResult.damage_type_nepali}</span>
                    </div>
                    {aiResult.severity_suggestion && aiResult.severity_suggestion !== 'none' && (
                      <div className="flex items-center gap-3">
                        <span className="text-gray-500 text-xs w-24 shrink-0">Severity</span>
                        <span className={`font-semibold capitalize ${
                          aiResult.severity_suggestion === 'high' ? 'text-red-600' : aiResult.severity_suggestion === 'medium' ? 'text-yellow-600' : 'text-green-600'
                        }`}>
                          {SEVERITY.find(sv => sv.value === aiResult.severity_suggestion)?.icon} {aiResult.severity_suggestion}
                        </span>
                      </div>
                    )}
                  </div>

                  <ConfidenceMeter confidence={aiResult.confidence}/>

                  <div className="mt-4">
                    {aiResult.confidence < 0.5 ? (
                      <div className="bg-yellow-100 rounded-xl px-3 py-2 flex items-center gap-2">
                        <span>⚠️</span>
                        <p className="text-xs text-yellow-800 font-medium">Low confidence — please verify manually</p>
                      </div>
                    ) : aiApplied ? (
                      <div className="bg-green-100 rounded-xl px-3 py-2 flex items-center gap-2">
                        <span>✅</span>
                        <p className="text-xs text-green-800 font-medium">AI settings applied — severity set to {aiResult.severity_suggestion}</p>
                      </div>
                    ) : (
                      <div className="flex gap-2">
                        <button type="button" onClick={applyAI} className="flex-1 bg-gradient-to-r from-blue-500 to-blue-600 hover:from-blue-600 hover:to-blue-700 text-white text-sm font-bold py-2.5 rounded-xl shadow-md shadow-blue-200 transition-all hover:scale-[1.01] active:scale-[0.99]">
                          ✅ Use AI Suggestion
                        </button>
                        <button type="button" onClick={() => setAiR(null)} className="flex-1 border border-gray-300 text-gray-700 text-sm font-bold py-2.5 rounded-xl hover:bg-gray-50 transition-all">
                          ✏️ Set Manually
                        </button>
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Summary Card */}
          <div className="bg-gradient-to-br from-gray-50 to-gray-100/50 rounded-2xl p-5 border border-gray-200">
            <div className="flex items-center gap-2 mb-4">
              <svg className="w-4 h-4 text-gray-400" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2"/></svg>
              <p className="text-[11px] font-bold text-gray-500 uppercase tracking-wider">Report Summary</p>
            </div>
            <div className="space-y-2.5 text-sm">
              <div className="flex gap-3">
                <span className="text-gray-400 text-xs w-20 shrink-0 font-medium">Location</span>
                <span className="text-gray-700 font-medium truncate">{address || (position ? `${position.lat.toFixed(4)}, ${position.lng.toFixed(4)}` : 'Not set')}</span>
              </div>
              <div className="flex gap-3">
                <span className="text-gray-400 text-xs w-20 shrink-0 font-medium">Title</span>
                <span className="text-gray-700 font-medium">{title || '—'}</span>
              </div>
              <div className="flex gap-3">
                <span className="text-gray-400 text-xs w-20 shrink-0 font-medium">Severity</span>
                <span className="font-medium">{SEVERITY.find(s => s.value === severity)?.icon} <span className="capitalize">{severity}</span></span>
              </div>
              <div className="flex gap-3">
                <span className="text-gray-400 text-xs w-20 shrink-0 font-medium">Photo</span>
                <span className="font-medium">{photo ? '✅ Uploaded' : '❌ Not uploaded'}</span>
              </div>
            </div>
          </div>

          {submitError && (
            <div className="bg-red-50 border border-red-200 text-red-700 text-sm px-4 py-3 rounded-xl flex items-start gap-2 animate-[fadeIn_0.3s_ease-out]">
              <span className="mt-0.5">⚠️</span>
              <p>{submitError}</p>
            </div>
          )}
        </div>
      )}

      {stepError && (
        <div className="mt-4 bg-red-50 border border-red-200 text-red-600 text-sm px-4 py-3 rounded-xl flex items-center gap-2 animate-[fadeIn_0.2s_ease-out]">
          <span>⚠️</span> {stepError}
        </div>
      )}

      {/* Navigation Buttons */}
      <div className="mt-8 flex gap-3">
        {step > 0 && (
          <button type="button" onClick={prevStep}
            className="flex-1 border border-gray-200 text-gray-700 font-bold py-3.5 rounded-xl hover:bg-gray-50 transition-all active:scale-[0.98] text-sm flex items-center justify-center gap-1">
            <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7"/></svg>
            Back
          </button>
        )}
        {step < 2 ? (
          <button type="button" onClick={nextStep}
            className="flex-1 bg-gradient-to-r from-red-500 to-red-600 hover:from-red-600 hover:to-red-700 text-white font-bold py-3.5 rounded-xl shadow-lg shadow-red-200 transition-all hover:scale-[1.01] active:scale-[0.98] text-sm flex items-center justify-center gap-1">
            Continue
            <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7"/></svg>
          </button>
        ) : (
          <button type="button" onClick={handleSubmit} disabled={submitting || (photo !== null && aiResult?.is_road_image === false)}
            className="flex-1 bg-gradient-to-r from-red-500 to-red-600 hover:from-red-600 hover:to-red-700 text-white font-bold py-3.5 rounded-xl shadow-lg shadow-red-200 transition-all hover:scale-[1.01] active:scale-[0.98] text-sm disabled:opacity-50 disabled:hover:scale-100 disabled:cursor-not-allowed flex items-center justify-center gap-2">
            {submitting ? <><Spinner className="h-4 w-4"/> Submitting...</> : <><span className="text-base">🚀</span> Submit Report</>}
          </button>
        )}
      </div>

      {step === 2 && !photo && rep.require_photo !== false && (
        <p className="text-center text-xs text-gray-400 mt-3">No photo? You can still submit without one.</p>
      )}
      {step === 2 && photo !== null && aiResult?.is_road_image === false && (
        <p className="text-center text-xs text-orange-600 font-medium mt-3">Please upload a road photo to continue.</p>
      )}

      {/* Keyboard hint */}
      <div className="text-center mt-6">
        <p className="text-[10px] text-gray-300">Press ← → arrow keys to navigate steps</p>
      </div>
    </div>
  )
}
