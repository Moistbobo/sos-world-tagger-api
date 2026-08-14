import { Router } from 'express';
import { getWorldRepository } from '../../db/worldRepository';
import { requirePermission } from '../middleware/auth';

const router = Router();

// GET /api/meta
router.get(
  '/api/meta',
  requirePermission('meta:read'),
  (_request, response) => {
    response.send(getWorldRepository().getMetadataCounts());
  }
);

export default router;
