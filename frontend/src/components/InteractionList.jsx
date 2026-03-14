// src/components/InteractionList.jsx
import { useEffect, useState } from 'react'
import { useDispatch, useSelector } from 'react-redux'
import { fetchInteractions, removeInteraction, editInteraction } from '../store/interactionSlice'
import { summarizeHCP, recommendForHCP } from '../api/api'
import {
  Search, Trash2, RefreshCw, Zap, FileText,
  Pencil, X, Save, AlertCircle,
} from 'lucide-react'
import toast from 'react-hot-toast'

// ─────────────────────────────────────────────────────────────────────────────
// EDIT MODAL — FEATURE 1
// ─────────────────────────────────────────────────────────────────────────────

const INTERACTION_TYPES = ['Meeting', 'Call', 'Email', 'Conference', 'Other']

function EditModal({ interaction, onClose, onSaved }) {
  const dispatch = useDispatch()
  const [form, setForm] = useState({
    hcp_name:          interaction.hcp_name          || '',
    hospital:          interaction.hospital           || '',
    interaction_type:  interaction.interaction_type   || 'Meeting',
    interaction_date:  interaction.interaction_date   || '',
    topics_discussed:  interaction.topics_discussed   || '',
    sentiment:         interaction.sentiment          || 'Neutral',
    outcomes:          interaction.outcomes           || '',
    follow_up_actions: interaction.follow_up_actions  || '',
    follow_up_date:    interaction.follow_up_date     || '',
  })
  const [saving, setSaving] = useState(false)

  const set = (field) => (e) => setForm(f => ({ ...f, [field]: e.target.value }))

  const handleSubmit = async (e) => {
    e.preventDefault()
    if (!form.hcp_name.trim()) { toast.error('HCP name is required'); return }
    setSaving(true)
    try {
      const payload = {
        ...form,
        follow_up_date: form.follow_up_date || null,
      }
      await dispatch(editInteraction({ id: interaction.id, data: payload })).unwrap()
      toast.success('Interaction updated!')
      onSaved()
      onClose()
    } catch (err) {
      toast.error(typeof err === 'string' ? err : 'Failed to update')
    } finally {
      setSaving(false)
    }
  }

  // Close on Escape key
  useEffect(() => {
    const handler = (e) => { if (e.key === 'Escape') onClose() }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [onClose])

  return (
    <div className="modal-overlay" onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="modal">
        <div className="modal-header">
          <h2>Edit Interaction #{interaction.id}</h2>
          <button className="btn btn-ghost btn-icon" onClick={onClose}>
            <X size={16} />
          </button>
        </div>

        <form onSubmit={handleSubmit}>
          <div className="modal-body">
            <div className="form-grid">

              <div className="form-group">
                <label className="form-label">HCP Name *</label>
                <input className="form-control" value={form.hcp_name} onChange={set('hcp_name')} required />
              </div>

              <div className="form-group">
                <label className="form-label">Hospital</label>
                <input className="form-control" value={form.hospital} onChange={set('hospital')} placeholder="e.g. Apollo Hospital" />
              </div>

              <div className="form-group">
                <label className="form-label">Interaction Type</label>
                <select className="form-control" value={form.interaction_type} onChange={set('interaction_type')}>
                  {INTERACTION_TYPES.map(t => <option key={t}>{t}</option>)}
                </select>
              </div>

              <div className="form-group">
                <label className="form-label">Date</label>
                <input type="date" className="form-control" value={form.interaction_date} onChange={set('interaction_date')} />
              </div>

              <div className="form-group full">
                <label className="form-label">Topics Discussed</label>
                <textarea className="form-control" rows={3} value={form.topics_discussed} onChange={set('topics_discussed')} placeholder="Key discussion points…" />
              </div>

              <div className="form-group full">
                <label className="form-label">Sentiment</label>
                <div className="sentiment-group">
                  {['Positive', 'Neutral', 'Negative'].map(s => (
                    <label
                      key={s}
                      className={`sentiment-option ${s.toLowerCase()} ${form.sentiment === s ? 'selected' : ''}`}
                    >
                      <input type="radio" name="edit-sentiment" value={s} checked={form.sentiment === s} onChange={() => setForm(f => ({ ...f, sentiment: s }))} />
                      {s === 'Positive' ? '😊' : s === 'Neutral' ? '😐' : '😕'} {s}
                    </label>
                  ))}
                </div>
              </div>

              <div className="form-group full">
                <label className="form-label">Outcomes</label>
                <textarea className="form-control" rows={2} value={form.outcomes} onChange={set('outcomes')} placeholder="Key agreements or results…" />
              </div>

              <div className="form-group full">
                <label className="form-label">Follow-up Actions</label>
                <textarea className="form-control" rows={2} value={form.follow_up_actions} onChange={set('follow_up_actions')} placeholder="Next steps…" />
              </div>

              <div className="form-group">
                <label className="form-label">Follow-up Date</label>
                <input type="date" className="form-control" value={form.follow_up_date || ''} onChange={set('follow_up_date')} />
              </div>

            </div>
          </div>

          <div className="modal-footer">
            <button type="button" className="btn btn-ghost" onClick={onClose}>Cancel</button>
            <button type="submit" className="btn btn-primary" disabled={saving}>
              {saving ? <span className="spinner" /> : <Save size={14} />}
              {saving ? 'Saving…' : 'Save Changes'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// AI RESULT PANEL
// ─────────────────────────────────────────────────────────────────────────────

function AiResultPanel({ panel, loading, onClose }) {
  if (!panel && !loading) return null
  return (
    <div className="extracted-card" style={{ marginBottom: 16, borderLeftColor: panel?.type === 'recommend' ? 'var(--warning)' : 'var(--primary)' }}>
      {loading
        ? <div style={{ display: 'flex', gap: 8, alignItems: 'center', color: 'var(--text-muted)' }}>
            <span className="spinner spinner-dark" /> Asking AI…
          </div>
        : <>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8 }}>
              <h4 style={{ color: panel.type === 'recommend' ? 'var(--warning)' : 'var(--primary)', margin: 0 }}>
                {panel.type === 'summary' ? `📋 Summary — ${panel.hcp}` : `💡 Recommendations — ${panel.hcp}`}
              </h4>
              <button className="btn btn-ghost btn-sm" style={{ padding: '1px 7px' }} onClick={onClose}>✕</button>
            </div>
            {Array.isArray(panel.content)
              ? <ol style={{ paddingLeft: 16, fontSize: 13, lineHeight: 1.6 }}>{panel.content.map((c, i) => <li key={i}>{c}</li>)}</ol>
              : <p style={{ fontSize: 13, lineHeight: 1.6 }}>{panel.content}</p>
            }
          </>
      }
    </div>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// MAIN COMPONENT
// ─────────────────────────────────────────────────────────────────────────────

export default function InteractionList({ refresh }) {
  const dispatch = useDispatch()
  const { items, loading } = useSelector(s => s.interactions)

  const [search,    setSearch]    = useState('')
  const [editing,   setEditing]   = useState(null)   // interaction obj being edited
  const [aiPanel,   setAiPanel]   = useState(null)
  const [aiLoading, setAiLoading] = useState(false)

  useEffect(() => { dispatch(fetchInteractions()) }, [dispatch, refresh])

  const filtered = items.filter(i =>
    !search ||
    i.hcp_name?.toLowerCase().includes(search.toLowerCase()) ||
    (i.hospital || '').toLowerCase().includes(search.toLowerCase()) ||
    (i.topics_discussed || '').toLowerCase().includes(search.toLowerCase())
  )

  const handleDelete = async (id, name) => {
    if (!confirm(`Delete interaction with ${name}?`)) return
    try { await dispatch(removeInteraction(id)).unwrap(); toast.success('Deleted') }
    catch { toast.error('Failed to delete') }
  }

  const handleSummarize = async (name) => {
    setAiLoading(true); setAiPanel(null)
    try {
      const r = await summarizeHCP(name)
      setAiPanel({ type: 'summary', hcp: name, content: r.summary || r.message })
    } catch { toast.error('Failed') } finally { setAiLoading(false) }
  }

  const handleRecommend = async (name) => {
    setAiLoading(true); setAiPanel(null)
    try {
      const r = await recommendForHCP(name)
      setAiPanel({ type: 'recommend', hcp: name, content: r.recommendations || [r.message] })
    } catch { toast.error('Failed') } finally { setAiLoading(false) }
  }

  const refreshList = () => dispatch(fetchInteractions())

  return (
    <div>
      {/* Toolbar */}
      <div style={{ display: 'flex', gap: 10, marginBottom: 14, alignItems: 'center', flexWrap: 'wrap' }}>
        <div className="search-wrap" style={{ flex: '1 1 200px' }}>
          <Search size={13} />
          <input
            className="form-control"
            style={{ paddingLeft: 32 }}
            placeholder="Search doctor, hospital, topics…"
            value={search}
            onChange={e => setSearch(e.target.value)}
          />
        </div>
        <button className="btn btn-ghost btn-sm" onClick={refreshList} title="Refresh">
          <RefreshCw size={13} />
        </button>
        <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>
          {filtered.length} record{filtered.length !== 1 ? 's' : ''}
        </span>
      </div>

      <AiResultPanel panel={aiPanel} loading={aiLoading} onClose={() => setAiPanel(null)} />

      {/* Edit Modal */}
      {editing && (
        <EditModal
          interaction={editing}
          onClose={() => setEditing(null)}
          onSaved={refreshList}
        />
      )}

      {loading ? (
        <div className="empty-state"><span className="spinner spinner-dark" /> Loading…</div>
      ) : filtered.length === 0 ? (
        <div className="empty-state"><AlertCircle size={36} /><p>No interactions yet. Log one above!</p></div>
      ) : (
        <>
          {/* ── Desktop table ── */}
          <div className="table-wrap">
            <table className="data-table">
              <thead>
                <tr>
                  <th>#</th>
                  <th>HCP Name</th>
                  <th>Hospital</th>
                  <th>Type</th>
                  <th>Date</th>
                  <th>Sentiment</th>
                  <th>Source</th>
                  <th>Topics</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map(row => (
                  <tr key={row.id}>
                    <td style={{ color: 'var(--text-muted)', fontSize: 12 }}>{row.id}</td>
                    <td><strong style={{ fontSize: 13 }}>{row.hcp_name}</strong></td>
                    <td style={{ color: 'var(--text-secondary)' }}>{row.hospital || '—'}</td>
                    <td><span className="badge badge-gray">{row.interaction_type}</span></td>
                    <td style={{ whiteSpace: 'nowrap', color: 'var(--text-secondary)', fontSize: 12 }}>{row.interaction_date}</td>
                    <td><span className={`badge badge-${row.sentiment?.toLowerCase()}`}>{row.sentiment}</span></td>
                    <td><span className={`badge ${row.source === 'chat' ? 'badge-chat' : 'badge-form'}`}>{row.source === 'chat' ? '💬 AI' : '📋 Form'}</span></td>
                    <td style={{ maxWidth: 200, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', color: 'var(--text-secondary)', fontSize: 12 }}>
                      {row.topics_discussed || '—'}
                    </td>
                    <td>
                      <div style={{ display: 'flex', gap: 4 }}>
                        {/* EDIT BUTTON — FEATURE 1 */}
                        <button
                          className="btn btn-secondary btn-sm btn-icon"
                          title="Edit interaction"
                          onClick={() => setEditing(row)}
                        >
                          <Pencil size={12} />
                        </button>
                        <button className="btn btn-ghost btn-sm btn-icon" title="Summarize" onClick={() => handleSummarize(row.hcp_name)}>
                          <FileText size={12} />
                        </button>
                        <button className="btn btn-ghost btn-sm btn-icon" title="Recommend" onClick={() => handleRecommend(row.hcp_name)} style={{ color: 'var(--warning)' }}>
                          <Zap size={12} />
                        </button>
                        <button className="btn btn-danger btn-sm btn-icon" title="Delete" onClick={() => handleDelete(row.id, row.hcp_name)}>
                          <Trash2 size={12} />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* ── Mobile cards ── */}
          <div className="mobile-card-list">
            {filtered.map(row => (
              <div key={row.id} className="mob-card">
                <div className="mob-card-row">
                  <div>
                    <div className="mob-card-name">{row.hcp_name}</div>
                    <div className="mob-card-sub">{row.hospital || 'No hospital'}</div>
                  </div>
                  <span className={`badge badge-${row.sentiment?.toLowerCase()}`}>{row.sentiment}</span>
                </div>
                {row.topics_discussed && (
                  <div className="mob-card-body">
                    {row.topics_discussed.slice(0, 100)}{row.topics_discussed.length > 100 ? '…' : ''}
                  </div>
                )}
                <div className="mob-card-meta">
                  <span>📅 {row.interaction_date}</span>
                  <span className="badge badge-gray" style={{ fontSize: 11 }}>{row.interaction_type}</span>
                  <span className={`badge ${row.source === 'chat' ? 'badge-chat' : 'badge-form'}`} style={{ fontSize: 11 }}>
                    {row.source === 'chat' ? '💬 AI' : '📋 Form'}
                  </span>
                </div>
                {/* EDIT + ACTIONS — mobile */}
                <div className="mob-card-actions">
                  <button className="btn btn-secondary btn-sm" onClick={() => setEditing(row)}>
                    <Pencil size={12} /> Edit
                  </button>
                  <button className="btn btn-ghost btn-sm" onClick={() => handleSummarize(row.hcp_name)}>
                    <FileText size={12} /> Summary
                  </button>
                  <button className="btn btn-ghost btn-sm" style={{ color: 'var(--warning)' }} onClick={() => handleRecommend(row.hcp_name)}>
                    <Zap size={12} />
                  </button>
                  <button className="btn btn-danger btn-sm" onClick={() => handleDelete(row.id, row.hcp_name)}>
                    <Trash2 size={12} />
                  </button>
                </div>
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  )
}
