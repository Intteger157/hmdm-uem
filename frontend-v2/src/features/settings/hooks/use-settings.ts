import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import {
  fetchSettings,
  fetchUserRoleSettings,
  updateDesignSettings,
  updateLanguageSettings,
  updateMiscSettings,
  updateUserRolesCommonSettings,
  type Settings,
  type UserRoleSettings,
} from '@/features/settings/api/settings-api'

export const settingsQueryKeys = {
  all: ['settings'] as const,
  main: () => [...settingsQueryKeys.all, 'main'] as const,
  role: (roleId: number) => [...settingsQueryKeys.all, 'role', roleId] as const,
}

export function useSettingsQuery() {
  return useQuery({
    queryKey: settingsQueryKeys.main(),
    queryFn: fetchSettings,
  })
}

export function useUserRoleSettingsQuery(roleId: number | undefined) {
  return useQuery({
    queryKey: settingsQueryKeys.role(roleId ?? 0),
    queryFn: () => fetchUserRoleSettings(roleId!),
    enabled: roleId != null && roleId > 0,
  })
}

export function useUpdateDesignSettingsMutation() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (settings: Settings) => updateDesignSettings(settings),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: settingsQueryKeys.all })
    },
  })
}

export function useUpdateUserRoleSettingsMutation() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (settings: UserRoleSettings[]) => updateUserRolesCommonSettings(settings),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: settingsQueryKeys.all })
    },
  })
}

export function useUpdateMiscLanguageSettingsMutation() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async (settings: Settings) => {
      await updateMiscSettings(settings)
      await updateLanguageSettings(settings)
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: settingsQueryKeys.all })
    },
  })
}
