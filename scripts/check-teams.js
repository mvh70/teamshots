#!/usr/bin/env node
import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

async function main() {
  const teams = await prisma.team.findMany({
    select: {
      id: true,
      name: true,
      adminId: true,
      createdAt: true,
      _count: {
        select: {
          teamMembers: true
        }
      }
    },
    orderBy: {
      createdAt: 'desc'
    }
  })
  
  console.log(`Found ${teams.length} team(s):`)
  teams.forEach(team => {
    console.log(`  - Team ${team.id}:`)
    console.log(`    Name: ${team.name === null ? '[NULL - needs setup]' : `"${team.name}"`}`)
    console.log(`    Admin ID: ${team.adminId}`)
    console.log(`    Members: ${team._count.teamMembers}`)
    console.log(`    Created: ${team.createdAt.toISOString()}`)
    console.log()
  })
}

main()
  .catch((error) => {
    console.error('Error:', error)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })

