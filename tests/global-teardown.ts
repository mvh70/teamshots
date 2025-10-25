import { FullConfig } from '@playwright/test';
import { execSync } from 'child_process';

const TEST_DB_NAME = 'teamshots_test';

async function globalTeardown(config: FullConfig) {
  console.log('🧹 Cleaning up test database...');
  
  try {
    // First, terminate all connections to the test database
    console.log(`Terminating connections to test database: ${TEST_DB_NAME}`);
    try {
      execSync(`psql -d postgres -c "SELECT pg_terminate_backend(pid) FROM pg_stat_activity WHERE datname = '${TEST_DB_NAME}' AND pid <> pg_backend_pid();"`, { stdio: 'inherit' });
    } catch (error) {
      console.log('No active connections to terminate, continuing...');
    }
    
    // Wait a moment for connections to close
    await new Promise(resolve => setTimeout(resolve, 1000));
    
    // Drop test database to clean up
    console.log(`Dropping test database: ${TEST_DB_NAME}`);
    execSync(`dropdb ${TEST_DB_NAME} --if-exists`, { stdio: 'inherit' });
    
    console.log('✅ Test database cleanup complete!');
    
  } catch (error) {
    console.error('❌ Error cleaning up test database:', error);
    // Don't throw error in teardown to avoid masking test failures
  }
}

export default globalTeardown;
