import Database from 'better-sqlite3';
import { runMigrations } from './schema';
import { WorldRepository } from './worldRepository';
import { RoleRepository } from './roleRepository';
import { TokenRepository } from './tokenRepository';
import { HighPriorityRepository } from './highPriorityRepository';

describe('high priority worlds', () => {
  let db: Database.Database;

  beforeEach(() => {
    db = new Database(':memory:');
    db.pragma('foreign_keys = ON');
    runMigrations(db);
  });

  afterEach(() => {
    db.close();
  });

  function addWorld(worldId: string, guildId: string): void {
    new WorldRepository(db).upsert({
      worldId,
      guildId,
      messageId: '1250000000000000000',
      name: 'Test World',
      authorName: 'Test Author',
      capacity: 16,
      platforms: ['standalonewindows'],
      tags: [],
      imageUrl: null,
      sourceContent: null,
      vrchatData: null,
      packageSizes: []
    });
  }

  test('add inserts a row and reports added: true', () => {
    addWorld('wrld_abc', 'guild-1');
    const repo = new HighPriorityRepository(db);
    expect(repo.add('wrld_abc', 'guild-1')).toEqual({ added: true });
  });

  test('add is idempotent', () => {
    addWorld('wrld_abc', 'guild-1');
    const repo = new HighPriorityRepository(db);
    expect(repo.add('wrld_abc', 'guild-1')).toEqual({ added: true });
    expect(repo.add('wrld_abc', 'guild-1')).toEqual({ added: false });
  });

  test('remove deletes a row and reports removed: true', () => {
    addWorld('wrld_abc', 'guild-1');
    const repo = new HighPriorityRepository(db);
    repo.add('wrld_abc', 'guild-1');
    expect(repo.remove('wrld_abc', 'guild-1')).toEqual({ removed: true });
  });

  test('remove is idempotent', () => {
    addWorld('wrld_abc', 'guild-1');
    const repo = new HighPriorityRepository(db);
    expect(repo.remove('wrld_abc', 'guild-1')).toEqual({ removed: false });
  });

  test('persists added_by_token_id', () => {
    addWorld('wrld_abc', 'guild-1');
    const roles = new RoleRepository(db);
    const viewer = roles.findByName('viewer')!;
    const { record } = new TokenRepository(db).create('hp-token', viewer);
    const repo = new HighPriorityRepository(db);
    repo.add('wrld_abc', 'guild-1', record.id);
    const row = db
      .prepare(
        'SELECT added_by_token_id FROM high_priority_worlds WHERE world_id = ? AND guild_id = ?'
      )
      .get('wrld_abc', 'guild-1') as { added_by_token_id: number | null };
    expect(row.added_by_token_id).toBe(record.id);
  });

  test('row cascades away when the world_records row is deleted', () => {
    addWorld('wrld_abc', 'guild-1');
    const repo = new HighPriorityRepository(db);
    repo.add('wrld_abc', 'guild-1');
    new WorldRepository(db).deleteByWorldAndGuild('wrld_abc', 'guild-1');
    const count = db
      .prepare('SELECT COUNT(*) as count FROM high_priority_worlds')
      .get() as { count: number };
    expect(count.count).toBe(0);
  });
});
