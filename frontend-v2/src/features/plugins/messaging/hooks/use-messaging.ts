import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import {
  deleteMessagingMessage,
  searchMessagingMessages,
  sendMessagingMessage,
  type MessagingSearchRequest,
  type MessagingSendRequest,
} from '@/features/plugins/messaging/api/messaging-api'

export const messagingQueryKeys = {
  all: ['messaging'] as const,
  list: (filter: MessagingSearchRequest) => [...messagingQueryKeys.all, 'list', filter] as const,
}

export function useMessagingMessagesQuery(filter: MessagingSearchRequest = {}) {
  return useQuery({
    queryKey: messagingQueryKeys.list(filter),
    queryFn: () => searchMessagingMessages(filter),
  })
}

export function useSendMessagingMutation() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (request: MessagingSendRequest) => sendMessagingMessage(request),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: messagingQueryKeys.all })
    },
  })
}

export function useDeleteMessagingMutation() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (id: number) => deleteMessagingMessage(id),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: messagingQueryKeys.all })
    },
  })
}
