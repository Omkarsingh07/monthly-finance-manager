// src/routes/index.ts
import { Router } from 'express';
import healthRouter from './health.route';
import investmentPlanRouter from './investmentPlan.route';
import monthlyInvestmentRouter from './monthlyInvestment.route';
import dashboardRouter from './dashboard.route';

const router = Router();

router.use('/', healthRouter);
router.use('/', investmentPlanRouter);
router.use('/', monthlyInvestmentRouter);
router.use('/', dashboardRouter);

export default router;
