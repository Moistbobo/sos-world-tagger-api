# sos-world-tagger-api — API Guide

The API exposes the world records stored in the shared SQLite database. It is
intended for dashboards, CI tools, and the Discord bot itself. Read endpoints
mirror the bot's original embedded API; mutation endpoints replace the bot's
direct database writes.

---

## Base URL

```
http://<host>:<port>
```

| Setting | Default | Env Variable |
|---------|---------|--------------|
| Host    | `0.0.0.0` | `API_HOST`   |
| Port    | `3000`    | `API_PORT`   |

---

## Authentication

All endpoints **except** `GET /api/health` require a valid Bearer token:

```
Authorization: Bearer <your-api-token>
```

The token is configured via the `API_TOKEN` environment variable (supports
multiple comma-separated tokens) and falls back to `EXPORT_API_TOKEN`.

If the header is missing, malformed, or the token does not match, the server
responds with `401 Unauthorized`.

Note: reads and mutations currently share the same token. Separate read/write
tokens (RBAC) are planned future work.

---

## Origin and IP Restrictions

You can lock down the API so only specific browser origins and/or source IP
addresses can reach it. Configure these via environment variables:

| Variable | Description |
|----------|-------------|
| `API_ALLOWED_ORIGINS` | Comma-separated list of allowed `Origin` values. Used for CORS preflight and origin header validation. Supports `*` wildcards. Example: `https://sosd.googoogaagaa.club,https://testnet.googoogaagaa.club`. |
| `API_ALLOWED_IPS` | Comma-separated list of allowed source IP addresses. Example: `203.0.113.42,127.0.0.1`. When set, the API trusts loopback reverse proxies (e.g. Caddy or Nginx on the same host) to provide the real client IP via `X-Forwarded-For`. |

A request to any endpoint except `/api/health` must satisfy **at least one**
configured restriction in addition to presenting a valid token:

- Its `Origin` header matches one of the allowed origins, **or**
- Its source IP matches one of the allowed IPs.

If neither rule is configured, only Bearer token auth is enforced and CORS
falls back to the wildcard `*` for backwards compatibility. The health endpoint
remains publicly reachable for monitoring.

---

## Read Endpoints

### 1. Health Check

```
GET /api/health
```

No authentication or origin/IP restrictions required. Returns basic server
health and database stats.

**Example response**

```json
{
  "status": "ok",
  "worldCount": 1423,
  "dbVersion": 1
}
```

---

### 2. List Worlds

```
GET /api/worlds
```

Returns a paginated, filterable list of world records.

**Query parameters**

| Parameter     | Type              | Default | Max | Description |
|---------------|-------------------|---------|-----|-------------|
| `limit`       | number            | `50`    | 500 | Number of records to return. |
| `offset`      | number            | `0`     | —   | Number of records to skip (for pagination). |
| `tag`         | string / string[] | —       | —   | Filter by tag(s). Comma-separated or repeated. Multiple values use AND logic. |
| `platform`    | string / string[] | —       | —   | Filter by supported platform(s). Comma-separated or repeated. Multiple values use AND logic. |
| `quality`     | string / string[] | —       | —   | Filter by quality. Values: `good`, `bad`. |
| `search`      | string            | —       | —   | Search across name, author, source content, world id, and tags. |
| `minCapacity` | integer           | —       | —   | Minimum world capacity (inclusive). Must be ≥ 1 and ≤ 80. |
| `maxCapacity` | integer           | —       | —   | Maximum world capacity (inclusive). Must be ≥ 1 and ≤ 80. |
| `worldId`     | string / string[] | —       | —   | Filter to specific world ID(s). Comma-separated or repeated. Exact match only. |
| `dayRange`    | integer           | —       | 365 | Return only worlds tagged within the last N days. Values below `0` are treated as `0` (no filter); values above `365` are clamped to `365`. Tagged date uses `internal_add_date` when present, otherwise falls back to `created_at`. |

**Response**

```json
{
  "total": 1423,
  "limit": 50,
  "offset": 0,
  "worlds": [
    {
      "worldId": "wrld_abc123",
      "name": "Midnight Bar",
      "authorName": "VRChat",
      "capacity": 40,
      "platforms": ["android", "standalonewindows"],
      "tags": ["social", "hangout", "bar"],
      "imageUrl": "https://api.vrchat.cloud/api/1/file/...",
      "vrchatUrl": "https://vrchat.com/home/world/wrld_abc123",
      "quality": "good",
      "createdAt": "2025-06-01T12:00:00.000Z"
    }
  ]
}
```

All filters combine with AND logic. Example:

```
GET /api/worlds?minCapacity=10&maxCapacity=40&quality=good&tag=horror&platform=android
GET /api/worlds?dayRange=7&tag=horror&quality=good
```

---

### 3. Get Single World

```
GET /api/worlds/:worldId
```

Returns the most recent record for a specific VRChat world ID.

**Path parameter**

| Parameter | Type   | Description |
|-----------|--------|-------------|
| `worldId` | string | The VRChat world ID (e.g. `wrld_abc123`). |

**Error response** (world not found)

```json
{
  "error": "World not found"
}
```

Status code: **404**

---

### 4. List All Tags

```
GET /api/tags
```

Returns every unique tag across all world records, sorted by frequency (most
common first).

**Response**

```json
{
  "tags": [
    { "tag": "social",  "count": 512 },
    { "tag": "hangout", "count": 320 }
  ]
}
```

---

### 5. Metadata Counts

```
GET /api/meta
```

Returns high-level dataset counts for quality ratings and platform support
across all world records.

**Response**

```json
{
  "qualityGood": 123,
  "qualityBad": 12,
  "platformDesktop": 80,
  "platformAndroid": 45,
  "platformiOS": 6
}
```

---

## Mutation Endpoints

The bot uses these endpoints to add, update, and delete worlds over HTTP.

### 6. Add World

```
POST /api/worlds
```

The API fetches VRChat data for the world, extracts tags from the message
content, and upserts the record. Scoped to `(worldId, guildId)`.

**Request body**

```json
{
  "worldId": "wrld_abc123",
  "guildId": "123456789012345678",
  "messageId": "1250000000000000000",
  "content": "https://vrchat.com/home/world/wrld_abc123 Tags: horror, game",
  "messageTimestamp": 1717257600,
  "checkDuplicate": true
}
```

| Field              | Type     | Required | Description |
|--------------------|----------|----------|-------------|
| `worldId`          | string   | yes      | VRChat world ID, must match `wrld_` + 36 hex chars. |
| `guildId`          | string   | yes      | Discord guild ID. |
| `messageId`        | string   | yes      | Discord message ID (snowflake). Used as the duplicate-response link and to derive `internalAddDate` when `messageTimestamp` is absent. |
| `content`          | string   | yes      | The entire Discord message text. Tag extraction source. |
| `messageTimestamp` | number   | no       | Unix seconds. Stored as `internalAddDate` when provided; otherwise derived from the snowflake. |
| `checkDuplicate`   | boolean  | no       | Default `true`. Set `false` to force a refetch/upsert (the bot's force-refetch flow). |

**New world** — status `201`:

```json
{
  "duplicate": false,
  "world": { "...": "sanitized world object (same shape as GET responses)" }
}
```

**Duplicate** — status `200`:

```json
{
  "duplicate": true,
  "existingMessageId": "1240000000000000000",
  "world": { "...": "sanitized existing world object" }
}
```

The bot replies to the new message with a link to the original message built
from `existingMessageId` and the channel.

**Errors**

| Status | Body |
|--------|------|
| `400`  | `{ "error": "Invalid body. Expected { worldId, guildId, messageId, content }" }` |
| `401`  | `{ "error": "Unauthorized" }` |
| `502`  | `{ "error": "Failed to fetch world data from VRChat" }` |

---

### 7. Delete World

```
DELETE /api/worlds/:worldId
```

Archives the `(worldId, guildId)` record into `deleted_world_records` and
removes it from the live table. This is the undo-tag / remove-reaction flow.

**Request body**

```json
{
  "guildId": "123456789012345678"
}
```

**Success** — status `204`, no body.

**Errors**

| Status | Body |
|--------|------|
| `400`  | `{ "error": "Invalid body. Expected { guildId }" }` |
| `401`  | `{ "error": "Unauthorized" }` |
| `404`  | `{ "error": "World not found" }` |

---

### 8. Set Quality

```
PUT /api/worlds/:worldId/quality
```

Sets the quality rating (`good` / `bad`) on the `(worldId, guildId)` record.
This is the 👍/👎 reaction flow. No-op when the quality is unchanged.

**Request body**

```json
{
  "guildId": "123456789012345678",
  "quality": "good"
}
```

**Success** — status `200`:

```json
{
  "updated": true
}
```

**Errors**

| Status | Body |
|--------|------|
| `400`  | `{ "error": "Invalid body. Expected { guildId, quality }" }` |
| `401`  | `{ "error": "Unauthorized" }` |
| `404`  | `{ "error": "World not found" }` |

---

### 9. Set Tags

```
PUT /api/worlds/:worldId/tags
```

Sets the tags and source content on the `(worldId, guildId)` record. This is
the crawlHistory backfill flow. No-op when nothing changed.

**Request body**

```json
{
  "guildId": "123456789012345678",
  "tags": ["horror", "game"],
  "sourceContent": "the original message text"
}
```

`sourceContent` may be `null`.

**Success** — status `200`:

```json
{
  "updated": true
}
```

**Errors**

| Status | Body |
|--------|------|
| `400`  | `{ "error": "Invalid body. Expected { guildId, tags, sourceContent }" }` |
| `401`  | `{ "error": "Unauthorized" }` |
| `404`  | `{ "error": "World not found" }` |

---

## World Record Schema

Each world object returned by the API has the following fields:

| Field             | Type                     | Description |
|-------------------|--------------------------|-------------|
| `worldId`         | string                   | VRChat world ID (e.g. `wrld_abc123`). |
| `name`            | string \| null           | Display name of the world. |
| `authorName`      | string \| null           | Name of the author / creator. |
| `capacity`        | number \| null           | Maximum player capacity. |
| `platforms`       | string[]                 | Supported platforms (`android`, `standalonewindows`, etc.). |
| `tags`            | string[]                 | Tags applied to this world record. |
| `imageUrl`        | string \| null           | Thumbnail image URL from VRChat API. |
| `vrchatUrl`       | string                   | Link to the world on the VRChat website. |
| `quality`         | `"good"` \| `"bad"` \| null | Manual quality rating (if set). |
| `createdAt`       | string \| undefined      | ISO 8601 timestamp of when the record was created. |
| `internalAddDate` | string \| null           | ISO 8601 timestamp of when the world was originally tagged, if known. |

Internal fields such as `guildId`, `messageId`, `sourceContent`, and
`vrchatData` are intentionally stripped from API responses.

---

## Error Responses

| Status Code | Meaning                  | Body |
|-------------|--------------------------|------|
| `400`       | Invalid query params / body | `{ "error": "..." }` |
| `401`       | Missing / invalid token  | `{ "error": "Unauthorized" }` |
| `403`       | Disallowed origin or IP  | `{ "error": "Forbidden" }` |
| `404`       | World not found / route  | `{ "error": "World not found" }` / `{ "error": "Not Found" }` |
| `502`       | VRChat fetch failure     | `{ "error": "Failed to fetch world data from VRChat" }` |

---

## Example Usage (cURL)

```bash
# Health check (no auth)
curl http://localhost:3000/api/health

# List first 20 worlds tagged "social"
curl -H "Authorization: Bearer my-token" \
  "http://localhost:3000/api/worlds?limit=20&tag=social"

# Get a specific world
curl -H "Authorization: Bearer my-token" \
  "http://localhost:3000/api/worlds/wrld_abc123"

# List all tags
curl -H "Authorization: Bearer my-token" \
  http://localhost:3000/api/tags

# Add a world (bot flow)
curl -X POST -H "Authorization: Bearer my-token" \
  -H "Content-Type: application/json" \
  -d '{
    "worldId": "wrld_abc123",
    "guildId": "123456789012345678",
    "messageId": "1250000000000000000",
    "content": "https://vrchat.com/home/world/wrld_abc123 Tags: horror, game"
  }' \
  http://localhost:3000/api/worlds

# Force refetch an already-tagged world
curl -X POST -H "Authorization: Bearer my-token" \
  -H "Content-Type: application/json" \
  -d '{
    "worldId": "wrld_abc123",
    "guildId": "123456789012345678",
    "messageId": "1250000000000000000",
    "content": "https://vrchat.com/home/world/wrld_abc123",
    "checkDuplicate": false
  }' \
  http://localhost:3000/api/worlds

# Delete a world (undo tag)
curl -X DELETE -H "Authorization: Bearer my-token" \
  -H "Content-Type: application/json" \
  -d '{"guildId": "123456789012345678"}' \
  http://localhost:3000/api/worlds/wrld_abc123

# Set quality (👍/👎 reactions)
curl -X PUT -H "Authorization: Bearer my-token" \
  -H "Content-Type: application/json" \
  -d '{"guildId": "123456789012345678", "quality": "good"}' \
  http://localhost:3000/api/worlds/wrld_abc123/quality

# Set tags (crawlHistory backfill)
curl -X PUT -H "Authorization: Bearer my-token" \
  -H "Content-Type: application/json" \
  -d '{
    "guildId": "123456789012345678",
    "tags": ["horror", "game"],
    "sourceContent": "the original message text"
  }' \
  http://localhost:3000/api/worlds/wrld_abc123/tags
```
