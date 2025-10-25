#!/bin/bash

# Start the development server with test database configuration
echo "🚀 Starting development server with test database..."

# Load test environment variables
export $(cat .env.test | xargs)

# Start the development server
npm run dev
