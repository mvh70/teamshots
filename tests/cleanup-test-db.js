#!/usr/bin/env node

/**
 * Test Database Cleanup Script
 * 
 * This script cleans up the test database after E2E tests
 * to ensure a clean state for the next test run.
 */

const { execSync } = require('child_process');

const TEST_DB_NAME = 'teamshots_test';

console.log('🧹 Cleaning up test database...');

try {
  // Drop and recreate test database
  console.log(`Dropping test database: ${TEST_DB_NAME}`);
  execSync(`dropdb ${TEST_DB_NAME} --if-exists`, { stdio: 'inherit' });
  
  console.log(`Creating fresh test database: ${TEST_DB_NAME}`);
  execSync(`createdb ${TEST_DB_NAME}`, { stdio: 'inherit' });
  
  // Set environment variable for test database
  process.env.DATABASE_URL = `postgresql://postgres:postgres@localhost:5432/${TEST_DB_NAME}?schema=public`;
  
  // Run migrations on fresh test database
  console.log('Running migrations on fresh test database...');
  execSync('npx prisma migrate deploy', { stdio: 'inherit' });
  
  console.log('✅ Test database cleanup complete!');
  
} catch (error) {
  console.error('❌ Error cleaning up test database:', error.message);
  process.exit(1);
}
