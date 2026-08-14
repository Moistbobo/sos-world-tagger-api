import { FastifyInstance, FastifyPluginAsync } from 'fastify';
import { getWorldRepository } from '../../db/worldRepository';
import { addWorld, WorldServiceError } from '../../worlds/service';
import { sanitizeRecord } from '../utils/sanitize';
import {
  parseAddWorldBody,
  parseGuildIdBody,
  parseUpdateQualityBody,
  parseUpdateTagsBody
} from '../utils/validation';

const worldsMutationsRoute: FastifyPluginAsync = async (
  fastify: FastifyInstance
) => {
  // POST /api/worlds
  fastify.post('/api/worlds', async (request, reply) => {
    const body = parseAddWorldBody(request.body);
    if (!body) {
      return reply.code(400).send({
        error: 'Invalid body. Expected { worldId, guildId, messageId, content }'
      });
    }

    try {
      const result = await addWorld(body);
      if (result.status === 'duplicate') {
        return reply.code(200).send({
          duplicate: true,
          existingMessageId: result.existingMessageId,
          world: sanitizeRecord(result.world)
        });
      }
      return reply.code(201).send({
        duplicate: false,
        world: result.world
      });
    } catch (error) {
      if (error instanceof WorldServiceError) {
        return reply.code(error.statusCode).send({ error: error.message });
      }
      throw error;
    }
  });

  // DELETE /api/worlds/:worldId
  fastify.delete('/api/worlds/:worldId', async (request, reply) => {
    const { worldId } = request.params as { worldId: string };
    const body = parseGuildIdBody(request.body);
    if (!body) {
      return reply
        .code(400)
        .send({ error: 'Invalid body. Expected { guildId }' });
    }

    const deleted = getWorldRepository().deleteByWorldAndGuild(
      worldId,
      body.guildId
    );
    if (!deleted) {
      return reply.code(404).send({ error: 'World not found' });
    }
    return reply.code(204).send();
  });

  // PUT /api/worlds/:worldId/quality
  fastify.put('/api/worlds/:worldId/quality', async (request, reply) => {
    const { worldId } = request.params as { worldId: string };
    const body = parseUpdateQualityBody(request.body);
    if (!body) {
      return reply
        .code(400)
        .send({ error: 'Invalid body. Expected { guildId, quality }' });
    }

    const repo = getWorldRepository();
    const exists = repo.getByWorldAndGuild(worldId, body.guildId);
    if (!exists) {
      return reply.code(404).send({ error: 'World not found' });
    }

    const updated = repo.updateQuality(worldId, body.guildId, body.quality);
    return { updated };
  });

  // PUT /api/worlds/:worldId/tags
  fastify.put('/api/worlds/:worldId/tags', async (request, reply) => {
    const { worldId } = request.params as { worldId: string };
    const body = parseUpdateTagsBody(request.body);
    if (!body) {
      return reply.code(400).send({
        error: 'Invalid body. Expected { guildId, tags, sourceContent }'
      });
    }

    const repo = getWorldRepository();
    const exists = repo.getByWorldAndGuild(worldId, body.guildId);
    if (!exists) {
      return reply.code(404).send({ error: 'World not found' });
    }

    const updated = repo.updateTags(
      worldId,
      body.guildId,
      body.tags,
      body.sourceContent
    );
    return { updated };
  });
};

export default worldsMutationsRoute;
