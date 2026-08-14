import type { NextFunction, Request, Response } from 'express';
import logger from '../../logger';

export function errorHandler(
  error: unknown,
  request: Request,
  response: Response,
  _next: NextFunction
) {
  const statusCode = (error as { statusCode?: number }).statusCode ?? 500;

  logger.error(`API error [${statusCode}] ${request.method} ${request.url}:`);
  logger.error(error);

  // Never leak stack traces or internal details to clients
  const clientMessage =
    statusCode >= 500
      ? 'Internal Server Error'
      : (error as Error).message || 'Unknown error';

  response.status(statusCode).send({ error: clientMessage });
}

export function notFoundHandler(request: Request, response: Response) {
  response.status(404).send({ error: 'Not Found' });
}
