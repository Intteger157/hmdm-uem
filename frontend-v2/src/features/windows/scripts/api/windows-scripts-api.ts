import axios from 'axios'
import { WINDOWS_API_BASE } from '@/shared/api/config'
import { useAuthStore } from '@/features/auth/store/auth-store'
import type {
  PowerShellScript,
  PowerShellScriptListResponse,
  UpsertPowerShellScriptPayload,
} from '@/features/windows/scripts/types/powershell-script'

export async function fetchPowerShellScripts(): Promise<PowerShellScript[]> {
  const jwt = useAuthStore.getState().jwt
  const response = await axios.get<PowerShellScriptListResponse>(`${WINDOWS_API_BASE}/scripts`, {
    headers: jwt ? { Authorization: `Bearer ${jwt}` } : {},
  })
  return response.data.items
}

export async function fetchPowerShellScript(id: number): Promise<PowerShellScript> {
  const jwt = useAuthStore.getState().jwt
  const response = await axios.get<PowerShellScript>(`${WINDOWS_API_BASE}/scripts/${id}`, {
    headers: jwt ? { Authorization: `Bearer ${jwt}` } : {},
  })
  return response.data
}

export async function createPowerShellScript(
  payload: UpsertPowerShellScriptPayload,
): Promise<PowerShellScript> {
  const jwt = useAuthStore.getState().jwt
  const response = await axios.post<PowerShellScript>(`${WINDOWS_API_BASE}/scripts`, payload, {
    headers: jwt ? { Authorization: `Bearer ${jwt}` } : {},
  })
  return response.data
}

export async function updatePowerShellScript(
  id: number,
  payload: UpsertPowerShellScriptPayload,
): Promise<PowerShellScript> {
  const jwt = useAuthStore.getState().jwt
  const response = await axios.put<PowerShellScript>(`${WINDOWS_API_BASE}/scripts/${id}`, payload, {
    headers: jwt ? { Authorization: `Bearer ${jwt}` } : {},
  })
  return response.data
}

export async function deletePowerShellScript(id: number): Promise<void> {
  const jwt = useAuthStore.getState().jwt
  await axios.delete(`${WINDOWS_API_BASE}/scripts/${id}`, {
    headers: jwt ? { Authorization: `Bearer ${jwt}` } : {},
  })
}
