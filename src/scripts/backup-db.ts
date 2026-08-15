import fs from 'fs';
import path from 'path';
import zlib from 'zlib';
import { pipeline } from 'stream/promises';
import Database from 'better-sqlite3';
import Config from '../config';
import logger from '../logger';

interface BackupOptions {
  dbPath: string;
  backupDir: string;
  retentionDays: number;
  now?: Date;
}

const BACKUP_FILE = /^worlds-.*\.db(\.gz)?$/;

const pad = (n: number): string => (n < 10 ? `0${n}` : String(n));

function formatTimestamp(date: Date): string {
  return (
    `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}` +
    `-${pad(date.getHours())}${pad(date.getMinutes())}${pad(date.getSeconds())}`
  );
}

export async function createBackup(
  options: BackupOptions
): Promise<{ file: string; kept: number; pruned: number }> {
  const { dbPath, backupDir, retentionDays } = options;
  const now = options.now ?? new Date();

  fs.mkdirSync(backupDir, { recursive: true });

  const rawPath = `${backupDir}/worlds-${formatTimestamp(now)}.db`;
  const gzPath = `${rawPath}.gz`;

  const source = new Database(dbPath);
  try {
    await source.backup(rawPath);

    // Normalize the snapshot to rollback mode so it stays a single portable
    // file (a WAL-mode snapshot leaves .db-shm/.db-wal sidecars behind).
    let integrity: unknown;
    const verifier = new Database(rawPath);
    try {
      verifier.pragma('journal_mode = DELETE');
      integrity = verifier.pragma('integrity_check', { simple: true });
    } finally {
      verifier.close();
    }
    // Keep the raw snapshot on failure so it can be inspected.
    if (integrity !== 'ok') {
      throw new Error(
        `Backup integrity check failed: ${rawPath} (${integrity})`
      );
    }

    await pipeline(
      fs.createReadStream(rawPath),
      zlib.createGzip(),
      fs.createWriteStream(gzPath)
    );
    fs.unlinkSync(rawPath);

    let kept = 0;
    let pruned = 0;
    const cutoffMs = now.getTime() - retentionDays * 24 * 60 * 60 * 1000;
    for (const name of fs.readdirSync(backupDir)) {
      if (!BACKUP_FILE.test(name)) continue;
      const filePath = path.join(backupDir, name);
      if (fs.statSync(filePath).mtime.getTime() < cutoffMs) {
        fs.unlinkSync(filePath);
        pruned++;
      } else {
        kept++;
      }
    }

    return { file: gzPath, kept, pruned };
  } finally {
    source.close();
  }
}

async function main() {
  const dbPath = path.resolve(Config.DATABASE_PATH);
  const backupDir = process.env.BACKUP_DIR
    ? path.resolve(process.env.BACKUP_DIR)
    : path.join(path.dirname(dbPath), 'backups');
  const retentionDays = Number(process.env.BACKUP_RETENTION_DAYS) || 14;

  try {
    const result = await createBackup({ dbPath, backupDir, retentionDays });
    logger.info(
      `Backup complete: ${path.basename(result.file)} (kept ${result.kept}, pruned ${result.pruned})`
    );
  } catch (error) {
    logger.error('Backup failed:', error);
    process.exitCode = 1;
  }
}

// jiti rewrites argv[1] to the entry path, so this distinguishes direct
// runs from test imports (require.main is not set by jiti).
if (path.resolve(process.argv[1] || '') === __filename) {
  main();
}
