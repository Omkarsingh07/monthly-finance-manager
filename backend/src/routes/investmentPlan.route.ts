// src/routes/investmentPlan.route.ts
import { Router } from 'express';
import {
  getInvestmentPlan,
  saveInvestmentPlan,
  deletePlanItem,
} from '../controllers/investmentPlan.controller';

const router = Router();

router.get('/investment-plan', getInvestmentPlan);
router.post('/investment-plan', saveInvestmentPlan);
router.put('/investment-plan', saveInvestmentPlan);
router.delete('/investment-plan/item/:id', deletePlanItem);

export default router;
