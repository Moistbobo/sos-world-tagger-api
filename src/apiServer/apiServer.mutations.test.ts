import { FastifyInstance } from 'fastify';

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

jest.mock('../worlds/service', () => ({
  addWorld: jest.fn(),
  WorldServiceError: class WorldServiceError extends Error {
    readonly kind: string;
    readonly statusCode: number;
    constructor(kind: string, message: string, statusCode: number) {
      super(message);
      this.kind = kind;
      this.statusCode = statusCode;
    }
  }
}));

jest.mock('../vrchat/client', () => ({
  fetchWorldData: jest.fn(),
  isCurrentUser: jest.fn(),
  vrchat: { client: {} }
}));

import { getWorldRepository } from '../db/worldRepository';
import { addWorld } from '../worlds/service';
import { createApiServer } from './index';

const asMock = <T extends (...args: any[]) => any>(fn: any) =>
  fn as jest.MockedFunction<T>;

const AUTH = { authorization: 'Bearer test-token' };

const VALID_BODY = {
  worldId: 'wrld_aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa',
  guildId: 'guild-1',
  messageId: '1250000000000000000',
  content:
    'https://vrchat.com/home/world/wrld_aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa Tags: horror, game'
};

describe('API mutations', () => {
  let app: FastifyInstance;

  beforeEach(() => {
    app = createApiServer();
  });

  afterEach(async () => {
    await app.close();
    jest.clearAllMocks();
  });

  describe('POST /api/worlds', () => {
    it('returns 401 without a token', async () => {
      const response = await app.inject({
        method: 'POST',
        url: '/api/worlds',
        payload: VALID_BODY
      });

      expect(response.statusCode).toBe(401);
    });

    it('returns 400 on invalid body', async () => {
      const response = await app.inject({
        method: 'POST',
        url: '/api/worlds',
        headers: AUTH,
        payload: { guildId: 'guild-1' }
      });

      expect(response.statusCode).toBe(400);
      expect(JSON.parse(response.body).error).toContain('Invalid body');
    });

    it('returns 400 on malformed worldId', async () => {
      const response = await app.inject({
        method: 'POST',
        url: '/api/worlds',
        headers: AUTH,
        payload: { ...VALID_BODY, worldId: 'not-a-world-id' }
      });

      expect(response.statusCode).toBe(400);
    });

    it('returns 201 created with sanitized world when new', async () => {
      asMock(addWorld).mockResolvedValue({
        status: 'created',
        world: {
          worldId: VALID_BODY.worldId,
          name: 'Midnight Bar',
          authorName: 'VRChat',
          capacity: 40,
          platforms: ['standalonewindows'],
          tags: ['horror', 'game'],
          imageUrl: 'https://example.com/img.png',
          sourceContent: null,
          vrchatData: null,
          quality: null,
          createdAt: 1717257600,
          updatedAt: 1717257600,
          guildId: VALID_BODY.guildId,
          messageId: VALID_BODY.messageId,
          internalAddDate: null
        }
      });

      const response = await app.inject({
        method: 'POST',
        url: '/api/worlds',
        headers: AUTH,
        payload: VALID_BODY
      });

      expect(response.statusCode).toBe(201);
      const body = JSON.parse(response.body);
      expect(body.duplicate).toBe(false);
      expect(body.world.worldId).toBe(VALID_BODY.worldId);
      expect(body.world.name).toBe('Midnight Bar');
      expect(body.world.guildId).toBeUndefined();
      expect(body.world.messageId).toBeUndefined();
      expect(body.world.vrchatData).toBeUndefined();
    });

    it('returns 200 duplicate with existingMessageId when world exists', async () => {
      asMock(addWorld).mockResolvedValue({
        status: 'duplicate',
        existingMessageId: '1240000000000000000',
        world: {
          worldId: VALID_BODY.worldId,
          name: 'Midnight Bar',
          authorName: 'VRChat',
          capacity: 40,
          platforms: ['standalonewindows'],
          tags: ['horror'],
          imageUrl: 'https://example.com/img.png',
          sourceContent: null,
          vrchatData: null,
          quality: null,
          createdAt: 1717257600,
          updatedAt: 1717257600,
          guildId: VALID_BODY.guildId,
          messageId: '1240000000000000000',
          internalAddDate: null
        }
      });

      const response = await app.inject({
        method: 'POST',
        url: '/api/worlds',
        headers: AUTH,
        payload: VALID_BODY
      });

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.body);
      expect(body.duplicate).toBe(true);
      expect(body.existingMessageId).toBe('1240000000000000000');
    });

    it('returns 502 when VRChat fetch fails', async () => {
      asMock(addWorld).mockRejectedValue(
        new (jest.requireMock('../worlds/service') as any).WorldServiceError(
          'vrchatFetchFailed',
          'Failed to fetch world data from VRChat',
          502
        )
      );

      const response = await app.inject({
        method: 'POST',
        url: '/api/worlds',
        headers: AUTH,
        payload: VALID_BODY
      });

      expect(response.statusCode).toBe(502);
      expect(JSON.parse(response.body)).toEqual({
        error: 'Failed to fetch world data from VRChat'
      });
    });
  });

  describe('DELETE /api/worlds/:worldId', () => {
    it('deletes the record and returns 204', async () => {
      asMock(getWorldRepository).mockReturnValue(
        createMockRepo({ deleteByWorldAndGuild: jest.fn(() => true) })
      );

      const response = await app.inject({
        method: 'DELETE',
        url: `/api/worlds/${VALID_BODY.worldId}`,
        headers: AUTH,
        payload: { guildId: 'guild-1' }
      });

      expect(response.statusCode).toBe(204);
    });

    it('returns 404 when record does not exist', async () => {
      asMock(getWorldRepository).mockReturnValue(
        createMockRepo({ deleteByWorldAndGuild: jest.fn(() => false) })
      );

      const response = await app.inject({
        method: 'DELETE',
        url: `/api/worlds/${VALID_BODY.worldId}`,
        headers: AUTH,
        payload: { guildId: 'guild-1' }
      });

      expect(response.statusCode).toBe(404);
    });

    it('returns 400 when guildId is missing', async () => {
      const response = await app.inject({
        method: 'DELETE',
        url: `/api/worlds/${VALID_BODY.worldId}`,
        headers: AUTH,
        payload: {}
      });

      expect(response.statusCode).toBe(400);
    });
  });

  describe('PUT /api/worlds/:worldId/quality', () => {
    it('updates quality and returns 200', async () => {
      asMock(getWorldRepository).mockReturnValue(
        createMockRepo({ updateQuality: jest.fn(() => true) })
      );

      const response = await app.inject({
        method: 'PUT',
        url: `/api/worlds/${VALID_BODY.worldId}/quality`,
        headers: AUTH,
        payload: { guildId: 'guild-1', quality: 'good' }
      });

      expect(response.statusCode).toBe(200);
      expect(JSON.parse(response.body)).toEqual({ updated: true });
    });

    it('returns 400 on invalid quality value', async () => {
      const response = await app.inject({
        method: 'PUT',
        url: `/api/worlds/${VALID_BODY.worldId}/quality`,
        headers: AUTH,
        payload: { guildId: 'guild-1', quality: 'amazing' }
      });

      expect(response.statusCode).toBe(400);
    });

    it('returns 404 when world does not exist', async () => {
      asMock(getWorldRepository).mockReturnValue(
        createMockRepo({ updateQuality: jest.fn(() => false) })
      );

      const response = await app.inject({
        method: 'PUT',
        url: `/api/worlds/${VALID_BODY.worldId}/quality`,
        headers: AUTH,
        payload: { guildId: 'guild-1', quality: 'bad' }
      });

      expect(response.statusCode).toBe(404);
    });
  });

  describe('PUT /api/worlds/:worldId/tags', () => {
    it('updates tags and returns 200', async () => {
      asMock(getWorldRepository).mockReturnValue(
        createMockRepo({ updateTags: jest.fn(() => true) })
      );

      const response = await app.inject({
        method: 'PUT',
        url: `/api/worlds/${VALID_BODY.worldId}/tags`,
        headers: AUTH,
        payload: {
          guildId: 'guild-1',
          tags: ['horror', 'game'],
          sourceContent: 'some source'
        }
      });

      expect(response.statusCode).toBe(200);
      expect(JSON.parse(response.body)).toEqual({ updated: true });
    });

    it('returns 400 when tags is not an array of strings', async () => {
      const response = await app.inject({
        method: 'PUT',
        url: `/api/worlds/${VALID_BODY.worldId}/tags`,
        headers: AUTH,
        payload: { guildId: 'guild-1', tags: 'horror' }
      });

      expect(response.statusCode).toBe(400);
    });

    it('returns 404 when world does not exist', async () => {
      asMock(getWorldRepository).mockReturnValue(
        createMockRepo({ updateTags: jest.fn(() => false) })
      );

      const response = await app.inject({
        method: 'PUT',
        url: `/api/worlds/${VALID_BODY.worldId}/tags`,
        headers: AUTH,
        payload: {
          guildId: 'guild-1',
          tags: ['horror'],
          sourceContent: null
        }
      });

      expect(response.statusCode).toBe(404);
    });
  });

  function createMockRepo(overrides: Record<string, unknown> = {}) {
    return {
      count: jest.fn(() => 1428),
      getAllPaginated: jest.fn(() => ({ total: 0, rows: [] })),
      getByWorldId: jest.fn(() => []),
      getUniqueTags: jest.fn(() => []),
      getMetadataCounts: jest.fn(() => ({
        qualityGood: 0,
        qualityBad: 0,
        platformDesktop: 0,
        platformAndroid: 0,
        platformiOS: 0
      })),
      ...overrides
    };
  }
});
