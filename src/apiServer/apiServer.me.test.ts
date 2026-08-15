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

jest.mock('../vrchat/client', () => ({
  fetchWorldData: jest.fn(),
  searchWorldsByName: jest.fn(),
  isCurrentUser: jest.fn(),
  ensureAuthenticated: jest.fn(),
  vrchat: { client: {} }
}));

import { getTokenRepository } from '../db/tokenRepository';
import { createApiServer } from './index';

const asMock = <T extends (...args: any[]) => any>(fn: any) =>
  fn as jest.MockedFunction<T>;

const AUTH = { authorization: 'Bearer test-token' };

describe('GET /api/me', () => {
  let app: Express;

  beforeEach(() => {
    asMock(getTokenRepository).mockReturnValue({
      findByHash: jest.fn(() => ({
        id: 1,
        tokenHash: 'test-token',
        name: 'test-token',
        roleId: 1,
        role: {
          id: 1,
          name: 'admin',
          permissions: [
            'worlds:read',
            'tags:read',
            'meta:read',
            'worlds:write'
          ],
          createdAt: 0
        },
        createdAt: 0,
        lastUsedAt: null,
        revokedAt: null
      })),
      touchLastUsed: jest.fn()
    });
    app = createApiServer();
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it('returns 401 without a token', async () => {
    const response = await request(app).get('/api/me');

    expect(response.status).toBe(401);
    expect(response.body).toEqual({ error: 'Unauthorized' });
  });

  it('returns the token name, role, and permissions', async () => {
    const response = await request(app).get('/api/me').set(AUTH);

    expect(response.status).toBe(200);
    expect(response.body).toEqual({
      name: 'test-token',
      role: 'admin',
      permissions: ['worlds:read', 'tags:read', 'meta:read', 'worlds:write']
    });
  });

  it('does not gate on permissions: viewer tokens succeed', async () => {
    asMock(getTokenRepository).mockReturnValue({
      findByHash: jest.fn(() => ({
        id: 1,
        tokenHash: 'test-token',
        name: 'test-token',
        roleId: 1,
        role: {
          id: 1,
          name: 'viewer',
          permissions: ['worlds:read', 'tags:read', 'meta:read'],
          createdAt: 0
        },
        createdAt: 0,
        lastUsedAt: null,
        revokedAt: null
      })),
      touchLastUsed: jest.fn()
    });

    const response = await request(app).get('/api/me').set(AUTH);

    expect(response.status).toBe(200);
    expect(response.body).toEqual({
      name: 'test-token',
      role: 'viewer',
      permissions: ['worlds:read', 'tags:read', 'meta:read']
    });
  });
});
