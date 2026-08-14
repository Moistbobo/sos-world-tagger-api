import { Router } from 'express';
import { getWorldRepository } from '../../db/worldRepository';

const router = Router();

// GET /api/meta
router.get('/api/meta', (_request, response) => {
  response.send(getWorldRepository().getMetadataCounts());
});

export default router;
