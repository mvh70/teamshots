import { renderHook } from '@testing-library/react'
import { OnboardingContext } from '@/lib/onborda/config'
import { useOnboardingState, getApplicableTours } from '@/lib/onborda/hooks'

// Mock next-auth
jest.mock('next-auth/react', () => ({
  useSession: () => ({
    data: {
      user: { id: 'test-user-id', email: 'test@example.com' }
    }
  })
}))

// Mock localStorage
const localStorageMock = {
  getItem: jest.fn(),
  setItem: jest.fn(),
  removeItem: jest.fn(),
  clear: jest.fn(),
}
Object.defineProperty(window, 'localStorage', {
  value: localStorageMock
})

describe('Onboarding Hooks', () => {
  beforeEach(() => {
    jest.clearAllMocks()
    localStorageMock.getItem.mockReturnValue(null)
  })

  describe('useOnboardingState', () => {
    it('should initialize with default context', () => {
      const { result } = renderHook(() => useOnboardingState())

      expect(result.current.context).toEqual({
        isTeamAdmin: false,
        isTeamMember: false,
        isRegularUser: true,
        hasUploadedSelfie: false,
        hasGeneratedPhotos: false,
        accountMode: 'individual',
        language: 'en',
      })
    })

    it('should load context from localStorage', () => {
      const storedContext = {
        hasGeneratedPhotos: true,
        accountMode: 'pro' as const,
        language: 'es' as const,
      }
      localStorageMock.getItem.mockReturnValue(JSON.stringify(storedContext))

      const { result } = renderHook(() => useOnboardingState())

      expect(result.current.context.hasGeneratedPhotos).toBe(true)
      expect(result.current.context.accountMode).toBe('pro')
      expect(result.current.context.language).toBe('es')
    })
  })

  describe('getApplicableTours', () => {
    it('should return welcome tour for new users', () => {
      const context: OnboardingContext = {
        userId: 'test-user',
        isTeamAdmin: false,
        isTeamMember: false,
        isRegularUser: true,
        hasUploadedSelfie: false,
        hasGeneratedPhotos: false, // New user hasn't generated photos
        accountMode: 'individual',
        language: 'en',
      }

      const applicableTours = getApplicableTours(context)

      expect(applicableTours).toHaveLength(1)
      expect(applicableTours[0].name).toBe('welcome')
    })

    it('should return team setup tour for team admins without team', () => {
      const context: OnboardingContext = {
        userId: 'test-user',
        isTeamAdmin: true, // Team admin
        isTeamMember: false,
        isRegularUser: false,
        teamId: undefined, // No team set up
        hasUploadedSelfie: true,
        hasGeneratedPhotos: true,
        accountMode: 'pro',
        language: 'en',
      }

      const applicableTours = getApplicableTours(context)

      expect(applicableTours).toHaveLength(1)
      expect(applicableTours[0].name).toBe('team-setup')
    })

    it('should return empty array when no tours apply', () => {
      const context: OnboardingContext = {
        userId: 'test-user',
        isTeamAdmin: false,
        isTeamMember: false,
        isRegularUser: true,
        hasUploadedSelfie: true,
        hasGeneratedPhotos: true, // User has generated photos
        accountMode: 'individual',
        language: 'en',
      }

      const applicableTours = getApplicableTours(context)

      expect(applicableTours).toHaveLength(0)
    })
  })
})
