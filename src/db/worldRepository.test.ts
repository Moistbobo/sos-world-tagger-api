import Database from 'better-sqlite3';
import { runMigrations } from './schema';
import { WorldRepository } from './worldRepository';

describe('world records', () => {
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

  describe('updateQuality', () => {
    test('sets quality to good', () => {
      addWorld('wrld_abc', 'guild-1');
      const repo = new WorldRepository(db);
      expect(repo.updateQuality('wrld_abc', 'guild-1', 'good')).toBe(true);
      expect(repo.getByWorldAndGuild('wrld_abc', 'guild-1')?.quality).toBe(
        'good'
      );
    });

    test('clears quality with null', () => {
      addWorld('wrld_abc', 'guild-1');
      const repo = new WorldRepository(db);
      repo.updateQuality('wrld_abc', 'guild-1', 'good');
      expect(repo.updateQuality('wrld_abc', 'guild-1', null)).toBe(true);
      expect(
        repo.getByWorldAndGuild('wrld_abc', 'guild-1')?.quality
      ).toBeNull();
    });

    test('clearing an already-null quality reports unchanged', () => {
      addWorld('wrld_abc', 'guild-1');
      const repo = new WorldRepository(db);
      expect(repo.updateQuality('wrld_abc', 'guild-1', null)).toBe(false);
    });

    test('returns false when the world does not exist', () => {
      const repo = new WorldRepository(db);
      expect(repo.updateQuality('wrld_abc', 'guild-1', 'good')).toBe(false);
    });
  });
});
