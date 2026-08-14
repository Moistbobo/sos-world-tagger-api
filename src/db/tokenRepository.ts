import type Database from 'better-sqlite3';
import { randomBytes, createHash } from 'crypto';
import { getDatabase } from './index';
import { RoleRepository, type RoleRecord } from './roleRepository';
import logger from '../logger';

export interface ApiTokenRecord {
  id: number;
  tokenHash: string;
  name: string;
  roleId: number;
  role: RoleRecord;
  createdAt: number;
  lastUsedAt: number | null;
  revokedAt: number | null;
}

export function hashToken(rawToken: string): string {
  return createHash('sha256').update(rawToken).digest('hex');
}

export function generateRawToken(): string {
  return randomBytes(32).toString('hex');
}

function rowToToken(
  row: Record<string, unknown>,
  role: RoleRecord
): ApiTokenRecord {
  return {
    id: row.id as number,
    tokenHash: row.token_hash as string,
    name: row.name as string,
    roleId: row.role_id as number,
    role,
    createdAt: row.created_at as number,
    lastUsedAt: (row.last_used_at as number | null) ?? null,
    revokedAt: (row.revoked_at as number | null) ?? null
  };
}

export class TokenRepository {
  private db: Database.Database;
  private roles: RoleRepository;

  constructor(db?: Database.Database) {
    this.db = db ?? getDatabase();
    this.roles = new RoleRepository(this.db);
  }

  create(
    name: string,
    role: RoleRecord
  ): { rawToken: string; record: ApiTokenRecord } {
    const exists = this.findByName(name);
    if (exists) {
      throw new Error(`Token "${name}" already exists`);
    }

    const rawToken = generateRawToken();
    const tokenHash = hashToken(rawToken);
    const sql =
      'INSERT INTO api_tokens (token_hash, name, role_id) VALUES (?, ?, ?)';
    const stmt = this.db.prepare(sql);
    const result = stmt.run(tokenHash, name, role.id);
    logger.info(`Created token "${name}" with role "${role.name}"`);
    return {
      rawToken,
      record: {
        id: Number(result.lastInsertRowid),
        tokenHash,
        name,
        roleId: role.id,
        role,
        createdAt: Math.floor(Date.now() / 1000),
        lastUsedAt: null,
        revokedAt: null
      }
    };
  }

  findByHash(tokenHash: string): ApiTokenRecord | undefined {
    const sql = 'SELECT * FROM api_tokens WHERE token_hash = ? LIMIT 1';
    const stmt = this.db.prepare(sql);
    const row = stmt.get(tokenHash) as Record<string, unknown> | undefined;
    if (!row) return undefined;
    const role = this.roles.findById(row.role_id as number);
    if (!role) return undefined;
    return rowToToken(row, role);
  }

  findByName(name: string): ApiTokenRecord | undefined {
    const sql = 'SELECT * FROM api_tokens WHERE name = ? LIMIT 1';
    const stmt = this.db.prepare(sql);
    const row = stmt.get(name) as Record<string, unknown> | undefined;
    if (!row) return undefined;
    const role = this.roles.findById(row.role_id as number);
    if (!role) return undefined;
    return rowToToken(row, role);
  }

  touchLastUsed(id: number, now: number): void {
    this.db
      .prepare('UPDATE api_tokens SET last_used_at = ? WHERE id = ?')
      .run(now, id);
  }

  revoke(name: string): boolean {
    const token = this.findByName(name);
    if (!token || token.revokedAt !== null) return false;
    this.db
      .prepare('UPDATE api_tokens SET revoked_at = ? WHERE id = ?')
      .run(Math.floor(Date.now() / 1000), token.id);
    logger.info(`Revoked token "${name}"`);
    return true;
  }

  list(): ApiTokenRecord[] {
    const sql = 'SELECT * FROM api_tokens ORDER BY created_at';
    const stmt = this.db.prepare(sql);
    const rows = stmt.all() as Record<string, unknown>[];
    return rows
      .map((row) => {
        const role = this.roles.findById(row.role_id as number);
        if (!role) return undefined;
        return rowToToken(row, role);
      })
      .filter((token): token is ApiTokenRecord => token !== undefined);
  }
}

let tokenRepoInstance: TokenRepository | null = null;

export function getTokenRepository(): TokenRepository {
  if (!tokenRepoInstance) {
    tokenRepoInstance = new TokenRepository();
  }
  return tokenRepoInstance;
}

export function resetTokenRepository(): void {
  tokenRepoInstance = null;
}
