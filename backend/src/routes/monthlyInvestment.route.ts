// src/routes/monthlyInvestment.route.ts
import { Router } from 'express';
import {
  getMonthlyInvestments,
  updateMonthlyInvestment,
  batchUpdateMonthlyInvestments,
} from '../controllers/monthlyInvestment.controller';

const router = Router();

router.get('/monthly-investments', getMonthlyInvestments);
router.put('/monthly-investments/:planInvestmentId', updateMonthlyInvestment);
router.put('/monthly-investments', batchUpdateMonthlyInvestments);

export default router;
