import { Router } from 'express';
import { getWorldRepository } from '../../db/worldRepository';
import { addWorld, WorldServiceError } from '../../worlds/service';
import { sanitizeRecord } from '../utils/sanitize';
import {
  parseAddWorldBody,
  parseGuildIdBody,
  parseUpdateQualityBody,
  parseUpdateTagsBody
} from '../utils/validation';
import { requirePermission } from '../middleware/auth';

const router = Router();

// POST /api/worlds
router.post(
  '/api/worlds',
  requirePermission('worlds:write'),
  async (request, response) => {
    const body = parseAddWorldBody(request.body);
    if (!body) {
      return response.status(400).send({
        error: 'Invalid body. Expected { worldId, guildId, messageId, content }'
      });
    }

    try {
      const result = await addWorld(body);
      if (result.status === 'duplicate') {
        return response.status(200).send({
          duplicate: true,
          existingMessageId: result.existingMessageId,
          world: sanitizeRecord(result.world)
        });
      }
      return response.status(201).send({
        duplicate: false,
        world: result.world
      });
    } catch (error) {
      if (error instanceof WorldServiceError) {
        return response.status(error.statusCode).send({ error: error.message });
      }
      throw error;
    }
  }
);

// DELETE /api/worlds/:worldId
router.delete(
  '/api/worlds/:worldId',
  requirePermission('worlds:write'),
  (request, response) => {
    const { worldId } = request.params as { worldId: string };
    const body = parseGuildIdBody(request.body);
    if (!body) {
      return response
        .status(400)
        .send({ error: 'Invalid body. Expected { guildId }' });
    }

    const deleted = getWorldRepository().deleteByWorldAndGuild(
      worldId,
      body.guildId
    );
    if (!deleted) {
      return response.status(404).send({ error: 'World not found' });
    }
    response.status(204).end();
  }
);

// PUT /api/worlds/:worldId/quality
router.put(
  '/api/worlds/:worldId/quality',
  requirePermission('worlds:write'),
  (request, response) => {
    const { worldId } = request.params as { worldId: string };
    const body = parseUpdateQualityBody(request.body);
    if (!body) {
      return response
        .status(400)
        .send({ error: 'Invalid body. Expected { guildId, quality }' });
    }

    const repo = getWorldRepository();
    const exists = repo.getByWorldAndGuild(worldId, body.guildId);
    if (!exists) {
      return response.status(404).send({ error: 'World not found' });
    }

    const updated = repo.updateQuality(worldId, body.guildId, body.quality);
    response.send({ updated });
  }
);

// PUT /api/worlds/:worldId/tags
router.put(
  '/api/worlds/:worldId/tags',
  requirePermission('worlds:write'),
  (request, response) => {
    const { worldId } = request.params as { worldId: string };
    const body = parseUpdateTagsBody(request.body);
    if (!body) {
      return response.status(400).send({
        error: 'Invalid body. Expected { guildId, tags, sourceContent }'
      });
    }

    const repo = getWorldRepository();
    const exists = repo.getByWorldAndGuild(worldId, body.guildId);
    if (!exists) {
      return response.status(404).send({ error: 'World not found' });
    }

    const updated = repo.updateTags(
      worldId,
      body.guildId,
      body.tags,
      body.sourceContent
    );
    response.send({ updated });
  }
);

export default router;
