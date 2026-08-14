import { FastifyInstance, FastifyPluginAsync } from 'fastify';
import { getWorldRepository } from '../../db/worldRepository';
import { parseIntegerParam, parseStringListQuery } from '../utils/queryParams';
import { sanitizeRecord } from '../utils/sanitize';

const worldsRoute: FastifyPluginAsync = async (fastify: FastifyInstance) => {
  // GET /api/worlds
  fastify.get('/api/worlds', async (request, reply) => {
    const query = request.query as Record<string, unknown>;

    const limit = Math.min(Number(query.limit ?? 50), 500);
    const offset = Number(query.offset ?? 0);

    const dayRange =
      typeof query.dayRange === 'string'
        ? Math.max(0, Math.min(parseInt(query.dayRange, 10) || 0, 365))
        : 0;

    const tags = parseStringListQuery(query.tag);
    const platforms = parseStringListQuery(query.platform);
    const worldIds = parseStringListQuery(query.worldId);

    const quality = Array.isArray(query.quality)
      ? query.quality
          .map(String)
          .filter((q): q is 'good' | 'bad' => q === 'good' || q === 'bad')
      : query.quality && (query.quality === 'good' || query.quality === 'bad')
        ? [String(query.quality) as 'good' | 'bad']
        : undefined;

    let minCapacity: number | undefined;
    let maxCapacity: number | undefined;
    try {
      minCapacity = parseIntegerParam(query.minCapacity, {
        name: 'minCapacity',
        min: 1,
        max: 80
      });
      maxCapacity = parseIntegerParam(query.maxCapacity, {
        name: 'maxCapacity',
        min: 1,
        max: 80
      });
    } catch (error) {
      return reply.code(400).send({
        error:
          error instanceof Error ? error.message : 'Invalid capacity filter'
      });
    }

    if (
      minCapacity !== undefined &&
      maxCapacity !== undefined &&
      minCapacity > maxCapacity
    ) {
      return reply.code(400).send({
        error: 'minCapacity must be less than or equal to maxCapacity'
      });
    }

    const filters: {
      platforms?: string[];
      tags?: string[];
      quality?: ('good' | 'bad')[];
      search?: string;
      minCapacity?: number;
      maxCapacity?: number;
      worldIds?: string[];
      dayRange?: number;
    } = {};
    if (tags) filters.tags = tags;
    if (platforms) filters.platforms = platforms;
    if (worldIds) filters.worldIds = worldIds;
    if (quality) filters.quality = quality;
    if (minCapacity !== undefined) filters.minCapacity = minCapacity;
    if (maxCapacity !== undefined) filters.maxCapacity = maxCapacity;
    if (dayRange > 0) filters.dayRange = dayRange;

    const search =
      typeof query.search === 'string' ? query.search.trim() : undefined;
    if (search) filters.search = search;

    const { rows, total } = getWorldRepository().getAllPaginated(
      limit,
      offset,
      Object.keys(filters).length > 0 ? filters : undefined
    );

    return {
      total,
      limit,
      offset,
      worlds: rows.map(sanitizeRecord)
    };
  });

  // GET /api/worlds/pairs — internal helper for the bot's crawl cache
  fastify.get('/api/worlds/pairs', async () => {
    const pairs = getWorldRepository().getAllWorldGuildPairs();
    const entries = Array.from(pairs).map((key) => {
      const dashIndex = key.lastIndexOf('-');
      return {
        worldId: key.slice(0, dashIndex),
        guildId: key.slice(dashIndex + 1)
      };
    });
    return { pairs: entries };
  });

  // GET /api/worlds/:worldId
  fastify.get('/api/worlds/:worldId', async (request, reply) => {
    const { worldId } = request.params as { worldId: string };
    const matches = getWorldRepository().getByWorldId(worldId);

    if (matches.length === 0) {
      return reply.code(404).send({ error: 'World not found' });
    }

    // Return first live match (most recent by created_at DESC)
    return sanitizeRecord(matches[0]);
  });
};

export default worldsRoute;
