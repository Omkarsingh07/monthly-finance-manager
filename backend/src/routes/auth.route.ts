// src/routes/auth.route.ts
import { Router } from 'express';
import { authController } from '../controllers/auth.controller';
import { loginRateLimiter } from '../middleware/rateLimit.middleware';

const router = Router();

router.post('/login', loginRateLimiter, (req, res) => authController.login(req, res));
router.post('/logout', (req, res) => authController.logout(req, res));
router.get('/me', (req, res) => authController.me(req, res));

export default router;
