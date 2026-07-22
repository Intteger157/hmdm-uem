import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import {
  deletePushMessage,
  searchPushMessages,
  sendPushMessage,
  type PushSearchRequest,
  type PushSendRequest,
} from '@/features/plugins/push/api/push-api'

export const pushQueryKeys = {
  all: ['push'] as const,
  list: (filter: PushSearchRequest) => [...pushQueryKeys.all, 'list', filter] as const,
}

export function usePushMessagesQuery(filter: PushSearchRequest = {}) {
  return useQuery({
    queryKey: pushQueryKeys.list(filter),
    queryFn: () => searchPushMessages(filter),
  })
}

export function useSendPushMutation() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (request: PushSendRequest) => sendPushMessage(request),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: pushQueryKeys.all })
    },
  })
}

export function useDeletePushMutation() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (id: number) => deletePushMessage(id),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: pushQueryKeys.all })
    },
  })
}
