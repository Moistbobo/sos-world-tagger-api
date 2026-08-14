import Config from './config';
import logger from './logger';
import { createApiServer } from './apiServer';
import { ensureAuthenticated } from './vrchat/client';

async function main() {
  try {
    const currentUser = await ensureAuthenticated();
    logger.info(`Authenticated with VRChat as ${currentUser.displayName}`);
  } catch (error) {
    logger.error('Failed to authenticate with VRChat:', error);
    process.exit(1);
  }

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
