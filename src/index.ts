import Config from './config';
import logger from './logger';
import { createApiServer } from './apiServer';

async function main() {
  const fastify = createApiServer();
  try {
    await fastify.listen({ port: Config.API_PORT, host: Config.API_HOST });
    logger.info(
      `API server listening on http://${Config.API_HOST}:${Config.API_PORT}`
    );
  } catch (error) {
    logger.error('Failed to start API server:', error);
    process.exit(1);
  }
}

void main();
