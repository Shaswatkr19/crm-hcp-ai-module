// src/pages/HCPDirectory.jsx
import { useEffect, useState } from 'react'
import { listHCPs, listInteractions, summarizeHCP, recommendForHCP } from '../api/api'
import axios from 'axios'
import {
  Search, Users, Plus, X, Phone, Mail,
  MapPin, Building2, Zap, FileText, Save, Trash2,
} from 'lucide-react'
import toast from 'react-hot-toast'

const BASE = import.meta.env.VITE_API_URL || '/api'

const SPECIALTIES = [
  'All', 'Endocrinologist', 'Cardiologist', 'Oncologist',
  'Diabetologist', 'Neurologist', 'General Physician',
]

const SPECIALTY_COLORS = {
  'Endocrinologist': '#e8f0fe',
  'Cardiologist':    '#fee2e2',
  'Oncologist':      '#ede9fe',
  'Diabetologist':   '#d1fae5',
  'Neurologist':     '#fef3c7',
  'General Physician':'#f0fdf4',
}

// ─────────────────────────────────────────────────────────────────────────────
// FEATURE 2 — Add HCP Modal
// ─────────────────────────────────────────────────────────────────────────────

function AddHCPModal({ onClose, onAdded }) {
  const [form, setForm] = useState({
    name: '', specialty: '', hospital: '', city: '', email: '', phone: '',
  })
  const [saving, setSaving] = useState(false)

  const set = f => e => setForm(p => ({ ...p, [f]: e.target.value }))

  const handleSubmit = async (e) => {
    e.preventDefault()
    if (!form.name.trim()) { toast.error('Name is required'); return }
    setSaving(true)
    try {
      await axios.post(`${BASE}/interactions/hcps`, form)
      toast.success(`${form.name} added to directory!`)
      onAdded()
      onClose()
    } catch (err) {
      toast.error(err.response?.data?.detail || 'Failed to add HCP')
    } finally {
      setSaving(false)
    }
  }

  useEffect(() => {
    const handler = e => { if (e.key === 'Escape') onClose() }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [onClose])

  return (
    <div className="modal-overlay" onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="modal">
        <div className="modal-header">
          <h2>Add New HCP</h2>
          <button className="btn btn-ghost btn-icon" onClick={onClose}><X size={16} /></button>
        </div>

        <form onSubmit={handleSubmit}>
          <div className="modal-body">
            <div className="form-grid">

              <div className="form-group full">
                <label className="form-label">Full Name *</label>
                <input className="form-control" placeholder="e.g. Dr. Priya Sharma" value={form.name} onChange={set('name')} required />
              </div>

              <div className="form-group">
                <label className="form-label">Specialty</label>
                <select className="form-control" value={form.specialty} onChange={set('specialty')}>
                  <option value="">Select specialty…</option>
                  {SPECIALTIES.filter(s => s !== 'All').map(s => <option key={s}>{s}</option>)}
                </select>
              </div>

              <div className="form-group">
                <label className="form-label">Hospital / Clinic</label>
                <input className="form-control" placeholder="e.g. Apollo Hospital" value={form.hospital} onChange={set('hospital')} />
              </div>

              <div className="form-group">
                <label className="form-label">City</label>
                <input className="form-control" placeholder="e.g. Mumbai" value={form.city} onChange={set('city')} />
              </div>

              <div className="form-group">
                <label className="form-label">Phone</label>
                <input className="form-control" placeholder="+91 98765 43210" value={form.phone} onChange={set('phone')} />
              </div>

              <div className="form-group full">
                <label className="form-label">Email</label>
                <input className="form-control" type="email" placeholder="doctor@hospital.com" value={form.email} onChange={set('email')} />
              </div>

            </div>
          </div>

          <div className="modal-footer">
            <button type="button" className="btn btn-ghost" onClick={onClose}>Cancel</button>
            <button type="submit" className="btn btn-primary" disabled={saving}>
              {saving ? <span className="spinner" /> : <Save size={14} />}
              {saving ? 'Adding…' : 'Add HCP'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// DELETE CONFIRM MODAL
// ─────────────────────────────────────────────────────────────────────────────

function DeleteConfirmModal({ hcp, onClose, onDeleted }) {
  const [deleting, setDeleting] = useState(false)

  const handleDelete = async () => {
    setDeleting(true)
    try {
      await axios.delete(`${BASE}/interactions/hcps/${hcp.id}`)
      toast.success(`${hcp.name} removed from directory.`)
      onDeleted()
      onClose()
    } catch (err) {
      toast.error(err.response?.data?.detail || 'Failed to delete HCP')
    } finally {
      setDeleting(false)
    }
  }

  useEffect(() => {
    const handler = e => { if (e.key === 'Escape') onClose() }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [onClose])

  return (
    <div className="modal-overlay" onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="modal" style={{ maxWidth: 420 }}>
        <div className="modal-header">
          <h2 style={{ color: 'var(--danger, #ef4444)' }}>Delete HCP</h2>
          <button className="btn btn-ghost btn-icon" onClick={onClose}><X size={16} /></button>
        </div>

        <div className="modal-body">
          <div style={{
            display: 'flex', alignItems: 'center', gap: 14,
            padding: '14px 16px',
            background: 'var(--danger-bg, #fef2f2)',
            border: '1px solid var(--danger-border, #fecaca)',
            borderRadius: 'var(--radius-md)',
            marginBottom: 16,
          }}>
            <Trash2 size={22} color="var(--danger, #ef4444)" style={{ flexShrink: 0 }} />
            <p style={{ margin: 0, fontSize: 14, lineHeight: 1.5 }}>
              Are you sure you want to delete <strong>{hcp.name}</strong>? This action
              cannot be undone and all associated data will be lost.
            </p>
          </div>
        </div>

        <div className="modal-footer">
          <button className="btn btn-ghost" onClick={onClose} disabled={deleting}>
            Cancel
          </button>
          <button
            className="btn btn-danger"
            onClick={handleDelete}
            disabled={deleting}
            style={{
              background: 'var(--danger, #ef4444)',
              color: '#fff',
              border: 'none',
            }}
          >
            {deleting ? <span className="spinner" /> : <Trash2 size={14} />}
            {deleting ? 'Deleting…' : 'Yes, Delete'}
          </button>
        </div>
      </div>
    </div>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// HCP DETAIL MODAL
// ─────────────────────────────────────────────────────────────────────────────

function HCPModal({ hcp, interactions, onClose, onDeleted }) {
  const [aiPanel,         setAiPanel]         = useState(null)
  const [aiLoading,       setAiLoading]       = useState(false)
  const [showDeleteModal, setShowDeleteModal] = useState(false)

  const hcpInteractions = interactions.filter(i =>
    i.hcp_name?.toLowerCase().includes(hcp.name?.toLowerCase())
  )

  const sentiments = { Positive: 0, Neutral: 0, Negative: 0 }
  hcpInteractions.forEach(i => { if (sentiments[i.sentiment] !== undefined) sentiments[i.sentiment]++ })

  const handleSummarize = async () => {
    setAiLoading(true); setAiPanel(null)
    try {
      const r = await summarizeHCP(hcp.name)
      setAiPanel({ type: 'summary', content: r.summary || r.message })
    } catch { toast.error('Failed') } finally { setAiLoading(false) }
  }

  const handleRecommend = async () => {
    setAiLoading(true); setAiPanel(null)
    try {
      const r = await recommendForHCP(hcp.name)
      setAiPanel({ type: 'recommend', content: r.recommendations || [r.message] })
    } catch { toast.error('Failed') } finally { setAiLoading(false) }
  }

  useEffect(() => {
    const handler = e => { if (e.key === 'Escape' && !showDeleteModal) onClose() }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [onClose, showDeleteModal])

  return (
    <>
      <div className="modal-overlay" onClick={e => e.target === e.currentTarget && onClose()}>
        <div className="modal">
          <div className="modal-header">
            <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
              <div className="avatar" style={{ width: 44, height: 44, fontSize: 16 }}>
                {hcp.name?.split(' ').pop()[0] || 'D'}
              </div>
              <div>
                <h2 style={{ margin: 0 }}>{hcp.name}</h2>
                <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 2 }}>
                  {hcp.specialty} · {hcp.hospital}
                </div>
              </div>
            </div>

            {/* Header actions: Delete + Close */}
            <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
              <button
                className="btn btn-ghost btn-icon"
                onClick={() => setShowDeleteModal(true)}
                title="Delete HCP"
                style={{ color: 'var(--danger, #ef4444)' }}
              >
                <Trash2 size={16} />
              </button>
              <button className="btn btn-ghost btn-icon" onClick={onClose}>
                <X size={16} />
              </button>
            </div>
          </div>

          <div className="modal-body">
            {/* Contact info */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 16 }}>
              {hcp.hospital && <div style={{ display: 'flex', gap: 8, alignItems: 'center', fontSize: 13 }}><Building2 size={14} color="var(--text-muted)" />{hcp.hospital}</div>}
              {hcp.city     && <div style={{ display: 'flex', gap: 8, alignItems: 'center', fontSize: 13 }}><MapPin    size={14} color="var(--text-muted)" />{hcp.city}</div>}
              {hcp.email    && <div style={{ display: 'flex', gap: 8, alignItems: 'center', fontSize: 13 }}><Mail      size={14} color="var(--text-muted)" />{hcp.email}</div>}
              {hcp.phone    && <div style={{ display: 'flex', gap: 8, alignItems: 'center', fontSize: 13 }}><Phone     size={14} color="var(--text-muted)" />{hcp.phone}</div>}
            </div>

            {/* Stats */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 8, marginBottom: 16 }}>
              {[
                { n: hcpInteractions.length,                                    l: 'Interactions' },
                { n: sentiments.Positive,                                       l: 'Positive'     },
                { n: hcpInteractions.filter(i => i.follow_up_actions).length,   l: 'Follow-ups'   },
              ].map(s => (
                <div key={s.l} className="hcp-stat">
                  <div className="n" style={{ color: 'var(--primary)' }}>{s.n}</div>
                  <div className="l">{s.l}</div>
                </div>
              ))}
            </div>

            {/* AI Actions */}
            <div style={{ display: 'flex', gap: 8, marginBottom: 12 }}>
              <button className="btn btn-secondary btn-sm" onClick={handleSummarize} disabled={aiLoading} style={{ flex: 1 }}>
                {aiLoading ? <span className="spinner spinner-dark" /> : <FileText size={13} />} Summarize
              </button>
              <button className="btn btn-ghost btn-sm" onClick={handleRecommend} disabled={aiLoading} style={{ flex: 1, borderColor: 'var(--warning)', color: 'var(--warning)' }}>
                {aiLoading ? <span className="spinner spinner-dark" /> : <Zap size={13} />} Recommend
              </button>
            </div>

            {/* AI Panel */}
            {aiLoading && (
              <div className="extracted-card" style={{ marginBottom: 12 }}>
                <div style={{ display: 'flex', gap: 8, alignItems: 'center', color: 'var(--text-muted)' }}>
                  <span className="spinner spinner-dark" /> Asking AI…
                </div>
              </div>
            )}
            {aiPanel && !aiLoading && (
              <div className="extracted-card" style={{ borderLeftColor: aiPanel.type === 'recommend' ? 'var(--warning)' : 'var(--primary)', marginBottom: 12 }}>
                <h4 style={{ color: aiPanel.type === 'recommend' ? 'var(--warning)' : 'var(--primary)' }}>
                  {aiPanel.type === 'summary' ? '📋 Summary' : '💡 Recommendations'}
                </h4>
                {Array.isArray(aiPanel.content)
                  ? <ol style={{ paddingLeft: 16, fontSize: 13, lineHeight: 1.6 }}>{aiPanel.content.map((c, i) => <li key={i}>{c}</li>)}</ol>
                  : <p style={{ fontSize: 13, lineHeight: 1.6 }}>{aiPanel.content}</p>
                }
              </div>
            )}

            {/* Recent interactions */}
            <div style={{ fontWeight: 600, fontSize: 13, marginBottom: 8 }}>Recent Interactions</div>
            {hcpInteractions.length === 0
              ? <p style={{ color: 'var(--text-muted)', fontSize: 13 }}>No interactions logged yet.</p>
              : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                  {hcpInteractions.slice(0, 4).map(i => (
                    <div key={i.id} style={{ padding: '10px 12px', background: 'var(--surface-2)', borderRadius: 'var(--radius-md)', border: '1px solid var(--border)' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 8 }}>
                        <div style={{ fontSize: 12, fontWeight: 600 }}>{i.interaction_date} · {i.interaction_type}</div>
                        <span className={`badge badge-${i.sentiment?.toLowerCase()}`}>{i.sentiment}</span>
                      </div>
                      {i.topics_discussed && (
                        <div style={{ fontSize: 12, color: 'var(--text-secondary)', marginTop: 3 }}>
                          {i.topics_discussed.slice(0, 80)}{i.topics_discussed.length > 80 ? '…' : ''}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )
            }

            {/* Delete button in footer area of modal body */}
            <div style={{ marginTop: 20, paddingTop: 16, borderTop: '1px solid var(--border)' }}>
              <button
                className="btn btn-ghost btn-sm"
                onClick={() => setShowDeleteModal(true)}
                style={{
                  color: 'var(--danger, #ef4444)',
                  borderColor: 'var(--danger, #ef4444)',
                  width: '100%',
                  justifyContent: 'center',
                }}
              >
                <Trash2 size={13} /> Delete {hcp.name} from Directory
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Delete confirmation — rendered on top */}
      {showDeleteModal && (
        <DeleteConfirmModal
          hcp={hcp}
          onClose={() => setShowDeleteModal(false)}
          onDeleted={() => {
            setShowDeleteModal(false)
            onDeleted()   // refreshes list + closes detail modal
          }}
        />
      )}
    </>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// MAIN PAGE
// ─────────────────────────────────────────────────────────────────────────────

export default function HCPDirectory() {
  const [hcps,         setHcps]         = useState([])
  const [interactions, setInteractions] = useState([])
  const [search,       setSearch]       = useState('')
  const [specialty,    setSpecialty]    = useState('All')
  const [selected,     setSelected]     = useState(null)
  const [showAddModal, setShowAddModal] = useState(false)
  const [loading,      setLoading]      = useState(true)

  const loadData = () => {
    setLoading(true)
    Promise.all([listHCPs(), listInteractions()]).then(([h, i]) => {
      setHcps(h); setInteractions(i); setLoading(false)
    })
  }

  useEffect(() => { loadData() }, [])

  const filtered = hcps.filter(h => {
    const matchSearch = !search
      || h.name.toLowerCase().includes(search.toLowerCase())
      || (h.hospital || '').toLowerCase().includes(search.toLowerCase())
    const matchSpec = specialty === 'All' || h.specialty === specialty
    return matchSearch && matchSpec
  })

  const getStats = (hcp) => {
    const ints = interactions.filter(i =>
      i.hcp_name?.toLowerCase().includes(hcp.name?.toLowerCase())
    )
    const pos = ints.filter(i => i.sentiment === 'Positive').length
    return {
      total:        ints.length,
      positiveRate: ints.length ? Math.round((pos / ints.length) * 100) : 0,
    }
  }

  // Called after a successful delete: close modal + reload list
  const handleDeleted = () => {
    setSelected(null)
    loadData()
  }

  return (
    <div className="page-body">

      {/* Header row */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: 12, marginBottom: 22 }}>
        <div className="page-header" style={{ margin: 0 }}>
          <h1>HCP Directory</h1>
          <p>{hcps.length} healthcare professionals in your network</p>
        </div>

        {/* FEATURE 2 — Add HCP button */}
        <button className="btn btn-primary" onClick={() => setShowAddModal(true)}>
          <Plus size={15} /> Add HCP
        </button>
      </div>

      {/* Filters */}
      <div style={{ display: 'flex', gap: 10, marginBottom: 20, flexWrap: 'wrap' }}>
        <div className="search-wrap" style={{ flex: '1 1 220px' }}>
          <Search size={14} />
          <input
            className="form-control"
            placeholder="Search doctors or hospitals…"
            value={search}
            onChange={e => setSearch(e.target.value)}
            style={{ paddingLeft: 32 }}
          />
        </div>
        <select
          className="form-control"
          value={specialty}
          onChange={e => setSpecialty(e.target.value)}
          style={{ width: 'auto', flex: '0 1 180px' }}
        >
          {SPECIALTIES.map(s => <option key={s}>{s}</option>)}
        </select>
        <span style={{ alignSelf: 'center', fontSize: 13, color: 'var(--text-muted)' }}>
          {filtered.length} result{filtered.length !== 1 ? 's' : ''}
        </span>
      </div>

      {/* Grid */}
      {loading ? (
        <div className="empty-state"><span className="spinner spinner-dark" /> Loading…</div>
      ) : filtered.length === 0 ? (
        <div className="empty-state">
          <Users size={40} />
          <p>No HCPs found.</p>
          <button className="btn btn-primary" onClick={() => setShowAddModal(true)}>
            <Plus size={14} /> Add your first HCP
          </button>
        </div>
      ) : (
        <div className="hcp-grid">
          {filtered.map(hcp => {
            const stats   = getStats(hcp)
            const initials = hcp.name.split(' ').filter(Boolean).map(w => w[0]).slice(0, 2).join('')
            const bgColor  = SPECIALTY_COLORS[hcp.specialty] || '#f1f5f9'

            return (
              <div key={hcp.id} className="hcp-card" onClick={() => setSelected(hcp)}>
                <div className="hcp-card-header">
                  <div className="avatar">{initials}</div>
                  <div className="hcp-card-info">
                    <h3>{hcp.name}</h3>
                    <p>{hcp.specialty || 'General'}</p>
                  </div>
                  <span className="badge badge-gray" style={{ marginLeft: 'auto', fontSize: 10, background: bgColor }}>
                    {hcp.specialty?.split(' ')[0] || 'HCP'}
                  </span>
                </div>

                {(hcp.hospital || hcp.city) && (
                  <div style={{ fontSize: 12, color: 'var(--text-muted)', marginBottom: 12, display: 'flex', gap: 6, alignItems: 'center' }}>
                    <Building2 size={11} />
                    {hcp.hospital}{hcp.city && ` · ${hcp.city}`}
                  </div>
                )}

                <div className="hcp-card-stats">
                  <div className="hcp-stat">
                    <div className="n">{stats.total}</div>
                    <div className="l">Interactions</div>
                  </div>
                  <div className="hcp-stat">
                    <div className="n" style={{ color: 'var(--success)' }}>{stats.positiveRate}%</div>
                    <div className="l">Positive</div>
                  </div>
                </div>
              </div>
            )
          })}
        </div>
      )}

      {/* Modals */}
      {showAddModal && (
        <AddHCPModal
          onClose={() => setShowAddModal(false)}
          onAdded={loadData}
        />
      )}
      {selected && (
        <HCPModal
          hcp={selected}
          interactions={interactions}
          onClose={() => setSelected(null)}
          onDeleted={handleDeleted}
        />
      )}
    </div>
  )
}
