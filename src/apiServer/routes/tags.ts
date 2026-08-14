import { Router } from 'express';
import { getWorldRepository } from '../../db/worldRepository';

const router = Router();

router.get('/api/tags', (_request, response) => {
  const tags = getWorldRepository().getUniqueTags();
  response.send({ tags });
});

export default router;
