#!/usr/bin/env node

/**
 * Test Database Setup Script
 * 
 * This script sets up a separate test database for E2E tests
 * to avoid polluting the production database with test data.
 */

const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

const TEST_DB_NAME = 'teamshots_test';
const TEST_DB_URL = `postgresql://postgres:postgres@localhost:5432/${TEST_DB_NAME}?schema=public`;

console.log('🧪 Setting up test database...');

try {
  // Create test database
  console.log(`Creating test database: ${TEST_DB_NAME}`);
  execSync(`createdb ${TEST_DB_NAME}`, { stdio: 'inherit' });
  
  // Set environment variable for test database
  process.env.DATABASE_URL = TEST_DB_URL;
  
  // Run migrations on test database
  console.log('Running migrations on test database...');
  execSync('npx prisma migrate deploy', { stdio: 'inherit' });
  
  // Generate Prisma client for test database
  console.log('Generating Prisma client...');
  execSync('npx prisma generate', { stdio: 'inherit' });
  
  console.log('✅ Test database setup complete!');
  console.log(`Test database URL: ${TEST_DB_URL}`);
  
} catch (error) {
  console.error('❌ Error setting up test database:', error.message);
  process.exit(1);
}
