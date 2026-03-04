jest.mock('@/domain/credits/credits', () => ({
  reserveCreditsForGeneration: jest.fn(),
  getPersonCreditBalance: jest.fn(),
  getTeamCreditBalance: jest.fn(),
}))

jest.mock('@/domain/services/UserService', () => ({
  UserService: {
    getUserContext: jest.fn(),
    getUserRoles: jest.fn(),
  },
}))

import { CreditService } from '@/domain/services/CreditService'
import {
  getPersonCreditBalance,
  getTeamCreditBalance,
  reserveCreditsForGeneration as reserveCreditsTx,
} from '@/domain/credits/credits'
import { UserService } from '@/domain/services/UserService'

describe('CreditService.reserveCreditsForGeneration', () => {
  beforeEach(() => {
    jest.resetAllMocks()
    ;(UserService.getUserContext as jest.Mock).mockResolvedValue({
      user: { person: { id: 'admin-person', teamId: 'team-1' } },
      teamId: 'team-1',
    })
    ;(getTeamCreditBalance as jest.Mock).mockResolvedValue(0)
  })

  it('reserves credits against the provided personId, not the context person', async () => {
    ;(reserveCreditsTx as jest.Mock).mockResolvedValue({ id: 'tx-1' })

    const result = await CreditService.reserveCreditsForGeneration(
      'admin-user',
      'invite-person',
      10
    )

    expect(result.success).toBe(true)
    expect(reserveCreditsTx).toHaveBeenCalledWith(
      'invite-person', 10, 'Generation reservation', undefined, undefined, undefined
    )
  })

  it('fails when the underlying reservation throws insufficient credits', async () => {
    ;(reserveCreditsTx as jest.Mock).mockRejectedValue(new Error('Insufficient credits'))

    const result = await CreditService.reserveCreditsForGeneration(
      'admin-user',
      'invite-person',
      10
    )

    expect(result.success).toBe(false)
    expect(result.error).toBe('Insufficient credits')
  })
})
