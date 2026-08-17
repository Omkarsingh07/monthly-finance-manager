// src/routes/dashboard.route.ts
import { Router } from 'express';
import { getDashboard } from '../controllers/dashboard.controller';

const router = Router();

router.get('/dashboard', getDashboard);

export default router;
