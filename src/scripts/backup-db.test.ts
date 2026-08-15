import fs from 'fs';
import os from 'os';
import path from 'path';
import zlib from 'zlib';
import Database from 'better-sqlite3';
import { createBackup } from './backup-db';

describe('createBackup', () => {
  const now = new Date(2026, 7, 15, 12, 0, 0);
  const dayMs = 24 * 60 * 60 * 1000;
  let tmpDir: string;
  let dbPath: string;

  beforeAll(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'backup-test-'));
    dbPath = path.join(tmpDir, 'source.db');
    const db = new Database(dbPath);
    db.exec('CREATE TABLE items (id INTEGER PRIMARY KEY, name TEXT NOT NULL)');
    const insert = db.prepare('INSERT INTO items (name) VALUES (?)');
    insert.run('alpha');
    insert.run('beta');
    insert.run('gamma');
    db.close();
  });

  afterAll(() => {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  test('writes a gzipped backup and prunes expired files', async () => {
    const backupDir = path.join(tmpDir, 'backups');
    fs.mkdirSync(backupDir, { recursive: true });

    const oldFile = path.join(backupDir, 'worlds-2026-07-01-000000.db.gz');
    const freshFile = path.join(backupDir, 'worlds-2026-08-10-000000.db.gz');
    const strayFile = path.join(backupDir, 'notes.txt');
    fs.writeFileSync(oldFile, 'stale');
    fs.writeFileSync(freshFile, 'recent');
    fs.writeFileSync(strayFile, 'not a backup');
    const oldMtime = new Date(now.getTime() - 15 * dayMs);
    fs.utimesSync(oldFile, oldMtime, oldMtime);
    const freshMtime = new Date(now.getTime() - dayMs);
    fs.utimesSync(freshFile, freshMtime, freshMtime);

    const result = await createBackup({
      dbPath,
      backupDir,
      retentionDays: 14,
      now
    });

    expect(result.file).toBe(
      path.join(backupDir, 'worlds-2026-08-15-120000.db.gz')
    );
    expect(fs.existsSync(result.file)).toBe(true);
    expect(fs.statSync(result.file).size).toBeGreaterThan(0);
    expect(fs.existsSync(result.file.replace(/\.gz$/, ''))).toBe(false);
    expect(fs.existsSync(oldFile)).toBe(false);
    expect(fs.existsSync(freshFile)).toBe(true);
    expect(fs.existsSync(strayFile)).toBe(true);
    expect(result.pruned).toBe(1);
    expect(result.kept).toBe(2);

    const raw = zlib.gunzipSync(fs.readFileSync(result.file));
    expect(raw.subarray(0, 16).toString('latin1')).toBe(
      'SQLite format 3\u0000'
    );
  });

  test('normalizes a WAL-mode snapshot to rollback mode without sidecars', async () => {
    const walDir = path.join(tmpDir, 'wal');
    fs.mkdirSync(walDir, { recursive: true });
    const walDbPath = path.join(walDir, 'source.db');
    const walDb = new Database(walDbPath);
    walDb.pragma('journal_mode = WAL');
    walDb.exec('CREATE TABLE items (id INTEGER PRIMARY KEY)');
    walDb.prepare('INSERT INTO items (id) VALUES (?)').run(1);
    walDb.close();

    const result = await createBackup({
      dbPath: walDbPath,
      backupDir: path.join(tmpDir, 'wal-backups'),
      retentionDays: 14,
      now
    });

    const entries = fs.readdirSync(path.dirname(result.file));
    expect(
      entries.some(
        (name) => name.endsWith('.db-shm') || name.endsWith('.db-wal')
      )
    ).toBe(false);

    const restoredPath = path.join(path.dirname(result.file), 'restored.db');
    fs.writeFileSync(
      restoredPath,
      zlib.gunzipSync(fs.readFileSync(result.file))
    );
    const db = new Database(restoredPath);
    expect(db.pragma('journal_mode', { simple: true })).toBe('delete');
    expect(db.pragma('integrity_check', { simple: true })).toBe('ok');
    expect(db.prepare('SELECT COUNT(*) AS c FROM items').get()).toEqual({
      c: 1
    });
    db.close();
  });
});
