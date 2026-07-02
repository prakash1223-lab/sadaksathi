import { useEffect, useRef, useState, useMemo } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import {
  AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer,
} from 'recharts'
import { motion, AnimatePresence, useMotionValue, useTransform, animate } from 'framer-motion'
import {
  MapPin, CheckCircle2, Wrench, ThumbsUp, Trophy, Star, Search,
  Sprout, FileText, Zap, Lock, Pencil, Share2, Smartphone, Mail,
  Calendar, Map, User, ChevronDown, ChevronUp, Award, Crown, Shield,
  Flame, TrendingUp, BarChart3, Activity, Eye, X, PartyPopper,
  ChevronRight, Loader2
} from 'lucide-react'
import { getProfile, updateProfile, changePassword } from '../api/auth'
import { useAuth } from '../context/AuthContext'
import { timeAgo, formatDate, formatMonthYear } from '../utils/time'

// ── Animated Counter Hook ───────────────────────────────────────────────────
function useAnimatedCounter(target, duration = 1.5) {
  const nodeRef = useRef()
  const motionValue = useMotionValue(0)
  const rounded = useTransform(motionValue, (latest) => Math.round(latest))

  useEffect(() => {
    const controls = animate(motionValue, target, {
      duration,
      ease: 'easeOut',
    })
    return controls.stop
  }, [target, duration, motionValue])

  useEffect(() => {
    const unsubscribe = rounded.on('change', (v) => {
      if (nodeRef.current) nodeRef.current.textContent = v
    })
    return unsubscribe
  }, [rounded])

  return nodeRef
}

// ── Helpers ───────────────────────────────────────────────────────────────────
function avatarColor(name = '') {
  const colors = [
    'bg-rose-500', 'bg-orange-500', 'bg-amber-500', 'bg-emerald-600',
    'bg-teal-500', 'bg-blue-600', 'bg-indigo-500', 'bg-violet-600',
    'bg-fuchsia-600', 'bg-pink-500'
  ]
  let h = 0
  for (let i = 0; i < name.length; i++) h = name.charCodeAt(i) + ((h << 5) - h)
  return colors[Math.abs(h) % colors.length]
}

function avatarHex(name = '') {
  const hexes = [
    '#f43f5e', '#f97316', '#f59e0b', '#10b981',
    '#14b8a6', '#2563eb', '#6366f1', '#7c3aed',
    '#c026d3', '#ec4899'
  ]
  let h = 0
  for (let i = 0; i < name.length; i++) h = name.charCodeAt(i) + ((h << 5) - h)
  return hexes[Math.abs(h) % hexes.length]
}



function getBadge(score) {
  if (score >= 500) return { icon: Crown, label: 'SadakSathi Legend', sub: 'Incredible impact!', next: null, nextPts: 0, rarity: 'legendary', color: '#fbbf24' }
  if (score >= 301) return { icon: Trophy, label: 'Community Hero', sub: 'Nepal thanks you!', next: 'SadakSathi Legend', nextPts: 500, rarity: 'epic', color: '#a78bfa' }
  if (score >= 151) return { icon: Star, label: 'Road Warrior', sub: 'Great contribution!', next: 'Community Hero', nextPts: 301, rarity: 'rare', color: '#60a5fa' }
  if (score >= 51)  return { icon: Shield, label: 'Active Citizen', sub: 'Keep reporting!', next: 'Road Warrior', nextPts: 151, rarity: 'uncommon', color: '#34d399' }
  return { icon: Sprout, label: 'New Reporter', sub: 'Welcome!', next: 'Active Citizen', nextPts: 51, rarity: 'common', color: '#9ca3af' }
}

function timelineFromReports(reports) {
  const evs = []
  for (const r of reports) {
    evs.push({ icon: MapPin, text: `You reported: ${r.title}`, date: r.created_at, key: `r-${r.id}`, type: 'report' })
    if (r.status === 'fixed')
      evs.push({ icon: CheckCircle2, text: `Your report "${r.title}" was fixed`, date: r.updated_at, key: `f-${r.id}`, type: 'fix' })
    if (r.status === 'in_progress')
      evs.push({ icon: Wrench, text: `Municipality started working on: ${r.title}`, date: r.updated_at, key: `p-${r.id}`, type: 'progress' })
    if (r.upvotes > 0)
      evs.push({ icon: ThumbsUp, text: `${r.upvotes} people upvoted: ${r.title}`, date: r.created_at, key: `u-${r.id}`, type: 'upvote' })
  }
  return evs.sort((a, b) => new Date(b.date) - new Date(a.date))
}

function generateHeatmapData(reports) {
  const weeks = 20
  const days = weeks * 7
  const today = new Date()
  const data = []
  const reportCounts = {}

  for (const r of reports) {
    const d = new Date(r.created_at).toISOString().split('T')[0]
    reportCounts[d] = (reportCounts[d] || 0) + 1
  }

  for (let i = days - 1; i >= 0; i--) {
    const d = new Date(today)
    d.setDate(d.getDate() - i)
    const dateStr = d.toISOString().split('T')[0]
    const count = reportCounts[dateStr] || 0
    data.push({ date: dateStr, count })
  }
  return data
}

const SEV_DOT = { high: 'bg-rose-500', medium: 'bg-amber-500', low: 'bg-emerald-500' }
const SEV_TEXT = { high: 'text-rose-700', medium: 'text-amber-700', low: 'text-emerald-700' }
const STA_STYLE = {
  pending: 'bg-slate-100 text-slate-600',
  in_progress: 'bg-blue-100 text-blue-700',
  fixed: 'bg-emerald-100 text-emerald-700',
}

const RARITY_STYLES = {
  common: { bg: 'bg-gray-100', border: 'border-gray-200', text: 'text-gray-600', glow: 'shadow-gray-200' },
  uncommon: { bg: 'bg-emerald-50', border: 'border-emerald-200', text: 'text-emerald-600', glow: 'shadow-emerald-200' },
  rare: { bg: 'bg-blue-50', border: 'border-blue-200', text: 'text-blue-600', glow: 'shadow-blue-200' },
  epic: { bg: 'bg-violet-50', border: 'border-violet-200', text: 'text-violet-600', glow: 'shadow-violet-200' },
  legendary: { bg: 'bg-amber-50', border: 'border-amber-200', text: 'text-amber-600', glow: 'shadow-amber-200' },
}

// ── Framer Motion Variants ────────────────────────────────────────────────────
const containerVariants = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: { staggerChildren: 0.08, delayChildren: 0.1 }
  }
}

const itemVariants = {
  hidden: { opacity: 0, y: 20 },
  visible: {
    opacity: 1, y: 0,
    transition: { type: 'spring', stiffness: 100, damping: 15 }
  }
}

const cardHover = {
  rest: { y: 0, boxShadow: '0 1px 3px rgba(0,0,0,0.08)' },
  hover: {
    y: -4,
    boxShadow: '0 20px 40px rgba(0,0,0,0.12)',
    transition: { type: 'spring', stiffness: 300, damping: 20 }
  }
}

// ── Floating Shapes Background ────────────────────────────────────────────────
function FloatingShapes() {
  return (
    <div className="fixed inset-0 overflow-hidden pointer-events-none z-0">
      <motion.div
        animate={{ x: [0, 30, 0], y: [0, -20, 0], rotate: [0, 10, 0] }}
        transition={{ duration: 12, repeat: Infinity, ease: 'easeInOut' }}
        className="absolute top-20 left-[10%] w-72 h-72 bg-rose-200/30 rounded-full blur-3xl"
      />
      <motion.div
        animate={{ x: [0, -20, 0], y: [0, 30, 0], rotate: [0, -15, 0] }}
        transition={{ duration: 15, repeat: Infinity, ease: 'easeInOut' }}
        className="absolute top-40 right-[5%] w-96 h-96 bg-blue-200/20 rounded-full blur-3xl"
      />
      <motion.div
        animate={{ x: [0, 40, 0], y: [0, 20, 0] }}
        transition={{ duration: 18, repeat: Infinity, ease: 'easeInOut' }}
        className="absolute bottom-20 left-[20%] w-80 h-80 bg-violet-200/20 rounded-full blur-3xl"
      />
      <motion.div
        animate={{ x: [0, -30, 0], y: [0, -40, 0] }}
        transition={{ duration: 14, repeat: Infinity, ease: 'easeInOut' }}
        className="absolute bottom-40 right-[15%] w-64 h-64 bg-amber-200/20 rounded-full blur-3xl"
      />
    </div>
  )
}

// ── Toast ─────────────────────────────────────────────────────────────────────
function Toast({ msg, onClose }) {
  useEffect(() => { const t = setTimeout(onClose, 3000); return () => clearTimeout(t) }, [onClose])
  return (
    <motion.div
      initial={{ opacity: 0, x: 50, scale: 0.9 }}
      animate={{ opacity: 1, x: 0, scale: 1 }}
      exit={{ opacity: 0, x: 50, scale: 0.9 }}
      className="fixed top-4 right-4 z-50 bg-emerald-600 text-white px-5 py-3 rounded-xl shadow-lg text-sm font-medium flex items-center gap-2"
    >
      <CheckCircle2 size={16} />
      {msg}
    </motion.div>
  )
}

// ── Collapsible Section ───────────────────────────────────────────────────────
function CollapsibleSection({ icon: Icon, title, count, badge, defaultOpen = false, children }) {
  const [open, setOpen] = useState(defaultOpen)
  return (
    <motion.div
      variants={itemVariants}
      className="bg-white/80 backdrop-blur-xl rounded-2xl shadow-sm border border-white/50 overflow-hidden"
    >
      <button
        onClick={() => setOpen(o => !o)}
        className="w-full flex items-center justify-between px-5 py-4 hover:bg-white/50 transition-colors"
      >
        <div className="flex items-center gap-2.5">
          <span className="p-1.5 bg-gray-50 rounded-lg">
            <Icon size={16} className="text-gray-700" />
          </span>
          <span className="font-semibold text-gray-800 text-sm">{title}</span>
          {count !== undefined && (
            <span className="bg-rose-600 text-white text-xs px-2 py-0.5 rounded-full font-medium">
              {count}
            </span>
          )}
          {badge && (
            <span className="bg-gray-100 text-gray-500 text-xs px-2 py-0.5 rounded-full">
              {badge}
            </span>
          )}
        </div>
        <div className="flex items-center gap-2">
          <span className="text-xs text-gray-400">{open ? 'Hide' : 'Show'}</span>
          <motion.div animate={{ rotate: open ? 180 : 0 }} transition={{ duration: 0.2 }}>
            <ChevronDown size={16} className="text-gray-400" />
          </motion.div>
        </div>
      </button>
      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.3, ease: 'easeInOut' }}
            className="border-t border-gray-100/50 overflow-hidden"
          >
            {children}
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  )
}

// ── Circular Progress ─────────────────────────────────────────────────────────
function CircularProgress({ percentage, size = 80, strokeWidth = 6, color = '#DC2626' }) {
  const radius = (size - strokeWidth) / 2
  const circumference = radius * 2 * Math.PI
  const offset = circumference - (percentage / 100) * circumference

  return (
    <div className="relative inline-flex items-center justify-center" style={{ width: size, height: size }}>
      <svg width={size} height={size} className="transform -rotate-90">
        <circle
          cx={size / 2} cy={size / 2} r={radius}
          fill="none" stroke="#e5e7eb" strokeWidth={strokeWidth}
        />
        <motion.circle
          cx={size / 2} cy={size / 2} r={radius}
          fill="none" stroke={color} strokeWidth={strokeWidth}
          strokeLinecap="round"
          strokeDasharray={circumference}
          initial={{ strokeDashoffset: circumference }}
          animate={{ strokeDashoffset: offset }}
          transition={{ duration: 1.5, ease: 'easeOut' }}
        />
      </svg>
      <span className="absolute text-sm font-bold text-gray-800">{percentage}%</span>
    </div>
  )
}

// ── Stat Card ─────────────────────────────────────────────────────────────────
function StatCard({ value, label, color, icon: Icon, delay = 0 }) {
  const counterRef = useAnimatedCounter(value, 1.2)

  return (
    <motion.div
      variants={itemVariants}
      whileHover="hover"
      initial="rest"
      animate="rest"
      className="relative bg-white/80 backdrop-blur-sm rounded-2xl p-4 border border-white/60 shadow-sm overflow-hidden group cursor-default"
    >
      <motion.div variants={cardHover} className="relative z-10">
        <div className="flex items-center justify-between mb-2">
          <div className="p-2 rounded-xl bg-gray-50 group-hover:bg-white transition-colors">
            <Icon size={18} style={{ color }} />
          </div>
          <TrendingUp size={14} className="text-gray-300 group-hover:text-gray-400 transition-colors" />
        </div>
        <p className="text-2xl font-bold tracking-tight" style={{ color }} ref={counterRef}>
          0
        </p>
        <p className="text-xs text-gray-500 mt-1 font-medium">{label}</p>
      </motion.div>
      <div
        className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-500"
        style={{ background: `radial-gradient(circle at 80% 20%, ${color}15 0%, transparent 70%)` }}
      />
    </motion.div>
  )
}

// ── Achievement Badge ─────────────────────────────────────────────────────────
function AchievementBadge({ icon: Icon, label, unlocked, rarity, delay = 0 }) {
  const style = RARITY_STYLES[rarity] || RARITY_STYLES.common

  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.8 }}
      animate={{ opacity: 1, scale: 1 }}
      transition={{ delay, type: 'spring', stiffness: 200, damping: 15 }}
      whileHover={{ scale: 1.05, y: -2 }}
      className={`
        relative flex items-center gap-2 text-xs font-semibold px-3.5 py-2 rounded-xl border transition-all duration-300
        ${unlocked
          ? `${style.bg} ${style.border} ${style.text} shadow-sm hover:shadow-md`
          : 'bg-gray-50/50 border-gray-100 text-gray-400 opacity-50 grayscale'
        }
      `}
    >
      {unlocked && (
        <div className={`absolute inset-0 rounded-xl opacity-0 hover:opacity-100 transition-opacity blur-md ${style.glow}`} />
      )}
      <span className="relative">
        <Icon size={14} />
      </span>
      <span className="relative">{label}</span>
      {!unlocked && <Lock size={10} className="relative text-gray-300" />}
    </motion.div>
  )
}

// ── Contribution Heatmap ──────────────────────────────────────────────────────
function ContributionHeatmap({ reports }) {
  const heatmapData = useMemo(() => generateHeatmapData(reports), [reports])
  const weeks = useMemo(() => {
    const w = []
    for (let i = 0; i < heatmapData.length; i += 7) {
      w.push(heatmapData.slice(i, i + 7))
    }
    return w
  }, [heatmapData])

  const getIntensity = (count) => {
    if (count === 0) return 'bg-gray-100'
    if (count === 1) return 'bg-emerald-200'
    if (count === 2) return 'bg-emerald-300'
    if (count === 3) return 'bg-emerald-400'
    return 'bg-emerald-500'
  }

  const monthLabels = useMemo(() => {
    const labels = []
    let lastMonth = ''
    for (let i = 0; i < heatmapData.length; i += 7) {
      const d = new Date(heatmapData[i].date)
      const month = d.toLocaleDateString('en-US', { month: 'short', timeZone: 'Asia/Kathmandu' })
      if (month !== lastMonth) {
        labels.push({ index: i / 7, label: month })
        lastMonth = month
      }
    }
    return labels
  }, [heatmapData])

  return (
    <motion.div
      variants={itemVariants}
      className="bg-white/80 backdrop-blur-xl rounded-2xl p-5 border border-white/50 shadow-sm mb-3"
    >
      <div className="flex items-center gap-2 mb-4">
        <div className="p-1.5 bg-gray-50 rounded-lg">
          <Activity size={16} className="text-gray-700" />
        </div>
        <h3 className="text-sm font-semibold text-gray-800">Contribution Activity</h3>
      </div>
      <div className="overflow-x-auto pb-2">
        <div className="min-w-[600px]">
          <div className="flex gap-1">
            {monthLabels.map((m) => (
              <div key={m.index} className="text-[10px] text-gray-400 font-medium mb-1" style={{ marginLeft: m.index === 0 ? 0 : `${(m.index - (monthLabels[monthLabels.indexOf(m) - 1]?.index || 0)) * 16 - 8}px` }}>
                {m.label}
              </div>
            ))}
          </div>
          <div className="flex gap-1">
            {weeks.map((week, wi) => (
              <div key={wi} className="flex flex-col gap-1">
                {week.map((day, di) => (
                  <motion.div
                    key={di}
                    initial={{ scale: 0 }}
                    animate={{ scale: 1 }}
                    transition={{ delay: wi * 0.01 + di * 0.005, type: 'spring', stiffness: 300 }}
                    whileHover={{ scale: 1.4 }}
                    title={`${day.date}: ${day.count} reports`}
                    className={`w-3 h-3 rounded-sm ${getIntensity(day.count)} transition-colors hover:ring-2 hover:ring-emerald-300 cursor-pointer`}
                  />
                ))}
              </div>
            ))}
          </div>
          <div className="flex items-center gap-2 mt-3 text-[10px] text-gray-400">
            <span>Less</span>
            <div className="flex gap-1">
              <div className="w-3 h-3 rounded-sm bg-gray-100" />
              <div className="w-3 h-3 rounded-sm bg-emerald-200" />
              <div className="w-3 h-3 rounded-sm bg-emerald-300" />
              <div className="w-3 h-3 rounded-sm bg-emerald-400" />
              <div className="w-3 h-3 rounded-sm bg-emerald-500" />
            </div>
            <span>More</span>
          </div>
        </div>
      </div>
    </motion.div>
  )
}

// ── AI Impact Summary ─────────────────────────────────────────────────────────
function ImpactSummary({ stats, user, rank }) {
  const generateSummary = () => {
    const parts = []
    if (stats.fixed > 0) parts.push(`fixed ${stats.fixed} roads`)
    if (stats.total_reports > 0) parts.push(`reported ${stats.total_reports} problems`)
    if (stats.total_upvotes_received > 0) parts.push(`earned ${stats.total_upvotes_received} upvotes`)
    if (rank && rank <= 10) parts.push(`ranked #${rank} in the city`)

    if (parts.length === 0) return "Start reporting to make an impact on your community!"
    return `You've ${parts.join(', ')}. Your contributions are making Kathmandu safer!`
  }

  const summary = generateSummary()

  return (
    <motion.div
      variants={itemVariants}
      className="relative bg-gradient-to-br from-indigo-600 via-violet-600 to-purple-700 rounded-2xl p-5 text-white overflow-hidden mb-3 shadow-lg"
    >
      <div className="absolute inset-0 bg-[url('data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iNjAiIGhlaWdodD0iNjAiIHhtbG5zPSJodHRwOi8vd3d3LnczLm9yZy8yMDAwL3N2ZyI+PGNpcmNsZSBjeD0iMzAiIGN5PSIzMCIgcj0iMSIgZmlsbD0icmdiYSgyNTUsMjU1LDI1NSwwLjEpIi8+PC9zdmc+')] opacity-30" />
      <div className="absolute -top-10 -right-10 w-40 h-40 bg-white/10 rounded-full blur-2xl" />
      <div className="absolute -bottom-10 -left-10 w-32 h-32 bg-white/10 rounded-full blur-2xl" />

      <div className="relative z-10">
        <div className="flex items-center gap-2 mb-3">
          <div className="p-1.5 bg-white/20 rounded-lg backdrop-blur-sm">
            <SparklesIcon />
          </div>
          <span className="text-xs font-semibold text-white/90 uppercase tracking-wider">Impact Summary</span>
        </div>
        <p className="text-sm leading-relaxed text-white/95">{summary}</p>
        <div className="flex items-center gap-3 mt-4">
          <div className="flex -space-x-2">
            {[...Array(3)].map((_, i) => (
              <div key={i} className="w-6 h-6 rounded-full border-2 border-white/20 bg-white/30 backdrop-blur-sm flex items-center justify-center">
                <User size={10} className="text-white/70" />
              </div>
            ))}
          </div>
          <p className="text-xs text-white/70">Community impact powered by AI</p>
        </div>
      </div>
    </motion.div>
  )
}

function SparklesIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-white">
      <path d="M12 3L14.5 8.5L20 11L14.5 13.5L12 19L9.5 13.5L4 11L9.5 8.5L12 3Z" />
    </svg>
  )
}

// ── Report Card ───────────────────────────────────────────────────────────────
function ReportCard({ report }) {
  const isFixed = report.status === 'fixed'
  const isInProgress = report.status === 'in_progress'
  const sevColor = report.severity === 'high' ? '#f43f5e' : report.severity === 'medium' ? '#f59e0b' : '#10b981'

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      whileHover={{ backgroundColor: 'rgba(249, 250, 251, 1)' }}
      className={`px-4 py-3.5 border-b border-gray-100/50 last:border-b-0 transition-colors ${isFixed ? 'bg-emerald-50/30' : ''}`}
    >
      <div className="flex items-start gap-2.5">
        <span className="w-2 h-2 rounded-full shrink-0 mt-1.5" style={{ background: sevColor }} />
        <div className="flex-1 min-w-0">
          <div className="flex items-start justify-between gap-2 mb-1">
            <p className="text-sm font-semibold text-gray-900 leading-snug">{report.title}</p>
            <span className={`text-xs px-2.5 py-0.5 rounded-full font-medium shrink-0 ${STA_STYLE[report.status] || STA_STYLE.pending}`}>
              {isFixed ? (
                <span className="flex items-center gap-1"><CheckCircle2 size={10} /> Fixed</span>
              ) : isInProgress ? (
                <span className="flex items-center gap-1"><Wrench size={10} /> Working</span>
              ) : (
                <span className="flex items-center gap-1"><Loader2 size={10} className="animate-spin" /> Pending</span>
              )}
            </span>
          </div>
          {report.address && (
            <p className="text-xs text-gray-400 mb-1.5 truncate flex items-center gap-1">
              <MapPin size={10} /> {report.address}
            </p>
          )}
          <div className="flex items-center gap-3 text-xs text-gray-400">
            <span className="flex items-center gap-1"><ClockIcon /> {timeAgo(report.created_at)}</span>
            <span className="flex items-center gap-1"><ThumbsUp size={10} /> {report.upvotes} upvotes</span>
            {report.damage_type && (
              <span className="bg-violet-50 text-violet-600 px-1.5 py-0.5 rounded-md text-xs font-medium">
                {report.damage_type.replace(/_/g, ' ')}
              </span>
            )}
          </div>
          {isFixed && (
            <div className="mt-2 flex items-center gap-1.5 text-xs text-emerald-700 bg-emerald-50 border border-emerald-100 rounded-lg px-3 py-1.5">
              <PartyPopper size={12} />
              Fixed on {formatDate(report.updated_at)} — You made a difference!
            </div>
          )}
          <Link to="/map" className="inline-flex items-center gap-1 mt-2 text-xs text-rose-600 font-medium hover:underline group/link">
            <Eye size={12} /> View on Map
            <ChevronRight size={10} className="group-hover/link:translate-x-0.5 transition-transform" />
          </Link>
        </div>
      </div>
    </motion.div>
  )
}

function ClockIcon() {
  return <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>
}

// ── Share Card ────────────────────────────────────────────────────────────────
function ShareCard({ user, stats, onClose }) {
  const b = getBadge(stats.impact_score)
  const hex = avatarHex(user.name)
  const BadgeIcon = b.icon

  const handleCopy = async () => {
    const text = `I've reported ${stats.total_reports} road problems and helped fix ${stats.fixed} roads in Kathmandu with SadakSathi 🇳🇵\nImpact Score: ${stats.impact_score} | Badge: ${b.label}\nJoin me: sadaksathi.vercel.app`
    try {
      await navigator.clipboard.writeText(text)
      alert('Caption copied! Screenshot the card and share it.')
    } catch {
      alert('Take a screenshot of the card to share!')
    }
  }

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4 backdrop-blur-sm"
      onClick={onClose}
    >
      <motion.div
        initial={{ scale: 0.9, opacity: 0, y: 20 }}
        animate={{ scale: 1, opacity: 1, y: 0 }}
        exit={{ scale: 0.9, opacity: 0, y: 20 }}
        transition={{ type: 'spring', stiffness: 300, damping: 25 }}
        className="w-full max-w-sm"
        onClick={e => e.stopPropagation()}
      >
        <div className="rounded-3xl overflow-hidden shadow-2xl relative"
          style={{ background: 'linear-gradient(135deg, #1e1b4b 0%, #312e81 50%, #1e1b4b 100%)' }}>
          <div className="absolute inset-0 opacity-20">
            <div className="absolute top-0 left-0 w-full h-full" style={{ backgroundImage: 'radial-gradient(circle at 20% 50%, rgba(120,119,198,0.3) 0%, transparent 50%)' }} />
            <div className="absolute bottom-0 right-0 w-full h-full" style={{ backgroundImage: 'radial-gradient(circle at 80% 80%, rgba(99,102,241,0.3) 0%, transparent 50%)' }} />
          </div>
          <div className="px-6 pt-6 pb-4 flex items-center gap-3 relative z-10">
            <div className="w-14 h-14 rounded-full flex items-center justify-center text-white text-xl font-bold shadow-lg ring-2 ring-white/20"
              style={{ background: hex }}>
              {user.avatar_initials}
            </div>
            <div>
              <p className="text-white font-bold text-lg leading-tight">{user.name}</p>
              <p className="text-indigo-300 text-xs mt-0.5 flex items-center gap-1">
                <MapPin size={10} /> SadakSathi Reporter
              </p>
            </div>
          </div>
          <div className="px-6 py-4 border-t border-white/10 relative z-10">
            <p className="text-white/90 text-sm leading-relaxed">
              I fixed <span className="text-emerald-400 font-bold text-lg">{stats.fixed}</span> roads in Kathmandu
            </p>
            <p className="text-white/60 text-xs mt-1">
              {stats.total_reports} reports · {stats.total_upvotes_received} upvotes received
            </p>
          </div>
          <div className="grid grid-cols-3 gap-px bg-white/10 mx-6 rounded-2xl overflow-hidden mb-4 relative z-10">
            {[
              { v: stats.total_reports, l: 'Reports' },
              { v: stats.total_upvotes_received, l: 'Upvotes' },
              { v: stats.impact_score, l: 'Impact' },
            ].map(s => (
              <div key={s.l} className="bg-white/5 px-3 py-3 text-center backdrop-blur-sm">
                <p className="text-white font-bold text-xl">{s.v}</p>
                <p className="text-white/50 text-xs mt-0.5">{s.l}</p>
              </div>
            ))}
          </div>
          <div className="flex items-center gap-3 px-6 pb-5 relative z-10">
            <div className="p-2 bg-white/10 rounded-lg backdrop-blur-sm">
              <BadgeIcon size={20} className="text-amber-400" />
            </div>
            <div>
              <p className="text-white font-semibold text-sm">{b.label}</p>
              <p className="text-white/50 text-xs">sadaksathi.vercel.app</p>
            </div>
          </div>
        </div>
        <div className="flex gap-3 mt-4">
          <motion.button
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.98 }}
            onClick={handleCopy}
            className="flex-1 bg-white text-gray-900 font-semibold py-3 rounded-xl text-sm hover:bg-gray-50 transition-colors flex items-center justify-center gap-2 shadow-lg"
          >
            <Share2 size={14} /> Copy Caption
          </motion.button>
          <motion.button
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.98 }}
            onClick={onClose}
            className="flex-1 bg-white/20 text-white font-semibold py-3 rounded-xl text-sm hover:bg-white/30 transition-colors backdrop-blur-sm"
          >
            Close
          </motion.button>
        </div>
        <p className="text-white/50 text-xs text-center mt-2">Screenshot the card above to share</p>
      </motion.div>
    </motion.div>
  )
}

// ── Main ──────────────────────────────────────────────────────────────────────
export default function Profile() {
  const navigate = useNavigate()

  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(true)
  const [tab, setTab] = useState('all')
  const [showAllAct, setShowAllAct] = useState(false)
  const [editing, setEditing] = useState(false)
  const [editForm, setEditForm] = useState({ name: '', email: '' })
  const [editErr, setEditErr] = useState('')
  const [editSaving, setEditSaving] = useState(false)
  const [toast, setToast] = useState('')
  const [showShare, setShowShare] = useState(false)
  const [pwOpen, setPwOpen] = useState(false)
  const [pwForm, setPwForm] = useState({ current_password: '', new_password: '', confirm_password: '' })
  const [pwErr, setPwErr] = useState('')
  const [pwSaving, setPwSaving] = useState(false)
  const [confirmDelete, setConfirmDelete] = useState(null)
  const [deleting, setDeleting] = useState(null)

  useEffect(() => {
    getProfile()
      .then(res => {
        setData(res.data)
        setEditForm({ name: res.data.user.name, email: res.data.user.email || '' })
      })
      .catch(() => navigate('/login'))
      .finally(() => setLoading(false))
  }, [navigate])

  const handleSaveProfile = async () => {
    try {
      const res = await updateProfile({ name: editForm.name.trim(), email: editForm.email.trim() || null })
      setData(d => ({ ...d, user: res.data }))
      setEditing(false)
      setToast('Profile updated!')
    } catch (e) {
      setEditErr(e.response?.data?.detail || 'Update failed')
    } finally { setEditSaving(false) }
  }

  const handleChangePassword = async () => {
    setPwErr('')
    if (pwForm.new_password.length < 6) { setPwErr('Min 6 characters'); return }
    if (pwForm.new_password !== pwForm.confirm_password) { setPwErr('Passwords do not match'); return }
    setPwSaving(true)
    try {
      await changePassword(pwForm)
      setPwForm({ current_password: '', new_password: '', confirm_password: '' })
      setPwOpen(false)
      setToast('Password updated!')
    } catch (e) {
      setPwErr(e.response?.data?.detail || 'Failed to update password')
    } finally { setPwSaving(false) }
  }

  if (loading) return (
    <div className="flex items-center justify-center min-h-screen bg-gray-50 relative overflow-hidden">
      <FloatingShapes />
      <div className="text-center relative z-10">
        <motion.div
          animate={{ rotate: 360 }}
          transition={{ duration: 1, repeat: Infinity, ease: 'linear' }}
          className="w-8 h-8 border-4 border-rose-600 border-t-transparent rounded-full mx-auto mb-3"
        />
        <p className="text-gray-400 text-sm">Loading profile…</p>
      </div>
    </div>
  )

  if (!data) return null

  const { user, stats, reports, monthly_data, streak, rank } = data
  const b = getBadge(stats.impact_score)
  const color = avatarColor(user.name)
  const tabReports = tab === 'all' ? reports : reports.filter(r => r.status === tab)
  const timeline = timelineFromReports(reports)
  const PREVIEW_ACT = 3
  const PREVIEW_REP = 3
  const progressPct = b.next
    ? Math.min(100, Math.round((stats.impact_score / b.nextPts) * 100))
    : 100

  const BadgeIcon = b.icon

  return (
    <div className="bg-gray-50 min-h-screen pb-24 relative overflow-hidden" style={{ fontFamily: "'Inter', system-ui, sans-serif", maxWidth: '100%' }}>
      <FloatingShapes />

      <AnimatePresence>
        {toast && <Toast msg={toast} onClose={() => setToast('')} />}
      </AnimatePresence>
      <AnimatePresence>
        {showShare && <ShareCard user={user} stats={stats} onClose={() => setShowShare(false)} />}
      </AnimatePresence>

      <motion.div
        variants={containerVariants}
        initial="hidden"
        animate="visible"
        className="max-w-2xl mx-auto px-4 relative z-10"
      >

        {/* ═══ CARD 1 — Hero (Glassmorphism) ═══ */}
        <motion.div
          variants={itemVariants}
          className="mb-4 mt-4"
        >
          <div className="relative bg-white/70 backdrop-blur-xl rounded-3xl border border-white/60 shadow-xl overflow-hidden">
            {/* Animated gradient background */}
            <div className="absolute inset-0 opacity-30">
              <div className="absolute inset-0" style={{ background: 'linear-gradient(135deg, rgba(220,38,38,0.1) 0%, rgba(99,102,241,0.1) 50%, rgba(139,92,246,0.1) 100%)' }} />
            </div>

            {/* Cover */}
            <div className="relative h-24 overflow-hidden">
              <div className="absolute inset-0" style={{ background: 'linear-gradient(135deg, #DC2626 0%, #991b1b 50%, #7c3aed 100%)' }} />
              <div className="absolute inset-0 opacity-20">
                <div className="absolute top-0 left-0 w-full h-full" style={{ backgroundImage: 'radial-gradient(circle at 30% 50%, rgba(255,255,255,0.2) 0%, transparent 60%)' }} />
              </div>
              <motion.div
                animate={{ x: [0, 10, 0], y: [0, -5, 0] }}
                transition={{ duration: 8, repeat: Infinity, ease: 'easeInOut' }}
                className="absolute top-4 right-8 w-16 h-16 bg-white/10 rounded-full blur-xl"
              />
            </div>

            <div className="px-5 pb-5 relative">
              {/* Avatar row */}
              <div className="flex items-end justify-between" style={{ marginTop: -32, marginBottom: 16 }}>
                <motion.div
                  initial={{ scale: 0, opacity: 0 }}
                  animate={{ scale: 1, opacity: 1 }}
                  transition={{ type: 'spring', stiffness: 200, delay: 0.2 }}
                  className={`${color} w-16 h-16 rounded-2xl flex items-center justify-center text-white text-xl font-bold shrink-0 ring-4 ring-white shadow-lg`}
                >
                  {user.avatar_initials}
                </motion.div>
                <div className="flex items-center gap-2 mb-1">
                  <motion.button
                    whileHover={{ scale: 1.05 }}
                    whileTap={{ scale: 0.95 }}
                    onClick={() => { setEditing(true); setEditErr('') }}
                    className="flex items-center gap-1.5 border border-gray-200/80 bg-white/80 backdrop-blur-sm text-gray-600 text-xs font-medium px-3.5 py-2 rounded-xl hover:bg-white transition-colors shadow-sm"
                  >
                    <Pencil size={12} /> Edit
                  </motion.button>
                  <motion.button
                    whileHover={{ scale: 1.05 }}
                    whileTap={{ scale: 0.95 }}
                    onClick={() => setShowShare(true)}
                    className="flex items-center gap-1.5 bg-rose-600 hover:bg-rose-700 text-white text-xs font-medium px-3.5 py-2 rounded-xl transition-colors shadow-lg shadow-rose-200"
                  >
                    <Share2 size={12} /> Share
                  </motion.button>
                </div>
              </div>

              {/* Name + meta OR edit form */}
              <AnimatePresence mode="wait">
                {!editing ? (
                  <motion.div
                    key="view"
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -10 }}
                  >
                    <h1 className="text-lg font-bold text-gray-900 mb-1">{user.name}</h1>
                    <div className="space-y-1.5 mb-4">
                      <p className="text-xs text-gray-500 flex items-center gap-1.5">
                        <Smartphone size={12} className="text-gray-400" /> {user.phone}
                      </p>
                      {user.email && (
                        <p className="text-xs text-gray-500 flex items-center gap-1.5">
                          <Mail size={12} className="text-gray-400" /> {user.email}
                        </p>
                      )}
                      {user.joined_date && (
                        <p className="text-xs text-gray-500 flex items-center gap-1.5">
                          <Calendar size={12} className="text-gray-400" />
                          Member since {formatMonthYear(user.joined_date)}
                        </p>
                      )}
                    </div>
                    <div className="inline-flex items-center gap-1.5 bg-rose-50 text-rose-700 text-xs font-semibold px-3.5 py-2 rounded-xl border border-rose-100">
                      <BadgeIcon size={14} /> {b.label}
                    </div>
                  </motion.div>
                ) : (
                  <motion.div
                    key="edit"
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -10 }}
                    className="space-y-3 pt-1"
                  >
                    {[
                      { key: 'name', label: 'Full name', type: 'text', placeholder: 'Your name' },
                      { key: 'email', label: 'Email (optional)', type: 'email', placeholder: 'your@email.com' },
                    ].map(f => (
                      <div key={f.key}>
                        <label className="block text-xs font-medium text-gray-600 mb-1">{f.label}</label>
                        <input
                          type={f.type} value={editForm[f.key]} placeholder={f.placeholder}
                          onChange={e => setEditForm(p => ({ ...p, [f.key]: e.target.value }))}
                          className="w-full border border-gray-200 bg-white/80 backdrop-blur-sm rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-rose-500 transition-all"
                        />
                      </div>
                    ))}
                    {editErr && <p className="text-xs text-rose-500">{editErr}</p>}
                    <div className="flex gap-2">
                      <motion.button
                        whileHover={{ scale: 1.02 }}
                        whileTap={{ scale: 0.98 }}
                        onClick={handleSaveProfile} disabled={editSaving}
                        className="bg-rose-600 hover:bg-rose-700 text-white text-sm font-semibold px-5 py-2.5 rounded-xl disabled:opacity-60 transition-colors shadow-lg shadow-rose-200"
                      >
                        {editSaving ? 'Saving…' : 'Save Changes'}
                      </motion.button>
                      <button
                        onClick={() => { setEditing(false); setEditErr('') }}
                        className="border border-gray-200 bg-white/80 text-gray-600 text-sm px-5 py-2.5 rounded-xl hover:bg-white transition-colors"
                      >
                        Cancel
                      </button>
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>

            {/* Stats grid — interactive cards */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 px-4 pb-4">
              <StatCard value={stats.total_reports} label="Reports" color="#DC2626" icon={FileText} delay={0} />
              <StatCard value={stats.total_upvotes_received} label="Upvotes" color="#f97316" icon={ThumbsUp} delay={0.1} />
              <StatCard value={stats.fixed} label="Fixed" color="#10b981" icon={CheckCircle2} delay={0.2} />
              <StatCard value={stats.impact_score} label="Impact" color="#9333ea" icon={Zap} delay={0.3} />
            </div>

            {/* Streak + Rank + Circular Progress */}
            <div className="grid grid-cols-3 gap-3 px-4 pb-4">
              {streak > 0 && (
                <motion.div
                  variants={itemVariants}
                  className="bg-gradient-to-br from-orange-50 to-amber-50 border border-orange-100 rounded-2xl p-3 text-center relative overflow-hidden group"
                >
                  <div className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity bg-gradient-to-br from-orange-100/50 to-amber-100/50" />
                  <p className="text-orange-600 font-bold text-base relative z-10 flex items-center justify-center gap-1">
                    <Flame size={16} className="text-orange-500" /> {streak}
                  </p>
                  <p className="text-orange-500 text-xs mt-0.5 relative z-10">day streak</p>
                </motion.div>
              )}
              {rank && (
                <Link to="/leaderboard" className="block">
                  <motion.div
                    variants={itemVariants}
                    whileHover={{ scale: 1.03, y: -2 }}
                    className="bg-gradient-to-br from-rose-50 to-red-50 border border-rose-100 rounded-2xl p-3 text-center relative overflow-hidden cursor-pointer shadow-sm"
                  >
                    <p className="text-rose-600 font-bold text-base relative z-10 flex items-center justify-center gap-1">
                      <Trophy size={14} /> #{rank}
                    </p>
                    <p className="text-rose-500 text-xs mt-0.5 relative z-10">in city</p>
                  </motion.div>
                </Link>
              )}
              <motion.div
                variants={itemVariants}
                className="bg-gradient-to-br from-violet-50 to-purple-50 border border-violet-100 rounded-2xl p-3 flex items-center justify-center gap-3 relative overflow-hidden"
              >
                <CircularProgress percentage={progressPct} size={56} strokeWidth={5} color={b.color} />
                <div className="text-left">
                  <p className="text-violet-600 font-bold text-sm">{progressPct}%</p>
                  <p className="text-violet-500 text-[10px]">to next level</p>
                </div>
              </motion.div>
            </div>

            {/* Progress bar */}
            <div className="px-4 pb-4">
              <motion.div
                variants={itemVariants}
                className="bg-gray-50/80 border border-gray-100/60 rounded-2xl p-4"
              >
                <div className="flex items-center gap-3 mb-3">
                  <div className="p-2 bg-white rounded-xl shadow-sm">
                    <BadgeIcon size={18} style={{ color: b.color }} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-xs font-bold text-gray-800">
                      {b.label}{b.next ? ` → ${b.next}` : ' · Max Level!'}
                    </p>
                    {b.next && (
                      <p className="text-xs text-gray-400 mt-0.5">
                        {stats.impact_score} / {b.nextPts} pts · {b.nextPts - stats.impact_score} more to go
                      </p>
                    )}
                  </div>
                </div>
                <div className="h-2 bg-gray-200 rounded-full overflow-hidden">
                  <motion.div
                    className="h-full rounded-full"
                    style={{ background: `linear-gradient(90deg, ${b.color}, ${b.color}dd)` }}
                    initial={{ width: 0 }}
                    animate={{ width: `${progressPct}%` }}
                    transition={{ duration: 1.2, ease: 'easeOut' }}
                  />
                </div>
              </motion.div>
            </div>

            {/* Achievements — Gaming badges */}
            <div className="px-4 pb-5">
              <p className="text-xs font-bold text-gray-500 mb-3 uppercase tracking-wider">Achievements</p>
              <div className="flex flex-wrap gap-2">
                {[
                  { icon: MapPin, label: 'First report', unlocked: stats.total_reports >= 1, rarity: 'common' },
                  { icon: Flame, label: '3 day streak', unlocked: streak >= 3, rarity: 'uncommon' },
                  { icon: Trophy, label: 'Top reporter', unlocked: rank === 1, rarity: 'legendary' },
                  { icon: Shield, label: 'Road hero', unlocked: stats.fixed >= 10, rarity: 'epic' },
                  { icon: Crown, label: 'Legend', unlocked: stats.impact_score >= 500, rarity: 'legendary' },
                ].map((a, i) => (
                  <AchievementBadge
                    key={a.label}
                    icon={a.icon}
                    label={a.label}
                    unlocked={a.unlocked}
                    rarity={a.rarity}
                    delay={0.1 + i * 0.1}
                  />
                ))}
              </div>
            </div>
          </div>
        </motion.div>

        {/* AI Impact Summary */}
        <ImpactSummary stats={stats} user={user} rank={rank} />

        {/* Contribution Heatmap */}
        <ContributionHeatmap reports={reports} />

        {/* ═══ CARD 2 — Chart (Gradient Area) ═══ */}
        {monthly_data && monthly_data.length > 0 && (
          <motion.div
            variants={itemVariants}
            className="bg-white/80 backdrop-blur-xl rounded-2xl p-5 border border-white/50 shadow-sm mb-3"
          >
            <div className="flex items-center gap-2 mb-4">
              <div className="p-1.5 bg-gray-50 rounded-lg">
                <BarChart3 size={16} className="text-gray-700" />
              </div>
              <p className="text-sm font-bold text-gray-800">Reports — Last 6 Months</p>
            </div>
            <ResponsiveContainer width="100%" height={140}>
              <AreaChart data={monthly_data} margin={{ top: 5, right: 5, left: -20, bottom: 0 }}>
                <defs>
                  <linearGradient id="colorCount" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#DC2626" stopOpacity={0.15} />
                    <stop offset="95%" stopColor="#DC2626" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <XAxis
                  dataKey="month"
                  tick={{ fontSize: 11, fill: '#9ca3af' }}
                  axisLine={false}
                  tickLine={false}
                />
                <YAxis hide allowDecimals={false} />
                <Tooltip
                  contentStyle={{
                    borderRadius: 12,
                    border: 'none',
                    boxShadow: '0 4px 20px rgba(0,0,0,.08)',
                    fontSize: 12,
                    background: 'rgba(255,255,255,0.95)',
                    backdropFilter: 'blur(10px)'
                  }}
                  cursor={{ stroke: '#fecaca', strokeWidth: 1, strokeDasharray: '4 4' }}
                />
                <Area
                  type="monotone"
                  dataKey="count"
                  name="Reports"
                  stroke="#DC2626"
                  strokeWidth={2.5}
                  fill="url(#colorCount)"
                  animationDuration={1500}
                  animationEasing="ease-out"
                />
              </AreaChart>
            </ResponsiveContainer>
          </motion.div>
        )}

        {/* ═══ CARD 3 — My Reports (Collapsible) ═══ */}
        <motion.div variants={itemVariants}>
          <CollapsibleSection
            icon={FileText}
            title="My Reports"
            count={stats.total_reports}
            defaultOpen={true}
          >
            {/* Tab bar */}
            <div className="flex border-b border-gray-100/50 overflow-x-auto">
              {[
                { key: 'all', label: `All (${stats.total_reports})` },
                { key: 'pending', label: `Pending (${stats.pending})` },
                { key: 'in_progress', label: `Working (${stats.in_progress})` },
                { key: 'fixed', label: `Fixed (${stats.fixed})` },
              ].map(t => (
                <motion.button
                  key={t.key}
                  onClick={() => setTab(t.key)}
                  whileHover={{ y: -1 }}
                  className={`px-4 py-3.5 text-xs font-semibold whitespace-nowrap border-b-2 transition-colors relative
                    ${tab === t.key ? 'border-rose-600 text-rose-600' : 'border-transparent text-gray-400 hover:text-gray-600'}`}
                >
                  {t.label}
                  {tab === t.key && (
                    <motion.div
                      layoutId="activeTab"
                      className="absolute bottom-0 left-0 right-0 h-0.5 bg-rose-600"
                      transition={{ type: 'spring', stiffness: 300, damping: 30 }}
                    />
                  )}
                </motion.button>
              ))}
            </div>

            {/* Report list */}
            <AnimatePresence mode="wait">
              <motion.div
                key={tab}
                initial={{ opacity: 0, x: 10 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -10 }}
                transition={{ duration: 0.2 }}
              >
                {tabReports.length === 0 ? (
                  <div className="text-center py-12">
                    <motion.div
                      initial={{ scale: 0 }}
                      animate={{ scale: 1 }}
                      transition={{ type: 'spring', stiffness: 200 }}
                    >
                      <MapPin size={40} className="mx-auto text-gray-200 mb-3" />
                    </motion.div>
                    <p className="text-gray-400 text-sm">
                      {tab === 'all' ? "You haven't reported any roads yet." : `No ${tab.replace('_', ' ')} reports.`}
                    </p>
                    {tab === 'all' && (
                      <Link to="/report/new">
                        <motion.button
                          whileHover={{ scale: 1.05 }}
                          whileTap={{ scale: 0.95 }}
                          className="inline-block mt-4 bg-rose-600 text-white text-sm font-semibold px-6 py-2.5 rounded-full hover:bg-rose-700 transition-colors shadow-lg shadow-rose-200"
                        >
                          Report a Problem
                        </motion.button>
                      </Link>
                    )}
                  </div>
                ) : (
                  <>
                    {tabReports
                      .slice(0, tab === 'all' && !data._showAllReports ? PREVIEW_REP : tabReports.length)
                      .map((r, i) => (
                        <motion.div
                          key={r.id}
                          initial={{ opacity: 0, y: 10 }}
                          animate={{ opacity: 1, y: 0 }}
                          transition={{ delay: i * 0.05 }}
                        >
                          <ReportCard report={r} />
                        </motion.div>
                      ))
                    }
                    {tab === 'all' && tabReports.length > PREVIEW_REP && (
                      <motion.button
                        whileHover={{ backgroundColor: 'rgba(254, 242, 242, 1)' }}
                        onClick={() => setData(d => ({ ...d, _showAllReports: !d._showAllReports }))}
                        className="w-full py-3.5 text-xs font-semibold text-rose-600 transition-colors flex items-center justify-center gap-1.5 border-t border-gray-100/50"
                      >
                        {data._showAllReports ? (
                          <><ChevronUp size={14} /> Show less</>
                        ) : (
                          <><ChevronDown size={14} /> Show all {tabReports.length} reports</>
                        )}
                      </motion.button>
                    )}
                  </>
                )}
              </motion.div>
            </AnimatePresence>
          </CollapsibleSection>
        </motion.div>

        {/* ═══ CARD 4 — Activity Timeline (Collapsible) ═══ */}
        {timeline.length > 0 && (
          <motion.div variants={itemVariants} className="mt-3">
            <CollapsibleSection
              icon={Activity}
              title="Recent Activity"
              count={timeline.length}
              defaultOpen={false}
            >
              <div className="px-4 py-3">
                {(showAllAct ? timeline : timeline.slice(0, PREVIEW_ACT)).map((ev, i, arr) => {
                  const EventIcon = ev.icon
                  return (
                    <motion.div
                      key={ev.key}
                      initial={{ opacity: 0, x: -10 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{ delay: i * 0.08 }}
                      className="flex gap-3"
                    >
                      <div className="flex flex-col items-center">
                        <div className={`w-8 h-8 rounded-full flex items-center justify-center text-xs shrink-0 border-2 transition-colors
                          ${ev.type === 'fix' ? 'bg-emerald-50 border-emerald-200 text-emerald-600' :
                            ev.type === 'progress' ? 'bg-blue-50 border-blue-200 text-blue-600' :
                            ev.type === 'upvote' ? 'bg-amber-50 border-amber-200 text-amber-600' :
                            'bg-gray-50 border-gray-200 text-gray-600'}`}>
                          <EventIcon size={12} />
                        </div>
                        {i < arr.length - 1 && <div className="w-px flex-1 bg-gray-100 my-1" />}
                      </div>
                      <div className="pb-3 pt-0.5 min-w-0">
                        <p className="text-xs text-gray-700 leading-snug font-medium">{ev.text}</p>
                        <p className="text-xs text-gray-400 mt-1">{timeAgo(ev.date)}</p>
                      </div>
                    </motion.div>
                  )
                })}

                {timeline.length > PREVIEW_ACT && (
                  <motion.button
                    whileHover={{ x: 2 }}
                    onClick={() => setShowAllAct(s => !s)}
                    className="w-full pt-2 text-xs font-semibold text-rose-600 hover:underline flex items-center justify-center gap-1.5"
                  >
                    {showAllAct ? (
                      <><ChevronUp size={14} /> Show less</>
                    ) : (
                      <><ChevronDown size={14} /> Show all {timeline.length} activities</>
                    )}
                  </motion.button>
                )}
              </div>
            </CollapsibleSection>
          </motion.div>
        )}

        {/* ═══ CARD 5 — Change Password (Collapsible) ═══ */}
        <motion.div variants={itemVariants} className="mt-3">
          <CollapsibleSection icon={Lock} title="Change Password" defaultOpen={false}>
            <div className="px-5 py-4 space-y-3">
              {[
                { key: 'current_password', label: 'Current Password', placeholder: '••••••••' },
                { key: 'new_password', label: 'New Password', placeholder: 'Min. 6 characters' },
                { key: 'confirm_password', label: 'Confirm New Password', placeholder: 'Repeat new password' },
              ].map(f => (
                <div key={f.key}>
                  <label className="block text-xs font-medium text-gray-600 mb-1">{f.label}</label>
                  <input
                    type="password" placeholder={f.placeholder} value={pwForm[f.key]}
                    onChange={e => setPwForm(p => ({ ...p, [f.key]: e.target.value }))}
                    className="w-full border border-gray-200 bg-white/80 backdrop-blur-sm rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-rose-500 transition-all"
                  />
                </div>
              ))}
              {pwErr && <p className="text-xs text-rose-500">{pwErr}</p>}
              <motion.button
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
                onClick={handleChangePassword} disabled={pwSaving}
                className="w-full bg-rose-600 hover:bg-rose-700 text-white font-semibold py-2.5 rounded-xl text-sm disabled:opacity-60 transition-colors shadow-lg shadow-rose-200"
              >
                {pwSaving ? 'Updating…' : 'Update Password'}
              </motion.button>
            </div>
          </CollapsibleSection>
        </motion.div>

        {/* ═══ CARD 6 — Rank teaser ═══ */}
        {rank && (
          <Link to="/leaderboard" className="block mt-3">
            <motion.div
              variants={itemVariants}
              whileHover={{ scale: 1.02, y: -2 }}
              className="bg-white/80 backdrop-blur-xl shadow-sm px-5 py-4 hover:bg-white/95 transition-colors rounded-2xl border border-white/50 group"
            >
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-bold text-gray-800">
                    You are ranked <span className="text-rose-600">#{rank}</span> in Kathmandu
                  </p>
                  <p className="text-xs text-gray-400 mt-1 flex items-center gap-1">
                    See full leaderboard <ChevronRight size={10} className="group-hover:translate-x-1 transition-transform" />
                  </p>
                </div>
                <div className="p-3 bg-rose-50 rounded-xl group-hover:bg-rose-100 transition-colors">
                  <Trophy size={20} className="text-rose-500" />
                </div>
              </div>
            </motion.div>
          </Link>
        )}

      </motion.div>

      {/* ═══ Bottom Nav (mobile) ═══ */}
      <div className="fixed bottom-0 left-0 right-0 bg-white/90 backdrop-blur-xl border-t border-gray-100/80 flex z-40 sm:hidden shadow-lg">
        {[
          { to: '/map', icon: Map, label: 'Map' },
          { to: '/report/new', icon: MapPin, label: 'Report' },
          { to: '/profile', icon: User, label: 'Profile', active: true },
        ].map(item => (
          <Link key={item.to} to={item.to}
            className={`flex-1 flex flex-col items-center py-3 text-xs transition-colors relative
              ${item.active ? 'text-rose-600' : 'text-gray-400 hover:text-gray-600'}`}>
            {item.active && (
              <motion.div
                layoutId="bottomNav"
                className="absolute -top-px left-0 right-0 h-0.5 bg-rose-600"
              />
            )}
            <item.icon size={20} strokeWidth={item.active ? 2.5 : 2} className="mb-1" />
            {item.label}
          </Link>
        ))}
      </div>
    </div>
  )
}
