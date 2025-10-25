import { FullConfig } from '@playwright/test';
import { execSync } from 'child_process';
import dotenv from 'dotenv';

const TEST_DB_NAME = 'teamshots_test';
const TEST_DB_URL = `postgresql://postgres:postgres@localhost:5432/${TEST_DB_NAME}?schema=public`;

async function globalSetup(config: FullConfig) {
  console.log('🧪 Setting up test database for E2E tests...');
  
  try {
    // Load test environment variables
    dotenv.config({ path: '.env.test' });
    
    // Set test database URL for the entire test environment
    process.env.DATABASE_URL = TEST_DB_URL;
    
    // Also set it in the global environment so the Next.js server uses it
    global.process = global.process || process;
    global.process.env.DATABASE_URL = TEST_DB_URL;
    
    // Create test database if it doesn't exist
    console.log(`Creating test database: ${TEST_DB_NAME}`);
    try {
      execSync(`createdb ${TEST_DB_NAME}`, { stdio: 'inherit' });
    } catch (error) {
      // Database might already exist, that's okay
      console.log('Test database might already exist, continuing...');
    }
    
    // Run migrations on test database
    console.log('Running migrations on test database...');
    execSync('npx prisma migrate deploy', { 
      stdio: 'inherit',
      env: { ...process.env, DATABASE_URL: TEST_DB_URL }
    });
    
    // Generate Prisma client
    console.log('Generating Prisma client...');
    execSync('npx prisma generate', { stdio: 'inherit' });
    
    console.log('✅ Test database setup complete!');
    console.log(`Test database URL: ${TEST_DB_URL}`);
    
  } catch (error) {
    console.error('❌ Error setting up test database:', error);
    throw error;
  }
}

export default globalSetup;
