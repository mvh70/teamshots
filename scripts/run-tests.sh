#!/bin/bash

# Test runner script for TeamShots Stripe implementation
set -e

echo "🧪 Running TeamShots Stripe Implementation Tests"
echo "================================================"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Function to print colored output
print_status() {
    echo -e "${GREEN}✅ $1${NC}"
}

print_warning() {
    echo -e "${YELLOW}⚠️  $1${NC}"
}

print_error() {
    echo -e "${RED}❌ $1${NC}"
}

# Check if we're in the right directory
if [ ! -f "package.json" ]; then
    print_error "Please run this script from the project root directory"
    exit 1
fi

# Install dependencies if needed
if [ ! -d "node_modules" ]; then
    print_warning "Installing dependencies..."
    npm install
fi

# Run unit tests
echo ""
echo "🔬 Running Unit Tests..."
echo "----------------------"
if npm run test:unit; then
    print_status "Unit tests passed"
else
    print_error "Unit tests failed"
    exit 1
fi

# Run E2E tests
echo ""
echo "🌐 Running E2E Tests..."
echo "----------------------"
if npm run test:e2e; then
    print_status "E2E tests passed"
else
    print_error "E2E tests failed"
    exit 1
fi

# Run integration tests
echo ""
echo "🔗 Running Integration Tests..."
echo "------------------------------"
if npm run test:integration; then
    print_status "Integration tests passed"
else
    print_error "Integration tests failed"
    exit 1
fi

# Run linting
echo ""
echo "🔍 Running Linting..."
echo "-------------------"
if npm run lint; then
    print_status "Linting passed"
else
    print_error "Linting failed"
    exit 1
fi

# Run type checking
echo ""
echo "📝 Running Type Checking..."
echo "--------------------------"
if npm run type-check; then
    print_status "Type checking passed"
else
    print_error "Type checking failed"
    exit 1
fi

echo ""
echo "🎉 All tests passed! The Stripe implementation is ready for production."
echo ""
echo "📋 Test Summary:"
echo "  ✅ Unit Tests: API endpoints and business logic"
echo "  ✅ E2E Tests: Complete user flows"
echo "  ✅ Integration Tests: Component interactions"
echo "  ✅ Linting: Code quality checks"
echo "  ✅ Type Checking: TypeScript validation"
echo ""
echo "🚀 Ready to deploy!"
