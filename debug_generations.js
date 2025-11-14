import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

async function checkGenerations() {
  try {
    // Get user data
    const user = await prisma.user.findUnique({
      where: { email: 'mvhaperen70@gmail.com' },
      include: {
        person: {
          include: {
            generations: {
              select: {
                id: true,
                status: true,
                deleted: true,
                createdAt: true
              }
            },
            _count: {
              select: {
                generations: true
              }
            }
          }
        }
      }
    })
    
    if (!user?.person) {
      console.log('User or person not found')
      return
    }
    
    console.log('=== Generation Analysis ===')
    console.log(`Person generations count: ${user.person._count.generations}`)
    console.log(`Actual generations array length: ${user.person.generations.length}`)
    
    // Check deleted vs non-deleted
    const deleted = user.person.generations.filter(g => g.deleted)
    const active = user.person.generations.filter(g => !g.deleted)
    
    console.log(`Deleted generations: ${deleted.length}`)
    console.log(`Active generations: ${active.length}`)
    
    // Show some recent generations
    console.log('\n=== Recent Generations ===')
    const recentGenerations = user.person.generations
      .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt))
      .slice(0, 10)
    
    recentGenerations.forEach((gen, i) => {
      console.log(`${i + 1}. ID: ${gen.id}, Status: ${gen.status}, Deleted: ${gen.deleted}, Created: ${gen.createdAt}`)
    })
    
  } catch (error) {
    console.error('Error:', error)
  } finally {
    await prisma.$disconnect()
  }
}

checkGenerations()
