import { Router } from 'express';
import { getWorldRepository } from '../../db/worldRepository';

const router = Router();

router.get('/api/health', (_request, response) => {
  const count = getWorldRepository().count();
  response.send({
    status: 'ok',
    worldCount: count,
    dbVersion: 1
  });
});

export default router;
