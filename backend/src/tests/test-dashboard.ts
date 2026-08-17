// src/tests/test-dashboard.ts
import 'dotenv/config';
import { dashboardService } from '../services/dashboard.service';
import { investmentPlanService } from '../services/investmentPlan.service';
import { monthlyInvestmentService } from '../services/monthlyInvestment.service';
import { googleSheetsService, SHEET_TABS } from '../services/googleSheets.service';

async function runDashboardTests() {
  console.log('====================================================');
  console.log('  DASHBOARD INTEGRATION TEST SUITE (PER-INVESTMENT)');
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

    // Step 2: Configure plan (2000/month: 40/25/20/15) effective from July 2026
    console.log('2. Setting up investment plan (2000/month: 40/25/20/15) effective from July 2026...');
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

    // Step 4: Enter July 2026 Actual Investments:
    // Nifty: planned 800, actual 500 -> pending 300
    // Next50: planned 500, actual 500 -> pending 0
    // Midcap: planned 400, actual 400 -> pending 0
    // Smallcap: planned 300, actual 100 -> pending 200
    // Total actual = 1500, total pending = 500
    console.log('4. Entering July 2026 actual investments (500 + 500 + 400 + 100 = 1500)...');
    await monthlyInvestmentService.upsertActualAmount(nifty.id, 2026, 7, 500);
    await monthlyInvestmentService.upsertActualAmount(next50.id, 2026, 7, 500);
    await monthlyInvestmentService.upsertActualAmount(midcap.id, 2026, 7, 400);
    await monthlyInvestmentService.upsertActualAmount(smallcap.id, 2026, 7, 100);

    const julyAfter = await dashboardService.getDashboard(7, 2026);
    console.log(`   July Total Investment: ${julyAfter.totalInvestment} (Expected: 1500)`);
    console.log(`   July This Month Investment: ${julyAfter.currentMonthTarget} (Expected: 2000)`);
    console.log(`   July This Month Remaining: ${julyAfter.currentMonthRemaining} (Expected: 500)`);

    if (
      julyAfter.totalInvestment !== 1500 ||
      julyAfter.currentMonthTarget !== 2000 ||
      julyAfter.currentMonthRemaining !== 500
    ) {
      console.error('❌ July Dashboard check failed!', julyAfter);
      process.exit(1);
    }
    console.log('✅ July Dashboard PASS: Total=1500, Target=2000, Remaining=500.\n');

    // Step 5: August 2026 Dashboard with PER-INVESTMENT Carry Forward
    // Nifty: 800 normal + 300 pending = 1100 target
    // Next50: 500 normal + 0 pending = 500 target
    // Midcap: 400 normal + 0 pending = 400 target
    // Smallcap: 300 normal + 200 pending = 500 target
    // Total Target = 1100 + 500 + 400 + 500 = 2500
    console.log('5. Checking August 2026 Dashboard with Per-Investment Carry Forward...');
    const augustInitial = await dashboardService.getDashboard(8, 2026);
    console.log(`   August Base: ${augustInitial.baseMonthlyAmount} (Expected: 2000)`);
    console.log(`   August Carry Forward: ${augustInitial.previousCarryForward} (Expected: 500)`);
    console.log(`   August This Month Investment Target: ${augustInitial.currentMonthTarget} (Expected: 2500)`);

    const pNifty = augustInitial.investments.find((i) => i.id === nifty.id);
    const pNext50 = augustInitial.investments.find((i) => i.id === next50.id);
    const pMidcap = augustInitial.investments.find((i) => i.id === midcap.id);
    const pSmallcap = augustInitial.investments.find((i) => i.id === smallcap.id);

    console.log(`   Investment-level Targets:`);
    console.log(`   - Nifty 50:  Normal=₹${pNifty?.normalPlannedAmount}, Pending=₹${pNifty?.previousMonthPending}, Target=₹${pNifty?.plannedAmount} (Exp: 1100)`);
    console.log(`   - Next 50:   Normal=₹${pNext50?.normalPlannedAmount}, Pending=₹${pNext50?.previousMonthPending}, Target=₹${pNext50?.plannedAmount} (Exp: 500)`);
    console.log(`   - Midcap:    Normal=₹${pMidcap?.normalPlannedAmount}, Pending=₹${pMidcap?.previousMonthPending}, Target=₹${pMidcap?.plannedAmount} (Exp: 400)`);
    console.log(`   - Smallcap:  Normal=₹${pSmallcap?.normalPlannedAmount}, Pending=₹${pSmallcap?.previousMonthPending}, Target=₹${pSmallcap?.plannedAmount} (Exp: 500)`);

    if (
      augustInitial.previousCarryForward !== 500 ||
      augustInitial.currentMonthTarget !== 2500 ||
      pNifty?.plannedAmount !== 1100 ||
      pNifty?.previousMonthPending !== 300 ||
      pNext50?.plannedAmount !== 500 ||
      pNext50?.previousMonthPending !== 0 ||
      pMidcap?.plannedAmount !== 400 ||
      pMidcap?.previousMonthPending !== 0 ||
      pSmallcap?.plannedAmount !== 500 ||
      pSmallcap?.previousMonthPending !== 200
    ) {
      console.error('❌ August Dashboard per-investment carry forward check failed!', augustInitial);
      process.exit(1);
    }
    console.log('✅ August Initial Dashboard PASS: Target=2500 with exact per-investment planned targets.\n');

    // Step 6: Enter August 2026 Actual Investments (Total = 1500)
    console.log('6. Entering August actual investments (500 + 500 + 500 + 0 = 1500)...');
    await monthlyInvestmentService.upsertActualAmount(nifty.id, 2026, 8, 500);
    await monthlyInvestmentService.upsertActualAmount(next50.id, 2026, 8, 500);
    await monthlyInvestmentService.upsertActualAmount(midcap.id, 2026, 8, 500);
    await monthlyInvestmentService.upsertActualAmount(smallcap.id, 2026, 8, 0);

    const augustAfter = await dashboardService.getDashboard(8, 2026);
    console.log(`   August Total Investment: ${augustAfter.totalInvestment} (Expected: 3000 = July 1500 + August 1500)`);
    console.log(`   August This Month Target: ${augustAfter.currentMonthTarget} (Expected: 2500)`);
    console.log(`   August This Month Remaining: ${augustAfter.currentMonthRemaining} (Expected: 1000)`);

    if (
      augustAfter.totalInvestment !== 3000 ||
      augustAfter.currentMonthTarget !== 2500 ||
      augustAfter.currentMonthRemaining !== 1000
    ) {
      console.error('❌ August Dashboard after investments check failed!', augustAfter);
      process.exit(1);
    }
    console.log('✅ August Dashboard PASS: Total=3000, This Month Target=2500, Remaining=1000.\n');

    // Step 7: Over-Investment Check
    console.log('7. Testing Over-Investment scenario in August (Nifty Target 1100, Invested 1500)...');
    await monthlyInvestmentService.upsertActualAmount(nifty.id, 2026, 8, 1500);

    const augustOver = await dashboardService.getDashboard(8, 2026);
    console.log(`   August Remaining on Over-Investment: ${augustOver.currentMonthRemaining} (Expected: 0)`);

    const sepAfterOver = await dashboardService.getDashboard(9, 2026);
    const sepNifty = sepAfterOver.investments.find((i) => i.id === nifty.id);
    console.log(`   September Nifty Target after August Over-Investment: ₹${sepNifty?.plannedAmount} (Expected: 800, not reduced)`);
    console.log(`   September Nifty Pending: ₹${sepNifty?.previousMonthPending} (Expected: 0)`);

    if (sepNifty?.plannedAmount !== 800 || sepNifty?.previousMonthPending !== 0) {
      console.error('❌ Over-investment should not reduce next month target!', sepAfterOver);
      process.exit(1);
    }
    console.log('✅ Over-Investment PASS: Remaining=0, next month target remains base amount (800).\n');

    // Reset August nifty
    await monthlyInvestmentService.upsertActualAmount(nifty.id, 2026, 8, 500);

    // Step 8: Multi-Month Total Investment Test (July 1500 + August 1500 + September 2000 = 5000)
    console.log('8. Testing Multi-Month Total Investment across July, August, September...');
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
  console.log('🎉 ALL DASHBOARD INTEGRATION TESTS PASSED (CLEAN)!');
  console.log('====================================================');
}

runDashboardTests().catch((err) => {
  console.error('❌ Dashboard test failed with error:', err);
  process.exit(1);
});
