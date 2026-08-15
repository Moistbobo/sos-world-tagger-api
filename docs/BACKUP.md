# Restore the database from a backup

`worlds.db` is backed up on the production droplet. Restore it when the live database is corrupt or accidentally deleted.

## Where backups live

- Backups are written to `backups/` next to the database file, as `worlds-YYYY-MM-DD-HHmmss.db.gz`.
- The daily cron entry at 02:00 runs `node dist/scripts/backup-db.js`.
- Every production deploy also takes a snapshot right before the PM2 restart.
- Backups older than 14 days are pruned. `BACKUP_RETENTION_DAYS` and `BACKUP_DIR` override the defaults.

## Restore

1. Stop the API so it releases the database file.

   ```
   pm2 stop world-tagger-api
   ```

2. List the snapshots and pick the one you want.

   ```
   ls -lh backups/worlds-*.db.gz
   ```

3. Decompress the chosen snapshot into place.

   ```
   gunzip -k backups/worlds-YYYY-MM-DD-HHmmss.db.gz
   ```

4. Remove the WAL files from the current database so they do not replay over the restored one.

   ```
   rm -f worlds.db-wal worlds.db-shm
   ```

5. Replace the live database with the snapshot.

   ```
   mv worlds-YYYY-MM-DD-HHmmss.db worlds.db
   ```

6. Start the API.

   ```
   pm2 start ecosystem.config.js
   ```

## Verify the restore

Each snapshot is integrity-checked when it is created. After a restore, confirm the API serves data:

```
curl http://127.0.0.1:3067/health
```

## Take a manual backup

Run the backup on demand:

```
pnpm backup:db
```

The script uses the SQLite online backup API, so it is safe to run while the API is live.
