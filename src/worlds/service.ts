import { World } from 'vrchat';
import { fetchWorldData } from '../vrchat/client';
import { extractTags } from '../tags/extractor';
import {
  getDiscordMessageTimestampSeconds,
  getSupportedPlatforms
} from './helpers';
import { getWorldRepository, type WorldRecord } from '../db/worldRepository';

export interface AddWorldRequest {
  worldId: string;
  guildId: string;
  messageId: string;
  content: string;
  messageTimestamp?: number;
  checkDuplicate?: boolean;
}

export type AddWorldResult =
  | { status: 'created'; world: WorldRecord }
  | { status: 'duplicate'; world: WorldRecord; existingMessageId: string };

export type WorldServiceErrorKind =
  'worldNotFound' | 'vrchatFetchFailed' | 'invalidRequest';

export class WorldServiceError extends Error {
  readonly kind: WorldServiceErrorKind;
  readonly statusCode: number;

  constructor(
    kind: WorldServiceErrorKind,
    message: string,
    statusCode: number
  ) {
    super(message);
    this.kind = kind;
    this.statusCode = statusCode;
  }
}

function buildWorldRecord(
  worldId: string,
  guildId: string,
  messageId: string,
  content: string,
  worldData: World,
  messageTimestamp?: number
): WorldRecord {
  return {
    worldId,
    guildId,
    messageId,
    name: worldData.name,
    authorName: worldData.authorName,
    capacity: worldData.capacity,
    platforms: getSupportedPlatforms(worldData.unityPackages),
    tags: extractTags(content),
    imageUrl: worldData.imageUrl,
    sourceContent: content,
    vrchatData: JSON.stringify(worldData),
    internalAddDate:
      messageTimestamp ?? getDiscordMessageTimestampSeconds(messageId)
  };
}

export async function addWorld(req: AddWorldRequest): Promise<AddWorldResult> {
  const repo = getWorldRepository();
  const checkDuplicate = req.checkDuplicate ?? true;

  if (checkDuplicate) {
    const existing = repo.getByWorldAndGuild(req.worldId, req.guildId);
    if (existing) {
      return {
        status: 'duplicate',
        world: existing,
        existingMessageId: existing.messageId
      };
    }
  }

  let worldData: World;
  try {
    worldData = await fetchWorldData(req.worldId);
  } catch {
    throw new WorldServiceError(
      'vrchatFetchFailed',
      'Failed to fetch world data from VRChat',
      502
    );
  }

  const record = buildWorldRecord(
    req.worldId,
    req.guildId,
    req.messageId,
    req.content,
    worldData,
    req.messageTimestamp
  );
  repo.upsert(record);

  return { status: 'created', world: record };
}
