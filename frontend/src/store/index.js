// src/store/index.js
import { configureStore } from '@reduxjs/toolkit'
import interactionReducer from './interactionSlice'

export const store = configureStore({
  reducer: {
    interactions: interactionReducer,
  },
})
