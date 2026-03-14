// src/pages/AIAssistant.jsx
import { useState, useRef, useEffect } from 'react'
import { chatWithAgent } from '../api/api'
import {
  Bot, Send, User, Sparkles, Lightbulb, CheckCircle,
  RotateCcw, Calendar, Stethoscope, Info,
} from 'lucide-react'
import toast from 'react-hot-toast'

const TOOL_EXAMPLES = [
  { icon:'📝', label:'Log',       msg:'Met Dr. Priya Sharma at Apollo today. Discussed new insulin pens. She was very interested, asked for Phase III data. Follow up next Monday.' },
  { icon:'✏️', label:'Edit',      msg:'Update sentiment to Positive and add follow-up: send clinical brochure' },
  { icon:'🔍', label:'Search',    msg:'Show me all interactions with Dr. Verma from last month' },
  { icon:'📋', label:'Summarize', msg:'Summarize my history with Dr. Anita Menon' },
  { icon:'💡', label:'Recommend', msg:'What should I prepare for my next visit with Dr. Suresh Patel?' },
]

// ── Typing dots ───────────────────────────────────────────────────────────────
function TypingDots() {
  return (
    <div style={{ display:'flex', gap:4, padding:'4px 0', alignItems:'center' }}>
      {[0,1,2].map(i => (
        <span key={i} style={{
          width:7, height:7, borderRadius:'50%', background:'var(--text-muted)',
          display:'inline-block',
          animation:`bounce .9s ${i*0.2}s infinite ease-in-out`,
        }}/>
      ))}
      <style>{`@keyframes bounce{0%,80%,100%{transform:translateY(0)}40%{transform:translateY(-7px)}}`}</style>
    </div>
  )
}

// ── Logged interaction card ───────────────────────────────────────────────────
function ExtractedCard({ interaction }) {
  if (!interaction) return null
  const id = interaction.id ?? interaction.interaction_id ?? '—'
  return (
    <div className="extracted-card">
      <h4><CheckCircle size={11} style={{marginRight:4}}/>Interaction Logged — ID #{id}</h4>
      <div className="extracted-grid">
        <div className="extracted-item"><span className="key">HCP</span><span className="val">{interaction.hcp_name}</span></div>
        <div className="extracted-item"><span className="key">Type</span><span className="val">{interaction.interaction_type}</span></div>
        <div className="extracted-item"><span className="key">Date</span><span className="val">{interaction.interaction_date}</span></div>
        <div className="extracted-item">
          <span className="key">Sentiment</span>
          <span className="val"><span className={`badge badge-${interaction.sentiment?.toLowerCase()}`}>{interaction.sentiment}</span></span>
        </div>
        {interaction.topics_discussed && (
          <div className="extracted-item" style={{gridColumn:'1/-1'}}>
            <span className="key">Topics</span><span className="val">{interaction.topics_discussed}</span>
          </div>
        )}
        {interaction.follow_up_actions && (
          <div className="extracted-item" style={{gridColumn:'1/-1'}}>
            <span className="key">Follow-up</span><span className="val">{interaction.follow_up_actions}</span>
          </div>
        )}
      </div>
    </div>
  )
}

// ── Recommendations card ──────────────────────────────────────────────────────
function RecommendCard({ suggestions }) {
  if (!suggestions?.length) return null
  return (
    <div className="extracted-card" style={{borderLeftColor:'var(--warning)'}}>
      <h4 style={{color:'var(--warning)'}}><Lightbulb size={11} style={{marginRight:4}}/>Recommended Actions</h4>
      <ol style={{paddingLeft:16, fontSize:13, lineHeight:1.7, display:'flex', flexDirection:'column', gap:3}}>
        {suggestions.map((s,i) => <li key={i}>{s}</li>)}
      </ol>
    </div>
  )
}

// ── Search results card ───────────────────────────────────────────────────────
function SearchCard({ results }) {
  if (!results?.length) return (
    <div className="extracted-card">
      <h4 style={{color:'var(--text-muted)'}}>🔍 No interactions found.</h4>
    </div>
  )
  return (
    <div className="extracted-card" style={{borderLeftColor:'var(--primary)'}}>
      <h4 style={{color:'var(--primary)', marginBottom:10}}>
        🔍 {results.length} Interaction{results.length !== 1 ? 's' : ''} Found
      </h4>
      <div style={{display:'flex', flexDirection:'column', gap:8}}>
        {results.map((item, i) => (
          <div key={item.id ?? i} style={{
            padding:'10px 12px',
            background:'var(--surface-2)',
            borderRadius:'var(--radius-md)',
            border:'1px solid var(--border)',
          }}>
            <div style={{display:'flex', justifyContent:'space-between', alignItems:'center', gap:8, marginBottom:4}}>
              <div style={{display:'flex', alignItems:'center', gap:6, fontSize:12, fontWeight:600}}>
                <Calendar size={11} color="var(--text-muted)"/>
                {item.interaction_date}
                {item.hcp_name && <><span style={{color:'var(--text-muted)'}}>·</span><Stethoscope size={11} color="var(--text-muted)"/>{item.hcp_name}</>}
                {item.interaction_type && <><span style={{color:'var(--text-muted)'}}>·</span>{item.interaction_type}</>}
              </div>
              {item.sentiment && <span className={`badge badge-${item.sentiment.toLowerCase()}`}>{item.sentiment}</span>}
            </div>
            {item.topics_discussed && (
              <div style={{fontSize:12, color:'var(--text-secondary)', marginBottom:item.follow_up_actions?4:0}}>
                <span style={{fontWeight:500}}>Topics:</span> {item.topics_discussed.slice(0,120)}{item.topics_discussed.length>120?'…':''}
              </div>
            )}
            {item.follow_up_actions && (
              <div style={{fontSize:12, color:'var(--text-muted)'}}>
                <span style={{fontWeight:500}}>Follow-up:</span> {item.follow_up_actions.slice(0,100)}{item.follow_up_actions.length>100?'…':''}
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  )
}

// ── Context pill shown in header ──────────────────────────────────────────────
function ContextPill({ currentHcp, lastId }) {
  if (!currentHcp && !lastId) return null
  return (
    <div style={{
      display:'flex', gap:8, alignItems:'center',
      padding:'4px 10px', background:'var(--primary-light)',
      borderRadius:999, fontSize:11, color:'var(--primary)', fontWeight:600,
      flexWrap:'wrap',
    }}>
      <Info size={11}/>
      {currentHcp && <span>👤 {currentHcp}</span>}
      {lastId     && <span>· Last ID: #{lastId}</span>}
    </div>
  )
}

// ── Main Component ────────────────────────────────────────────────────────────
export default function AIAssistant() {
  const [messages, setMessages] = useState([{
    role:'ai',
    content:`Hi! I'm your CRM AI assistant.\n\nI can help you:\n• Log new HCP interactions from plain text\n• Edit existing interactions (just say "update sentiment" — no ID needed)\n• Search past interaction history\n• Summarize your relationship with a doctor\n• Recommend next best actions\n\nI remember the current doctor and last interaction across messages. Just talk naturally!`,
  }])
  const [input,   setInput]   = useState('')
  const [loading, setLoading] = useState(false)

  // ── Conversation context ──────────────────────────────────────────────────
  const [currentHcp,  setCurrentHcp]  = useState(null)
  const [lastIntId,   setLastIntId]   = useState(null)

  const bottomRef = useRef(null)
  useEffect(() => { bottomRef.current?.scrollIntoView({ behavior:'smooth' }) }, [messages, loading])

  const send = async (text) => {
    const msg = (text || input).trim()
    if (!msg || loading) return
    setInput('')
    setMessages(prev => [...prev, { role:'user', content:msg }])
    setLoading(true)
    try {
      // Send context with every message
      const res = await chatWithAgent(msg, currentHcp, lastIntId)

      // Save updated context from response
      if (res.current_hcp)         setCurrentHcp(res.current_hcp)
      if (res.last_interaction_id) setLastIntId(res.last_interaction_id)

      setMessages(prev => [...prev, {
        role:        'ai',
        content:     res.reply,
        action:      res.action,
        interaction: res.interaction  ?? null,
        suggestions: res.suggestions  ?? null,
        results:     res.results      ?? null,
      }])
    } catch {
      toast.error('Agent error — check backend and Groq API key')
      setMessages(prev => [...prev, {
        role:    'ai',
        content: '⚠️ Error contacting AI agent. Ensure backend is running and GROQ_API_KEY is set.',
      }])
    } finally {
      setLoading(false)
    }
  }

  const clearChat = () => {
    setMessages([{ role:'ai', content:'Chat cleared! How can I help you?' }])
    setCurrentHcp(null)
    setLastIntId(null)
  }

  return (
    <div className="chat-layout">

      {/* Header */}
      <div style={{ padding:'14px 20px', background:'var(--surface)', borderBottom:'1px solid var(--border)', display:'flex', alignItems:'center', justifyContent:'space-between', gap:10, flexWrap:'wrap' }}>
        <div style={{ display:'flex', alignItems:'center', gap:10 }}>
          <div style={{ width:36, height:36, borderRadius:'var(--radius-md)', background:'linear-gradient(135deg,var(--primary),var(--accent))', display:'flex', alignItems:'center', justifyContent:'center', flexShrink:0 }}>
            <Bot size={18} color="#fff"/>
          </div>
          <div>
            <div style={{ fontWeight:700, fontSize:14 }}>CRM AI Assistant</div>
            <div style={{ fontSize:11, color:'var(--text-muted)' }}>gemma2-9b-it · LangGraph · context-aware</div>
          </div>
        </div>
        <div style={{ display:'flex', gap:8, alignItems:'center', flexWrap:'wrap' }}>
          <ContextPill currentHcp={currentHcp} lastId={lastIntId}/>
          <button className="btn btn-ghost btn-sm" onClick={clearChat}><RotateCcw size={13}/> Clear</button>
        </div>
      </div>

      {/* Tool chips */}
      <div style={{ padding:'8px 20px', background:'var(--surface-2)', borderBottom:'1px solid var(--border)', display:'flex', gap:6, flexWrap:'wrap', alignItems:'center' }}>
        <span style={{ fontSize:11, color:'var(--text-muted)', display:'flex', alignItems:'center', gap:3 }}><Sparkles size={11}/> Try:</span>
        {TOOL_EXAMPLES.map(t => (
          <button key={t.label} className="btn btn-ghost" style={{ fontSize:11, padding:'4px 10px', fontWeight:500 }} onClick={() => send(t.msg)}>
            {t.icon} {t.label}
          </button>
        ))}
      </div>

      {/* Messages */}
      <div className="chat-messages" style={{ background:'#f8fafc' }}>
        {messages.map((m, i) => (
          <div key={i} className={`chat-bubble-wrap ${m.role}`}>

            {m.role === 'ai' && (
              <div className="bubble-meta">
                <Bot size={11}/> AI Assistant
                {m.action && (
                  <span className="badge badge-primary" style={{fontSize:10}}>
                    {m.action.replace(/_/g,' ')}
                  </span>
                )}
              </div>
            )}
            {m.role === 'user' && (
              <div className="bubble-meta" style={{ justifyContent:'flex-end' }}>
                <User size={11}/> You
              </div>
            )}

            <div className={`chat-bubble ${m.role}`} style={{ whiteSpace:'pre-wrap' }}>
              {m.content}
            </div>

            {m.interaction && <ExtractedCard interaction={m.interaction}/>}
            {m.suggestions  && <RecommendCard suggestions={m.suggestions}/>}
            {m.results      && <SearchCard   results={m.results}/>}
          </div>
        ))}

        {loading && (
          <div className="chat-bubble-wrap ai">
            <div className="bubble-meta"><Bot size={11}/> AI Assistant</div>
            <div className="chat-bubble ai"><TypingDots/></div>
          </div>
        )}
        <div ref={bottomRef}/>
      </div>

      {/* Input */}
      <div className="chat-input-bar">
        <input
          className="chat-input"
          placeholder={
            currentHcp
              ? `Chatting about ${currentHcp} — type naturally…`
              : 'Describe a meeting or ask anything…'
          }
          value={input}
          onChange={e => setInput(e.target.value)}
          onKeyDown={e => e.key==='Enter' && !e.shiftKey && (e.preventDefault(), send())}
          disabled={loading}
        />
        <button
          className="btn btn-primary"
          onClick={() => send()}
          disabled={loading || !input.trim()}
          style={{padding:'9px 16px'}}
        >
          {loading ? <span className="spinner"/> : <Send size={15}/>}
        </button>
      </div>
    </div>
  )
}
