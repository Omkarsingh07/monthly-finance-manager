// src/tests/test-dashboard.ts
import 'dotenv/config';
import { dashboardService } from '../services/dashboard.service';
import { investmentPlanService } from '../services/investmentPlan.service';
import { monthlyInvestmentService } from '../services/monthlyInvestment.service';
import { googleSheetsService, SHEET_TABS } from '../services/googleSheets.service';

async function runDashboardTests() {
  console.log('====================================================');
  console.log('  PHASE D — DASHBOARD INTEGRATION TEST SUITE');
  console.log('====================================================\n');

  try {
    // Step 0: Ensure schema & start with clean sheets
    console.log('0. Preparing Google Sheets for test execution...');
    await googleSheetsService.ensureSpreadsheetSchema();

    await googleSheetsService.clearDataRows(SHEET_TABS.MONTHLY_INVESTMENTS);
    await googleSheetsService.clearDataRows(SHEET_TABS.INVESTMENT_PLAN);
    await googleSheetsService.clearDataRows(SHEET_TABS.PLAN_HISTORY);
    await googleSheetsService.clearDataRows(SHEET_TABS.SETTINGS);
    console.log('✅ Tabs cleared.\n');

    // Step 1: Empty state test (no plan configured)
    console.log('1. Testing Dashboard Empty State (No investment plan configured)...');
    const emptyDash = await dashboardService.getDashboard(8, 2026);
    if (!emptyDash.noPlan) {
      console.error('❌ Expected noPlan: true when no plan is configured!', emptyDash);
      process.exit(1);
    }
    console.log(`✅ Empty State PASS: noPlan=true, message="${emptyDash.message}"\n`);

    // Step 2: Configure canonical plan (2000/month: 40/25/20/15) effective from July 2026
    console.log('2. Setting up canonical investment plan (2000/month: 40/25/20/15) effective from July 2026...');
    const plan = await investmentPlanService.savePlan({
      monthlyAmount: 2000,
      effectiveFromMonth: 7,
      effectiveFromYear: 2026,
      investments: [
        { name: 'Nippon India Nifty 50 ETF', category: 'ETF', weightage: 40 },
        { name: 'ICICI Prudential Nifty Next 50 ETF', category: 'ETF', weightage: 25 },
        { name: 'Mirae Asset Nifty Midcap 150 ETF', category: 'ETF', weightage: 20 },
        { name: 'HDFC Nifty Smallcap 250 ETF', category: 'ETF', weightage: 15 },
      ],
    });

    const [nifty, next50, midcap, smallcap] = plan.investments;
    console.log(`✅ Plan saved with IDs: ${nifty.id}, ${next50.id}, ${midcap.id}, ${smallcap.id}\n`);

    // Step 3: July 2026 Initial Dashboard (No previous month)
    console.log('3. Checking July 2026 Initial Dashboard (No previous investments)...');
    const julyInitial = await dashboardService.getDashboard(7, 2026);
    console.log(`   Total Investment: ${julyInitial.totalInvestment} (Expected: 0)`);
    console.log(`   This Month Investment: ${julyInitial.currentMonthTarget} (Expected: 2000)`);
    console.log(`   This Month Remaining: ${julyInitial.currentMonthRemaining} (Expected: 2000)`);

    if (
      julyInitial.totalInvestment !== 0 ||
      julyInitial.currentMonthTarget !== 2000 ||
      julyInitial.currentMonthRemaining !== 2000
    ) {
      console.error('❌ July Initial Dashboard check failed!', julyInitial);
      process.exit(1);
    }
    console.log('✅ July Initial Dashboard PASS.\n');

    // Step 4: Enter July 2026 Actual Investments (Total = 1500)
    console.log('4. Entering July 2026 actual investments (Total = 1500)...');
    await monthlyInvestmentService.upsertActualAmount(nifty.id, 2026, 7, 750);
    await monthlyInvestmentService.upsertActualAmount(next50.id, 2026, 7, 450);
    await monthlyInvestmentService.upsertActualAmount(midcap.id, 2026, 7, 300);
    await monthlyInvestmentService.upsertActualAmount(smallcap.id, 2026, 7, 0);

    const julyAfter = await dashboardService.getDashboard(7, 2026);
    console.log(`   July Total Investment: ${julyAfter.totalInvestment} (Expected: 1500)`);
    console.log(`   July This Month Investment: ${julyAfter.currentMonthTarget} (Expected: 2000)`);
    console.log(`   July This Month Remaining: ${julyAfter.currentMonthRemaining} (Expected: 500)`);

    if (
      julyAfter.totalInvestment !== 1500 ||
      julyAfter.currentMonthTarget !== 2000 ||
      julyAfter.currentMonthRemaining !== 500
    ) {
      console.error('❌ July Dashboard with partial investment check failed!', julyAfter);
      process.exit(1);
    }
    console.log('✅ July Dashboard PASS: Total=1500, Target=2000, Remaining=500.\n');

    // Step 5: August 2026 Dashboard with Carry Forward (Base 2000 + Carry Forward 500 = Target 2500)
    console.log('5. Checking August 2026 Dashboard with Carry Forward from July (500)...');
    const augustInitial = await dashboardService.getDashboard(8, 2026);
    console.log(`   August Base: ${augustInitial.baseMonthlyAmount} (Expected: 2000)`);
    console.log(`   August Carry Forward: ${augustInitial.previousCarryForward} (Expected: 500)`);
    console.log(`   August This Month Investment: ${augustInitial.currentMonthTarget} (Expected: 2500)`);

    const pNifty = augustInitial.investments.find((i) => i.id === nifty.id)?.plannedAmount;
    const pNext50 = augustInitial.investments.find((i) => i.id === next50.id)?.plannedAmount;
    const pMidcap = augustInitial.investments.find((i) => i.id === midcap.id)?.plannedAmount;
    const pSmallcap = augustInitial.investments.find((i) => i.id === smallcap.id)?.plannedAmount;

    console.log(`   Planned Breakdown: Nifty=${pNifty} (Exp: 1000), Next50=${pNext50} (Exp: 625), Midcap=${pMidcap} (Exp: 500), Smallcap=${pSmallcap} (Exp: 375)`);

    if (
      augustInitial.previousCarryForward !== 500 ||
      augustInitial.currentMonthTarget !== 2500 ||
      pNifty !== 1000 ||
      pNext50 !== 625 ||
      pMidcap !== 500 ||
      pSmallcap !== 375
    ) {
      console.error('❌ August Dashboard carry forward check failed!', augustInitial);
      process.exit(1);
    }
    console.log('✅ August Initial Dashboard PASS: Target=2500 with exact planned amounts.\n');

    // Step 6: Enter August 2026 Actual Investments (500 + 500 + 500 + 0 = 1500)
    console.log('6. Entering August actual investments (500 + 500 + 500 + 0 = 1500)...');
    await monthlyInvestmentService.upsertActualAmount(nifty.id, 2026, 8, 500);
    await monthlyInvestmentService.upsertActualAmount(next50.id, 2026, 8, 500);
    await monthlyInvestmentService.upsertActualAmount(midcap.id, 2026, 8, 500);
    await monthlyInvestmentService.upsertActualAmount(smallcap.id, 2026, 8, 0);

    const augustAfter = await dashboardService.getDashboard(8, 2026);
    console.log(`   August Total Investment: ${augustAfter.totalInvestment} (Expected: 3000 = July 1500 + August 1500)`);
    console.log(`   August This Month Investment: ${augustAfter.currentMonthTarget} (Expected: 2500)`);
    console.log(`   August This Month Remaining: ${augustAfter.currentMonthRemaining} (Expected: 1000)`);

    if (
      augustAfter.totalInvestment !== 3000 ||
      augustAfter.currentMonthTarget !== 2500 ||
      augustAfter.currentMonthRemaining !== 1000
    ) {
      console.error('❌ August Dashboard after investments check failed!', augustAfter);
      process.exit(1);
    }
    console.log('✅ August Dashboard PASS: Total=3000, This Month=2500, Remaining=1000.\n');

    // Step 7: Over-Investment Check
    console.log('7. Testing Over-Investment scenario in August (Target 2500, Invested 2800)...');
    await monthlyInvestmentService.upsertActualAmount(nifty.id, 2026, 8, 1800); // 1300 over

    const augustOver = await dashboardService.getDashboard(8, 2026);
    console.log(`   August Remaining on Over-Investment: ${augustOver.currentMonthRemaining} (Expected: 0, never negative)`);
    if (augustOver.currentMonthRemaining !== 0) {
      console.error('❌ Over-investment remaining should be 0!', augustOver);
      process.exit(1);
    }

    const sepAfterOver = await dashboardService.getDashboard(9, 2026);
    console.log(`   September Target after August Over-Investment: ${sepAfterOver.currentMonthTarget} (Expected: 2000, not reduced)`);
    console.log(`   September Carry Forward: ${sepAfterOver.previousCarryForward} (Expected: 0)`);
    if (sepAfterOver.currentMonthTarget !== 2000 || sepAfterOver.previousCarryForward !== 0) {
      console.error('❌ Over-investment should not reduce next month target!', sepAfterOver);
      process.exit(1);
    }
    console.log('✅ Over-Investment PASS: Remaining=0, next month target remains base amount (2000).\n');

    // Step 8: Multi-Month Total Investment Test (July 1500 + August 1500 + September 2000 = 5000)
    console.log('8. Testing Multi-Month Total Investment across July, August, September...');
    await monthlyInvestmentService.upsertActualAmount(nifty.id, 2026, 8, 500); // reset aug nifty
    await monthlyInvestmentService.upsertActualAmount(nifty.id, 2026, 9, 800);
    await monthlyInvestmentService.upsertActualAmount(next50.id, 2026, 9, 500);
    await monthlyInvestmentService.upsertActualAmount(midcap.id, 2026, 9, 400);
    await monthlyInvestmentService.upsertActualAmount(smallcap.id, 2026, 9, 300);

    const sepDashboard = await dashboardService.getDashboard(9, 2026);
    console.log(`   September Total Investment: ${sepDashboard.totalInvestment} (Expected: 5000 = 1500 + 1500 + 2000)`);
    if (sepDashboard.totalInvestment !== 5000) {
      console.error('❌ Multi-month total investment failed!', sepDashboard);
      process.exit(1);
    }
    console.log('✅ Multi-Month Total Investment PASS: 5000.\n');
  } finally {
    // Step 9: Self-clean all test rows so spreadsheet is completely empty for real user usage
    console.log('9. Self-cleaning all test rows from Google Sheets...');
    await googleSheetsService.clearDataRows(SHEET_TABS.MONTHLY_INVESTMENTS);
    await googleSheetsService.clearDataRows(SHEET_TABS.INVESTMENT_PLAN);
    await googleSheetsService.clearDataRows(SHEET_TABS.PLAN_HISTORY);
    await googleSheetsService.clearDataRows(SHEET_TABS.SETTINGS);
    console.log('✅ All test rows cleaned.');
  }

  console.log('\n====================================================');
  console.log('🎉 ALL PHASE D DASHBOARD INTEGRATION TESTS PASSED (CLEAN)!');
  console.log('====================================================');
}

runDashboardTests().catch((err) => {
  console.error('❌ Dashboard test failed with error:', err);
  process.exit(1);
});
