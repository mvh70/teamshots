#!/usr/bin/env node
/**
 * Data migration: Update teams with default "My Team" name to null
 * This allows users to complete the team setup flow properly
 * 
 * Run with: node scripts/fix-team-names.js
 */

import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

async function main() {
  console.log('Starting team name migration...')
  
  // Find teams with default names or empty strings
  const teamsToUpdate = await prisma.team.findMany({
    where: {
      OR: [
        { name: 'My Team' },
        { name: 'My team' },
        { name: '' }
      ]
    },
    select: {
      id: true,
      name: true,
      adminId: true,
      createdAt: true
    }
  })
  
  console.log(`Found ${teamsToUpdate.length} team(s) with default names:`)
  teamsToUpdate.forEach(team => {
    console.log(`  - Team ${team.id}: "${team.name}" (created: ${team.createdAt.toISOString()})`)
  })
  
  if (teamsToUpdate.length === 0) {
    console.log('No teams to update. Exiting.')
    return
  }
  
  // Update teams to have null names
  const result = await prisma.team.updateMany({
    where: {
      OR: [
        { name: 'My Team' },
        { name: 'My team' },
        { name: '' }
      ]
    },
    data: {
      name: null
    }
  })
  
  console.log(`✓ Updated ${result.count} team(s) to have null names`)
  console.log('Users will now see the team setup form to choose their team name.')
}

main()
  .catch((error) => {
    console.error('Error updating team names:', error)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })

