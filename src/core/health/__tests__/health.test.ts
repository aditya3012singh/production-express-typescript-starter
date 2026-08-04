import { describe, it, expect, vi } from 'vitest';
import request from 'supertest';
import app from '../../../app.js';

// Mock health check service so we don't connect to real services during testing
vi.mock('../healthCheck.js', () => ({
  default: {
    getHealthStatus: vi.fn().mockResolvedValue({
      status: 'healthy',
      timestamp: new Date().toISOString(),
      checks: {
        redis: { status: 'healthy', connected: true },
        queue: { status: 'healthy' },
        database: { status: 'healthy', connected: true }
      }
    }),
    getLastCheck: vi.fn().mockReturnValue(null)
  }
}));

describe('GET /api/health', () => {
  it('should return a 200 and healthy status details', async () => {
    const response = await request(app)
      .get('/api/health')
      .expect('Content-Type', /json/)
      .expect(200);

    expect(response.body).toBeDefined();
    expect(response.body.status).toBe('healthy');
    expect(response.body.checks.redis.status).toBe('healthy');
    expect(response.body.checks.database.status).toBe('healthy');
  });
});
