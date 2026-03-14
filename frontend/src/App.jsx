// src/App.jsx
import { useState, useEffect } from 'react'
import { Provider } from 'react-redux'
import { BrowserRouter, Routes, Route, NavLink, useLocation } from 'react-router-dom'
import { Toaster } from 'react-hot-toast'
import { store } from './store'

import Dashboard      from './pages/Dashboard'
import LogInteraction from './pages/LogInteraction'
import AIAssistant    from './pages/AIAssistant'
import HCPDirectory   from './pages/HCPDirectory'
import Settings       from './pages/Settings'

import {
  LayoutDashboard, ClipboardList, MessageSquare,
  Users, Settings as SettingsIcon, Menu, Bot,
} from 'lucide-react'
import './styles/global.css'

const NAV = [
  { to:'/',          label:'Dashboard',       icon:LayoutDashboard, end:true },
  { to:'/log',       label:'Log Interaction', icon:ClipboardList            },
  { to:'/assistant', label:'AI Assistant',    icon:MessageSquare            },
  { to:'/hcps',      label:'HCP Directory',   icon:Users                    },
  { to:'/settings',  label:'Settings',        icon:SettingsIcon             },
]

const PAGE_META = {
  '/':          { title:'Dashboard',       sub:'Overview',                      icon:'chart' },
  '/log':       { title:'Log Interaction', sub:'New Entry',                     icon:'log'   },
  '/assistant': { title:'AI Assistant',    sub:'LangGraph · gemma2-9b-it',      icon:'bot'   },
  '/hcps':      { title:'HCP Directory',   sub:'Healthcare Professionals',      icon:'users' },
  '/settings':  { title:'Settings',        sub:'Preferences & Configuration',   icon:'cog'   },
}

// Read profile from localStorage (same key Settings.jsx uses)
function useProfile() {
  const [profile, setProfile] = useState(() => {
    try {
      const raw = localStorage.getItem('crm_settings')
      if (raw) {
        const parsed = JSON.parse(raw)
        if (parsed.profile) return parsed.profile
      }
    } catch {}
    return { name: 'Rahul Mehta', role: 'Field Representative' }
  })

  // Listen for storage changes (when Settings saves)
  useEffect(() => {
    const handler = () => {
      try {
        const raw = localStorage.getItem('crm_settings')
        if (raw) {
          const parsed = JSON.parse(raw)
          if (parsed.profile) setProfile(parsed.profile)
        }
      } catch {}
    }
    window.addEventListener('storage', handler)
    // Also poll every 500ms for same-tab updates
    const interval = setInterval(handler, 500)
    return () => { window.removeEventListener('storage', handler); clearInterval(interval) }
  }, [])

  return profile
}

function Sidebar({ open, onClose }) {
  const profile = useProfile()
  const initial = (profile.name || 'R')[0].toUpperCase()

  return (
    <>
      <div className={`sidebar-overlay ${open ? 'open' : ''}`} onClick={onClose} />
      <aside className={`sidebar ${open ? 'open' : ''}`}>

        {/* Logo */}
        <div className="sidebar-logo">
          <div className="sidebar-logo-icon">💊</div>
          <div>
            <h1>CRM HCP Module</h1>
            <span>HCP Module v1.0</span>
          </div>
        </div>

        <div className="sidebar-section-label">Navigation</div>
        <nav>
          <ul className="sidebar-nav">
            {NAV.map(({ to, label, icon: Icon, end }) => (
              <li key={to}>
                <NavLink
                  to={to}
                  end={end}
                  className={({ isActive }) => `sidebar-nav-link ${isActive ? 'active' : ''}`}
                  onClick={onClose}
                >
                  <Icon size={16} /> {label}
                  {to === '/assistant' && <span className="nav-badge">AI</span>}
                </NavLink>
              </li>
            ))}
          </ul>
        </nav>

        {/* Footer */}
        <div className="sidebar-footer">
          <div className="sidebar-avatar">{initial}</div>
          <div className="sidebar-footer-info">
            <div className="sidebar-footer-name">{profile.name || 'Rahul Mehta'}</div>
            <div className="sidebar-footer-role">{profile.role || 'Field Representative'}</div>
          </div>
        </div>
      </aside>
    </>
  )
}

function TopBar({ onMenuClick }) {
  const { pathname } = useLocation()
  const meta = PAGE_META[pathname] || { title: 'CRM', sub: '' }

  return (
    <header className="topbar">
      <button className="hamburger" onClick={onMenuClick} aria-label="Toggle menu">
        <Menu size={20} />
      </button>
      <span style={{ color: 'var(--primary)', display:'flex', alignItems:'center' }}>
        {meta.icon === 'bot'
          ? <Bot size={18} />
          : meta.icon === 'users'
          ? <Users size={18} />
          : <ClipboardList size={18} />
        }
      </span>
      <span className="topbar-title">{meta.title}</span>
      <span style={{ fontSize:12, color:'var(--text-muted)' }}>/ {meta.sub}</span>
      <div className="topbar-right">
        <span className="topbar-chip">🤖 AI-Powered</span>
      </div>
    </header>
  )
}

function AppContent() {
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const { pathname } = useLocation()
  const isFullHeight = pathname === '/assistant'   // chat needs full viewport height

  return (
    <div className="app-layout">
      <Sidebar open={sidebarOpen} onClose={() => setSidebarOpen(false)} />
      <main className="main-content">
        <TopBar onMenuClick={() => setSidebarOpen(o => !o)} />
        <div style={{ flex:1, overflow: isFullHeight ? 'hidden' : 'auto', display:'flex', flexDirection:'column' }}>
          <Routes>
            <Route path="/"          element={<Dashboard />} />
            <Route path="/log"       element={<LogInteraction />} />
            <Route path="/assistant" element={<AIAssistant />} />
            <Route path="/hcps"      element={<HCPDirectory />} />
            <Route path="/settings"  element={<Settings />} />
          </Routes>
        </div>
      </main>
    </div>
  )
}

export default function App() {
  return (
    <Provider store={store}>
      <Toaster
        position="top-right"
        toastOptions={{ style: { fontFamily: 'Inter, sans-serif', fontSize: 13 } }}
      />
      <BrowserRouter>
        <AppContent />
      </BrowserRouter>
    </Provider>
  )
}
