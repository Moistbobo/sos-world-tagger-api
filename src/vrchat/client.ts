import type {
  CurrentUser,
  LimitedWorld,
  RequiresTwoFactorAuth,
  World
} from 'vrchat';
import { VRChat } from 'vrchat';
import Config from '../config';
import KeyvFile from 'keyv-file';

export const vrchat = new VRChat({
  application: {
    name: 'SosWorldTaggerApi',
    version: '0.1.0',
    contact: 'vrcworldtagger@gmail.com'
  },
  authentication: {
    credentials: {
      username: Config.VRC_USERNAME,
      password: Config.VRC_PASSWORD,
      totpSecret: Config.VRC_TOTP_KEY
    }
  },
  keyv: new KeyvFile({ filename: './data.json' })
});

/**
 * Type guard: getCurrentUser can return CurrentUser or RequiresTwoFactorAuth (200).
 * RequiresTwoFactorAuth only has `requiresTwoFactorAuth`; CurrentUser has `displayName`.
 */
export function isCurrentUser(
  data: CurrentUser | RequiresTwoFactorAuth
): data is CurrentUser {
  return 'displayName' in data;
}

/**
 * Fetches world data from the VRChat API.
 */
export async function fetchWorldData(worldId: string): Promise<World> {
  const { data } = await vrchat.getWorld({
    client: vrchat.client,
    path: { worldId }
  });
  return data;
}

/**
 * Searches VRChat worlds by name (fuzzy, relevance-sorted).
 * Returns the limited world list, or an empty array when the search fails.
 */
export async function searchWorldsByName(
  worldName: string
): Promise<LimitedWorld[]> {
  const searchResults = await vrchat.searchWorlds({
    client: vrchat.client,
    query: { search: `"${worldName}"`, fuzzy: true, n: 10, sort: 'relevance' }
  });
  return searchResults.data ?? [];
}
