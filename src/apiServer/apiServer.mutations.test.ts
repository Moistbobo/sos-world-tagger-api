import { Express } from 'express';
import request from 'supertest';

jest.mock('../config', () => ({
  __esModule: true,
  default: {
    API_PORT: 3000,
    API_HOST: '0.0.0.0',
    API_ALLOWED_ORIGINS: [],
    API_ALLOWED_IPS: [],
    DISABLE_API_RESTRICTIONS: false
  }
}));

jest.mock('../db/worldRepository', () => ({
  getWorldRepository: jest.fn()
}));

jest.mock('../db/tokenRepository', () => ({
  __esModule: true,
  getTokenRepository: jest.fn(),
  hashToken: jest.fn((token: string) => token)
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
  ensureAuthenticated: jest.fn(),
  vrchat: { client: {} }
}));

import { getWorldRepository } from '../db/worldRepository';
import { getTokenRepository } from '../db/tokenRepository';
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
  let app: Express;

  function mockTokenRepo(
    permissions: string[] = [
      'worlds:read',
      'tags:read',
      'meta:read',
      'worlds:write'
    ]
  ) {
    asMock(getTokenRepository).mockReturnValue({
      findByHash: jest.fn(() => ({
        id: 1,
        tokenHash: 'test-token',
        name: 'test-token',
        roleId: 1,
        role: { id: 1, name: 'admin', permissions, createdAt: 0 },
        createdAt: 0,
        lastUsedAt: null,
        revokedAt: null
      })),
      touchLastUsed: jest.fn()
    });
  }

  beforeEach(() => {
    mockTokenRepo();
    app = createApiServer();
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('POST /api/worlds', () => {
    it('returns 401 without a token', async () => {
      const response = await request(app).post('/api/worlds').send(VALID_BODY);

      expect(response.status).toBe(401);
    });

    it('returns 403 when the token lacks worlds:write', async () => {
      mockTokenRepo(['worlds:read']);

      const response = await request(app)
        .post('/api/worlds')
        .set(AUTH)
        .send(VALID_BODY);

      expect(response.status).toBe(403);
      expect(response.body).toEqual({ error: 'Forbidden' });
    });

    it('returns 400 on invalid body', async () => {
      const response = await request(app)
        .post('/api/worlds')
        .set(AUTH)
        .send({ guildId: 'guild-1' });

      expect(response.status).toBe(400);
      expect(response.body.error).toContain('Invalid body');
    });

    it('returns 400 on malformed worldId', async () => {
      const response = await request(app)
        .post('/api/worlds')
        .set(AUTH)
        .send({ ...VALID_BODY, worldId: 'not-a-world-id' });

      expect(response.status).toBe(400);
    });

    it('returns 201 with full record (including guildId/messageId/vrchatData) when new', async () => {
      asMock(addWorld).mockResolvedValue({
        status: 'created',
        world: {
          worldId: VALID_BODY.worldId,
          guildId: VALID_BODY.guildId,
          messageId: VALID_BODY.messageId,
          name: 'Midnight Bar',
          authorName: 'VRChat',
          capacity: 40,
          platforms: ['standalonewindows'],
          tags: ['horror', 'game'],
          imageUrl: 'https://example.com/img.png',
          sourceContent: 'original message',
          vrchatData: '{"id":"wrld_x"}',
          quality: null,
          createdAt: 1717257600,
          updatedAt: 1717257600,
          internalAddDate: 1717257600
        }
      });

      const response = await request(app)
        .post('/api/worlds')
        .set(AUTH)
        .send(VALID_BODY);

      expect(response.status).toBe(201);
      const body = response.body;
      expect(body.duplicate).toBe(false);
      expect(body.world.worldId).toBe(VALID_BODY.worldId);
      expect(body.world.name).toBe('Midnight Bar');
      expect(body.world.guildId).toBe(VALID_BODY.guildId);
      expect(body.world.messageId).toBe(VALID_BODY.messageId);
      expect(body.world.vrchatData).toBe('{"id":"wrld_x"}');
      expect(body.world.tags).toEqual(['horror', 'game']);
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

      const response = await request(app)
        .post('/api/worlds')
        .set(AUTH)
        .send(VALID_BODY);

      expect(response.status).toBe(200);
      const body = response.body;
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

      const response = await request(app)
        .post('/api/worlds')
        .set(AUTH)
        .send(VALID_BODY);

      expect(response.status).toBe(502);
      expect(response.body).toEqual({
        error: 'Failed to fetch world data from VRChat'
      });
    });
  });

  describe('DELETE /api/worlds/:worldId', () => {
    it('deletes the record and returns 204', async () => {
      asMock(getWorldRepository).mockReturnValue(
        createMockRepo({ deleteByWorldAndGuild: jest.fn(() => true) })
      );

      const response = await request(app)
        .delete(`/api/worlds/${VALID_BODY.worldId}`)
        .set(AUTH)
        .send({ guildId: 'guild-1' });

      expect(response.status).toBe(204);
    });

    it('returns 404 when record does not exist', async () => {
      asMock(getWorldRepository).mockReturnValue(
        createMockRepo({ deleteByWorldAndGuild: jest.fn(() => false) })
      );

      const response = await request(app)
        .delete(`/api/worlds/${VALID_BODY.worldId}`)
        .set(AUTH)
        .send({ guildId: 'guild-1' });

      expect(response.status).toBe(404);
    });

    it('returns 400 when guildId is missing', async () => {
      const response = await request(app)
        .delete(`/api/worlds/${VALID_BODY.worldId}`)
        .set(AUTH)
        .send({});

      expect(response.status).toBe(400);
    });
  });

  describe('PUT /api/worlds/:worldId/quality', () => {
    it('updates quality and returns 200 with updated: true', async () => {
      asMock(getWorldRepository).mockReturnValue(
        createMockRepo({
          getByWorldAndGuild: jest.fn(() => ({})),
          updateQuality: jest.fn(() => true)
        })
      );

      const response = await request(app)
        .put(`/api/worlds/${VALID_BODY.worldId}/quality`)
        .set(AUTH)
        .send({ guildId: 'guild-1', quality: 'good' });

      expect(response.status).toBe(200);
      expect(response.body).toEqual({ updated: true });
    });

    it('returns 200 with updated: false when quality is unchanged', async () => {
      asMock(getWorldRepository).mockReturnValue(
        createMockRepo({
          getByWorldAndGuild: jest.fn(() => ({})),
          updateQuality: jest.fn(() => false)
        })
      );

      const response = await request(app)
        .put(`/api/worlds/${VALID_BODY.worldId}/quality`)
        .set(AUTH)
        .send({ guildId: 'guild-1', quality: 'bad' });

      expect(response.status).toBe(200);
      expect(response.body).toEqual({ updated: false });
    });

    it('returns 400 on invalid quality value', async () => {
      const response = await request(app)
        .put(`/api/worlds/${VALID_BODY.worldId}/quality`)
        .set(AUTH)
        .send({ guildId: 'guild-1', quality: 'amazing' });

      expect(response.status).toBe(400);
    });

    it('returns 404 when world does not exist', async () => {
      asMock(getWorldRepository).mockReturnValue(
        createMockRepo({ getByWorldAndGuild: jest.fn(() => undefined) })
      );

      const response = await request(app)
        .put(`/api/worlds/${VALID_BODY.worldId}/quality`)
        .set(AUTH)
        .send({ guildId: 'guild-1', quality: 'bad' });

      expect(response.status).toBe(404);
    });
  });

  describe('PUT /api/worlds/:worldId/tags', () => {
    it('updates tags and returns 200 with updated: true', async () => {
      asMock(getWorldRepository).mockReturnValue(
        createMockRepo({
          getByWorldAndGuild: jest.fn(() => ({})),
          updateTags: jest.fn(() => true)
        })
      );

      const response = await request(app)
        .put(`/api/worlds/${VALID_BODY.worldId}/tags`)
        .set(AUTH)
        .send({
          guildId: 'guild-1',
          tags: ['horror', 'game'],
          sourceContent: 'some source'
        });

      expect(response.status).toBe(200);
      expect(response.body).toEqual({ updated: true });
    });

    it('returns 400 when tags is not an array of strings', async () => {
      const response = await request(app)
        .put(`/api/worlds/${VALID_BODY.worldId}/tags`)
        .set(AUTH)
        .send({ guildId: 'guild-1', tags: 'horror' });

      expect(response.status).toBe(400);
    });

    it('returns 404 when world does not exist', async () => {
      asMock(getWorldRepository).mockReturnValue(
        createMockRepo({ getByWorldAndGuild: jest.fn(() => undefined) })
      );

      const response = await request(app)
        .put(`/api/worlds/${VALID_BODY.worldId}/tags`)
        .set(AUTH)
        .send({
          guildId: 'guild-1',
          tags: ['horror'],
          sourceContent: null
        });

      expect(response.status).toBe(404);
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
      getAllWorldGuildPairs: jest.fn(() => new Set()),
      ...overrides
    };
  }
});
