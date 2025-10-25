import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

export interface TestUser {
  id: string;
  email: string;
  name: string;
  credits: number;
  companyId?: string;
  role?: string;
}

export interface TestCompany {
  id: string;
  name: string;
  domain: string;
  credits: number;
}

export class TestDataManager {
  private testUsers: TestUser[] = [];
  private testCompanies: TestCompany[] = [];

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

  async createTestCompany(overrides: Partial<TestCompany> = {}): Promise<TestCompany> {
    // Create or get admin user
    const adminUser = await prisma.user.create({
      data: {
        id: `test-admin-${Date.now()}`,
        email: `admin-${Date.now()}@testcompany.com`,
      },
    });

    const company = await prisma.company.create({
      data: {
        id: `test-company-${Date.now()}`,
        name: 'Test Company',
        domain: 'testcompany.com',
        adminId: adminUser.id,
        ...overrides,
      },
    });

    this.testCompanies.push(company as unknown as TestCompany);
    return company as unknown as TestCompany;
  }

  async createTestSelfie(userId: string, overrides: any = {}): Promise<any> {
    return await prisma.selfie.create({
      data: {
        id: `test-selfie-${Date.now()}`,
        userId,
        uploadedKey: `test-selfie-key-${Date.now()}`,
        validated: true,
        ...overrides,
      },
    });
  }

  async createTestGeneration(userId: string, selfieId: string, overrides: any = {}): Promise<any> {
    return await prisma.generation.create({
      data: {
        id: `test-generation-${Date.now()}`,
        userId,
        selfieId,
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

    for (const company of this.testCompanies) {
      await prisma.company.deleteMany({
        where: { id: company.id },
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
    
    await prisma.company.deleteMany({
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
    companyAdmin: {
      email: 'admin@testcompany.com',
      name: 'Company Admin',
      companyId: 'test-company-id',
      role: 'team_admin',
    },
  },
  companies: {
    standard: {
      id: 'test-company-id',
      name: 'Test Company',
      domain: 'testcompany.com',
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

export async function setupTestCompany(overrides: Partial<TestCompany> = {}): Promise<TestCompany> {
  return await testDataManager.createTestCompany(overrides);
}

export async function setupTestSelfie(userId: string, overrides: any = {}): Promise<any> {
  return await testDataManager.createTestSelfie(userId, overrides);
}

export async function cleanupTestData(): Promise<void> {
  await testDataManager.cleanup();
}

export async function resetTestDatabase(): Promise<void> {
  await testDataManager.resetDatabase();
}
