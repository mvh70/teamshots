#!/usr/bin/env node

/**
 * Development Database Reset Script
 * 
 * This script resets the development database by dropping and recreating it
 * with fresh migrations. Use with caution - this will delete all data!
 */

const { execSync } = require('child_process');

// Get the database name from DATABASE_URL or use default
const getDbName = () => {
  try {
    // Try to read from .env file if it exists
    const fs = require('fs');
    const path = require('path');
    const envPath = path.join(process.cwd(), '.env');
    
    if (fs.existsSync(envPath)) {
      const envContent = fs.readFileSync(envPath, 'utf-8');
      const dbUrlMatch = envContent.match(/DATABASE_URL=(.+)/);
      if (dbUrlMatch) {
        const dbUrl = dbUrlMatch[1].trim().replace(/^"|"$/g, '');
        const dbNameMatch = dbUrl.match(/\/\/([^:]+):([^@]+)@[^:]+:\d+\/([^?]+)/);
        if (dbNameMatch) {
          return dbNameMatch[3];
        }
      }
    }
  } catch (error) {
    console.log('Could not read .env file, using defaults');
  }
  
  // Default database name (Docker Compose or common local setup)
  return 'teamshots';
};

const DEV_DB_NAME = getDbName();

async function resetDatabase() {
  console.log('⚠️  WARNING: This will delete ALL data in your development database!');
  console.log(`Database: ${DEV_DB_NAME}`);
  console.log('Press Ctrl+C to cancel, or wait 5 seconds to continue...\n');

  // Wait 5 seconds for user to cancel
  await new Promise(resolve => setTimeout(resolve, 5000));

  console.log('🧹 Resetting development database...\n');

  try {
    // First, terminate all connections to the database
    console.log(`Terminating connections to database: ${DEV_DB_NAME}`);
    try {
      execSync(`psql -d postgres -c "SELECT pg_terminate_backend(pid) FROM pg_stat_activity WHERE datname = '${DEV_DB_NAME}' AND pid <> pg_backend_pid();"`, { stdio: 'inherit' });
    } catch (error) {
      console.log('No active connections to terminate, continuing...');
    }
    
    // Wait a moment for connections to close
    await new Promise(resolve => setTimeout(resolve, 1000));
    
    // Drop database (handles both local PostgreSQL and Docker scenarios)
    console.log(`Dropping database: ${DEV_DB_NAME}`);
    try {
      execSync(`dropdb ${DEV_DB_NAME} --if-exists`, { stdio: 'inherit' });
    } catch (error) {
      console.log('⚠️  Could not drop with dropdb. Trying via psql...');
      execSync(`psql -d postgres -c "DROP DATABASE IF EXISTS ${DEV_DB_NAME};"`, { stdio: 'inherit' });
    }
    
    // Create fresh database
    console.log(`\nCreating fresh database: ${DEV_DB_NAME}`);
    try {
      execSync(`createdb ${DEV_DB_NAME}`, { stdio: 'inherit' });
    } catch (error) {
      console.log('⚠️  Could not create with createdb. Trying via psql...');
      execSync(`psql -d postgres -c "CREATE DATABASE ${DEV_DB_NAME};"`, { stdio: 'inherit' });
    }
    
    // Run migrations
    console.log('\nRunning migrations on fresh database...');
    execSync('npx prisma migrate deploy', { stdio: 'inherit' });
    
    // Generate Prisma client
    console.log('\nGenerating Prisma client...');
    execSync('npx prisma generate', { stdio: 'inherit' });
    
    console.log('\n✅ Development database reset complete!');
    
  } catch (error) {
    console.error('\n❌ Error resetting development database:', error.message);
    process.exit(1);
  }
}

// Run the function
resetDatabase();

