import { PrismaClient } from '@prisma/client';
import { mockDeep, mockReset, DeepMockProxy } from 'vitest-mock-extended';
import { vi, beforeEach } from 'vitest';

export const mockPrisma = mockDeep<PrismaClient>();

// Mock the PrismaClient constructor inside @prisma/client
vi.mock('@prisma/client', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@prisma/client')>();
  return {
    ...actual,
    PrismaClient: vi.fn().mockImplementation(function (this: any) {
      return mockPrisma;
    })
  };
});

beforeEach(() => {
  mockReset(mockPrisma);
});
