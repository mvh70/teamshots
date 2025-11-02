// Test setup configuration
import '@testing-library/jest-dom'
import { beforeAll, afterAll, beforeEach, afterEach } from '@jest/globals'

// Mock environment variables
Object.defineProperty(process.env, 'NODE_ENV', { value: 'test', writable: true })
process.env.STRIPE_SECRET_KEY = 'sk_test_mock_key'
process.env.STRIPE_WEBHOOK_SECRET = 'whsec_test_mock_secret'
process.env.DATABASE_URL = 'postgresql://test:test@localhost:5432/teamshots_test'
process.env.NEXTAUTH_SECRET = 'test_secret'
process.env.NEXTAUTH_URL = 'http://localhost:3000'

// Mock Next.js modules
jest.mock('next/navigation', () => ({
  useRouter: () => ({
    push: jest.fn(),
    replace: jest.fn(),
    back: jest.fn(),
    forward: jest.fn(),
    refresh: jest.fn(),
    prefetch: jest.fn()
  }),
  useSearchParams: () => ({
    get: jest.fn((key: string) => {
      const params = new URLSearchParams(window.location.search)
      return params.get(key)
    })
  }),
  usePathname: () => '/test-path'
}))

jest.mock('next-auth/react', () => ({
  useSession: () => ({
    data: {
      user: {
        id: 'user_123',
        email: 'test@example.com',
        name: 'Test User'
      }
    },
    status: 'authenticated'
  }),
  signIn: jest.fn(),
  signOut: jest.fn()
}))

// Mock internationalization
jest.mock('next-intl', () => ({
  useTranslations: (namespace: string) => (key: string) => {
    const translations: Record<string, Record<string, string>> = {
      'auth.signup': {
        'userTypeLabel': 'How will you use TeamShots?',
        'individual': 'Individual',
        'individualDesc': 'For personal use',
        'team': 'Team',
        'teamDesc': 'For team use'
      },
      'pricing': {
        'individual': 'Individual',
        'pro': 'Pro',
        'tryOnce': 'Try Once'
      }
    }
    
    return translations[namespace]?.[key] || key
  }
}))

// Global test setup
beforeAll(async () => {
  // Setup test database if needed
  console.log('Setting up test environment...')
})

afterAll(async () => {
  // Cleanup test database if needed
  console.log('Cleaning up test environment...')
})

beforeEach(() => {
  // Reset mocks before each test
  jest.clearAllMocks()
})

afterEach(() => {
  // Cleanup after each test
  jest.restoreAllMocks()
})

// Mock fetch globally
global.fetch = jest.fn()

// Mock window.location
Object.defineProperty(window, 'location', {
  value: {
    href: 'http://localhost:3000',
    search: '',
    pathname: '/',
    assign: jest.fn(),
    replace: jest.fn(),
    reload: jest.fn()
  },
  writable: true
})

// Mock localStorage
Object.defineProperty(window, 'localStorage', {
  value: {
    getItem: jest.fn(),
    setItem: jest.fn(),
    removeItem: jest.fn(),
    clear: jest.fn()
  },
  writable: true
})

// Mock sessionStorage
Object.defineProperty(window, 'sessionStorage', {
  value: {
    getItem: jest.fn(),
    setItem: jest.fn(),
    removeItem: jest.fn(),
    clear: jest.fn()
  },
  writable: true
})