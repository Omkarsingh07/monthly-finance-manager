// src/tests/test-monthly-investments.ts
import 'dotenv/config';
import { investmentPlanService } from '../services/investmentPlan.service';
import { monthlyInvestmentService } from '../services/monthlyInvestment.service';
import { googleSheetsService, SHEET_TABS } from '../services/googleSheets.service';
import { UpdateMonthlyInvestmentSchema } from '../validators/monthlyInvestment.validator';

async function runPhaseCTests() {
  console.log('======================================================');
  console.log('  PHASE C — MONTHLY INVESTMENTS GOOGLE SHEETS SUITE');
  console.log('======================================================\n');

  try {
    // Step 0: Clean sheets for pristine test execution using single-call clearDataRows
    console.log('0. Cleaning test tabs for pristine test execution...');
    await googleSheetsService.ensureSpreadsheetSchema();

    await googleSheetsService.clearDataRows(SHEET_TABS.MONTHLY_INVESTMENTS);
    await googleSheetsService.clearDataRows(SHEET_TABS.INVESTMENT_PLAN);
    await googleSheetsService.clearDataRows(SHEET_TABS.PLAN_HISTORY);
    await googleSheetsService.clearDataRows(SHEET_TABS.SETTINGS);
    console.log('✅ Cleaned previous test rows instantly via clearDataRows.\n');

    // Setup canonical investment plan effective from July 2026
    console.log('Setting up canonical investment plan (2000/month: 40/25/20/15) effective from July 2026...');
    const plan = await investmentPlanService.savePlan({
      monthlyAmount: 2000,
      effectiveFromMonth: 7, // Effective from July 2026
      effectiveFromYear: 2026,
      investments: [
        { name: 'Nippon India Nifty 50 ETF', category: 'ETF', weightage: 40 },
        { name: 'ICICI Prudential Nifty Next 50 ETF', category: 'ETF', weightage: 25 },
        { name: 'Mirae Asset Nifty Midcap 150 ETF', category: 'ETF', weightage: 20 },
        { name: 'HDFC Nifty Smallcap 250 ETF', category: 'ETF', weightage: 15 },
      ],
    });

    const niftyId = plan.investments[0].id;
    const next50Id = plan.investments[1].id;
    const midcapId = plan.investments[2].id;
    const smallcapId = plan.investments[3].id;

    console.log(`✅ Canonical plan saved! Nifty50=${niftyId}, Next50=${next50Id}, Midcap=${midcapId}, Smallcap=${smallcapId}\n`);

    // Step 1: Input Validation Tests
    console.log('1. Testing validation: rejecting negative actual amount and invalid month...');
    const invalidNegative = UpdateMonthlyInvestmentSchema.safeParse({
      year: 2026,
      month: 8,
      actualAmount: -50,
    });
    if (invalidNegative.success) {
      console.error('❌ Validation should have failed for negative actual amount!');
      process.exit(1);
    }
    console.log('✅ Correctly rejected negative amount:', invalidNegative.error.issues[0]?.message);

    const invalidMonth = UpdateMonthlyInvestmentSchema.safeParse({
      year: 2026,
      month: 13,
      actualAmount: 500,
    });
    if (invalidMonth.success) {
      console.error('❌ Validation should have failed for month=13!');
      process.exit(1);
    }
    console.log('✅ Correctly rejected invalid month 13:', invalidMonth.error.issues[0]?.message);

    // Step 2: Test A — No previous month data (July 2026)
    console.log('\n2. Test A: July 2026 (No previous month data)...');
    const julyInitial = await monthlyInvestmentService.getMonthlyBreakdown(7, 2026);
    console.log(`   July Target: ${julyInitial.currentMonthTarget} (Expected: 2000)`);
    console.log(`   July Carry Forward: ${julyInitial.previousCarryForward} (Expected: 0)`);
    if (julyInitial.currentMonthTarget !== 2000 || julyInitial.previousCarryForward !== 0) {
      console.error('❌ Test A failed!', julyInitial);
      process.exit(1);
    }
    console.log('✅ Test A PASS: Initial target = 2000, Carry Forward = 0.');

    // Step 3: Enter July actual investment = 1500 (partially invested)
    console.log('\n3. Entering July 2026 actual investments (Total: 1500)...');
    await monthlyInvestmentService.upsertActualAmount(niftyId, 2026, 7, 750);
    await monthlyInvestmentService.upsertActualAmount(next50Id, 2026, 7, 450);
    await monthlyInvestmentService.upsertActualAmount(midcapId, 2026, 7, 300);
    await monthlyInvestmentService.upsertActualAmount(smallcapId, 2026, 7, 0);

    const julyBreakdown = await monthlyInvestmentService.getMonthlyBreakdown(7, 2026);
    console.log(`   July Actual: ${julyBreakdown.currentMonthActual} (Expected: 1500)`);
    console.log(`   July Remaining: ${julyBreakdown.currentMonthRemaining} (Expected: 500)`);
    if (julyBreakdown.currentMonthActual !== 1500 || julyBreakdown.currentMonthRemaining !== 500) {
      console.error('❌ July breakdown check failed!', julyBreakdown);
      process.exit(1);
    }
    console.log('✅ July actual = 1500, remaining = 500 verified.');

    // Step 4: Test B — Previous month partially invested -> August 2026 target = 2500
    console.log('\n4. Test B: August 2026 carry forward from partially invested July...');
    const augustInitial = await monthlyInvestmentService.getMonthlyBreakdown(8, 2026);
    console.log(`   August Base: ${augustInitial.baseMonthlyAmount} (Expected: 2000)`);
    console.log(`   August Carry Forward: ${augustInitial.previousCarryForward} (Expected: 500)`);
    console.log(`   August Target: ${augustInitial.currentMonthTarget} (Expected: 2500)`);

    const plannedNifty = augustInitial.investments.find((i) => i.id === niftyId)?.plannedAmount;
    const plannedNext50 = augustInitial.investments.find((i) => i.id === next50Id)?.plannedAmount;
    const plannedMidcap = augustInitial.investments.find((i) => i.id === midcapId)?.plannedAmount;
    const plannedSmallcap = augustInitial.investments.find((i) => i.id === smallcapId)?.plannedAmount;

    console.log(`   Planned amounts: Nifty50=${plannedNifty} (Exp: 1000), Next50=${plannedNext50} (Exp: 625), Midcap=${plannedMidcap} (Exp: 500), Smallcap=${plannedSmallcap} (Exp: 375)`);

    if (
      augustInitial.previousCarryForward !== 500 ||
      augustInitial.currentMonthTarget !== 2500 ||
      plannedNifty !== 1000 ||
      plannedNext50 !== 625 ||
      plannedMidcap !== 500 ||
      plannedSmallcap !== 375
    ) {
      console.error('❌ Test B failed!', augustInitial);
      process.exit(1);
    }
    console.log('✅ Test B PASS: August Target = 2500 with exact planned allocations.');

    // Step 5: Test E — Enter August actual investments (Nifty: 500, Next50: 500, Midcap: 500, Smallcap: 0) -> Total Actual = 1500, Remaining = 1000
    console.log('\n5. Test E: Entering August actual investments (500 + 500 + 500 + 0 = 1500)...');
    await monthlyInvestmentService.upsertActualAmount(niftyId, 2026, 8, 500);
    await monthlyInvestmentService.upsertActualAmount(next50Id, 2026, 8, 500);
    await monthlyInvestmentService.upsertActualAmount(midcapId, 2026, 8, 500);
    await monthlyInvestmentService.upsertActualAmount(smallcapId, 2026, 8, 0);

    const augustBreakdown = await monthlyInvestmentService.getMonthlyBreakdown(8, 2026);
    console.log(`   August Actual: ${augustBreakdown.currentMonthActual} (Expected: 1500)`);
    console.log(`   August Remaining: ${augustBreakdown.currentMonthRemaining} (Expected: 1000)`);

    if (augustBreakdown.currentMonthActual !== 1500 || augustBreakdown.currentMonthRemaining !== 1000) {
      console.error('❌ Test E failed!', augustBreakdown);
      process.exit(1);
    }
    console.log('✅ Test E PASS: August Actual = 1500, August Remaining = 1000.');

    // Step 6: Test Duplicate Prevention & Row Updating in Google Sheets
    console.log('\n6. Testing duplicate prevention & row update in real Google Sheet...');
    console.log('   Updating Nifty 50 August amount from 500 -> 700...');
    await monthlyInvestmentService.upsertActualAmount(niftyId, 2026, 8, 700);

    const rawRows = await googleSheetsService.readRawRows(SHEET_TABS.MONTHLY_INVESTMENTS);
    const niftyAugustRows = rawRows.filter(
      (r) => r.values[1] === niftyId && r.values[2] === '2026' && r.values[3] === '8'
    );

    if (niftyAugustRows.length !== 1) {
      console.error(`❌ Expected exactly 1 row for Nifty August 2026, found ${niftyAugustRows.length}!`, niftyAugustRows);
      process.exit(1);
    }
    if (parseFloat(niftyAugustRows[0].values[4]) !== 700) {
      console.error(`❌ Expected row actualAmount to be 700, found ${niftyAugustRows[0].values[4]}!`);
      process.exit(1);
    }
    console.log(`✅ Duplicate Prevention PASS: exactly 1 row found in Google Sheet with actualAmount = ${niftyAugustRows[0].values[4]}`);

    // Restore 500 for Nifty August
    await monthlyInvestmentService.upsertActualAmount(niftyId, 2026, 8, 500);

    // Step 7: Test Month Isolation (August changes do NOT affect July)
    console.log('\n7. Testing Month Isolation...');
    const refreshedJuly = await monthlyInvestmentService.getMonthlyBreakdown(7, 2026);
    if (refreshedJuly.currentMonthActual !== 1500 || refreshedJuly.currentMonthRemaining !== 500) {
      console.error('❌ Month isolation failed! July data changed after August updates.', refreshedJuly);
      process.exit(1);
    }
    console.log('✅ Month Isolation PASS: July actual (1500) and remaining (500) remain unchanged.');

    // Step 8: Test Total Investment Calculation across all months
    console.log('\n8. Testing Total Actual Investment across all history...');
    const totalInvested = await monthlyInvestmentService.getTotalActualInvestment();
    console.log(`   Total Actual Investment: ${totalInvested} (Expected: 3000 = July 1500 + August 1500)`);
    if (totalInvested !== 3000) {
      console.error(`❌ Total investment calculation failed! Expected 3000, got ${totalInvested}`);
      process.exit(1);
    }
    console.log('✅ Total Investment PASS: 3000.');

    // Step 9: Test C — Previous month fully invested
    console.log('\n9. Test C: Simulating September with fully invested August (Target 2500, Actual 2500)...');
    await monthlyInvestmentService.upsertActualAmount(niftyId, 2026, 8, 1000);
    await monthlyInvestmentService.upsertActualAmount(next50Id, 2026, 8, 625);
    await monthlyInvestmentService.upsertActualAmount(midcapId, 2026, 8, 500);
    await monthlyInvestmentService.upsertActualAmount(smallcapId, 2026, 8, 375);

    const sepBreakdown = await monthlyInvestmentService.getMonthlyBreakdown(9, 2026);
    console.log(`   September Carry Forward: ${sepBreakdown.previousCarryForward} (Expected: 0)`);
    console.log(`   September Target: ${sepBreakdown.currentMonthTarget} (Expected: 2000)`);
    if (sepBreakdown.previousCarryForward !== 0 || sepBreakdown.currentMonthTarget !== 2000) {
      console.error('❌ Test C failed!', sepBreakdown);
      process.exit(1);
    }
    console.log('✅ Test C PASS: Fully invested month yields Carry Forward = 0.');

    // Step 10: Test D — Previous month over-invested
    console.log('\n10. Test D: Simulating September with over-invested August (Target 2500, Actual 2800)...');
    await monthlyInvestmentService.upsertActualAmount(niftyId, 2026, 8, 1300); // 300 over

    const sepOverBreakdown = await monthlyInvestmentService.getMonthlyBreakdown(9, 2026);
    console.log(`   September Carry Forward: ${sepOverBreakdown.previousCarryForward} (Expected: 0)`);
    console.log(`   September Target: ${sepOverBreakdown.currentMonthTarget} (Expected: 2000)`);
    if (sepOverBreakdown.previousCarryForward !== 0 || sepOverBreakdown.currentMonthTarget !== 2000) {
      console.error('❌ Test D failed! Over-investment should NOT reduce next target or produce negative carry forward.', sepOverBreakdown);
      process.exit(1);
    }
    console.log('✅ Test D PASS: Over-investment gives Carry Forward = 0 and does not reduce next month target.');
  } finally {
    // Self-clean all test rows
    console.log('\n11. Self-cleaning all test records from Google Sheets...');
    await googleSheetsService.clearDataRows(SHEET_TABS.MONTHLY_INVESTMENTS);
    await googleSheetsService.clearDataRows(SHEET_TABS.INVESTMENT_PLAN);
    await googleSheetsService.clearDataRows(SHEET_TABS.PLAN_HISTORY);
    await googleSheetsService.clearDataRows(SHEET_TABS.SETTINGS);
    console.log('✅ All test records cleared.');
  }

  console.log('\n======================================================');
  console.log('🎉 ALL PHASE C MONTHLY INVESTMENT TESTS PASSED (CLEAN)!');
  console.log('======================================================');
}

runPhaseCTests().catch((err) => {
  console.error('❌ Phase C test failed with error:', err);
  process.exit(1);
});
