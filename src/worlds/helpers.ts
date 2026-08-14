import { UnityPackage } from 'vrchat';

export function getSupportedPlatforms(
  unityPackages: Array<UnityPackage>
): string[] {
  const platforms = new Set<string>(
    unityPackages.map((pkg) => pkg.platform || '')
  );

  const support: Record<string, number> = {
    standalonewindows: platforms.has('standalonewindows') ? 1 : 0,
    android: platforms.has('android') ? 1 : 0,
    ios: platforms.has('ios') ? 1 : 0
  };

  return Object.keys(support).filter((key) => support[key] > 0);
}

const DISCORD_EPOCH_MS = 1420070400000;

/**
 * Derive the Unix timestamp (in seconds) from a Discord message/snowflake ID.
 */
export function getDiscordMessageTimestampSeconds(messageId: string): number {
  const snowflake = BigInt(messageId);
  const timestampMs = Number(snowflake >> BigInt(22)) + DISCORD_EPOCH_MS;
  return Math.floor(timestampMs / 1000);
}
