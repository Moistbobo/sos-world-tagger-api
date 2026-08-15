import type { WorldRecord } from '../../db/worldRepository';

function toDateString(timestamp: number | undefined): string | undefined {
  if (!timestamp) return undefined;
  return new Date(timestamp * 1000).toISOString();
}

function buildWorldUrl(worldId: string): string {
  return `https://vrchat.com/home/world/${worldId}`;
}

export function sanitizeRecord(raw: WorldRecord) {
  return {
    worldId: raw.worldId,
    name: raw.name,
    authorName: raw.authorName,
    capacity: raw.capacity,
    platforms: raw.platforms,
    packageSizes: raw.packageSizes,
    tags: raw.tags,
    imageUrl: raw.imageUrl,
    vrchatUrl: buildWorldUrl(raw.worldId),
    quality: raw.quality ?? null,
    createdAt: toDateString(raw.createdAt),
    internalAddDate: toDateString(raw.internalAddDate ?? undefined)
  };
}
