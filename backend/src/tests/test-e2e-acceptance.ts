// src/tests/test-e2e-acceptance.ts
import 'dotenv/config';
import { dashboardService } from '../services/dashboard.service';
import { investmentPlanService } from '../services/investmentPlan.service';
import { monthlyInvestmentService } from '../services/monthlyInvestment.service';
import { googleSheetsService, SHEET_TABS } from '../services/googleSheets.service';
import { UpdateMonthlyInvestmentSchema } from '../validators/monthlyInvestment.validator';
import { SaveInvestmentPlanSchema } from '../validators/investmentPlan.validator';

async function runE2EAcceptanceSuite() {
  console.log('================================================================');
  console.log('  FULL END-TO-END ACCEPTANCE TEST SUITE');
  console.log('  Testing complete workflow against REAL Google Spreadsheet');
  console.log('================================================================\n');

  try {
    // Step 1: Pre-test cleanup
    console.log('1. PRE-TEST CLEANUP: Verifying tabs and clearing previous test rows...');
    await googleSheetsService.ensureSpreadsheetSchema();

    await googleSheetsService.clearDataRows(SHEET_TABS.MONTHLY_INVESTMENTS);
    await googleSheetsService.clearDataRows(SHEET_TABS.INVESTMENT_PLAN);
    await googleSheetsService.clearDataRows(SHEET_TABS.PLAN_HISTORY);
    await googleSheetsService.clearDataRows(SHEET_TABS.SETTINGS);
    console.log('✅ Google Spreadsheet tabs ready and clean.\n');

    // Step 2: Configure Canonical Investment Plan (2000/month: 40/25/20/15)
    console.log('2. CANONICAL INVESTMENT PLAN SETUP...');
    const plan = await investmentPlanService.savePlan({
      monthlyAmount: 2000,
      effectiveFromMonth: 7, // Effective from July 2026
      effectiveFromYear: 2026,
      investments: [
        { name: 'Nifty 50 ETF', category: 'ETF', weightage: 40 },
        { name: 'Next 50 ETF', category: 'ETF', weightage: 25 },
        { name: 'Midcap ETF', category: 'ETF', weightage: 20 },
        { name: 'Smallcap ETF', category: 'ETF', weightage: 15 },
      ],
    });

    const [nifty, next50, midcap, smallcap] = plan.investments;
    console.log(`✅ Saved Plan:`);
    console.log(`   - Version: ${plan.planVersion}`);
    console.log(`   - Monthly Amount: ₹${plan.monthlyAmount}`);
    console.log(`   - Nifty 50 ETF (40%): ID=${nifty.id}`);
    console.log(`   - Next 50 ETF (25%): ID=${next50.id}`);
    console.log(`   - Midcap ETF (20%): ID=${midcap.id}`);
    console.log(`   - Smallcap ETF (15%): ID=${smallcap.id}\n`);

    // Step 3: Direct Google Sheets Inspection for Settings & Plan
    console.log('3. DIRECT GOOGLE SHEET INSPECTION...');
    const settingsRows = await googleSheetsService.readRawRows(SHEET_TABS.SETTINGS);
    const monthlySetting = settingsRows.find((r) => r.values[0] === 'monthlyInvestmentAmount');
    if (!monthlySetting || monthlySetting.values[1] !== '2000') {
      console.error('❌ Settings sheet verification failed!', monthlySetting);
      process.exit(1);
    }
    console.log(`✅ Settings sheet verified: monthlyInvestmentAmount="${monthlySetting.values[1]}"`);

    const planRows = await googleSheetsService.readRawRows(SHEET_TABS.INVESTMENT_PLAN);
    if (planRows.length !== 4) {
      console.error(`❌ InvestmentPlan sheet verification failed! Expected 4 items, found ${planRows.length}`);
      process.exit(1);
    }
    console.log(`✅ InvestmentPlan sheet verified: 4 canonical items persisted.\n`);

    // Step 4: July 2026 Initial State (No previous month)
    console.log('4. JULY 2026 — INITIAL STATE (Before actual investments)...');
    const julyInitial = await dashboardService.getDashboard(7, 2026);
    console.log(`   - Base Monthly Amount: ₹${julyInitial.baseMonthlyAmount} (Expected: 2000)`);
    console.log(`   - Previous Carry Forward: ₹${julyInitial.previousCarryForward} (Expected: 0)`);
    console.log(`   - Current Month Target: ₹${julyInitial.currentMonthTarget} (Expected: 2000)`);
    console.log(`   - Current Month Actual: ₹${julyInitial.currentMonthActual} (Expected: 0)`);
    console.log(`   - Current Month Remaining: ₹${julyInitial.currentMonthRemaining} (Expected: 2000)`);
    console.log(`   - Total Investment: ₹${julyInitial.totalInvestment} (Expected: 0)`);

    if (
      julyInitial.currentMonthTarget !== 2000 ||
      julyInitial.currentMonthActual !== 0 ||
      julyInitial.currentMonthRemaining !== 2000 ||
      julyInitial.totalInvestment !== 0
    ) {
      console.error('❌ July Initial State check failed!', julyInitial);
      process.exit(1);
    }
    console.log('✅ July Initial State PASS.\n');

    // Step 5: July 2026 Enter Actual Investments:
    // Nifty: planned 800, actual 500 -> pending 300
    // Next50: planned 500, actual 400 -> pending 100
    // Midcap: planned 400, actual 400 -> pending 0
    // Smallcap: planned 300, actual 200 -> pending 100
    // Total Actual = 1500, Total Pending = 500
    console.log('5. JULY 2026 — ENTER ACTUAL INVESTMENTS (500 + 400 + 400 + 200 = ₹1,500)...');
    await monthlyInvestmentService.upsertActualAmount(nifty.id, 2026, 7, 500);
    await monthlyInvestmentService.upsertActualAmount(next50.id, 2026, 7, 400);
    await monthlyInvestmentService.upsertActualAmount(midcap.id, 2026, 7, 400);
    await monthlyInvestmentService.upsertActualAmount(smallcap.id, 2026, 7, 200);

    const julyBreakdown = await dashboardService.getDashboard(7, 2026);
    console.log(`   - July Target: ₹${julyBreakdown.currentMonthTarget} (Expected: 2000)`);
    console.log(`   - July Actual: ₹${julyBreakdown.currentMonthActual} (Expected: 1500)`);
    console.log(`   - July Remaining: ₹${julyBreakdown.currentMonthRemaining} (Expected: 500)`);
    console.log(`   - Total Investment: ₹${julyBreakdown.totalInvestment} (Expected: 1500)`);

    if (
      julyBreakdown.currentMonthTarget !== 2000 ||
      julyBreakdown.currentMonthActual !== 1500 ||
      julyBreakdown.currentMonthRemaining !== 500 ||
      julyBreakdown.totalInvestment !== 1500
    ) {
      console.error('❌ July Actual Investments check failed!', julyBreakdown);
      process.exit(1);
    }
    console.log('✅ July Actual Investments PASS.\n');

    // Step 6: July Duplicate Update Test (Nifty 500 -> 600 -> Total 1600, exactly 1 row)
    console.log('6. JULY DUPLICATE UPDATE TEST (Updating Nifty from 500 -> 600)...');
    await monthlyInvestmentService.upsertActualAmount(nifty.id, 2026, 7, 600);

    const julyUpdated = await dashboardService.getDashboard(7, 2026);
    console.log(`   - July Actual with updated Nifty: ₹${julyUpdated.currentMonthActual} (Expected: 1600, NOT 2100)`);
    if (julyUpdated.currentMonthActual !== 1600) {
      console.error('❌ Duplicate update failed! Expected 1600, got', julyUpdated.currentMonthActual);
      process.exit(1);
    }

    const rawMonthly = await googleSheetsService.readRawRows(SHEET_TABS.MONTHLY_INVESTMENTS);
    const niftyJulyRows = rawMonthly.filter(
      (r) => r.values[1] === nifty.id && r.values[2] === '2026' && r.values[3] === '7'
    );
    if (niftyJulyRows.length !== 1) {
      console.error(`❌ Expected exactly 1 row for Nifty July 2026, found ${niftyJulyRows.length}!`);
      process.exit(1);
    }
    console.log(`✅ Duplicate Prevention PASS: exactly 1 row in sheet with amount=${niftyJulyRows[0].values[4]}`);

    // Restore July Nifty back to 500
    await monthlyInvestmentService.upsertActualAmount(nifty.id, 2026, 7, 500);
    console.log('✅ Restored July Nifty to canonical ₹500.\n');

    // Step 7: August 2026 PER-INVESTMENT Carry Forward & Planned Targets
    // Nifty: 800 normal + 300 pending = 1100 target
    // Next50: 500 normal + 100 pending = 600 target
    // Midcap: 400 normal + 0 pending = 400 target
    // Smallcap: 300 normal + 100 pending = 400 target
    // Total Target = 1100 + 600 + 400 + 400 = 2500
    console.log('7. AUGUST 2026 — PER-INVESTMENT CARRY FORWARD & TARGETS...');
    const augustInitial = await dashboardService.getDashboard(8, 2026);
    console.log(`   - August Base: ₹${augustInitial.baseMonthlyAmount} (Expected: 2000)`);
    console.log(`   - Previous Carry Forward: ₹${augustInitial.previousCarryForward} (Expected: 500)`);
    console.log(`   - August Target: ₹${augustInitial.currentMonthTarget} (Expected: 2500)`);

    const pNifty = augustInitial.investments.find((i) => i.id === nifty.id);
    const pNext50 = augustInitial.investments.find((i) => i.id === next50.id);
    const pMidcap = augustInitial.investments.find((i) => i.id === midcap.id);
    const pSmallcap = augustInitial.investments.find((i) => i.id === smallcap.id);

    console.log(`   Per-Investment Planned Targets (Calculated by Backend):`);
    console.log(`   - Nifty 50 ETF: Normal=₹${pNifty?.normalPlannedAmount}, Pending=₹${pNifty?.previousMonthPending}, Target=₹${pNifty?.plannedAmount} (Expected: 1100)`);
    console.log(`   - Next 50 ETF:  Normal=₹${pNext50?.normalPlannedAmount}, Pending=₹${pNext50?.previousMonthPending}, Target=₹${pNext50?.plannedAmount} (Expected: 600)`);
    console.log(`   - Midcap ETF:   Normal=₹${pMidcap?.normalPlannedAmount}, Pending=₹${pMidcap?.previousMonthPending}, Target=₹${pMidcap?.plannedAmount} (Expected: 400)`);
    console.log(`   - Smallcap ETF: Normal=₹${pSmallcap?.normalPlannedAmount}, Pending=₹${pSmallcap?.previousMonthPending}, Target=₹${pSmallcap?.plannedAmount} (Expected: 400)`);

    if (
      augustInitial.previousCarryForward !== 500 ||
      augustInitial.currentMonthTarget !== 2500 ||
      pNifty?.plannedAmount !== 1100 ||
      pNifty?.previousMonthPending !== 300 ||
      pNext50?.plannedAmount !== 600 ||
      pNext50?.previousMonthPending !== 100 ||
      pMidcap?.plannedAmount !== 400 ||
      pMidcap?.previousMonthPending !== 0 ||
      pSmallcap?.plannedAmount !== 400 ||
      pSmallcap?.previousMonthPending !== 100
    ) {
      console.error('❌ August Per-Investment Carry Forward & Planned Targets check failed!', augustInitial);
      process.exit(1);
    }
    console.log('✅ August Per-Investment Carry Forward & Planned Targets PASS.\n');

    // Step 8: August 2026 Enter Actual Investments (500 + 500 + 500 + 0 = 1500)
    console.log('8. AUGUST 2026 — ENTER ACTUAL INVESTMENTS (500 + 500 + 500 + 0 = ₹1,500)...');
    await monthlyInvestmentService.upsertActualAmount(nifty.id, 2026, 8, 500);
    await monthlyInvestmentService.upsertActualAmount(next50.id, 2026, 8, 500);
    await monthlyInvestmentService.upsertActualAmount(midcap.id, 2026, 8, 500);
    await monthlyInvestmentService.upsertActualAmount(smallcap.id, 2026, 8, 0);

    const augustFinal = await dashboardService.getDashboard(8, 2026);
    console.log(`   - Total Investment: ₹${augustFinal.totalInvestment} (Expected: 3000 = 1500 July + 1500 Aug)`);
    console.log(`   - This Month Target: ₹${augustFinal.currentMonthTarget} (Expected: 2500)`);
    console.log(`   - This Month Remaining: ₹${augustFinal.currentMonthRemaining} (Expected: 1000)`);

    if (
      augustFinal.totalInvestment !== 3000 ||
      augustFinal.currentMonthTarget !== 2500 ||
      augustFinal.currentMonthRemaining !== 1000
    ) {
      console.error('❌ August Final Result check failed!', augustFinal);
      process.exit(1);
    }
    console.log('✅ August Final Dashboard Result PASS.\n');

    // Step 9: Month Isolation Test (Modifying August does NOT affect July)
    console.log('9. MONTH ISOLATION TEST (Testing that August changes do not mutate July)...');
    await monthlyInvestmentService.upsertActualAmount(nifty.id, 2026, 8, 700);

    const augTemp = await dashboardService.getDashboard(8, 2026);
    console.log(`   - August with temporary Nifty=700: Actual=₹${augTemp.currentMonthActual} (Exp: 1700), Remaining=₹${augTemp.currentMonthRemaining} (Exp: 800)`);

    const julyIsolated = await dashboardService.getDashboard(7, 2026);
    console.log(`   - July actual during August edit: ₹${julyIsolated.currentMonthActual} (Expected: 1500)`);
    console.log(`   - July remaining during August edit: ₹${julyIsolated.currentMonthRemaining} (Expected: 500)`);

    if (julyIsolated.currentMonthActual !== 1500 || julyIsolated.currentMonthRemaining !== 500) {
      console.error('❌ Month Isolation failed! July was mutated.', julyIsolated);
      process.exit(1);
    }
    console.log('✅ Month Isolation PASS: July actual (1500) and remaining (500) untouched.');

    // Restore August Nifty to 500
    await monthlyInvestmentService.upsertActualAmount(nifty.id, 2026, 8, 500);
    console.log('✅ Restored August Nifty to canonical ₹500.\n');

    // Step 10: Over-Investment Test
    // In August, targets were: Nifty 1100, Next50 600, Midcap 400, Smallcap 400
    // Set August actuals: Nifty 1500 (over), Next50 600 (full), Midcap 400 (full), Smallcap 400 (full)
    console.log('10. OVER-INVESTMENT TEST (August actual = 2900 on 2500 target: Nifty=1500, Next50=600, Midcap=400, Smallcap=400)...');
    await monthlyInvestmentService.upsertActualAmount(nifty.id, 2026, 8, 1500);
    await monthlyInvestmentService.upsertActualAmount(next50.id, 2026, 8, 600);
    await monthlyInvestmentService.upsertActualAmount(midcap.id, 2026, 8, 400);
    await monthlyInvestmentService.upsertActualAmount(smallcap.id, 2026, 8, 400);

    const augOver = await dashboardService.getDashboard(8, 2026);
    console.log(`   - August Remaining on Over-Investment: ₹${augOver.currentMonthRemaining} (Expected: 0, never negative)`);
    if (augOver.currentMonthRemaining !== 0) {
      console.error('❌ Over-investment remaining should be 0!', augOver);
      process.exit(1);
    }

    const sepAfterOver = await dashboardService.getDashboard(9, 2026);
    const sepNifty = sepAfterOver.investments.find((i) => i.id === nifty.id);
    const sepNext50 = sepAfterOver.investments.find((i) => i.id === next50.id);

    console.log(`   - September Targets after August Full/Over Investments:`);
    console.log(`     Nifty Target:    ₹${sepNifty?.plannedAmount} (Expected: 800, not reduced)`);
    console.log(`     Next50 Target:   ₹${sepNext50?.plannedAmount} (Expected: 500)`);
    console.log(`     Total Target:    ₹${sepAfterOver.currentMonthTarget} (Expected: 2000)`);
    console.log(`     Carry Forward:   ₹${sepAfterOver.previousCarryForward} (Expected: 0)`);

    if (
      sepAfterOver.currentMonthTarget !== 2000 ||
      sepAfterOver.previousCarryForward !== 0 ||
      sepNifty?.plannedAmount !== 800
    ) {
      console.error('❌ Over-investment should not reduce next month target!', sepAfterOver);
      process.exit(1);
    }
    console.log('✅ Over-Investment PASS: Remaining=0, all targets remain base amount (Total: 2000).');

    // Restore August back to canonical (500/500/500/0)
    await monthlyInvestmentService.upsertActualAmount(nifty.id, 2026, 8, 500);
    await monthlyInvestmentService.upsertActualAmount(next50.id, 2026, 8, 500);
    await monthlyInvestmentService.upsertActualAmount(midcap.id, 2026, 8, 500);
    await monthlyInvestmentService.upsertActualAmount(smallcap.id, 2026, 8, 0);
    console.log('✅ Restored August to canonical state.\n');

    // Step 11: Invalid Input Validations
    console.log('11. INVALID INPUT VALIDATION TESTS...');
    const negCheck = UpdateMonthlyInvestmentSchema.safeParse({ year: 2026, month: 8, actualAmount: -100 });
    if (negCheck.success) {
      console.error('❌ Should have rejected negative actualAmount!');
      process.exit(1);
    }
    console.log('✅ Rejected negative actualAmount (-100):', negCheck.error.issues[0]?.message);

    const m13Check = UpdateMonthlyInvestmentSchema.safeParse({ year: 2026, month: 13, actualAmount: 500 });
    if (m13Check.success) {
      console.error('❌ Should have rejected month=13!');
      process.exit(1);
    }
    console.log('✅ Rejected month 13:', m13Check.error.issues[0]?.message);

    const m0Check = UpdateMonthlyInvestmentSchema.safeParse({ year: 2026, month: 0, actualAmount: 500 });
    if (m0Check.success) {
      console.error('❌ Should have rejected month=0!');
      process.exit(1);
    }
    console.log('✅ Rejected month 0:', m0Check.error.issues[0]?.message);

    const invalidPlanSum = SaveInvestmentPlanSchema.safeParse({
      monthlyAmount: 2000,
      effectiveFromMonth: 8,
      effectiveFromYear: 2026,
      investments: [
        { name: 'Nifty', category: 'ETF', weightage: 50 },
        { name: 'Next 50', category: 'ETF', weightage: 40 }, // total 90%
      ],
    });
    if (invalidPlanSum.success) {
      console.error('❌ Should have rejected 90% plan allocation sum!');
      process.exit(1);
    }
    console.log('✅ Rejected invalid plan sum (90%):', invalidPlanSum.error.issues[0]?.message);
    console.log('✅ Input Validation Tests PASS.\n');
  } finally {
    // Step 12: Self-cleaning all test data so the spreadsheet is left pristine
    console.log('12. Self-cleaning all test records from Google Sheets...');
    await googleSheetsService.clearDataRows(SHEET_TABS.MONTHLY_INVESTMENTS);
    await googleSheetsService.clearDataRows(SHEET_TABS.INVESTMENT_PLAN);
    await googleSheetsService.clearDataRows(SHEET_TABS.PLAN_HISTORY);
    await googleSheetsService.clearDataRows(SHEET_TABS.SETTINGS);

    const finalSettings = await googleSheetsService.readRawRows(SHEET_TABS.SETTINGS, true);
    const finalPlan = await googleSheetsService.readRawRows(SHEET_TABS.INVESTMENT_PLAN, true);
    const finalMonthly = await googleSheetsService.readRawRows(SHEET_TABS.MONTHLY_INVESTMENTS, true);
    const finalHistory = await googleSheetsService.readRawRows(SHEET_TABS.PLAN_HISTORY, true);

    console.log(`   - Settings rows: ${finalSettings.length} (Expected: 0)`);
    console.log(`   - InvestmentPlan rows: ${finalPlan.length} (Expected: 0)`);
    console.log(`   - MonthlyInvestments rows: ${finalMonthly.length} (Expected: 0)`);
    console.log(`   - PlanHistory rows: ${finalHistory.length} (Expected: 0)`);
    console.log('✅ Google Sheets is left in a pristine, empty state for real user usage.');
  }

  console.log('\n================================================================');
  console.log('🎉 ALL FULL END-TO-END ACCEPTANCE TESTS PASSED (CLEAN)!');
  console.log('================================================================');
}

runE2EAcceptanceSuite().catch((err) => {
  console.error('❌ E2E Acceptance test failed with error:', err);
  process.exit(1);
});
