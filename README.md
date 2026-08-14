# sos-world-tagger-api

Standalone REST API for the VRChat world tagging system. This is the API
refactor of the `bot_vrc_world_tagger` project: the bot hosts the Discord bot,
this project hosts the Fastify API that reads and writes the shared SQLite
world database.

The API keeps the existing read endpoints (`/api/worlds`, `/api/tags`,
`/api/meta`, `/api/health`) and adds mutation endpoints so the bot can add,
delete, and update worlds over HTTP instead of touching the database directly.

## Architecture

The bot sends the world ID, the guild ID, and the entire Discord message to the
API on add. The API then:

1. Checks for duplicates scoped to `(worldId, guildId)` and returns the
   original `messageId` when one exists, so the bot can reply with the
   "already tagged" link.
2. Fetches the world's data from the VRChat API.
3. Extracts tags from the message content using the shared taxonomy.
4. Upserts the record into SQLite.

## Setup

```bash
pnpm install
cp .env.sample .env
```

Fill in `.env` with:

| Variable | Description |
|----------|-------------|
| `VRC_USERNAME` / `VRC_PASSWORD` / `VRC_TOTP_KEY` | VRChat credentials used to fetch world data on add |
| `API_PORT` / `API_HOST` | Bind address, defaults `3000` / `0.0.0.0` |
| `API_TOKEN` | Comma-separated Bearer tokens for all `/api/*` endpoints (except `/api/health`). Falls back to `EXPORT_API_TOKEN`. |
| `API_ALLOWED_ORIGINS` | Comma-separated allowed `Origin` values. Leave empty to allow any. |
| `API_ALLOWED_IPS` | Comma-separated allowed source IPs. Leave empty to skip. |
| `DISABLE_API_RESTRICTIONS` | Set `true` to bypass origin/IP allowlists (dev only). |
| `DATABASE_PATH` | SQLite database path, defaults `./worlds.db`. Point this at the bot's database to share data. |

## Running

```bash
pnpm start        # build and run
pnpm test         # jest
pnpm lint         # eslint (zero warnings allowed)
pnpm format       # prettier
```

## Endpoints

Full documentation lives in [docs/API.md](docs/API.md).

Read endpoints (unchanged from the bot's embedded API):

- `GET /api/health`
- `GET /api/worlds` (paginated, filterable)
- `GET /api/worlds/:worldId`
- `GET /api/tags`
- `GET /api/meta`

Mutation endpoints:

- `POST /api/worlds` — add a world. Body: `{ worldId, guildId, messageId,
  content, messageTimestamp?, checkDuplicate? }`. Returns `201` with
  `{ duplicate: false, world }` for a new world, or `200` with
  `{ duplicate: true, existingMessageId, world }` for a duplicate.
- `DELETE /api/worlds/:worldId` — delete a world. Body: `{ guildId }`.
- `PUT /api/worlds/:worldId/quality` — set quality. Body:
  `{ guildId, quality: 'good' | 'bad' }`.
- `PUT /api/worlds/:worldId/tags` — set tags. Body:
  `{ guildId, tags: string[], sourceContent: string | null }`.

## Future work

- RBAC: separate read-only tokens (`API_TOKEN`) from write tokens
  (`MUTATION_API_TOKEN`) so dashboards cannot mutate the database.
