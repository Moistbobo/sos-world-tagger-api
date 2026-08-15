import { Router } from 'express';
import type { TokenRequest } from '../middleware/auth';

const router = Router();

// GET /api/me — current token identity (authMiddleware guarantees request.token)
router.get('/api/me', (request: TokenRequest, response) => {
  const token = request.token!;
  response.send({
    name: token.name,
    role: token.role.name,
    permissions: token.role.permissions
  });
});

export default router;
