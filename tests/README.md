# TeamShots Test Suite

This directory contains comprehensive tests for the TeamShots Stripe yearly contract implementation.

## Test Structure

```
tests/
├── e2e/                    # End-to-end tests (Playwright)
│   ├── complete-flow.spec.ts
│   ├── generation-gating.spec.ts
│   ├── pricing-page.spec.ts
│   ├── signup-flow.spec.ts
│   ├── stripe-checkout.spec.ts
│   └── stripe-webhook.spec.ts
├── integration/            # Integration tests (Playwright)
│   ├── subscription-flow.test.ts
│   └── credit-system.test.ts
├── unit/                   # Unit tests (Jest)
│   ├── stripe-checkout.test.ts
│   └── stripe-webhook.test.ts
├── setup/                  # Test setup and configuration
│   └── test-setup.ts
├── fixtures/               # Test data and files
│   ├── valid-selfie.jpg
│   ├── no-face.jpg
│   └── multiple-faces.jpg
└── utils/                  # Test utilities
    ├── test-data.ts
    └── test-providers.tsx
```

## Test Types

### 1. Unit Tests (`tests/unit/`)
- **Framework**: Jest
- **Purpose**: Test individual functions and API endpoints
- **Coverage**: Business logic, API routes, utility functions
- **Run**: `npm run test:unit`

### 2. Integration Tests (`tests/integration/`)
- **Framework**: Playwright
- **Purpose**: Test component interactions and API flows
- **Coverage**: User workflows, component behavior, API integration
- **Run**: `npm run test:integration`

### 3. End-to-End Tests (`tests/e2e/`)
- **Framework**: Playwright
- **Purpose**: Test complete user journeys
- **Coverage**: Full user flows from signup to photo generation
- **Run**: `npm run test:e2e`

## Test Coverage

### Stripe Implementation
- ✅ Checkout session creation
- ✅ Webhook event handling
- ✅ Subscription lifecycle management
- ✅ Credit top-up processing
- ✅ Upgrade/downgrade flows

### User Flows
- ✅ Signup with individual/team selection
- ✅ Pricing page redirects
- ✅ Checkout flow
- ✅ Credit management
- ✅ Photo generation gating

### Business Logic
- ✅ Credit balance validation
- ✅ Subscription status checks
- ✅ Contract management
- ✅ Payment processing

## Running Tests

### Prerequisites
```bash
# Install dependencies
npm install

# Install Playwright browsers
npm run test:setup

# Set up test database
npm run db:push
```

### Individual Test Suites
```bash
# Unit tests only
npm run test:unit

# Integration tests only
npm run test:integration

# E2E tests only
npm run test:e2e

# All tests
npm run test:all
```

### Test Development
```bash
# Watch mode for unit tests
npm run test:unit:watch

# Debug E2E tests
npm run test:e2e:debug

# UI mode for Playwright tests
npm run test:e2e:ui
npm run test:integration:ui
```

### Test Reports
```bash
# Generate coverage report
npm run test:coverage

# View Playwright report
npm run test:report
```

## Test Configuration

### Jest Configuration (`jest.config.js`)
- Test environment: jsdom
- Setup file: `tests/setup/test-setup.ts`
- Coverage threshold: 70%
- Module mapping for `@/` imports

### Playwright Configuration (`tests/playwright.config.ts`)
- Multiple browsers: Chrome, Firefox, Safari
- Mobile testing: iPhone 12, Pixel 5
- Screenshots and videos on failure
- Global setup/teardown

## Mocking Strategy

### API Endpoints
- Stripe API calls are mocked using Playwright's `route` method
- Database operations are mocked in unit tests
- External services are stubbed

### Authentication
- Mock NextAuth session data
- Simulate different user states
- Test both authenticated and unauthenticated flows

### Stripe Events
- Mock webhook payloads
- Simulate different event types
- Test error scenarios

## Test Data

### Fixtures
- `valid-selfie.jpg`: Valid selfie for testing
- `no-face.jpg`: Image without face detection
- `multiple-faces.jpg`: Image with multiple faces

### Test Users
- Individual users with different subscription states
- Team users with company associations
- Users with various credit balances

## Continuous Integration

### GitHub Actions
Tests run automatically on:
- Pull requests
- Push to main branch
- Release tags

### Test Matrix
- Node.js versions: 18, 20
- Browsers: Chrome, Firefox, Safari
- Operating systems: Ubuntu, macOS, Windows

## Debugging Tests

### Unit Tests
```bash
# Debug specific test
npm run test:unit -- --testNamePattern="stripe checkout"

# Verbose output
npm run test:unit -- --verbose
```

### Playwright Tests
```bash
# Debug mode
npm run test:e2e:debug

# Headed mode (see browser)
npm run test:e2e:headed

# Specific test file
npx playwright test tests/e2e/signup-flow.spec.ts
```

### Common Issues

1. **Test Database**: Ensure test database is properly set up
2. **Environment Variables**: Check `.env.test` file
3. **Stripe Keys**: Use test keys for all tests
4. **Port Conflicts**: Ensure port 3000 is available

## Adding New Tests

### Unit Tests
1. Create test file in `tests/unit/`
2. Import the function/component to test
3. Mock dependencies
4. Write test cases
5. Run with `npm run test:unit`

### Integration Tests
1. Create test file in `tests/integration/`
2. Use Playwright's `test` function
3. Mock API calls with `page.route()`
4. Test component interactions
5. Run with `npm run test:integration`

### E2E Tests
1. Create test file in `tests/e2e/`
2. Use Playwright's `test` function
3. Test complete user journeys
4. Use real browser interactions
5. Run with `npm run test:e2e`

## Best Practices

1. **Test Isolation**: Each test should be independent
2. **Mock External Dependencies**: Don't rely on external services
3. **Clear Test Names**: Describe what the test does
4. **Arrange-Act-Assert**: Structure tests clearly
5. **Test Edge Cases**: Include error scenarios
6. **Keep Tests Fast**: Avoid unnecessary delays
7. **Maintain Test Data**: Keep fixtures up to date

## Troubleshooting

### Common Errors

1. **"Test database not found"**
   - Run `npm run db:push`
   - Check database connection string

2. **"Stripe API key not found"**
   - Set `STRIPE_SECRET_KEY` in `.env.test`
   - Use test keys, not live keys

3. **"Playwright browser not found"**
   - Run `npm run test:setup`
   - Install system dependencies

4. **"Port 3000 already in use"**
   - Stop other development servers
   - Use different port in test config

### Getting Help

1. Check test logs for specific errors
2. Run tests in debug mode
3. Check Playwright trace files
4. Review test configuration files