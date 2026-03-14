// src/store/interactionSlice.js
import { createSlice, createAsyncThunk } from '@reduxjs/toolkit'
import {
  listInteractions,
  createInteraction,
  updateInteraction,
  deleteInteraction,
} from '../api/api'

// ── Async Thunks ──────────────────────────────────────────────────────────────

export const fetchInteractions = createAsyncThunk(
  'interactions/fetchAll',
  async (params = {}, { rejectWithValue }) => {
    try {
      return await listInteractions(params)
    } catch (err) {
      return rejectWithValue(err.response?.data?.detail || 'Failed to fetch')
    }
  }
)

export const addInteraction = createAsyncThunk(
  'interactions/add',
  async (data, { rejectWithValue }) => {
    try {
      return await createInteraction(data)
    } catch (err) {
      // FastAPI 422 returns detail as array of validation errors
      const detail = err.response?.data?.detail
      if (Array.isArray(detail)) {
        return rejectWithValue(detail)
      }
      return rejectWithValue(detail || err.message || 'Failed to create')
    }
  }
)

export const editInteraction = createAsyncThunk(
  'interactions/edit',
  async ({ id, data }, { rejectWithValue }) => {
    try {
      return await updateInteraction(id, data)
    } catch (err) {
      return rejectWithValue(err.response?.data?.detail || 'Failed to update')
    }
  }
)

export const removeInteraction = createAsyncThunk(
  'interactions/remove',
  async (id, { rejectWithValue }) => {
    try {
      await deleteInteraction(id)
      return id
    } catch (err) {
      return rejectWithValue(err.response?.data?.detail || 'Failed to delete')
    }
  }
)

// ── Slice ─────────────────────────────────────────────────────────────────────

const interactionSlice = createSlice({
  name: 'interactions',
  initialState: {
    items: [],
    loading: false,
    error: null,
    selectedId: null,
  },
  reducers: {
    setSelected: (state, action) => { state.selectedId = action.payload },
    clearError:  (state) => { state.error = null },
  },
  extraReducers: (builder) => {
    builder
      // fetchAll
      .addCase(fetchInteractions.pending,   (s) => { s.loading = true; s.error = null })
      .addCase(fetchInteractions.fulfilled, (s, a) => { s.loading = false; s.items = a.payload })
      .addCase(fetchInteractions.rejected,  (s, a) => { s.loading = false; s.error = a.payload })
      // add
      .addCase(addInteraction.fulfilled,    (s, a) => { s.items.unshift(a.payload) })
      // edit
      .addCase(editInteraction.fulfilled,   (s, a) => {
        const idx = s.items.findIndex(i => i.id === a.payload.id)
        if (idx !== -1) s.items[idx] = a.payload
      })
      // remove
      .addCase(removeInteraction.fulfilled, (s, a) => {
        s.items = s.items.filter(i => i.id !== a.payload)
      })
  },
})

export const { setSelected, clearError } = interactionSlice.actions
export default interactionSlice.reducer
