import type Database from 'better-sqlite3';
import { getDatabase } from './index';
import { parsePermissions, type Permission } from '../auth/permissions';
import logger from '../logger';

export interface RoleRecord {
  id: number;
  name: string;
  permissions: Permission[];
  createdAt: number;
}

function rowToRole(row: Record<string, unknown>): RoleRecord {
  return {
    id: row.id as number,
    name: row.name as string,
    permissions: parsePermissions(JSON.parse(row.permissions as string)),
    createdAt: row.created_at as number
  };
}

export class RoleRepository {
  private db: Database.Database;

  constructor(db?: Database.Database) {
    this.db = db ?? getDatabase();
  }

  create(name: string, permissions: Permission[]): RoleRecord {
    const exists = this.findByName(name);
    if (exists) {
      throw new Error(`Role "${name}" already exists`);
    }

    const validated = parsePermissions(permissions);
    const sql = 'INSERT INTO roles (name, permissions) VALUES (?, ?)';
    const stmt = this.db.prepare(sql);
    const result = stmt.run(name, JSON.stringify(validated));
    logger.info(
      `Created role "${name}" with permissions [${validated.join(', ')}]`
    );
    return {
      id: Number(result.lastInsertRowid),
      name,
      permissions: validated,
      createdAt: Math.floor(Date.now() / 1000)
    };
  }

  updatePermissions(
    name: string,
    add: Permission[],
    remove: Permission[]
  ): RoleRecord | undefined {
    const role = this.findByName(name);
    if (!role) return undefined;

    const validatedAdd = parsePermissions(add);
    const validatedRemove = parsePermissions(remove);
    const existing = new Set(role.permissions);
    for (const permission of validatedAdd) existing.add(permission);
    for (const permission of validatedRemove) existing.delete(permission);
    const permissions = [...existing];

    const sql = 'UPDATE roles SET permissions = ? WHERE name = ?';
    const stmt = this.db.prepare(sql);
    stmt.run(JSON.stringify(permissions), name);
    logger.info(
      `Updated role "${name}" permissions to [${permissions.join(', ')}]`
    );
    return { ...role, permissions };
  }

  findByName(name: string): RoleRecord | undefined {
    const sql = 'SELECT * FROM roles WHERE name = ? LIMIT 1';
    const stmt = this.db.prepare(sql);
    const row = stmt.get(name) as Record<string, unknown> | undefined;
    return row ? rowToRole(row) : undefined;
  }

  findById(id: number): RoleRecord | undefined {
    const sql = 'SELECT * FROM roles WHERE id = ? LIMIT 1';
    const stmt = this.db.prepare(sql);
    const row = stmt.get(id) as Record<string, unknown> | undefined;
    return row ? rowToRole(row) : undefined;
  }

  list(): RoleRecord[] {
    const sql = 'SELECT * FROM roles ORDER BY name';
    const stmt = this.db.prepare(sql);
    const rows = stmt.all() as Record<string, unknown>[];
    return rows.map(rowToRole);
  }
}

let roleRepoInstance: RoleRepository | null = null;

export function getRoleRepository(): RoleRepository {
  if (!roleRepoInstance) {
    roleRepoInstance = new RoleRepository();
  }
  return roleRepoInstance;
}

export function resetRoleRepository(): void {
  roleRepoInstance = null;
}
