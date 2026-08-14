import Config from './config';
import logger from './logger';
import { createApiServer } from './apiServer';

async function main() {
  const app = createApiServer();
  try {
    await new Promise<void>((resolve, reject) => {
      const server = app.listen(Config.API_PORT, Config.API_HOST);
      server.once('listening', resolve);
      server.once('error', reject);
    });
    logger.info(
      `API server listening on http://${Config.API_HOST}:${Config.API_PORT}`
    );
  } catch (error) {
    logger.error('Failed to start API server:', error);
    process.exit(1);
  }
}

void main();
