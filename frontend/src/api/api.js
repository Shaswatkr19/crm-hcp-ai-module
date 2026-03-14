// src/api/api.js
import axios from 'axios'

const BASE = import.meta.env.VITE_API_URL || '/api'

const api = axios.create({
  baseURL: BASE,
  headers: { 'Content-Type': 'application/json' },
})

// ── Interactions ─────────────────────────────────────────────────────────────

export const createInteraction = (data) =>
  api.post('/interactions/', data).then(r => r.data)

export const listInteractions = (params = {}) =>
  api.get('/interactions/', { params }).then(r => r.data)

export const getInteraction = (id) =>
  api.get(`/interactions/${id}`).then(r => r.data)

export const updateInteraction = (id, data) =>
  api.patch(`/interactions/${id}`, data).then(r => r.data)

export const deleteInteraction = (id) =>
  api.delete(`/interactions/${id}`)

export const listHCPs = (search = '') =>
  api.get('/interactions/hcps', { params: { search } }).then(r => r.data)

// ── Agent ─────────────────────────────────────────────────────────────────────

export const chatWithAgent = (message, current_hcp = null, last_interaction_id = null) =>
  api.post('/agent/chat', { message, current_hcp, last_interaction_id }).then(r => r.data)

export const summarizeHCP = (hcp_name) =>
  api.get(`/agent/summarize/${encodeURIComponent(hcp_name)}`).then(r => r.data)

export const recommendForHCP = (hcp_name) =>
  api.get(`/agent/recommend/${encodeURIComponent(hcp_name)}`).then(r => r.data)
