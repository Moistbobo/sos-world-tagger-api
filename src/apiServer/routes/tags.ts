import { Router } from 'express';
import { getWorldRepository } from '../../db/worldRepository';
import { requirePermission } from '../middleware/auth';

const router = Router();

router.get(
  '/api/tags',
  requirePermission('tags:read'),
  (_request, response) => {
    const tags = getWorldRepository().getUniqueTags();
    response.send({ tags });
  }
);

export default router;
