import axios from 'axios'
import { API_BASE } from '@/shared/api/config'
import { setupAuthInterceptors } from '@/shared/api/setup-auth-interceptors'

export const publicApi = axios.create({
  baseURL: API_BASE,
  headers: {
    'Content-Type': 'application/json',
  },
})

export const api = axios.create({
  baseURL: API_BASE,
  headers: {
    'Content-Type': 'application/json',
  },
})

setupAuthInterceptors(api)
