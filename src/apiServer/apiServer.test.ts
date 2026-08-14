import { Express } from 'express';
import request from 'supertest';

jest.mock('../config', () => ({
  __esModule: true,
  default: {
    API_PORT: 3000,
    API_HOST: '0.0.0.0',
    API_TOKEN: ['test-token'],
    API_ALLOWED_ORIGINS: [],
    API_ALLOWED_IPS: [],
    DISABLE_API_RESTRICTIONS: false
  }
}));

jest.mock('../db/worldRepository', () => ({
  getWorldRepository: jest.fn()
}));

jest.mock('../logger', () => ({
  __esModule: true,
  default: {
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
    debug: jest.fn()
  }
}));

jest.mock('../vrchat/client', () => ({
  fetchWorldData: jest.fn(),
  isCurrentUser: jest.fn(),
  vrchat: { client: {} }
}));

import { getWorldRepository } from '../db/worldRepository';
import { createApiServer } from './index';

const asMock = <T extends (...args: any[]) => any>(fn: any) =>
  fn as jest.MockedFunction<T>;

function createMockRepo(overrides: Record<string, unknown> = {}) {
  return {
    count: jest.fn(() => 1428),
    getAllPaginated: jest.fn(() => ({
      total: 1,
      rows: [
        {
          worldId: 'wrld_abc123',
          name: 'Spooky Mansion',
          authorName: 'GhostDev',
          capacity: 16,
          platforms: ['standalonewindows', 'android'],
          tags: ['horror', 'game'],
          imageUrl: 'https://example.com/img.png',
          sourceContent: null,
          vrchatData: null,
          quality: 'good',
          createdAt: 1717257600,
          updatedAt: 1717257600
        }
      ]
    })),
    getByWorldId: jest.fn(() => [
      {
        worldId: 'wrld_abc123',
        name: 'Spooky Mansion',
        authorName: 'GhostDev',
        capacity: 16,
        platforms: ['standalonewindows', 'android'],
        tags: ['horror', 'game'],
        imageUrl: 'https://example.com/img.png',
        sourceContent: null,
        vrchatData: null,
        quality: 'good',
        createdAt: 1717257600,
        updatedAt: 1717257600
      }
    ]),
    getUniqueTags: jest.fn(() => [
      { tag: 'horror', count: 312 },
      { tag: 'game', count: 145 }
    ]),
    getMetadataCounts: jest.fn(() => ({
      qualityGood: 123,
      qualityBad: 12,
      platformDesktop: 80,
      platformAndroid: 45,
      platformiOS: 6
    })),
    ...overrides
  };
}

describe('API Server', () => {
  let app: Express;

  beforeEach(() => {
    app = createApiServer();
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('GET /api/health', () => {
    it('returns health status without auth', async () => {
      asMock(getWorldRepository).mockReturnValue(createMockRepo());

      const response = await request(app).get('/api/health');

      expect(response.status).toBe(200);
      expect(response.body).toEqual({
        status: 'ok',
        worldCount: 1428,
        dbVersion: 1
      });
    });
  });

  describe('Auth', () => {
    it('returns 401 when auth header is missing', async () => {
      const response = await request(app).get('/api/worlds');

      expect(response.status).toBe(401);
      expect(response.body).toEqual({ error: 'Unauthorized' });
    });

    it('returns 401 when token is invalid', async () => {
      const response = await request(app)
        .get('/api/worlds')
        .set('authorization', 'Bearer wrong-token');

      expect(response.status).toBe(401);
      expect(response.body).toEqual({ error: 'Unauthorized' });
    });

    it('allows access with a valid token', async () => {
      asMock(getWorldRepository).mockReturnValue(createMockRepo());

      const response = await request(app)
        .get('/api/worlds')
        .set('authorization', 'Bearer test-token');

      expect(response.status).toBe(200);
    });
  });

  describe('GET /api/worlds', () => {
    it('returns paginated world list with sanitized fields', async () => {
      asMock(getWorldRepository).mockReturnValue(createMockRepo());

      const response = await request(app)
        .get('/api/worlds')
        .set('authorization', 'Bearer test-token');

      expect(response.status).toBe(200);
      const body = response.body;
      expect(body.total).toBe(1);
      expect(body.limit).toBe(50);
      expect(body.offset).toBe(0);
      expect(body.worlds).toHaveLength(1);

      const world = body.worlds[0];
      expect(world.worldId).toBe('wrld_abc123');
      expect(world.name).toBe('Spooky Mansion');
      expect(world.vrchatUrl).toBe('https://vrchat.com/home/world/wrld_abc123');
      expect(world.quality).toBe('good');
      expect(world.createdAt).toBe('2024-06-01T16:00:00.000Z');

      // Server-identifying fields must be stripped
      expect(world.guildId).toBeUndefined();
      expect(world.messageId).toBeUndefined();
      expect(world.sourceContent).toBeUndefined();
      expect(world.vrchatData).toBeUndefined();
    });

    it('passes tag filters to repository', async () => {
      const getAllPaginated = jest.fn(() => ({ total: 0, rows: [] }));
      asMock(getWorldRepository).mockReturnValue(
        createMockRepo({ getAllPaginated })
      );

      await request(app)
        .get('/api/worlds?tag=horror&tag=game')
        .set('authorization', 'Bearer test-token');

      expect(getAllPaginated).toHaveBeenCalledWith(
        50,
        0,
        expect.objectContaining({ tags: ['horror', 'game'] })
      );
    });

    it('caps limit at 500', async () => {
      const getAllPaginated = jest.fn(() => ({ total: 0, rows: [] }));
      asMock(getWorldRepository).mockReturnValue(
        createMockRepo({ getAllPaginated })
      );

      await request(app)
        .get('/api/worlds?limit=9999')
        .set('authorization', 'Bearer test-token');

      expect(getAllPaginated).toHaveBeenCalledWith(500, 0, undefined);
    });

    it('returns 400 when minCapacity is greater than maxCapacity', async () => {
      const response = await request(app)
        .get('/api/worlds?minCapacity=50&maxCapacity=20')
        .set('authorization', 'Bearer test-token');

      expect(response.status).toBe(400);
      expect(response.body).toEqual({
        error: 'minCapacity must be less than or equal to maxCapacity'
      });
    });

    it('returns 400 for non-integer capacity values', async () => {
      const response = await request(app)
        .get('/api/worlds?minCapacity=abc')
        .set('authorization', 'Bearer test-token');

      expect(response.status).toBe(400);
      expect(response.body).toEqual({
        error: 'minCapacity must be an integer'
      });
    });

    it('passes dayRange filter to repository', async () => {
      const getAllPaginated = jest.fn(() => ({ total: 0, rows: [] }));
      asMock(getWorldRepository).mockReturnValue(
        createMockRepo({ getAllPaginated })
      );

      await request(app)
        .get('/api/worlds?dayRange=7')
        .set('authorization', 'Bearer test-token');

      expect(getAllPaginated).toHaveBeenCalledWith(
        50,
        0,
        expect.objectContaining({ dayRange: 7 })
      );
    });
  });

  describe('GET /api/worlds/:worldId', () => {
    it('returns a single world with vrchatUrl and quality', async () => {
      asMock(getWorldRepository).mockReturnValue(createMockRepo());

      const response = await request(app)
        .get('/api/worlds/wrld_abc123')
        .set('authorization', 'Bearer test-token');

      expect(response.status).toBe(200);
      const body = response.body;
      expect(body.worldId).toBe('wrld_abc123');
      expect(body.vrchatUrl).toBe('https://vrchat.com/home/world/wrld_abc123');
      expect(body.quality).toBe('good');

      // Stripped fields
      expect(body.guildId).toBeUndefined();
      expect(body.sourceContent).toBeUndefined();
    });

    it('returns 404 when world does not exist', async () => {
      asMock(getWorldRepository).mockReturnValue(
        createMockRepo({ getByWorldId: jest.fn(() => []) })
      );

      const response = await request(app)
        .get('/api/worlds/wrld_missing')
        .set('authorization', 'Bearer test-token');

      expect(response.status).toBe(404);
      expect(response.body).toEqual({
        error: 'World not found'
      });
    });
  });

  describe('GET /api/tags', () => {
    it('returns unique tags with counts', async () => {
      asMock(getWorldRepository).mockReturnValue(createMockRepo());

      const response = await request(app)
        .get('/api/tags')
        .set('authorization', 'Bearer test-token');

      expect(response.status).toBe(200);
      expect(response.body.tags).toEqual([
        { tag: 'horror', count: 312 },
        { tag: 'game', count: 145 }
      ]);
    });
  });

  describe('GET /api/meta', () => {
    it('returns quality and platform metadata counts', async () => {
      asMock(getWorldRepository).mockReturnValue(createMockRepo());

      const response = await request(app)
        .get('/api/meta')
        .set('authorization', 'Bearer test-token');

      expect(response.status).toBe(200);
      expect(response.body).toEqual({
        qualityGood: 123,
        qualityBad: 12,
        platformDesktop: 80,
        platformAndroid: 45,
        platformiOS: 6
      });
    });
  });

  describe('Error handling', () => {
    it('returns clean JSON 404 for unmatched routes', async () => {
      const response = await request(app)
        .get('/api/not-a-route')
        .set('authorization', 'Bearer test-token');

      expect(response.status).toBe(404);
      expect(response.body).toEqual({ error: 'Not Found' });
    });

    it('sanitizes 500 errors from route handlers', async () => {
      asMock(getWorldRepository).mockReturnValue(
        createMockRepo({
          getAllPaginated: jest.fn(() => {
            throw new Error('database exploded');
          })
        })
      );

      const response = await request(app)
        .get('/api/worlds')
        .set('authorization', 'Bearer test-token');

      expect(response.status).toBe(500);
      expect(response.body.error).toBe('Internal Server Error');
      expect(response.body).not.toHaveProperty('stack');
    });
  });
});
