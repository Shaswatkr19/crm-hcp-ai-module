// src/pages/LogInteraction.jsx
import { useState, useRef, useEffect } from 'react'
import { useDispatch } from 'react-redux'
import { addInteraction } from '../store/interactionSlice'
import { extractFields } from '../api/api'
import {
  Bot, Send, User, Mic, MicOff, Save, RotateCcw,
  CheckCircle, Sparkles, RefreshCw,
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
// Typing dots animation
// ─────────────────────────────────────────────────────────────────────────────

function TypingDots() {
  return (
    <div style={{ display: 'flex', gap: 4, padding: '4px 0', alignItems: 'center' }}>
      {[0, 1, 2].map(i => (
        <span key={i} style={{
          width: 7, height: 7, borderRadius: '50%',
          background: 'var(--text-muted)',
          display: 'inline-block',
          animation: `bounce .9s ${i * 0.2}s infinite ease-in-out`,
        }} />
      ))}
      <style>{`@keyframes bounce{0%,80%,100%{transform:translateY(0)}40%{transform:translateY(-7px)}}`}</style>
    </div>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// AI Chat Panel (right side)
// ─────────────────────────────────────────────────────────────────────────────

const WELCOME_MSG = `Hi! I'll help you fill this interaction form.\n\nJust describe the meeting naturally — for example:\n\n_"Met Dr. Priya Sharma at Apollo today. Discussed insulin pens. She was very interested, positive response. Shared the OncoPen brochure."_\n\nI'll extract all the details and fill the form for you. You can then correct anything by chatting with me.\n\nWhen the form looks good, say **"submit"** or click the Submit button.`

function AIChatPanel({ formFields, onFieldsUpdate, onSubmit }) {
  const [messages, setMessages] = useState([{ role: 'ai', content: WELCOME_MSG }])
  const [input,     setInput]     = useState('')
  const [loading,   setLoading]   = useState(false)
  const [listening, setListening] = useState(false)
  // Track whether form was just submitted — next message = fresh session
  const [isNewSession, setIsNewSession] = useState(false)
  const recognitionRef = useRef(null)
  const bottomRef      = useRef(null)

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages, loading])

  // Voice input
  const toggleVoice = () => {
    const SR = window.SpeechRecognition || window.webkitSpeechRecognition
    if (!SR) { toast.error('Voice not supported — use Chrome'); return }
    if (listening && recognitionRef.current) {
      recognitionRef.current.stop(); setListening(false); return
    }
    const r = new SR()
    r.lang = 'en-IN'; r.interimResults = false
    r.onstart  = () => { setListening(true); toast('🎙 Listening…', { duration: 2500 }) }
    r.onresult = e => { setInput(e.results[0][0].transcript); setListening(false) }
    r.onerror  = () => setListening(false)
    r.onend    = () => setListening(false)
    recognitionRef.current = r
    r.start()
  }

  const sendMessage = async (text) => {
    const msg = (text || input).trim()
    if (!msg || loading) return
    setInput('')

    setMessages(prev => [...prev, { role: 'user', content: msg }])
    setLoading(true)

    try {
      // After submit — next message is a brand new interaction, don't pass old fields
      const currentFields = isNewSession ? null : (() => {
        const cf = { ...formFields }
        delete cf.source
        // Don't pass empty form as context — treat as fresh
        const hasData = Object.values(cf).some(v => v && v !== 'Meeting' && v !== 'Neutral' && v !== new Date().toISOString().split('T')[0])
        return hasData ? cf : null
      })()

      setIsNewSession(false)  // reset flag after first message

      const res = await extractFields(msg, currentFields)

      // Update form with new/corrected fields
      if (res.fields) {
        onFieldsUpdate(res.fields)
      }

      // If user said submit — trigger form submission
      if (res.ready_to_submit) {
        setMessages(prev => [...prev, {
          role: 'ai',
          content: res.reply,
          isSubmit: true,
        }])
        setIsNewSession(true)  // next message = fresh session
        setTimeout(() => onSubmit(), 600)
      } else {
        setMessages(prev => [...prev, {
          role: 'ai',
          content: res.reply,
        }])
      }

    } catch (err) {
      toast.error('AI error — check backend')
      setMessages(prev => [...prev, {
        role: 'ai',
        content: '⚠️ Could not process that. Please try again or fill the form manually.',
      }])
    } finally {
      setLoading(false)
    }
  }

  return (
    <div style={{
      display: 'flex', flexDirection: 'column',
      background: 'var(--surface)',
      border: '1px solid var(--border)',
      borderRadius: 'var(--radius-lg)',
      overflow: 'hidden',
      height: '100%',
      minHeight: 500,
      position: 'sticky',
      top: 16,
    }}>

      {/* Header */}
      <div style={{
        padding: '14px 16px',
        background: 'linear-gradient(135deg, var(--primary), var(--accent))',
        display: 'flex', alignItems: 'center', gap: 10,
        flexShrink: 0,
      }}>
        <div style={{
          width: 32, height: 32, borderRadius: 'var(--radius-md)',
          background: 'rgba(255,255,255,.2)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
        }}>
          <Bot size={17} color="#fff" />
        </div>
        <div>
          <div style={{ fontWeight: 700, fontSize: 13, color: '#fff' }}>AI Form Assistant</div>
          <div style={{ fontSize: 11, color: 'rgba(255,255,255,.75)' }}>Describe the meeting — I'll fill the form</div>
        </div>
      </div>

      {/* Messages */}
      <div style={{
        flex: 1, overflowY: 'auto', padding: '14px',
        display: 'flex', flexDirection: 'column', gap: 10,
        background: '#f8fafc',
      }}>
        {messages.map((m, i) => (
          <div key={i} className={`chat-bubble-wrap ${m.role}`}
            style={{ maxWidth: '95%' }}
          >
            {m.role === 'ai' && (
              <div className="bubble-meta">
                <Bot size={10} /> AI Assistant
                {m.isSubmit && <span className="badge badge-primary" style={{ fontSize: 10 }}>submitted</span>}
              </div>
            )}
            {m.role === 'user' && (
              <div className="bubble-meta" style={{ justifyContent: 'flex-end' }}>
                <User size={10} /> You
              </div>
            )}
            <div
              className={`chat-bubble ${m.role}`}
              style={{ whiteSpace: 'pre-wrap', fontSize: 13 }}
              dangerouslySetInnerHTML={{
                __html: m.content
                  .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
                  .replace(/_(.*?)_/g, '<em>$1</em>')
              }}
            />
          </div>
        ))}

        {loading && (
          <div className="chat-bubble-wrap ai">
            <div className="bubble-meta"><Bot size={10} /> AI Assistant</div>
            <div className="chat-bubble ai"><TypingDots /></div>
          </div>
        )}
        <div ref={bottomRef} />
      </div>

      {/* Quick prompts */}
      <div style={{
        padding: '8px 12px',
        borderTop: '1px solid var(--border)',
        background: 'var(--surface-2)',
        display: 'flex', gap: 5, flexWrap: 'wrap',
        flexShrink: 0,
      }}>
        {[
          'Sorry, wrong name — correct it',
          'Add follow-up: send brochure',
          'Change sentiment to Negative',
          'Submit this interaction',
        ].map(s => (
          <button
            key={s}
            type="button"
            className="btn btn-ghost"
            style={{ fontSize: 10.5, padding: '3px 8px' }}
            onClick={() => sendMessage(s)}
            disabled={loading}
          >
            {s}
          </button>
        ))}
      </div>

      {/* Input */}
      <div style={{
        padding: '10px 12px',
        borderTop: '1px solid var(--border)',
        display: 'flex', gap: 8,
        background: 'var(--surface)',
        flexShrink: 0,
      }}>
        <button
          type="button"
          onClick={toggleVoice}
          style={{
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            width: 36, height: 36, flexShrink: 0,
            border: `1px solid ${listening ? 'var(--danger)' : 'var(--border)'}`,
            borderRadius: 'var(--radius-md)',
            background: listening ? 'var(--danger-light)' : 'var(--surface-2)',
            color: listening ? 'var(--danger)' : 'var(--text-muted)',
            cursor: 'pointer',
          }}
        >
          {listening ? <MicOff size={14} /> : <Mic size={14} />}
        </button>

        <textarea
          className="chat-input"
          style={{
            fontSize: 13,
            resize: 'none',
            minHeight: 38,
            maxHeight: 160,
            overflowY: 'auto',
            lineHeight: 1.5,
            padding: '9px 12px',
            borderRadius: 'var(--radius-md)',
            border: '1px solid var(--border)',
            fontFamily: 'var(--font-sans)',
            flex: 1,
            outline: 'none',
            transition: 'border-color .15s',
            background: 'var(--surface)',
            color: 'var(--text-primary)',
          }}
          rows={1}
          placeholder={listening ? '🎙 Listening…' : 'Describe interaction or type a correction…'}
          value={input}
          onChange={e => {
            setInput(e.target.value)
            // Auto-resize
            e.target.style.height = 'auto'
            e.target.style.height = Math.min(e.target.scrollHeight, 160) + 'px'
          }}
          onKeyDown={e => e.key === 'Enter' && !e.shiftKey && (e.preventDefault(), sendMessage())}
          onFocus={e => e.target.style.borderColor = 'var(--primary)'}
          onBlur={e  => e.target.style.borderColor = 'var(--border)'}
          disabled={loading}
        />
        <button
          type="button"
          className="btn btn-primary"
          style={{ padding: '8px 12px', flexShrink: 0 }}
          onClick={() => sendMessage()}
          disabled={loading || !input.trim()}
        >
          {loading ? <span className="spinner" /> : <Send size={14} />}
        </button>
      </div>
    </div>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// AI Suggested Follow-ups (left form, below follow-up date)
// ─────────────────────────────────────────────────────────────────────────────

function AISuggestedFollowups({ hcpName, onApply }) {
  const [suggestions, setSuggestions] = useState(null)
  const [loading,     setLoading]     = useState(false)
  const [fetched,     setFetched]     = useState(false)

  const fetchSuggestions = async () => {
    if (!hcpName || loading) return
    setLoading(true)
    try {
      const { recommendForHCP } = await import('../api/api')
      const res = await recommendForHCP(hcpName)
      setSuggestions(res.recommendations || [])
      setFetched(true)
    } catch {
      toast.error('Could not fetch suggestions')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div style={{
      padding: '12px 14px',
      background: 'linear-gradient(135deg,#fffbeb,#fef9f0)',
      border: '1px solid #fed7aa',
      borderRadius: 'var(--radius-lg)',
    }}>
      <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom: fetched ? 10 : 0 }}>
        <div style={{ display:'flex', alignItems:'center', gap:6 }}>
          <Sparkles size={13} color="var(--warning)"/>
          <span style={{ fontSize:12, fontWeight:700, color:'#92400e' }}>AI Suggested Follow-ups</span>
        </div>
        {!fetched && (
          <button
            type="button"
            className="btn btn-ghost btn-sm"
            style={{ fontSize:11, color:'var(--warning)', borderColor:'#fed7aa' }}
            onClick={fetchSuggestions}
            disabled={loading}
          >
            {loading ? <span className="spinner spinner-dark"/> : '💡'}
            {loading ? ' Loading…' : ' Get suggestions'}
          </button>
        )}
      </div>
      {fetched && suggestions?.length > 0 && (
        <ul style={{ margin:0, paddingLeft:0, listStyle:'none', display:'flex', flexDirection:'column', gap:6 }}>
          {suggestions.map((s,i) => (
            <li key={i} style={{ display:'flex', alignItems:'flex-start', gap:8, fontSize:12.5 }}>
              <span style={{ color:'var(--warning)', marginTop:2, flexShrink:0 }}>→</span>
              <span style={{ color:'#78350f', lineHeight:1.5, flex:1 }}>{s}</span>
              <button
                type="button"
                className="btn btn-ghost btn-sm"
                style={{ fontSize:11, padding:'2px 8px', flexShrink:0, color:'var(--warning)', borderColor:'#fcd34d' }}
                onClick={() => onApply(s)}
              >
                + Add
              </button>
            </li>
          ))}
        </ul>
      )}
      {fetched && (!suggestions || suggestions.length === 0) && (
        <p style={{ fontSize:12, color:'var(--text-muted)', margin:'6px 0 0' }}>No suggestions available.</p>
      )}
    </div>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// Form — left side (AI fills it, user can also edit manually)
// ─────────────────────────────────────────────────────────────────────────────

function InteractionForm({ form, onChange, onSubmit, saving }) {
  const set = f => e => onChange({ ...form, [f]: e.target.value })
  const setSentiment = s => onChange({ ...form, sentiment: s })

  // Highlight fields that have been AI-filled
  const filled = f => form[f] && form[f] !== EMPTY_FORM[f]
    ? { borderColor: 'var(--primary)', background: '#f0f7ff' }
    : {}

  return (
    <div style={{
      background: 'var(--surface)',
      border: '1px solid var(--border)',
      borderRadius: 'var(--radius-lg)',
      overflow: 'hidden',
    }}>
      {/* Header */}
      <div style={{
        padding: '14px 18px',
        borderBottom: '1px solid var(--border)',
        background: 'var(--surface-2)',
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
      }}>
        <div>
          <div style={{ fontWeight: 700, fontSize: 14 }}>Interaction Details</div>
          <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 2 }}>
            <span style={{ color: 'var(--primary)', fontWeight: 600 }}>Blue fields</span> = AI filled · Edit any field manually
          </div>
        </div>
        <button
          type="button"
          className="btn btn-ghost btn-sm"
          onClick={() => onChange(EMPTY_FORM)}
          title="Reset form"
        >
          <RotateCcw size={12} /> Reset
        </button>
      </div>

      <div style={{ padding: '18px', display: 'flex', flexDirection: 'column', gap: 14 }}>

        {/* HCP + Hospital */}
        <div className="form-grid">
          <div className="form-group">
            <label className="form-label">HCP Name</label>
            <input className="form-control" style={filled('hcp_name')} placeholder="e.g. Dr. Priya Sharma"
              value={form.hcp_name} onChange={set('hcp_name')} />
          </div>
          <div className="form-group">
            <label className="form-label">Hospital / Clinic</label>
            <input className="form-control" style={filled('hospital')} placeholder="e.g. Apollo Hospital"
              value={form.hospital} onChange={set('hospital')} />
          </div>
        </div>

        {/* Type + Date + Time */}
        <div className="form-grid">
          <div className="form-group">
            <label className="form-label">Interaction Type</label>
            <select className="form-control" style={filled('interaction_type')} value={form.interaction_type} onChange={set('interaction_type')}>
              {INTERACTION_TYPES.map(t => <option key={t}>{t}</option>)}
            </select>
          </div>
          <div className="form-group">
            <label className="form-label">Date</label>
            <input type="date" className="form-control" style={filled('interaction_date')}
              value={form.interaction_date} onChange={set('interaction_date')} />
          </div>
        </div>

        {/* Attendees */}
        <div className="form-group">
          <label className="form-label">Attendees</label>
          <input className="form-control" style={filled('attendees')} placeholder="Names, comma-separated"
            value={form.attendees} onChange={set('attendees')} />
        </div>

        {/* Topics + Voice */}
        <div className="form-group">
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 5 }}>
            <label className="form-label" style={{ margin: 0 }}>Topics Discussed</label>
            <button
              type="button"
              onClick={() => {
                const SR = window.SpeechRecognition || window.webkitSpeechRecognition
                if (!SR) { toast.error('Voice not supported — use Chrome'); return }
                const r = new SR()
                r.lang = 'en-IN'; r.interimResults = false
                r.onstart  = () => toast('🎙 Listening…', { duration: 2500 })
                r.onresult = e => {
                  const t = e.results[0][0].transcript
                  onChange({ ...form, topics_discussed: form.topics_discussed ? form.topics_discussed + ' ' + t : t })
                  toast.success('Voice added to Topics!')
                }
                r.onerror = () => {}
                r.start()
              }}
              style={{
                display: 'flex', alignItems: 'center', gap: 4,
                padding: '3px 9px',
                border: '1px solid var(--border)',
                borderRadius: 'var(--radius-md)',
                background: 'var(--surface-2)',
                color: 'var(--text-secondary)',
                cursor: 'pointer', fontSize: 11, fontWeight: 600,
                fontFamily: 'var(--font-sans)',
              }}
            >
              <svg xmlns="http://www.w3.org/2000/svg" width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 2a3 3 0 0 0-3 3v7a3 3 0 0 0 6 0V5a3 3 0 0 0-3-3Z"/><path d="M19 10v2a7 7 0 0 1-14 0v-2"/><line x1="12" x2="12" y1="19" y2="22"/></svg>
              Voice
            </button>
          </div>
          <textarea className="form-control" rows={3} style={filled('topics_discussed')}
            placeholder="Key discussion points… or click Voice to dictate 🎙"
            value={form.topics_discussed} onChange={set('topics_discussed')} />
        </div>

        {/* Materials + Samples */}
        <div className="form-grid">
          <div className="form-group">
            <label className="form-label">Materials Shared</label>
            <input className="form-control" style={filled('materials_shared')} placeholder="e.g. OncoPen brochure"
              value={form.materials_shared} onChange={set('materials_shared')} />
          </div>
          <div className="form-group">
            <label className="form-label">Samples Distributed</label>
            <input className="form-control" style={filled('samples_distributed')} placeholder="e.g. OncoPen X × 3"
              value={form.samples_distributed} onChange={set('samples_distributed')} />
          </div>
        </div>

        {/* Sentiment */}
        <div className="form-group">
          <label className="form-label">HCP Sentiment</label>
          <div className="sentiment-group">
            {['Positive', 'Neutral', 'Negative'].map(s => (
              <label key={s}
                className={`sentiment-option ${s.toLowerCase()} ${form.sentiment === s ? 'selected' : ''}`}
              >
                <input type="radio" name="sentiment" value={s}
                  checked={form.sentiment === s}
                  onChange={() => setSentiment(s)} />
                {s === 'Positive' ? '😊' : s === 'Neutral' ? '😐' : '😕'} {s}
              </label>
            ))}
          </div>
        </div>

        {/* Outcomes */}
        <div className="form-group">
          <label className="form-label">Outcomes</label>
          <textarea className="form-control" rows={2} style={filled('outcomes')}
            placeholder="Key agreements or results…"
            value={form.outcomes} onChange={set('outcomes')} />
        </div>

        {/* Follow-up */}
        <div className="form-group">
          <label className="form-label">Follow-up Actions</label>
          <textarea className="form-control" rows={2} style={filled('follow_up_actions')}
            placeholder="Next steps or tasks…"
            value={form.follow_up_actions} onChange={set('follow_up_actions')} />
        </div>

        <div className="form-group" style={{ maxWidth: 200 }}>
          <label className="form-label">Follow-up Date</label>
          <input type="date" className="form-control" style={filled('follow_up_date')}
            value={form.follow_up_date} onChange={set('follow_up_date')} />
        </div>

        {/* AI Suggested Follow-ups */}
        {form.hcp_name && <AISuggestedFollowups hcpName={form.hcp_name} onApply={(s) => onChange({ ...form, follow_up_actions: form.follow_up_actions ? form.follow_up_actions + '\n' + s : s })} />}

      </div>

      {/* Footer */}
      <div style={{
        padding: '14px 18px',
        borderTop: '1px solid var(--border)',
        background: 'var(--surface-2)',
        display: 'flex', gap: 10, justifyContent: 'space-between', alignItems: 'center',
      }}>
        <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>
          <Sparkles size={11} style={{ marginRight: 4 }} />
          Tell the AI to correct anything, or edit fields directly above
        </div>
        <button
          type="button"
          className="btn btn-primary"
          onClick={onSubmit}
          disabled={saving || !form.hcp_name.trim()}
        >
          {saving ? <span className="spinner" /> : <Save size={14} />}
          {saving ? 'Saving…' : 'Submit Interaction'}
        </button>
      </div>
    </div>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// Page
// ─────────────────────────────────────────────────────────────────────────────

export default function LogInteraction() {
  const dispatch = useDispatch()
  const [form,     setForm]    = useState(EMPTY_FORM)
  const [saving,   setSaving]  = useState(false)
  const [listKey,  setListKey] = useState(0)

  const handleSubmit = async () => {
    const hcp = (form.hcp_name || '').trim()
    if (!hcp) { toast.error('HCP name is required — ask AI to fill it first'); return }

    const today = new Date().toISOString().split('T')[0]

    // Sanitize: backend expects proper types, empty strings cause 422
    const toStr = v => (v !== null && v !== undefined && v !== '') ? String(v) : null
    const payload = {
      hcp_name:            hcp,
      hospital:            toStr(form.hospital),
      interaction_type:    form.interaction_type    || 'Meeting',
      interaction_date:    form.interaction_date    || today,
      interaction_time:    form.interaction_time    || null,
      attendees:           toStr(form.attendees),
      topics_discussed:    toStr(form.topics_discussed),
      materials_shared:    toStr(form.materials_shared),
      samples_distributed: toStr(form.samples_distributed),
      sentiment:           form.sentiment           || 'Neutral',
      outcomes:            toStr(form.outcomes),
      follow_up_actions:   toStr(form.follow_up_actions),
      follow_up_date:      form.follow_up_date      || null,
      source:              'chat',
    }

    setSaving(true)
    try {
      await dispatch(addInteraction(payload)).unwrap()
      toast.success(`✅ Interaction with ${hcp} logged successfully!`)
      setForm(EMPTY_FORM)
      setListKey(k => k + 1)
    } catch (err) {
      // err might be array of Pydantic validation errors — show first one
      const msg = Array.isArray(err)
        ? err.map(e => `${e.loc?.join('.')} — ${e.msg}`).join(', ')
        : (typeof err === 'string' ? err : JSON.stringify(err))
      console.error('Submit 422 detail:', msg)
      toast.error(`Validation error: ${msg.slice(0, 120)}`)
    } finally {
      setSaving(false)
    }
  }

  // Merge AI-filled fields into form (keep manual edits for fields AI returned null)
  const handleFieldsUpdate = (newFields) => {
    setForm(prev => {
      const merged = { ...prev }
      Object.entries(newFields).forEach(([k, v]) => {
        // Only apply if value is non-null, non-empty, and key exists in form
        if (v !== null && v !== undefined && v !== '' && k in prev) {
          // Always store as string — AI sometimes returns numbers (e.g. samples count)
          merged[k] = typeof v === 'object' ? JSON.stringify(v) : String(v)
        }
      })
      return merged
    })
  }

  return (
    <div className="page-body">
      <div className="page-header">
        <h1>Log HCP Interaction</h1>
        <p>Describe the meeting to the AI on the right — it will fill the form automatically.</p>
      </div>

      {/* Two-column layout */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: '1fr 380px',
        gap: 20,
        alignItems: 'start',
      }}>
        {/* Left — Form */}
        <InteractionForm
          form={form}
          onChange={setForm}
          onSubmit={handleSubmit}
          saving={saving}
        />

        {/* Right — AI Chat */}
        <AIChatPanel
          formFields={form}
          onFieldsUpdate={handleFieldsUpdate}
          onSubmit={handleSubmit}
        />
      </div>

      {/* History */}
      <div className="card" style={{ marginTop: 20 }}>
        <div className="card-header">
          <div>
            <div className="card-title">Interaction History</div>
            <div className="card-subtitle">All logged interactions · Summarize · Recommend</div>
          </div>
        </div>
        <InteractionList refresh={listKey} />
      </div>
    </div>
  )
}
