import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'

import type { Me } from '../../shared/types'
import { handleLocalRequest } from './localVault'

let isClientFallback = false

export class ApiError extends Error {
  constructor(
    public status: number,
    message: string,
    public code?: string,
  ) {
    super(message)
  }
}

export async function api<T>(path: string, init?: RequestInit & { json?: unknown }): Promise<T> {
  if (isClientFallback) {
    return handleLocalRequest<T>(path, init)
  }

  try {
    const { json, ...rest } = init ?? {}
    const response = await fetch(`/api${path}`, {
      credentials: 'same-origin',
      ...rest,
      headers: {
        accept: 'application/json',
        ...(json !== undefined ? { 'content-type': 'application/json' } : {}),
        ...(rest.headers ?? {}),
      },
      body: json !== undefined ? JSON.stringify(json) : rest.body,
    })

    const contentType = response.headers.get('content-type') ?? ''
    // If static host returns index.html or 404 HTML
    if (contentType.includes('text/html') || (!response.ok && response.status === 404)) {
      isClientFallback = true
      return handleLocalRequest<T>(path, init)
    }

    if (!response.ok) {
      let message = response.statusText
      let code: string | undefined
      try {
        const body = (await response.json()) as { error?: string; message?: string }
        message = body.message ?? body.error ?? message
        code = body.error
      } catch {
        /* no body */
      }
      throw new ApiError(response.status, message, code)
    }
    if (response.status === 204) return undefined as T
    return (await response.json()) as T
  } catch (error) {
    if (!(error instanceof ApiError)) {
      isClientFallback = true
      return handleLocalRequest<T>(path, init)
    }
    throw error
  }
}


// Queries
export const useMe = () => useQuery({ queryKey: ['me'], queryFn: () => api<Me>('/me'), retry: false, staleTime: 60_000 })

// Mutations
export function useInvalidate() {
  const client = useQueryClient()
  return (...keys: string[]) => Promise.all(keys.map((key) => client.invalidateQueries({ queryKey: [key] })))
}

export function useApiMutation<TInput, TResult>(
  run: (input: TInput) => Promise<TResult>,
  invalidates: string[],
  options?: { onSuccess?: (result: TResult, input: TInput) => void },
) {
  const invalidate = useInvalidate()
  return useMutation({
    mutationFn: run,
    onSuccess: async (result, input) => {
      await invalidate(...invalidates)
      options?.onSuccess?.(result, input)
    },
  })
}

