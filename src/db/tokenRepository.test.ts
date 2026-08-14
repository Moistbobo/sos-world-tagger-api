import Database from 'better-sqlite3';
import { runMigrations } from './schema';
import { RoleRepository } from './roleRepository';
import { TokenRepository, hashToken } from './tokenRepository';

describe('roles', () => {
  let db: Database.Database;

  beforeEach(() => {
    db = new Database(':memory:');
    runMigrations(db);
  });

  afterEach(() => {
    db.close();
  });

  test('seeds viewer, curator, admin roles', () => {
    const repo = new RoleRepository(db);
    const roles = repo.list();
    const names = roles.map((r) => r.name).sort();
    expect(names).toEqual(['admin', 'curator', 'viewer']);
    expect(roles.find((r) => r.name === 'viewer')?.permissions).toEqual([
      'worlds:read',
      'tags:read',
      'meta:read'
    ]);
    expect(roles.find((r) => r.name === 'curator')?.permissions).toContain(
      'worlds:write'
    );
    expect(roles.find((r) => r.name === 'admin')?.permissions).toContain(
      'worlds:write'
    );
  });

  test('create adds a role with the given permissions', () => {
    const repo = new RoleRepository(db);
    const role = repo.create('curator-v2', ['worlds:read', 'worlds:write']);
    expect(role.permissions).toEqual(['worlds:read', 'worlds:write']);
    expect(repo.findByName('curator-v2')).toMatchObject({
      name: 'curator-v2'
    });
  });

  test('create rejects a duplicate name', () => {
    const repo = new RoleRepository(db);
    expect(() => repo.create('viewer', ['worlds:read'])).toThrow(
      'already exists'
    );
  });

  test('create rejects unknown permissions', () => {
    const repo = new RoleRepository(db);
    expect(() =>
      repo.create('bogus', ['worlds:read', 'does:not-exist'] as never)
    ).toThrow('Unknown permission');
  });

  test('updatePermissions adds and removes, ignoring no-ops', () => {
    const repo = new RoleRepository(db);
    const updated = repo.updatePermissions(
      'viewer',
      ['worlds:write'],
      ['meta:read', 'meta:read']
    );
    expect(updated?.permissions).toEqual([
      'worlds:read',
      'tags:read',
      'worlds:write'
    ]);
    expect(repo.findByName('viewer')?.permissions).toEqual(
      updated?.permissions
    );
  });

  test('updatePermissions returns undefined for a missing role', () => {
    const repo = new RoleRepository(db);
    expect(repo.updatePermissions('nope', [], [])).toBeUndefined();
  });
});

describe('api tokens', () => {
  let db: Database.Database;
  let roles: RoleRepository;

  beforeEach(() => {
    db = new Database(':memory:');
    runMigrations(db);
    roles = new RoleRepository(db);
  });

  afterEach(() => {
    db.close();
  });

  test('create returns a raw token whose hash can look it up', () => {
    const repo = new TokenRepository(db);
    const viewer = roles.findByName('viewer')!;
    const { rawToken, record } = repo.create('bot', viewer);

    expect(rawToken).toMatch(/^[0-9a-f]{64}$/);
    expect(record.name).toBe('bot');
    expect(record.roleId).toBe(viewer.id);
    expect(record.revokedAt).toBeNull();

    const found = repo.findByHash(hashToken(rawToken));
    expect(found).toMatchObject({ name: 'bot' });
    expect(found?.role.permissions).toEqual(viewer.permissions);
  });

  test('create rejects a duplicate name', () => {
    const repo = new TokenRepository(db);
    const viewer = roles.findByName('viewer')!;
    repo.create('bot', viewer);
    expect(() => repo.create('bot', viewer)).toThrow('already exists');
  });

  test('generateRawToken produces unique tokens', () => {
    const repo = new TokenRepository(db);
    const viewer = roles.findByName('viewer')!;
    const a = repo.create('a', viewer).rawToken;
    const b = repo.create('b', viewer).rawToken;
    expect(a).not.toBe(b);
  });

  test('findByHash returns undefined for an unknown hash', () => {
    const repo = new TokenRepository(db);
    expect(repo.findByHash('0'.repeat(64))).toBeUndefined();
  });

  test('revoke is idempotent and marks the token', () => {
    const repo = new TokenRepository(db);
    const viewer = roles.findByName('viewer')!;
    const { record } = repo.create('bot', viewer);
    expect(repo.revoke('bot')).toBe(true);
    expect(repo.revoke('bot')).toBe(false);
    expect(repo.findByName('bot')?.revokedAt).not.toBeNull();
    expect(record.revokedAt).toBeNull();
  });

  test('touchLastUsed updates the timestamp', () => {
    const repo = new TokenRepository(db);
    const viewer = roles.findByName('viewer')!;
    const { record } = repo.create('bot', viewer);
    expect(record.lastUsedAt).toBeNull();
    repo.touchLastUsed(record.id, 1234567890);
    expect(repo.findByName('bot')?.lastUsedAt).toBe(1234567890);
  });

  test('list returns tokens with their roles', () => {
    const repo = new TokenRepository(db);
    const viewer = roles.findByName('viewer')!;
    repo.create('bot', viewer);
    repo.create('dash', viewer);
    expect(
      repo
        .list()
        .map((t) => t.name)
        .sort()
    ).toEqual(['bot', 'dash']);
    expect(repo.list()[0].role.name).toBe('viewer');
  });
});
