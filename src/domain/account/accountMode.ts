export type AccountMode = 'pro' | 'individual' | 'team_member'

export interface AccountModeResult {
  mode: AccountMode
  isPro: boolean
  isIndividual: boolean
  isTeamMember: boolean
  subscriptionTier: string | null
  subscriptionPeriod?: string | null
  hasProTier: boolean
}

/**
 * Client-side hook to determine account mode
 * Should fetch from API endpoint that uses getAccountMode
 */
export async function fetchAccountMode(): Promise<AccountModeResult> {
  const response = await fetch('/api/account/mode')
  if (!response.ok) {
    return {
      mode: 'individual',
      isPro: false,
      isIndividual: true,
      isTeamMember: false,
      subscriptionTier: null,
      subscriptionPeriod: null,
      hasProTier: false,
    }
  }
  return response.json()
}

