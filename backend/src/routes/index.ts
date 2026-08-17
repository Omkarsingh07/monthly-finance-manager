// src/routes/index.ts
import { Router } from 'express';
import healthRouter from './health.route';
import authRouter from './auth.route';
import investmentPlanRouter from './investmentPlan.route';
import monthlyInvestmentRouter from './monthlyInvestment.route';
import dashboardRouter from './dashboard.route';
import { requireAuth } from '../middleware/auth.middleware';

const router = Router();

// Public routes
router.use('/', healthRouter);
router.use('/auth', authRouter);

// Protected finance routes (require authentication)
router.use('/', requireAuth, investmentPlanRouter);
router.use('/', requireAuth, monthlyInvestmentRouter);
router.use('/', requireAuth, dashboardRouter);

export default router;
