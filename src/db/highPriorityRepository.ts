import type Database from 'better-sqlite3';
import { getDatabase } from './index';
import logger from '../logger';

export class HighPriorityRepository {
  private db: Database.Database;

  constructor(db?: Database.Database) {
    this.db = db ?? getDatabase();
  }

  add(
    worldId: string,
    guildId: string,
    addedByTokenId?: number
  ): { added: boolean } {
    const sql =
      'INSERT OR IGNORE INTO high_priority_worlds (world_id, guild_id, added_by_token_id) VALUES (?, ?, ?)';
    const stmt = this.db.prepare(sql);
    const result = stmt.run(worldId, guildId, addedByTokenId ?? null);
    const added = result.changes > 0;
    if (added) {
      logger.info(
        `Marked world ${worldId} in guild ${guildId} as high priority`
      );
    }
    return { added };
  }

  remove(worldId: string, guildId: string): { removed: boolean } {
    const sql =
      'DELETE FROM high_priority_worlds WHERE world_id = ? AND guild_id = ?';
    const stmt = this.db.prepare(sql);
    const result = stmt.run(worldId, guildId);
    const removed = result.changes > 0;
    if (removed) {
      logger.info(
        `Removed high priority flag for world ${worldId} in guild ${guildId}`
      );
    }
    return { removed };
  }
}

let repoInstance: HighPriorityRepository | null = null;

export function getHighPriorityRepository(): HighPriorityRepository {
  if (!repoInstance) {
    repoInstance = new HighPriorityRepository();
  }
  return repoInstance;
}

export function resetHighPriorityRepository(): void {
  repoInstance = null;
}
