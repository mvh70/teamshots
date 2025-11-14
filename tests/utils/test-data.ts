import { PrismaClient, Prisma, Selfie, Generation } from '@prisma/client';

const prisma = new PrismaClient();

export interface TestUser {
  id: string;
  email: string;
  name: string;
  credits: number;
  teamId?: string;
  role?: string;
}

export interface TestTeam {
  id: string;
  name: string;
  domain: string;
  credits: number;
}

export class TestDataManager {
  private testUsers: TestUser[] = [];
  private testCompanies: TestTeam[] = [];

  async createTestUser(overrides: Partial<TestUser> = {}): Promise<TestUser> {
    const user = await prisma.user.create({
      data: {
        id: `test-user-${Date.now()}`,
        email: `test-${Date.now()}@example.com`,
        ...overrides,
      },
    });

    this.testUsers.push(user as unknown as TestUser);
    return user as unknown as TestUser;
  }

  async createTestTeam(overrides: Partial<TestTeam> = {}): Promise<TestTeam> {
    // Create or get admin user
    const adminUser = await prisma.user.create({
      data: {
        id: `test-admin-${Date.now()}`,
        email: `admin-${Date.now()}@testteam.com`,
      },
    });

    const team = await prisma.team.create({
      data: {
        id: `test-team-${Date.now()}`,
        name: 'Test Team',
        domain: 'testteam.com',
        adminId: adminUser.id,
        ...overrides,
      },
    });

    this.testCompanies.push(team as unknown as TestTeam);
    return team as unknown as TestTeam;
  }

  async createTestSelfie(personId: string, overrides: Partial<Prisma.SelfieCreateInput> = {}): Promise<Selfie> {
    return await prisma.selfie.create({
      data: {
        id: `test-selfie-${Date.now()}`,
        person: {
          connect: { id: personId }
        },
        key: `test-selfie-key-${Date.now()}`,
        validated: true,
        ...overrides,
      },
    });
  }

  async createTestGeneration(personId: string, selfieId: string, overrides: Partial<Prisma.GenerationCreateInput> = {}): Promise<Generation> {
    return await prisma.generation.create({
      data: {
        id: `test-generation-${Date.now()}`,
        person: {
          connect: { id: personId }
        },
        selfie: {
          connect: { id: selfieId }
        },
        uploadedPhotoKey: `test-uploaded-${Date.now()}`,
        generatedPhotoKeys: [],
        status: 'completed',
        ...overrides,
      },
    });
  }

  async cleanup(): Promise<void> {
    // Clean up test data in reverse order to handle dependencies
    for (const user of this.testUsers) {
      await prisma.user.deleteMany({
        where: { id: user.id },
      });
    }

    for (const team of this.testCompanies) {
      await prisma.team.deleteMany({
        where: { id: team.id },
      });
    }

    this.testUsers = [];
    this.testCompanies = [];
  }

  async resetDatabase(): Promise<void> {
    // Reset all test-related data
    await prisma.generation.deleteMany({
      where: { id: { startsWith: 'test-' } },
    });
    
    await prisma.selfie.deleteMany({
      where: { id: { startsWith: 'test-' } },
    });
    
    await prisma.user.deleteMany({
      where: { id: { startsWith: 'test-' } },
    });
    
    await prisma.team.deleteMany({
      where: { id: { startsWith: 'test-' } },
    });
  }
}

export const testDataManager = new TestDataManager();

// Test data fixtures
export const testFixtures = {
  users: {
    standard: {
      email: 'test-user@example.com',
      name: 'Test User',
      credits: 10,
    },
    noCredits: {
      email: 'no-credits@example.com',
      name: 'No Credits User',
      credits: 0,
    },
    teamAdmin: {
      email: 'admin@testteam.com',
      name: 'Team Admin',
      teamId: 'test-team-id',
      role: 'team_admin',
    },
  },
  companies: {
    standard: {
      id: 'test-team-id',
      name: 'Test Team',
      domain: 'testteam.com',
      credits: 100,
    },
  },
  files: {
    validSelfie: 'tests/fixtures/valid-selfie.jpg',
    invalidFile: 'tests/fixtures/invalid-file.txt',
    noFaceImage: 'tests/fixtures/no-face.jpg',
    multipleFaces: 'tests/fixtures/multiple-faces.jpg',
  },
};

// Helper functions for test setup
export async function setupTestUser(overrides: Partial<TestUser> = {}): Promise<TestUser> {
  return await testDataManager.createTestUser(overrides);
}

export async function setupTestTeam(overrides: Partial<TestTeam> = {}): Promise<TestTeam> {
  return await testDataManager.createTestTeam(overrides);
}

export async function setupTestSelfie(personId: string, overrides: Partial<Prisma.SelfieCreateInput> = {}): Promise<Selfie> {
  return await testDataManager.createTestSelfie(personId, overrides);
}

export async function cleanupTestData(): Promise<void> {
  await testDataManager.cleanup();
}

export async function resetTestDatabase(): Promise<void> {
  await testDataManager.resetDatabase();
}
