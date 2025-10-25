# Selfie Upload Flow Testing Module

This testing module provides comprehensive test coverage for the selfie upload and approval flow, ensuring the user experience remains consistent and reliable across all changes.

## 🎯 Overview

The testing module covers:
- **End-to-End Testing** with Playwright for complete user journeys
- **Unit Testing** with Jest and React Testing Library for component logic
- **Integration Testing** for API endpoints and database interactions
- **Internationalization Testing** for English and Spanish language support
- **Mobile Testing** across different device viewports
- **Error Handling Testing** for various failure scenarios

## 📁 Directory Structure

```
tests/
├── e2e/
│   └── selfie-flow/
│       ├── config.ts              # Test configuration and fixtures
│       ├── upload.spec.ts          # Upload flow tests
│       ├── approval.spec.ts        # Approval flow tests
│       ├── journey.spec.ts         # Complete user journey tests
│       ├── errors.spec.ts          # Error handling tests
│       └── i18n-mobile.spec.ts     # Internationalization and mobile tests
├── unit/
│   └── components/
│       ├── SelfieApproval.test.tsx
│       └── SelfieUploadFlow.test.tsx
├── fixtures/                       # Test image files
├── utils/
│   └── test-data.ts               # Test data management
└── README.md                      # This file
```

## 🚀 Getting Started

### Prerequisites

- Node.js 18+
- npm or yarn
- Playwright browsers installed

### Installation

```bash
# Install dependencies
npm install

# Install Playwright browsers
npx playwright install --with-deps
```

### Running Tests

```bash
# Run all tests
npm run test:all

# Run only unit tests
npm run test

# Run only E2E tests
npm run test:e2e

# Run selfie flow tests specifically
npm run test:selfie-flow

# Run tests in watch mode
npm run test:watch

# Run E2E tests with UI
npm run test:e2e:ui

# Run E2E tests in headed mode
npm run test:e2e:headed
```

## 🧪 Test Categories

### 1. Upload Flow Tests (`upload.spec.ts`)

Tests the selfie upload process including:
- Empty state display
- Upload flow initiation
- Drag and drop functionality
- File picker functionality
- File type validation
- Face detection validation
- Upload progress indicators
- Cancel functionality

### 2. Approval Flow Tests (`approval.spec.ts`)

Tests the selfie approval process including:
- Approval screen display
- Quality guidelines display
- Selfie image display
- Approval button functionality
- Retake button functionality
- Cancel button functionality
- Processing states
- Different user contexts

### 3. Complete Journey Tests (`journey.spec.ts`)

Tests the complete user journey including:
- Full flow from login to approval
- Retake flow handling
- Cancel flow handling
- Session persistence
- Multiple selfie uploads
- Company context flows

### 4. Error Handling Tests (`errors.spec.ts`)

Tests various error scenarios including:
- Server errors during upload
- Face detection failures
- File size limit exceeded
- Network timeouts
- Insufficient credits
- API errors during approval
- Browser storage limitations
- Invalid image formats

### 5. Internationalization & Mobile Tests (`i18n-mobile.spec.ts`)

Tests cross-language and device support including:
- Spanish language support
- Mobile viewport testing
- Tablet viewport testing
- Orientation changes
- Touch interactions
- Accessibility features
- Keyboard navigation

## 🔧 Test Configuration

### Playwright Configuration

The `playwright.config.ts` file configures:
- Test directory and parallel execution
- Browser projects (Chrome, Firefox, Safari, Mobile)
- Screenshot and video capture on failure
- Trace collection for debugging
- Local development server integration

### Jest Configuration

The `jest.config.js` file configures:
- Next.js integration
- TypeScript support
- Module path mapping
- Coverage reporting
- Test environment setup

## 📊 Test Data Management

### Test Fixtures

The testing module includes:
- **Test Images**: Valid selfies, invalid files, no-face images, multiple faces
- **Test Users**: Standard users, no-credits users, company admins
- **Test Companies**: Standard company configurations
- **Test Data Manager**: Automated cleanup and setup

### Database Management

```typescript
import { testDataManager } from './utils/test-data';

// Create test user
const user = await testDataManager.createTestUser({
  email: 'test@example.com',
  credits: 10,
});

// Create test selfie
const selfie = await testDataManager.createTestSelfie(user.id, {
  uploadedKey: 'test-key',
  validated: true,
});

// Cleanup after tests
await testDataManager.cleanup();
```

## 🎨 Test Data Attributes

The tests use `data-testid` attributes for reliable element selection:

```typescript
// Example test selectors
'[data-testid="selfies-title"]'
'[data-testid="upload-cta"]'
'[data-testid="dropzone"]'
'[data-testid="approval-screen"]'
'[data-testid="approve-button"]'
'[data-testid="retake-button"]'
'[data-testid="cancel-button"]'
```

## 🔄 CI/CD Integration

### GitHub Actions Workflow

The `.github/workflows/selfie-flow-tests.yml` workflow:
- Triggers on changes to selfie-related files
- Runs unit tests with coverage
- Runs E2E tests with Playwright
- Uploads test reports as artifacts
- Comments PR with test results

### Test Triggers

Tests run automatically when changes are made to:
- `src/components/Upload/**`
- `src/app/app-routes/selfies/**`
- `src/app/api/uploads/**`
- `src/app/api/files/**`
- `tests/e2e/selfie-flow/**`

## 📈 Coverage and Reporting

### Coverage Reports

- **Unit Tests**: Jest coverage reports in `coverage/`
- **E2E Tests**: Playwright HTML reports in `playwright-report/`
- **CI Integration**: Artifacts uploaded to GitHub Actions

### Test Reports

- **HTML Reports**: Interactive test results with screenshots
- **JSON Reports**: Machine-readable test results
- **JUnit Reports**: CI/CD integration format

## 🐛 Debugging Tests

### Playwright Debugging

```bash
# Run tests in debug mode
npx playwright test --debug

# Run specific test in debug mode
npx playwright test tests/e2e/selfie-flow/upload.spec.ts --debug

# Open test results
npx playwright show-report
```

### Jest Debugging

```bash
# Run tests in watch mode
npm run test:watch

# Run tests with verbose output
npm run test -- --verbose

# Run specific test file
npm run test -- SelfieApproval.test.tsx
```

## 🔧 Maintenance

### Adding New Tests

1. **Unit Tests**: Add to `tests/unit/components/`
2. **E2E Tests**: Add to `tests/e2e/selfie-flow/`
3. **Test Data**: Update `tests/utils/test-data.ts`
4. **Fixtures**: Add to `tests/fixtures/`

### Updating Test Data

When the selfie flow changes:
1. Update test selectors in existing tests
2. Add new test cases for new functionality
3. Update test data fixtures
4. Update documentation

### Test Maintenance Checklist

- [ ] All tests pass locally
- [ ] Tests run in CI/CD pipeline
- [ ] Test coverage meets requirements
- [ ] Documentation is up to date
- [ ] Test data is properly cleaned up

## 📚 Best Practices

### Test Writing

1. **Use descriptive test names** that explain what is being tested
2. **Keep tests independent** - each test should be able to run in isolation
3. **Use proper test data** - create realistic test scenarios
4. **Clean up after tests** - ensure no test data persists
5. **Test both happy path and error scenarios**

### Test Organization

1. **Group related tests** using `describe` blocks
2. **Use `beforeEach` and `afterEach`** for setup and cleanup
3. **Use meaningful test data** that reflects real usage
4. **Keep tests focused** - one test should verify one behavior

### Performance

1. **Run tests in parallel** when possible
2. **Use test fixtures** to avoid repeated setup
3. **Mock external dependencies** to improve test speed
4. **Clean up test data** to prevent test interference

## 🆘 Troubleshooting

### Common Issues

1. **Tests failing in CI but passing locally**
   - Check environment variables
   - Verify test data setup
   - Check for timing issues

2. **Flaky tests**
   - Add proper waits and assertions
   - Check for race conditions
   - Use proper test data cleanup

3. **Slow tests**
   - Mock external API calls
   - Use test fixtures instead of creating data
   - Run tests in parallel

### Getting Help

- Check the [Playwright documentation](https://playwright.dev/docs/intro)
- Review the [Jest documentation](https://jestjs.io/docs/getting-started)
- Check test logs in CI/CD pipeline
- Review test artifacts for screenshots and traces

## 🎉 Success Metrics

The testing module is successful when:
- ✅ All tests pass consistently
- ✅ Tests run in under 5 minutes
- ✅ Coverage is above 80% for selfie flow components
- ✅ Tests catch regressions before deployment
- ✅ New features are properly tested
- ✅ Documentation is up to date

---

**Last Updated**: October 2024  
**Maintainer**: Development Team  
**Version**: 1.0.0
