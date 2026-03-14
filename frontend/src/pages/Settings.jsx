// src/pages/Settings.jsx
import { useState, useEffect } from 'react'
import { User, Bell, Shield, Database, Cpu, Palette, Save, CheckCircle } from 'lucide-react'
import toast from 'react-hot-toast'

// ─────────────────────────────────────────────────────────────────────────────
// localStorage helpers — ek key mein poora settings object save karo
// ─────────────────────────────────────────────────────────────────────────────

const STORAGE_KEY = 'crm_settings'

function loadSettings() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    return raw ? JSON.parse(raw) : {}
  } catch {
    return {}
  }
}

function saveSettings(section, data) {
  try {
    const all = loadSettings()
    localStorage.setItem(STORAGE_KEY, JSON.stringify({ ...all, [section]: data }))
  } catch {
    // localStorage not available
  }
}

function getSectionData(section, defaults) {
  const all = loadSettings()
  return all[section] ? { ...defaults, ...all[section] } : defaults
}

// ─────────────────────────────────────────────────────────────────────────────
// Sidebar nav items
// ─────────────────────────────────────────────────────────────────────────────

const SECTIONS = [
  { key: 'profile',       label: 'Profile',        icon: User     },
  { key: 'notifications', label: 'Notifications',  icon: Bell     },
  { key: 'ai',            label: 'AI & Agent',     icon: Cpu      },
  { key: 'data',          label: 'Data & Privacy', icon: Database },
  { key: 'appearance',    label: 'Appearance',     icon: Palette  },
  { key: 'security',      label: 'Security',       icon: Shield   },
]

// ─────────────────────────────────────────────────────────────────────────────
// Toggle component
// ─────────────────────────────────────────────────────────────────────────────

function Toggle({ on, onChange }) {
  return (
    <button
      type="button"
      className={`toggle ${on ? 'on' : ''}`}
      onClick={() => onChange(!on)}
    />
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// PROFILE SECTION
// ─────────────────────────────────────────────────────────────────────────────

const PROFILE_DEFAULTS = {
  name:      'Rahul Mehta',
  email:     'rahul.mehta@pharma.com',
  phone:     '+91 98765 43210',
  territory: 'Maharashtra & Gujarat',
  role:      'Field Representative',
}

function ProfileSection() {
  const [form,  setForm]  = useState(() => getSectionData('profile', PROFILE_DEFAULTS))
  const [saved, setSaved] = useState(false)

  const set = f => e => setForm(p => ({ ...p, [f]: e.target.value }))

  const handleSave = () => {
    if (!form.name.trim()) { toast.error('Name cannot be empty'); return }
    saveSettings('profile', form)
    setSaved(true)
    toast.success('Profile saved!')
    setTimeout(() => setSaved(false), 2000)
  }

  return (
    <div className="settings-section">
      <h2>Profile Settings</h2>
      <p>Manage your personal information. Changes are saved to your browser.</p>

      <div style={{ display: 'flex', alignItems: 'center', gap: 16, marginBottom: 24, padding: '14px 16px', background: 'var(--surface-2)', borderRadius: 'var(--radius-lg)', border: '1px solid var(--border)' }}>
        <div style={{ width: 56, height: 56, borderRadius: '50%', background: 'linear-gradient(135deg,var(--primary),var(--accent))', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff', fontSize: 20, fontWeight: 700, flexShrink: 0 }}>
          {form.name?.[0] || 'R'}
        </div>
        <div>
          <div style={{ fontWeight: 700, fontSize: 15 }}>{form.name || '—'}</div>
          <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 2 }}>{form.role} · {form.territory}</div>
        </div>
      </div>

      <div className="form-grid">
        <div className="form-group">
          <label className="form-label">Full Name</label>
          <input className="form-control" value={form.name} onChange={set('name')} placeholder="Your name" />
        </div>
        <div className="form-group">
          <label className="form-label">Email</label>
          <input className="form-control" type="email" value={form.email} onChange={set('email')} placeholder="email@company.com" />
        </div>
        <div className="form-group">
          <label className="form-label">Phone</label>
          <input className="form-control" value={form.phone} onChange={set('phone')} placeholder="+91 00000 00000" />
        </div>
        <div className="form-group">
          <label className="form-label">Territory</label>
          <input className="form-control" value={form.territory} onChange={set('territory')} placeholder="e.g. Maharashtra & Gujarat" />
        </div>
        <div className="form-group full">
          <label className="form-label">Role</label>
          <select className="form-control" value={form.role} onChange={set('role')}>
            <option>Field Representative</option>
            <option>Senior Field Representative</option>
            <option>Area Sales Manager</option>
            <option>Regional Manager</option>
            <option>Medical Science Liaison</option>
          </select>
        </div>
      </div>

      <div style={{ marginTop: 20 }}>
        <button className="btn btn-primary" onClick={handleSave}>
          {saved ? <CheckCircle size={14} /> : <Save size={14} />}
          {saved ? 'Saved!' : 'Save Profile'}
        </button>
      </div>
    </div>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// NOTIFICATIONS SECTION
// ─────────────────────────────────────────────────────────────────────────────

const NOTIF_DEFAULTS = {
  followUpReminders: true,
  newHCPAlert:       false,
  weeklySummary:     true,
  aiSuggestions:     true,
  emailDigest:       false,
}

function NotificationsSection() {
  const [prefs, setPrefs] = useState(() => getSectionData('notifications', NOTIF_DEFAULTS))
  const [saved, setSaved] = useState(false)

  const toggle = k => setPrefs(p => ({ ...p, [k]: !p[k] }))

  const handleSave = () => {
    saveSettings('notifications', prefs)
    setSaved(true)
    toast.success('Notification preferences saved!')
    setTimeout(() => setSaved(false), 2000)
  }

  const rows = [
    { key: 'followUpReminders', label: 'Follow-up Reminders', desc: 'Get notified when follow-up dates are approaching' },
    { key: 'newHCPAlert',       label: 'New HCP Alerts',      desc: 'Alert when a new HCP is added to your territory' },
    { key: 'weeklySummary',     label: 'Weekly Summary',      desc: 'Receive a weekly digest of your activity' },
    { key: 'aiSuggestions',     label: 'AI Suggestions',      desc: 'Show AI-powered next-action recommendations in the dashboard' },
    { key: 'emailDigest',       label: 'Email Digest',        desc: 'Daily email summary of interactions and follow-ups' },
  ]

  return (
    <div className="settings-section">
      <h2>Notification Preferences</h2>
      <p>Control which notifications and alerts you receive.</p>

      {rows.map(r => (
        <div key={r.key} className="settings-row">
          <div className="settings-row-info">
            <h4>{r.label}</h4>
            <p>{r.desc}</p>
          </div>
          <Toggle on={prefs[r.key]} onChange={() => toggle(r.key)} />
        </div>
      ))}

      <div style={{ marginTop: 20 }}>
        <button className="btn btn-primary" onClick={handleSave}>
          {saved ? <CheckCircle size={14} /> : <Save size={14} />}
          {saved ? 'Saved!' : 'Save Preferences'}
        </button>
      </div>
    </div>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// AI SECTION
// ─────────────────────────────────────────────────────────────────────────────

const AI_DEFAULTS = {
  model:           'gemma2-9b-it',
  temperature:     '0.3',
  autoLog:         true,
  sentimentInfer:  true,
  followUpSuggest: true,
  apiKey:          '',
}

function AISection() {
  const [cfg,  setCfg]  = useState(() => getSectionData('ai', AI_DEFAULTS))
  const [saved, setSaved] = useState(false)

  const set = k => e => setCfg(p => ({ ...p, [k]: e.target.value }))
  const tog = k => setCfg(p => ({ ...p, [k]: !p[k] }))

  const handleSave = () => {
    saveSettings('ai', cfg)
    setSaved(true)
    toast.success('AI settings saved!')
    setTimeout(() => setSaved(false), 2000)
  }

  return (
    <div className="settings-section">
      <h2>AI & Agent Configuration</h2>
      <p>Configure the LangGraph AI agent and Groq LLM settings.</p>

      <div className="form-grid" style={{ marginBottom: 20 }}>
        <div className="form-group">
          <label className="form-label">LLM Model</label>
          <select className="form-control" value={cfg.model} onChange={set('model')}>
            <option value="gemma2-9b-it">gemma2-9b-it (Default)</option>
            <option value="llama-3.3-70b-versatile">llama-3.3-70b-versatile</option>
            <option value="mixtral-8x7b-32768">mixtral-8x7b-32768</option>
          </select>
        </div>
        <div className="form-group">
          <label className="form-label">Temperature</label>
          <input className="form-control" type="number" min="0" max="1" step="0.1" value={cfg.temperature} onChange={set('temperature')} />
          <span className="form-hint">0 = deterministic · 1 = creative</span>
        </div>
        <div className="form-group full">
          <label className="form-label">Groq API Key</label>
          <input className="form-control" type="password" value={cfg.apiKey} onChange={set('apiKey')} placeholder="gsk_••••••••••••" />
          <span className="form-hint">Get free key from console.groq.com</span>
        </div>
      </div>

      <div className="settings-row">
        <div className="settings-row-info"><h4>Auto-log from chat</h4><p>Automatically structure and save interactions from AI chat</p></div>
        <Toggle on={cfg.autoLog} onChange={() => tog('autoLog')} />
      </div>
      <div className="settings-row">
        <div className="settings-row-info"><h4>Infer Sentiment</h4><p>Use AI to automatically detect HCP sentiment from notes</p></div>
        <Toggle on={cfg.sentimentInfer} onChange={() => tog('sentimentInfer')} />
      </div>
      <div className="settings-row">
        <div className="settings-row-info"><h4>Follow-up Suggestions</h4><p>Show AI-powered follow-up action suggestions after logging</p></div>
        <Toggle on={cfg.followUpSuggest} onChange={() => tog('followUpSuggest')} />
      </div>

      <div style={{ marginTop: 20 }}>
        <button className="btn btn-primary" onClick={handleSave}>
          {saved ? <CheckCircle size={14} /> : <Save size={14} />}
          {saved ? 'Saved!' : 'Save AI Settings'}
        </button>
      </div>
    </div>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// DATA SECTION
// ─────────────────────────────────────────────────────────────────────────────

const DATA_DEFAULTS = {
  retention:        '12 months',
  anonymizeTraining: true,
}

function DataSection() {
  const [cfg,  setCfg]  = useState(() => getSectionData('data', DATA_DEFAULTS))
  const [saved, setSaved] = useState(false)

  const set = k => e => setCfg(p => ({ ...p, [k]: e.target.value }))
  const tog = k => setCfg(p => ({ ...p, [k]: !p[k] }))

  const handleSave = () => {
    saveSettings('data', cfg)
    setSaved(true)
    toast.success('Data preferences saved!')
    setTimeout(() => setSaved(false), 2000)
  }

  const handleExport = () => {
    toast.success('Export started — check your downloads folder (demo)')
  }

  const handleDelete = () => {
    if (!confirm('Are you sure? This will clear all localStorage settings. Database data is unaffected.')) return
    localStorage.removeItem(STORAGE_KEY)
    toast.success('Local settings cleared')
  }

  return (
    <div className="settings-section">
      <h2>Data & Privacy</h2>
      <p>Manage your data storage, exports, and privacy settings.</p>

      <div className="settings-row">
        <div className="settings-row-info"><h4>Export All Interactions</h4><p>Download your HCP interaction data as CSV</p></div>
        <button className="btn btn-ghost btn-sm" onClick={handleExport}>Export CSV</button>
      </div>

      <div className="settings-row">
        <div className="settings-row-info"><h4>Data Retention</h4><p>Automatically archive interactions older than</p></div>
        <select className="form-control" style={{ width: 'auto' }} value={cfg.retention} onChange={set('retention')}>
          <option>6 months</option>
          <option>12 months</option>
          <option>24 months</option>
          <option>Never</option>
        </select>
      </div>

      <div className="settings-row">
        <div className="settings-row-info"><h4>Anonymize AI Training</h4><p>Exclude your data from AI model improvement</p></div>
        <Toggle on={cfg.anonymizeTraining} onChange={() => tog('anonymizeTraining')} />
      </div>

      <div style={{ marginTop: 20, display: 'flex', gap: 10 }}>
        <button className="btn btn-primary" onClick={handleSave}>
          {saved ? <CheckCircle size={14} /> : <Save size={14} />}
          {saved ? 'Saved!' : 'Save Preferences'}
        </button>
        <button className="btn btn-danger" onClick={handleDelete}>Clear Local Settings</button>
      </div>
    </div>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// APPEARANCE SECTION
// ─────────────────────────────────────────────────────────────────────────────

const APPEARANCE_DEFAULTS = {
  theme:   'light',
  density: 'comfortable',
  font:    'Inter',
}

function AppearanceSection() {
  const [cfg,  setCfg]  = useState(() => getSectionData('appearance', APPEARANCE_DEFAULTS))
  const [saved, setSaved] = useState(false)

  const set = k => v => setCfg(p => ({ ...p, [k]: v }))

  const handleSave = () => {
    saveSettings('appearance', cfg)
    setSaved(true)
    toast.success('Appearance saved!')
    setTimeout(() => setSaved(false), 2000)
  }

  return (
    <div className="settings-section">
      <h2>Appearance</h2>
      <p>Customize how the CRM looks and feels.</p>

      <div className="settings-row">
        <div className="settings-row-info"><h4>Theme</h4><p>Choose your preferred color scheme</p></div>
        <div style={{ display: 'flex', gap: 8 }}>
          {['light', 'dark', 'system'].map(t => (
            <button
              key={t}
              type="button"
              className={`btn btn-sm ${cfg.theme === t ? 'btn-primary' : 'btn-ghost'}`}
              onClick={() => set('theme')(t)}
            >
              {t === 'light' ? '☀️' : t === 'dark' ? '🌙' : '💻'} {t.charAt(0).toUpperCase() + t.slice(1)}
            </button>
          ))}
        </div>
      </div>

      <div className="settings-row">
        <div className="settings-row-info"><h4>Density</h4><p>Adjust information density and spacing</p></div>
        <div style={{ display: 'flex', gap: 8 }}>
          {['compact', 'comfortable', 'spacious'].map(d => (
            <button
              key={d}
              type="button"
              className={`btn btn-sm ${cfg.density === d ? 'btn-primary' : 'btn-ghost'}`}
              onClick={() => set('density')(d)}
            >
              {d.charAt(0).toUpperCase() + d.slice(1)}
            </button>
          ))}
        </div>
      </div>

      <div className="settings-row">
        <div className="settings-row-info"><h4>Font</h4><p>Interface font family</p></div>
        <select
          className="form-control"
          style={{ width: 'auto' }}
          value={cfg.font}
          onChange={e => set('font')(e.target.value)}
        >
          <option>Inter</option>
          <option>System UI</option>
        </select>
      </div>

      <div style={{ marginTop: 20 }}>
        <button className="btn btn-primary" onClick={handleSave}>
          {saved ? <CheckCircle size={14} /> : <Save size={14} />}
          {saved ? 'Saved!' : 'Save Appearance'}
        </button>
      </div>
    </div>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// SECURITY SECTION
// ─────────────────────────────────────────────────────────────────────────────

const SECURITY_DEFAULTS = {
  twoFA: false,
}

function SecuritySection() {
  const [cfg,     setCfg]     = useState(() => getSectionData('security', SECURITY_DEFAULTS))
  const [pwForm,  setPwForm]  = useState({ current: '', newPw: '', confirm: '' })
  const [saved,   setSaved]   = useState(false)

  const setPw = f => e => setPwForm(p => ({ ...p, [f]: e.target.value }))
  const tog   = k => setCfg(p => ({ ...p, [k]: !p[k] }))

  const handleSavePw = () => {
    if (!pwForm.current)         { toast.error('Enter current password'); return }
    if (!pwForm.newPw)           { toast.error('Enter new password'); return }
    if (pwForm.newPw.length < 6) { toast.error('Password must be at least 6 characters'); return }
    if (pwForm.newPw !== pwForm.confirm) { toast.error('Passwords do not match'); return }
    saveSettings('security', cfg)
    setSaved(true)
    toast.success('Password updated!')
    setPwForm({ current: '', newPw: '', confirm: '' })
    setTimeout(() => setSaved(false), 2000)
  }

  const handleSaveSecurity = () => {
    saveSettings('security', cfg)
    toast.success('Security settings saved!')
  }

  return (
    <div className="settings-section">
      <h2>Security</h2>
      <p>Manage your account security and authentication.</p>

      <div className="form-grid" style={{ marginBottom: 20 }}>
        <div className="form-group">
          <label className="form-label">Current Password</label>
          <input className="form-control" type="password" placeholder="••••••••" value={pwForm.current} onChange={setPw('current')} />
        </div>
        <div className="form-group">
          <label className="form-label">New Password</label>
          <input className="form-control" type="password" placeholder="••••••••" value={pwForm.newPw} onChange={setPw('newPw')} />
        </div>
        <div className="form-group full">
          <label className="form-label">Confirm Password</label>
          <input className="form-control" type="password" placeholder="••••••••" value={pwForm.confirm} onChange={setPw('confirm')} />
        </div>
      </div>

      <div style={{ marginBottom: 20 }}>
        <button className="btn btn-primary" onClick={handleSavePw}>
          {saved ? <CheckCircle size={14} /> : <Save size={14} />}
          {saved ? 'Updated!' : 'Update Password'}
        </button>
      </div>

      <hr className="divider" />

      <div className="settings-row">
        <div className="settings-row-info">
          <h4>Two-Factor Authentication</h4>
          <p>Add an extra layer of security to your account</p>
        </div>
        <Toggle on={cfg.twoFA} onChange={() => { tog('twoFA'); setTimeout(handleSaveSecurity, 100) }} />
      </div>

      <div className="settings-row">
        <div className="settings-row-info">
          <h4>Active Sessions</h4>
          <p>You are currently logged in on this device</p>
        </div>
        <button className="btn btn-ghost btn-sm" onClick={() => toast('Session management coming soon', { icon: 'ℹ️' })}>
          View All
        </button>
      </div>
    </div>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// MAIN SETTINGS PAGE
// ─────────────────────────────────────────────────────────────────────────────

const PANEL_MAP = {
  profile:       ProfileSection,
  notifications: NotificationsSection,
  ai:            AISection,
  data:          DataSection,
  appearance:    AppearanceSection,
  security:      SecuritySection,
}

export default function Settings() {
  const [active, setActive] = useState('profile')
  const Panel = PANEL_MAP[active]

  return (
    <div className="page-body">
      <div className="page-header">
        <h1>Settings</h1>
        <p>Your preferences are saved in the browser and persist across sessions.</p>
      </div>

      <div className="settings-grid">
        {/* Left nav */}
        <div className="settings-nav">
          {SECTIONS.map(({ key, label, icon: Icon }) => (
            <button
              key={key}
              className={`settings-nav-item ${active === key ? 'active' : ''}`}
              onClick={() => setActive(key)}
            >
              <Icon size={15} /> {label}
            </button>
          ))}
        </div>

        {/* Right panel */}
        <div className="settings-panel">
          <Panel />
        </div>
      </div>
    </div>
  )
}
