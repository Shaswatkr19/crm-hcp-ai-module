// src/pages/Dashboard.jsx
import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { listInteractions, listHCPs, summarizeHCP } from '../api/api'
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell, Legend,
} from 'recharts'
import {
  Users, ClipboardList, TrendingUp, Calendar,
  ArrowRight, Bot, Smile, Meh, Frown, Zap,
} from 'lucide-react'

const COLORS = { Positive:'#10b981', Neutral:'#0ea5e9', Negative:'#ef4444' }

export default function Dashboard() {
  const navigate = useNavigate()
  const [interactions, setInteractions] = useState([])
  const [hcps, setHcps] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    Promise.all([listInteractions(), listHCPs()]).then(([ints, h]) => {
      setInteractions(ints)
      setHcps(h)
      setLoading(false)
    })
  }, [])

  // Stats
  const total = interactions.length
  const thisMonth = interactions.filter(i => {
    const d = new Date(i.interaction_date)
    const now = new Date()
    return d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear()
  }).length
  const positives = interactions.filter(i => i.sentiment === 'Positive').length
  const pending = interactions.filter(i => i.follow_up_actions && i.follow_up_actions.trim()).length

  // Sentiment pie
  const sentimentData = [
    { name: 'Positive', value: interactions.filter(i => i.sentiment === 'Positive').length },
    { name: 'Neutral',  value: interactions.filter(i => i.sentiment === 'Neutral').length },
    { name: 'Negative', value: interactions.filter(i => i.sentiment === 'Negative').length },
  ].filter(d => d.value > 0)

  // Interactions per month (last 6)
  const monthMap = {}
  interactions.forEach(i => {
    const d = new Date(i.interaction_date)
    const key = d.toLocaleString('default', { month: 'short' })
    monthMap[key] = (monthMap[key] || 0) + 1
  })
  const barData = Object.entries(monthMap).slice(-6).map(([m, c]) => ({ month: m, count: c }))

  // Recent 5
  const recent = [...interactions].slice(0, 5)

  // Upcoming follow-ups
  const today = new Date()
  const upcoming = interactions
    .filter(i => i.follow_up_date && new Date(i.follow_up_date) >= today)
    .sort((a, b) => new Date(a.follow_up_date) - new Date(b.follow_up_date))
    .slice(0, 4)

  if (loading) return (
    <div className="page-body">
      <div className="empty-state"><span className="spinner spinner-dark" /> Loading dashboard…</div>
    </div>
  )

  return (
    <div className="page-body">
      <div className="page-header">
        <h1>Dashboard</h1>
        <p>Welcome back, Rahul. Here's your HCP activity overview.</p>
      </div>

      {/* Stats */}
      <div className="stats-grid">
        <div className="stat-card">
          <div className="stat-icon" style={{ background:'#e8f0fe' }}>
            <ClipboardList size={20} color="var(--primary)" />
          </div>
          <div>
            <div className="stat-value">{total}</div>
            <div className="stat-label">Total Interactions</div>
            <div className="stat-change up">↑ {thisMonth} this month</div>
          </div>
        </div>
        <div className="stat-card">
          <div className="stat-icon" style={{ background:'#d1fae5' }}>
            <Users size={20} color="#059669" />
          </div>
          <div>
            <div className="stat-value">{hcps.length}</div>
            <div className="stat-label">HCPs in Network</div>
            <div className="stat-change up">Active doctors</div>
          </div>
        </div>
        <div className="stat-card">
          <div className="stat-icon" style={{ background:'#fef3c7' }}>
            <Calendar size={20} color="#d97706" />
          </div>
          <div>
            <div className="stat-value">{upcoming.length}</div>
            <div className="stat-label">Pending Follow-ups</div>
            <div className="stat-change" style={{ color:'var(--warning)' }}>Action needed</div>
          </div>
        </div>
        <div className="stat-card">
          <div className="stat-icon" style={{ background:'#d1fae5' }}>
            <TrendingUp size={20} color="#059669" />
          </div>
          <div>
            <div className="stat-value">{total ? Math.round((positives/total)*100) : 0}%</div>
            <div className="stat-label">Positive Sentiment</div>
            <div className="stat-change up">HCP engagement</div>
          </div>
        </div>
      </div>

      {/* Charts row */}
      <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:16, marginBottom:16 }}>
        {/* Bar chart */}
        <div className="card">
          <div className="card-header">
            <span className="card-title">Interactions by Month</span>
          </div>
          {barData.length ? (
            <ResponsiveContainer width="100%" height={180}>
              <BarChart data={barData} barSize={28}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                <XAxis dataKey="month" tick={{ fontSize:12 }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fontSize:12 }} axisLine={false} tickLine={false} />
                <Tooltip contentStyle={{ borderRadius:8, border:'1px solid #e2e8f0', fontSize:12 }} />
                <Bar dataKey="count" name="Interactions" fill="var(--primary)" radius={[4,4,0,0]} />
              </BarChart>
            </ResponsiveContainer>
          ) : <div className="empty-state" style={{ padding:'40px 0' }}>No data yet</div>}
        </div>

        {/* Pie chart */}
        <div className="card">
          <div className="card-header">
            <span className="card-title">Sentiment Breakdown</span>
          </div>
          {sentimentData.length ? (
            <ResponsiveContainer width="100%" height={180}>
              <PieChart>
                <Pie data={sentimentData} cx="50%" cy="50%" innerRadius={45} outerRadius={70} paddingAngle={3} dataKey="value">
                  {sentimentData.map((e, i) => <Cell key={i} fill={COLORS[e.name]} />)}
                </Pie>
                <Legend iconType="circle" iconSize={10} wrapperStyle={{ fontSize:12 }} />
                <Tooltip contentStyle={{ borderRadius:8, border:'1px solid #e2e8f0', fontSize:12 }} />
              </PieChart>
            </ResponsiveContainer>
          ) : <div className="empty-state" style={{ padding:'40px 0' }}>No data yet</div>}
        </div>
      </div>

      {/* Bottom row */}
      <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:16 }}>
        {/* Recent interactions */}
        <div className="card">
          <div className="card-header">
            <span className="card-title">Recent Interactions</span>
            <button className="btn btn-ghost btn-sm" onClick={() => navigate('/log')}>
              View all <ArrowRight size={12} />
            </button>
          </div>
          {recent.length === 0
            ? <div className="empty-state" style={{ padding:'24px 0' }}>No interactions logged yet</div>
            : (
            <div className="activity-feed">
              {recent.map(r => (
                <div key={r.id} className="activity-item">
                  <div className="activity-dot" style={{ background: COLORS[r.sentiment] || '#94a3b8' }} />
                  <div className="activity-body">
                    <div>
                      <strong>{r.hcp_name}</strong>
                      <span style={{ color:'var(--text-muted)', fontSize:12 }}> · {r.interaction_type}</span>
                    </div>
                    <div style={{ fontSize:12, color:'var(--text-secondary)', marginTop:2 }}>
                      {r.topics_discussed?.slice(0, 60) || 'No topics recorded'}
                      {(r.topics_discussed?.length || 0) > 60 && '…'}
                    </div>
                    <div className="activity-time">{r.interaction_date}</div>
                  </div>
                  <span className={`badge badge-${r.sentiment?.toLowerCase()}`} style={{ marginLeft:'auto', flexShrink:0 }}>
                    {r.sentiment}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Upcoming follow-ups */}
        <div className="card">
          <div className="card-header">
            <span className="card-title">Upcoming Follow-ups</span>
            <span className="badge badge-primary">{upcoming.length}</span>
          </div>
          {upcoming.length === 0
            ? <div className="empty-state" style={{ padding:'24px 0' }}>No upcoming follow-ups 🎉</div>
            : (
            <div style={{ display:'flex', flexDirection:'column', gap:10 }}>
              {upcoming.map(u => (
                <div key={u.id} style={{ padding:'12px', background:'var(--surface-2)', borderRadius:'var(--radius-md)', border:'1px solid var(--border)' }}>
                  <div style={{ display:'flex', justifyContent:'space-between', alignItems:'flex-start', gap:8 }}>
                    <div>
                      <div style={{ fontWeight:600, fontSize:13 }}>{u.hcp_name}</div>
                      <div style={{ fontSize:12, color:'var(--text-muted)', marginTop:2 }}>
                        {u.follow_up_actions?.slice(0,60) || 'Follow-up required'}
                      </div>
                    </div>
                    <div style={{ fontSize:12, fontWeight:600, color:'var(--warning)', background:'var(--warning-light)', padding:'3px 8px', borderRadius:999, flexShrink:0, whiteSpace:'nowrap' }}>
                      📅 {u.follow_up_date}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
