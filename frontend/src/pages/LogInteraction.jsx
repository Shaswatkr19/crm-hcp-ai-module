// src/pages/LogInteraction.jsx
import { useState, useRef } from 'react'
import { useDispatch } from 'react-redux'
import { addInteraction, fetchInteractions } from '../store/interactionSlice'
import { chatWithAgent, summarizeHCP, recommendForHCP } from '../api/api'
import {
  Bot, Send, Mic, MicOff, Save, RotateCcw, Sparkles,
  Lightbulb, CheckCircle, ChevronDown, Plus, Search,
} from 'lucide-react'
import toast from 'react-hot-toast'
import InteractionList from '../components/InteractionList'

// ─────────────────────────────────────────────────────────────────────────────
// Constants
// ─────────────────────────────────────────────────────────────────────────────

const INTERACTION_TYPES = ['Meeting', 'Call', 'Email', 'Conference', 'Other']

const EMPTY_FORM = {
  hcp_name: '', hospital: '', interaction_type: 'Meeting',
  interaction_date: new Date().toISOString().split('T')[0],
  interaction_time: '', attendees: '', topics_discussed: '',
  materials_shared: '', samples_distributed: '',
  sentiment: 'Neutral', outcomes: '', follow_up_actions: '',
  follow_up_date: '', source: 'form',
}

// ─────────────────────────────────────────────────────────────────────────────
// Mini AI Sidebar — right panel
// ─────────────────────────────────────────────────────────────────────────────

function AISidebar({ onFillForm, currentHcp, lastIntId, onContextUpdate }) {
  const [input,   setInput]   = useState('')
  const [loading, setLoading] = useState(false)
  const [reply,   setReply]   = useState(null)

  const handleLog = async () => {
    const msg = input.trim()
    if (!msg || loading) return
    setLoading(true)
    try {
      const res = await chatWithAgent(msg, currentHcp, lastIntId)
      setReply(res)
      if (res.current_hcp)         onContextUpdate(res.current_hcp, res.last_interaction_id)
      if (res.last_interaction_id) onContextUpdate(res.current_hcp, res.last_interaction_id)
      // If it logged an interaction — fill the form fields too
      if (res.interaction) {
        onFillForm(res.interaction)
        toast.success('Interaction logged via AI!')
        setInput('')
      } else {
        toast.success('AI processed your request')
      }
    } catch {
      toast.error('AI error — check backend')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div style={{
      display: 'flex', flexDirection: 'column', gap: 0,
      background: 'var(--surface)',
      border: '1px solid var(--border)',
      borderRadius: 'var(--radius-lg)',
      overflow: 'hidden',
      height: 'fit-content',
      position: 'sticky',
      top: 16,
    }}>
      {/* Header */}
      <div style={{
        padding: '14px 16px',
        background: 'linear-gradient(135deg, var(--primary), var(--accent))',
        display: 'flex', alignItems: 'center', gap: 10,
      }}>
        <div style={{
          width: 32, height: 32, borderRadius: 'var(--radius-md)',
          background: 'rgba(255,255,255,.2)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
        }}>
          <Bot size={17} color="#fff"/>
        </div>
        <div>
          <div style={{ fontWeight: 700, fontSize: 13, color: '#fff' }}>AI Assistant</div>
          <div style={{ fontSize: 11, color: 'rgba(255,255,255,.75)' }}>Log interaction via chat</div>
        </div>
      </div>

      {/* Hint */}
      <div style={{ padding: '12px 14px', background: 'var(--surface-2)', borderBottom: '1px solid var(--border)' }}>
        <p style={{ fontSize: 12, color: 'var(--text-secondary)', lineHeight: 1.55, margin: 0 }}>
          Log interaction details here (e.g., "Met Dr. Smith, discussed Product X efficacy, positive sentiment, shared brochure") or ask for help.
        </p>
      </div>

      {/* AI Reply */}
      {reply && (
        <div style={{ padding: '12px 14px', borderBottom: '1px solid var(--border)' }}>
          {reply.interaction && (
            <div className="extracted-card" style={{ margin: 0 }}>
              <h4 style={{ marginBottom: 6 }}>
                <CheckCircle size={11} style={{ marginRight: 4 }}/>
                Logged — ID #{reply.interaction.id ?? reply.interaction.interaction_id}
              </h4>
              <div style={{ fontSize: 12, display: 'flex', flexDirection: 'column', gap: 3 }}>
                {reply.interaction.hcp_name     && <div><strong>HCP:</strong> {reply.interaction.hcp_name}</div>}
                {reply.interaction.sentiment    && <div><strong>Sentiment:</strong> <span className={`badge badge-${reply.interaction.sentiment?.toLowerCase()}`}>{reply.interaction.sentiment}</span></div>}
                {reply.interaction.topics_discussed && <div><strong>Topics:</strong> {reply.interaction.topics_discussed?.slice(0,80)}</div>}
              </div>
            </div>
          )}
          {!reply.interaction && reply.reply && (
            <div style={{ fontSize: 12.5, color: 'var(--text-secondary)', lineHeight: 1.55, whiteSpace: 'pre-wrap' }}>
              {reply.reply}
            </div>
          )}
        </div>
      )}

      {/* Input */}
      <div style={{ padding: '12px 14px', display: 'flex', flexDirection: 'column', gap: 8 }}>
        <textarea
          style={{
            width: '100%', padding: '9px 11px',
            border: '1px solid var(--border)',
            borderRadius: 'var(--radius-md)',
            fontFamily: 'var(--font-sans)',
            fontSize: 13, lineHeight: 1.5,
            resize: 'vertical', minHeight: 80,
            outline: 'none', background: 'var(--surface)',
            color: 'var(--text-primary)',
            transition: 'border-color .15s',
            boxSizing: 'border-box',
          }}
          placeholder={'Describe the interaction…\ne.g. "Met Dr. Sharma, discussed insulin pens, very interested"'}
          value={input}
          onChange={e => setInput(e.target.value)}
          onFocus={e => e.target.style.borderColor = 'var(--primary)'}
          onBlur={e  => e.target.style.borderColor = 'var(--border)'}
          onKeyDown={e => e.key === 'Enter' && e.ctrlKey && handleLog()}
        />
        <button
          className="btn btn-primary"
          style={{ width: '100%', justifyContent: 'center' }}
          onClick={handleLog}
          disabled={loading || !input.trim()}
        >
          {loading
            ? <><span className="spinner"/> Processing…</>
            : <><Bot size={14}/> Log via AI</>
          }
        </button>
        {currentHcp && (
          <div style={{ fontSize: 11, color: 'var(--text-muted)', textAlign: 'center' }}>
            📍 Context: <strong>{currentHcp}</strong>
            {lastIntId && ` · Last ID #${lastIntId}`}
          </div>
        )}
      </div>
    </div>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// AI Suggested Follow-ups — shown below form after logging
// ─────────────────────────────────────────────────────────────────────────────

function AISuggestedFollowups({ hcpName, onApply }) {
  const [suggestions, setSuggestions] = useState(null)
  const [loading,     setLoading]     = useState(false)
  const [fetched,     setFetched]     = useState(false)

  const fetchSuggestions = async () => {
    if (!hcpName || loading) return
    setLoading(true)
    try {
      const res = await recommendForHCP(hcpName)
      setSuggestions(res.recommendations || [])
      setFetched(true)
    } catch {
      toast.error('Could not fetch suggestions')
    } finally {
      setLoading(false)
    }
  }

  if (!hcpName) return null

  return (
    <div style={{
      marginTop: 16,
      padding: '14px 16px',
      background: 'linear-gradient(135deg, #fffbeb, #fef9f0)',
      border: '1px solid #fed7aa',
      borderRadius: 'var(--radius-lg)',
    }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: fetched ? 10 : 0 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 7 }}>
          <Sparkles size={14} color="var(--warning)"/>
          <span style={{ fontSize: 13, fontWeight: 700, color: '#92400e' }}>AI Suggested Follow-ups</span>
        </div>
        {!fetched && (
          <button
            type="button"
            className="btn btn-ghost btn-sm"
            style={{ fontSize: 11, color: 'var(--warning)', borderColor: '#fed7aa' }}
            onClick={fetchSuggestions}
            disabled={loading}
          >
            {loading ? <span className="spinner spinner-dark"/> : <Lightbulb size={12}/>}
            {loading ? ' Loading…' : ' Get suggestions'}
          </button>
        )}
      </div>
      {fetched && suggestions?.length > 0 && (
        <ul style={{ margin: 0, paddingLeft: 0, listStyle: 'none', display: 'flex', flexDirection: 'column', gap: 6 }}>
          {suggestions.map((s, i) => (
            <li key={i} style={{ display: 'flex', alignItems: 'flex-start', gap: 8, fontSize: 13 }}>
              <span style={{ color: 'var(--warning)', marginTop: 1, flexShrink: 0 }}>→</span>
              <span style={{ color: '#78350f', lineHeight: 1.5, flex: 1 }}>{s}</span>
              <button
                type="button"
                className="btn btn-ghost btn-sm"
                style={{ fontSize: 11, padding: '2px 8px', flexShrink: 0, color: 'var(--warning)', borderColor: '#fcd34d' }}
                onClick={() => onApply(s)}
                title="Add to Follow-up Actions"
              >
                + Add
              </button>
            </li>
          ))}
        </ul>
      )}
      {fetched && (!suggestions || suggestions.length === 0) && (
        <p style={{ fontSize: 12, color: 'var(--text-muted)', margin: '8px 0 0' }}>No suggestions available.</p>
      )}
    </div>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// Inline Form (self-contained, no tab switching)
// ─────────────────────────────────────────────────────────────────────────────

function InlineForm({ onSuccess }) {
  const dispatch = useDispatch()
  const [form,      setForm]      = useState(EMPTY_FORM)
  const [saving,    setSaving]    = useState(false)
  const [listening, setListening] = useState(false)
  const [lastHcp,   setLastHcp]   = useState('')
  const recognitionRef = useRef(null)

  const set = f => e => setForm(p => ({ ...p, [f]: e.target.value }))

  // Voice input
  const toggleVoice = () => {
    const SR = window.SpeechRecognition || window.webkitSpeechRecognition
    if (!SR) { toast.error('Voice not supported — use Chrome'); return }
    if (listening && recognitionRef.current) {
      recognitionRef.current.stop(); setListening(false); return
    }
    const r = new SR()
    r.lang = 'en-IN'; r.interimResults = false
    r.onstart  = () => { setListening(true); toast('🎙 Listening…', { duration: 2000 }) }
    r.onresult = e => {
      const t = e.results[0][0].transcript
      setForm(p => ({ ...p, topics_discussed: p.topics_discussed ? p.topics_discussed + ' ' + t : t }))
      toast.success('Voice added!')
    }
    r.onerror  = () => setListening(false)
    r.onend    = () => setListening(false)
    recognitionRef.current = r
    r.start()
  }

  // Fill form from AI sidebar result
  const fillFromAI = (interaction) => {
    setForm(p => ({
      ...p,
      hcp_name:          interaction.hcp_name          || p.hcp_name,
      interaction_type:  interaction.interaction_type   || p.interaction_type,
      interaction_date:  interaction.interaction_date   || p.interaction_date,
      topics_discussed:  interaction.topics_discussed   || p.topics_discussed,
      sentiment:         interaction.sentiment          || p.sentiment,
      follow_up_actions: interaction.follow_up_actions  || p.follow_up_actions,
    }))
    if (interaction.hcp_name) setLastHcp(interaction.hcp_name)
  }

  // Apply AI follow-up suggestion to form
  const applyFollowup = (suggestion) => {
    setForm(p => ({
      ...p,
      follow_up_actions: p.follow_up_actions
        ? p.follow_up_actions + '\n' + suggestion
        : suggestion,
    }))
    toast.success('Suggestion added to Follow-up Actions')
  }

  const reset = () => {
    if (listening && recognitionRef.current) recognitionRef.current.stop()
    setForm(EMPTY_FORM)
  }

  const handleSubmit = async e => {
    e.preventDefault()
    if (!form.hcp_name.trim()) { toast.error('HCP name is required'); return }
    setSaving(true)
    try {
      const payload = { ...form, interaction_time: form.interaction_time || null, follow_up_date: form.follow_up_date || null }
      await dispatch(addInteraction(payload)).unwrap()
      toast.success(`Interaction with ${form.hcp_name} logged!`)
      setLastHcp(form.hcp_name)
      onSuccess?.()
      reset()
    } catch { toast.error('Failed to save') } finally { setSaving(false) }
  }

  // Context state for AI sidebar
  const [currentHcp, setCurrentHcp] = useState(null)
  const [lastIntId,  setLastIntId]  = useState(null)

  return (
    <div style={{ display: 'grid', gridTemplateColumns: '1fr 300px', gap: 20, alignItems: 'start' }}>

      {/* ── LEFT: Form ─────────────────────────────────────────────────── */}
      <form onSubmit={handleSubmit}>
        <div style={{
          background: 'var(--surface)',
          border: '1px solid var(--border)',
          borderRadius: 'var(--radius-lg)',
          overflow: 'hidden',
        }}>
          {/* Form header */}
          <div style={{ padding: '14px 18px', borderBottom: '1px solid var(--border)', background: 'var(--surface-2)' }}>
            <div style={{ fontWeight: 700, fontSize: 14 }}>Interaction Details</div>
          </div>

          <div style={{ padding: '18px', display: 'flex', flexDirection: 'column', gap: 14 }}>

            {/* Row 1 — HCP + Type */}
            <div className="form-grid">
              <div className="form-group">
                <label className="form-label">HCP Name *</label>
                <input className="form-control" placeholder="Search or select HCP…" value={form.hcp_name} onChange={e => { set('hcp_name')(e); if (e.target.value) setLastHcp(e.target.value) }} required/>
              </div>
              <div className="form-group">
                <label className="form-label">Interaction Type</label>
                <select className="form-control" value={form.interaction_type} onChange={set('interaction_type')}>
                  {INTERACTION_TYPES.map(t => <option key={t}>{t}</option>)}
                </select>
              </div>
            </div>

            {/* Row 2 — Date + Time */}
            <div className="form-grid">
              <div className="form-group">
                <label className="form-label">Date</label>
                <input type="date" className="form-control" value={form.interaction_date} onChange={set('interaction_date')} required/>
              </div>
              <div className="form-group">
                <label className="form-label">Time</label>
                <input type="time" className="form-control" value={form.interaction_time} onChange={set('interaction_time')}/>
              </div>
            </div>

            {/* Attendees */}
            <div className="form-group">
              <label className="form-label">Attendees</label>
              <input className="form-control" placeholder="Enter names or search…" value={form.attendees} onChange={set('attendees')}/>
            </div>

            {/* Topics Discussed + voice */}
            <div className="form-group">
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 5 }}>
                <label className="form-label" style={{ margin: 0 }}>Topics Discussed</label>
                <button
                  type="button"
                  onClick={toggleVoice}
                  style={{
                    display: 'flex', alignItems: 'center', gap: 5,
                    padding: '3px 9px',
                    borderRadius: 'var(--radius-md)',
                    border: `1px solid ${listening ? 'var(--danger)' : 'var(--border)'}`,
                    background: listening ? 'var(--danger-light)' : 'var(--surface-2)',
                    color: listening ? 'var(--danger)' : 'var(--text-secondary)',
                    cursor: 'pointer', fontSize: 11, fontWeight: 600,
                    fontFamily: 'var(--font-sans)',
                  }}
                >
                  {listening ? <MicOff size={12}/> : <Mic size={12}/>}
                  {listening ? 'Stop' : 'Voice'}
                  {listening && <span style={{ width: 6, height: 6, borderRadius: '50%', background: 'var(--danger)', animation: 'pulse 1s infinite', marginLeft: 2 }}/>}
                </button>
                <style>{`@keyframes pulse{0%,100%{opacity:1}50%{opacity:.3}}`}</style>
              </div>
              <textarea className="form-control" rows={3} placeholder="Enter key discussion points…" value={form.topics_discussed} onChange={set('topics_discussed')}/>
            </div>

            {/* Summarize from Voice Note */}
            <div style={{
              display: 'flex', alignItems: 'center', gap: 8,
              padding: '9px 12px',
              background: 'var(--surface-2)',
              border: '1px solid var(--border)',
              borderRadius: 'var(--radius-md)',
              cursor: 'pointer',
              fontSize: 12, color: 'var(--text-secondary)',
            }} onClick={toggleVoice}>
              <Sparkles size={13} color="var(--primary)"/>
              <span style={{ fontWeight: 500 }}>Summarize from Voice Note (Requires Consent)</span>
            </div>

            {/* Materials + Samples */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              <div style={{ background: 'var(--surface-2)', border: '1px solid var(--border)', borderRadius: 'var(--radius-md)', overflow: 'hidden' }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '10px 12px', borderBottom: '1px solid var(--border)' }}>
                  <span style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-secondary)' }}>Materials Shared</span>
                  <button type="button" className="btn btn-ghost btn-sm" style={{ fontSize: 11 }}><Search size={11}/> Search/Add</button>
                </div>
                <div style={{ padding: '10px 12px' }}>
                  {form.materials_shared
                    ? <span style={{ fontSize: 12 }}>{form.materials_shared}</span>
                    : <span style={{ fontSize: 12, color: 'var(--text-muted)', fontStyle: 'italic' }}>No materials added.</span>
                  }
                  <input
                    className="form-control" style={{ marginTop: 8, fontSize: 12 }}
                    placeholder="Type material name…"
                    value={form.materials_shared}
                    onChange={set('materials_shared')}
                  />
                </div>
              </div>

              <div style={{ background: 'var(--surface-2)', border: '1px solid var(--border)', borderRadius: 'var(--radius-md)', overflow: 'hidden' }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '10px 12px', borderBottom: '1px solid var(--border)' }}>
                  <span style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-secondary)' }}>Samples Distributed</span>
                  <button type="button" className="btn btn-ghost btn-sm" style={{ fontSize: 11 }}><Plus size={11}/> Add Sample</button>
                </div>
                <div style={{ padding: '10px 12px' }}>
                  {form.samples_distributed
                    ? <span style={{ fontSize: 12 }}>{form.samples_distributed}</span>
                    : <span style={{ fontSize: 12, color: 'var(--text-muted)', fontStyle: 'italic' }}>No samples added.</span>
                  }
                  <input
                    className="form-control" style={{ marginTop: 8, fontSize: 12 }}
                    placeholder="e.g. OncoPen X × 3"
                    value={form.samples_distributed}
                    onChange={set('samples_distributed')}
                  />
                </div>
              </div>
            </div>

            {/* Sentiment */}
            <div className="form-group">
              <label className="form-label">Observed/Inferred HCP Sentiment</label>
              <div className="sentiment-group">
                {['Positive','Neutral','Negative'].map(s => (
                  <label key={s} className={`sentiment-option ${s.toLowerCase()} ${form.sentiment === s ? 'selected' : ''}`}>
                    <input type="radio" name="sentiment" value={s} checked={form.sentiment === s} onChange={() => setForm(p => ({ ...p, sentiment: s }))}/>
                    {s === 'Positive' ? '😊' : s === 'Neutral' ? '😐' : '😕'} {s}
                  </label>
                ))}
              </div>
            </div>

            {/* Outcomes */}
            <div className="form-group">
              <label className="form-label">Outcomes</label>
              <textarea className="form-control" rows={2} placeholder="Key outcomes or agreements…" value={form.outcomes} onChange={set('outcomes')}/>
            </div>

            {/* Follow-up Actions */}
            <div className="form-group">
              <label className="form-label">Follow-up Actions</label>
              <textarea className="form-control" rows={2} placeholder="Enter next steps or tasks…" value={form.follow_up_actions} onChange={set('follow_up_actions')}/>
            </div>

            {/* Follow-up Date */}
            <div className="form-group" style={{ maxWidth: 200 }}>
              <label className="form-label">Follow-up Date</label>
              <input type="date" className="form-control" value={form.follow_up_date} onChange={set('follow_up_date')}/>
            </div>

            {/* ── AI Suggested Follow-ups ── */}
            <AISuggestedFollowups hcpName={form.hcp_name || lastHcp} onApply={applyFollowup}/>

          </div>

          {/* Form footer */}
          <div style={{ padding: '14px 18px', borderTop: '1px solid var(--border)', display: 'flex', gap: 10, justifyContent: 'flex-end', background: 'var(--surface-2)' }}>
            <button type="button" className="btn btn-ghost" onClick={reset}><RotateCcw size={13}/> Reset</button>
            <button type="submit" className="btn btn-primary" disabled={saving}>
              {saving ? <span className="spinner"/> : <Save size={13}/>}
              {saving ? 'Saving…' : 'Log Interaction'}
            </button>
          </div>
        </div>
      </form>

      {/* ── RIGHT: AI Sidebar ───────────────────────────────────────────── */}
      <AISidebar
        currentHcp={currentHcp}
        lastIntId={lastIntId}
        onFillForm={fillFromAI}
        onContextUpdate={(hcp, id) => {
          if (hcp) setCurrentHcp(hcp)
          if (id)  setLastIntId(id)
        }}
      />
    </div>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// Page
// ─────────────────────────────────────────────────────────────────────────────

export default function LogInteraction() {
  const [listKey, setListKey] = useState(0)
  const refresh = () => setListKey(k => k + 1)

  return (
    <div className="page-body">
      <div className="page-header">
        <h1>Log HCP Interaction</h1>
        <p>Record field interactions via structured form or AI-powered chat.</p>
      </div>

      <InlineForm onSuccess={refresh}/>

      <div className="card" style={{ marginTop: 20 }}>
        <div className="card-header">
          <div>
            <div className="card-title">Interaction History</div>
            <div className="card-subtitle">All logged interactions · 📋 Summarize · ⚡ Recommend</div>
          </div>
        </div>
        <InteractionList refresh={listKey}/>
      </div>
    </div>
  )
}
