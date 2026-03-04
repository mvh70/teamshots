'use client'

import { useCallback, useState } from 'react'

export interface GenerationFilterItem {
  createdAt: string
  contextName?: string | null
}

export function normalizeGenerationContextName(name: string | undefined | null): string {
  if (!name || name.trim() === '') return 'Freestyle'
  return name.trim()
}

export function useGenerationFilters(initialUserFilter: string = 'me') {
  const [timeframe, setTimeframe] = useState<'all' | '7d' | '30d'>('all')
  const [context, setContext] = useState<string>('all')
  const [userFilter, setUserFilter] = useState<string>(initialUserFilter)
  const [selectedUserId, setSelectedUserId] = useState<string>('all')

  const filterGenerated = useCallback(
    <T extends GenerationFilterItem>(items: T[]): T[] => {
      const now = Date.now()
      const inTimeframe = (date: string) => {
        if (timeframe === 'all') return true
        const diff = now - new Date(date).getTime()
        return timeframe === '7d' ? diff <= 7 * 86400000 : diff <= 30 * 86400000
      }

      return items.filter(
        (item) =>
          inTimeframe(item.createdAt) &&
          (context === 'all' || normalizeGenerationContextName(item.contextName) === context)
      )
    },
    [timeframe, context]
  )

  return {
    timeframe,
    context,
    userFilter,
    selectedUserId,
    setTimeframe,
    setContext,
    setUserFilter,
    setSelectedUserId,
    filterGenerated,
  }
}

