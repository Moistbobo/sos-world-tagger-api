import { World } from 'vrchat';
import { getDatabase } from '../db';
import { getPackageSizesInMb } from '../worlds/packageSizes';
import logger from '../logger';

interface Row {
  id: number;
  vrchat_data: string | null;
}

const DEFAULT_DELAY_MS = 150;
const BATCH_SIZE = 50;

function parseWorldData(vrchatData: string | null): World | null {
  if (!vrchatData) return null;
  try {
    return JSON.parse(vrchatData) as World;
  } catch {
    return null;
  }
}

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

async function main() {
  const delayMs = Number(process.env.BACKFILL_DELAY_MS) || DEFAULT_DELAY_MS;

  const db = getDatabase();

  const total = (
    db
      .prepare(
        `SELECT COUNT(*) as total FROM world_records WHERE vrchat_data IS NOT NULL AND vrchat_data != ''`
      )
      .get() as { total: number }
  ).total;
  logger.info(`Backfilling package sizes for ${total} world records`);

  let offset = 0;
  let processed = 0;
  let updated = 0;
  let failed = 0;

  while (true) {
    const rows = db
      .prepare(
        `SELECT id, vrchat_data FROM world_records WHERE vrchat_data IS NOT NULL AND vrchat_data != '' AND (package_sizes IS NULL OR package_sizes = '') ORDER BY id LIMIT ? OFFSET ?`
      )
      .all(BATCH_SIZE, offset) as Row[];

    if (rows.length === 0) break;

    for (const row of rows) {
      const worldData = parseWorldData(row.vrchat_data);
      if (!worldData) {
        failed++;
        continue;
      }

      const sizes = await getPackageSizesInMb(worldData);
      if (sizes.length > 0) {
        db.prepare(
          'UPDATE world_records SET package_sizes = ? WHERE id = ?'
        ).run(JSON.stringify(sizes), row.id);
        updated++;
      } else {
        failed++;
      }
      processed++;
      await sleep(delayMs);
    }

    logger.info(
      `Backfill progress: ${processed}/${total} processed, ${updated} updated, ${failed} failed`
    );
    offset += rows.length;
  }

  logger.info(
    `Backfill complete: ${processed} processed, ${updated} updated, ${failed} failed`
  );
}

main().catch((error) => {
  logger.error('Backfill failed:', error);
  process.exit(1);
});
