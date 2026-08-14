import { FastifyInstance, FastifyPluginAsync } from 'fastify';
import { getWorldRepository } from '../../db/worldRepository';

const tagsRoute: FastifyPluginAsync = async (fastify: FastifyInstance) => {
  fastify.get('/api/tags', async () => {
    const tags = getWorldRepository().getUniqueTags();
    return { tags };
  });
};

export default tagsRoute;
