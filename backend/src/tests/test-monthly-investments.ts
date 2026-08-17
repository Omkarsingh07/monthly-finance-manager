// src/tests/test-monthly-investments.ts
import 'dotenv/config';
import { investmentPlanService } from '../services/investmentPlan.service';
import { monthlyInvestmentService } from '../services/monthlyInvestment.service';
import { googleSheetsService, SHEET_TABS } from '../services/googleSheets.service';
import { UpdateMonthlyInvestmentSchema } from '../validators/monthlyInvestment.validator';

async function runPhaseCTests() {
  console.log('======================================================');
  console.log('  MONTHLY INVESTMENTS — INVESTMENT-LEVEL CARRY FORWARD');
  console.log('======================================================\n');

  try {
    // Step 0: Clean sheets for pristine test execution
    console.log('0. Cleaning test tabs for pristine test execution...');
    await googleSheetsService.ensureSpreadsheetSchema();

    await googleSheetsService.clearDataRows(SHEET_TABS.MONTHLY_INVESTMENTS);
    await googleSheetsService.clearDataRows(SHEET_TABS.INVESTMENT_PLAN);
    await googleSheetsService.clearDataRows(SHEET_TABS.PLAN_HISTORY);
    await googleSheetsService.clearDataRows(SHEET_TABS.SETTINGS);
    console.log('✅ Cleaned previous test rows via clearDataRows.\n');

    // Setup investment plan (2000/month: Reliance 40%, HDFC 30%, ICICI 30%) effective from July 2026
    console.log('Setting up investment plan (2000/month: Reliance 40%, HDFC 30%, ICICI 30%) effective from July 2026...');
    const plan = await investmentPlanService.savePlan({
      monthlyAmount: 2000,
      effectiveFromMonth: 7, // July 2026
      effectiveFromYear: 2026,
      investments: [
        { name: 'Reliance', category: 'STOCK', weightage: 40 },
        { name: 'HDFC', category: 'STOCK', weightage: 30 },
        { name: 'ICICI', category: 'STOCK', weightage: 30 },
      ],
    });

    const relianceId = plan.investments[0].id;
    const hdfcId = plan.investments[1].id;
    const iciciId = plan.investments[2].id;

    console.log(`✅ Plan saved! Reliance=${relianceId}, HDFC=${hdfcId}, ICICI=${iciciId}\n`);

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

    const relJuly = julyInitial.investments.find((i) => i.id === relianceId);
    const hdfcJuly = julyInitial.investments.find((i) => i.id === hdfcId);
    const iciciJuly = julyInitial.investments.find((i) => i.id === iciciId);

    console.log(`   July Initial Targets: Reliance=₹${relJuly?.plannedAmount} (Exp: 800), HDFC=₹${hdfcJuly?.plannedAmount} (Exp: 600), ICICI=₹${iciciJuly?.plannedAmount} (Exp: 600)`);

    if (
      julyInitial.currentMonthTarget !== 2000 ||
      julyInitial.previousCarryForward !== 0 ||
      relJuly?.plannedAmount !== 800 ||
      hdfcJuly?.plannedAmount !== 600 ||
      iciciJuly?.plannedAmount !== 600
    ) {
      console.error('❌ Test A failed!', julyInitial);
      process.exit(1);
    }
    console.log('✅ Test A PASS: Initial targets: Reliance=800, HDFC=600, ICICI=600. Carry Forward = 0.');

    // Step 3: Test B & F — July Reliance missed completely (0), HDFC (600), ICICI (600)
    console.log('\n3. Test B & F: July Reliance completely missed (Actual: 0), HDFC (600), ICICI (600)...');
    await monthlyInvestmentService.upsertActualAmount(relianceId, 2026, 7, 0);
    await monthlyInvestmentService.upsertActualAmount(hdfcId, 2026, 7, 600);
    await monthlyInvestmentService.upsertActualAmount(iciciId, 2026, 7, 600);

    const augustAfterMiss = await monthlyInvestmentService.getMonthlyBreakdown(8, 2026);
    const relAug = augustAfterMiss.investments.find((i) => i.id === relianceId);
    const hdfcAug = augustAfterMiss.investments.find((i) => i.id === hdfcId);
    const iciciAug = augustAfterMiss.investments.find((i) => i.id === iciciId);

    console.log(`   August Targets after Reliance missed in July:`);
    console.log(`   - Reliance: Normal=₹${relAug?.normalPlannedAmount}, Pending=₹${relAug?.previousMonthPending}, Target=₹${relAug?.plannedAmount} (Expected: 1600 = 800+800)`);
    console.log(`   - HDFC:     Normal=₹${hdfcAug?.normalPlannedAmount}, Pending=₹${hdfcAug?.previousMonthPending}, Target=₹${hdfcAug?.plannedAmount} (Expected: 600 = 600+0)`);
    console.log(`   - ICICI:    Normal=₹${iciciAug?.normalPlannedAmount}, Pending=₹${iciciAug?.previousMonthPending}, Target=₹${iciciAug?.plannedAmount} (Expected: 600 = 600+0)`);
    console.log(`   - Total Target: ₹${augustAfterMiss.currentMonthTarget} (Expected: 2800 = 2000 base + 800 carry)`);

    if (
      relAug?.plannedAmount !== 1600 ||
      relAug?.previousMonthPending !== 800 ||
      hdfcAug?.plannedAmount !== 600 ||
      hdfcAug?.previousMonthPending !== 0 ||
      iciciAug?.plannedAmount !== 600 ||
      iciciAug?.previousMonthPending !== 0 ||
      augustAfterMiss.currentMonthTarget !== 2800 ||
      augustAfterMiss.previousCarryForward !== 800
    ) {
      console.error('❌ Test B & F failed!', augustAfterMiss);
      process.exit(1);
    }
    console.log('✅ Test B & F PASS: Reliance carry forward stays attached to Reliance ONLY (Target = 1600). Total Target = 2800.');

    // Step 4: Test C — Partial Investment (July Reliance actual = 300)
    console.log('\n4. Test C: July Reliance partially invested (Actual = 300, Planned = 800 -> Pending = 500)...');
    await monthlyInvestmentService.upsertActualAmount(relianceId, 2026, 7, 300);

    const augustPartial = await monthlyInvestmentService.getMonthlyBreakdown(8, 2026);
    const relAugPartial = augustPartial.investments.find((i) => i.id === relianceId);

    console.log(`   August Reliance Target: Normal=₹${relAugPartial?.normalPlannedAmount}, Pending=₹${relAugPartial?.previousMonthPending}, Target=₹${relAugPartial?.plannedAmount} (Expected: 1300 = 800+500)`);
    if (relAugPartial?.plannedAmount !== 1300 || relAugPartial?.previousMonthPending !== 500) {
      console.error('❌ Test C failed!', relAugPartial);
      process.exit(1);
    }
    console.log('✅ Test C PASS: Partial investment carry forward: Reliance Target = 1300.');

    // Step 5: Test D — Full Investment (July Reliance actual = 800)
    console.log('\n5. Test D: July Reliance fully invested (Actual = 800, Planned = 800 -> Pending = 0)...');
    await monthlyInvestmentService.upsertActualAmount(relianceId, 2026, 7, 800);

    const augustFull = await monthlyInvestmentService.getMonthlyBreakdown(8, 2026);
    const relAugFull = augustFull.investments.find((i) => i.id === relianceId);

    console.log(`   August Reliance Target: Target=₹${relAugFull?.plannedAmount} (Expected: 800)`);
    if (relAugFull?.plannedAmount !== 800 || relAugFull?.previousMonthPending !== 0) {
      console.error('❌ Test D failed!', relAugFull);
      process.exit(1);
    }
    console.log('✅ Test D PASS: Fully invested month yields Pending = 0, Target = 800.');

    // Step 6: Test E — Over-investment (July Reliance actual = 1000)
    console.log('\n6. Test E: July Reliance over-invested (Actual = 1000, Planned = 800 -> Pending = 0)...');
    await monthlyInvestmentService.upsertActualAmount(relianceId, 2026, 7, 1000);

    const augustOver = await monthlyInvestmentService.getMonthlyBreakdown(8, 2026);
    const relAugOver = augustOver.investments.find((i) => i.id === relianceId);

    console.log(`   August Reliance Target on Over-Investment: Target=₹${relAugOver?.plannedAmount} (Expected: 800, not reduced)`);
    if (relAugOver?.plannedAmount !== 800 || relAugOver?.previousMonthPending !== 0) {
      console.error('❌ Test E failed!', relAugOver);
      process.exit(1);
    }
    console.log('✅ Test E PASS: Over-investment gives Pending = 0 and does NOT reduce next month target.');

    // Reset July Reliance back to canonical 0 (for multi-month test)
    await monthlyInvestmentService.upsertActualAmount(relianceId, 2026, 7, 0);

    // Step 7: Test Duplicate Prevention & Row Updating in Google Sheets
    console.log('\n7. Testing duplicate prevention & row update in real Google Sheet...');
    await monthlyInvestmentService.upsertActualAmount(relianceId, 2026, 8, 700);
    await monthlyInvestmentService.upsertActualAmount(relianceId, 2026, 8, 900); // update to 900

    const rawRows = await googleSheetsService.readRawRows(SHEET_TABS.MONTHLY_INVESTMENTS);
    const relAugRows = rawRows.filter(
      (r) => r.values[1] === relianceId && r.values[2] === '2026' && r.values[3] === '8'
    );

    if (relAugRows.length !== 1) {
      console.error(`❌ Expected exactly 1 row for Reliance August 2026, found ${relAugRows.length}!`, relAugRows);
      process.exit(1);
    }
    if (parseFloat(relAugRows[0].values[4]) !== 900) {
      console.error(`❌ Expected row actualAmount to be 900, found ${relAugRows[0].values[4]}!`);
      process.exit(1);
    }
    console.log(`✅ Duplicate Prevention PASS: exactly 1 row found in Google Sheet with actualAmount = ${relAugRows[0].values[4]}`);

    // Step 8: Test Month Isolation (August changes do NOT affect July)
    console.log('\n8. Testing Month Isolation...');
    const refreshedJuly = await monthlyInvestmentService.getMonthlyBreakdown(7, 2026);
    const relJulyRefreshed = refreshedJuly.investments.find((i) => i.id === relianceId);

    if (relJulyRefreshed?.actualAmount !== 0) {
      console.error('❌ Month isolation failed! July data changed after August updates.', refreshedJuly);
      process.exit(1);
    }
    console.log('✅ Month Isolation PASS: July actual (0) remains untouched.');

    // Step 9: Test Total Investment Calculation across all months
    console.log('\n9. Testing Total Actual Investment across all history...');
    // July actuals: Reliance 0 + HDFC 600 + ICICI 600 = 1200
    // August actuals: Reliance 900
    // Total = 1200 + 900 = 2100
    const totalInvested = await monthlyInvestmentService.getTotalActualInvestment();
    console.log(`   Total Actual Investment: ${totalInvested} (Expected: 2100)`);
    if (totalInvested !== 2100) {
      console.error(`❌ Total investment calculation failed! Expected 2100, got ${totalInvested}`);
      process.exit(1);
    }
    console.log('✅ Total Investment PASS: 2100.');
  } finally {
    // Self-clean all test rows so spreadsheet is left pristine
    console.log('\n10. Self-cleaning all test records from Google Sheets...');
    await googleSheetsService.clearDataRows(SHEET_TABS.MONTHLY_INVESTMENTS);
    await googleSheetsService.clearDataRows(SHEET_TABS.INVESTMENT_PLAN);
    await googleSheetsService.clearDataRows(SHEET_TABS.PLAN_HISTORY);
    await googleSheetsService.clearDataRows(SHEET_TABS.SETTINGS);
    console.log('✅ All test records cleared.');
  }

  console.log('\n======================================================');
  console.log('🎉 ALL MONTHLY INVESTMENT PER-INVESTMENT TESTS PASSED!');
  console.log('======================================================');
}

runPhaseCTests().catch((err) => {
  console.error('❌ Monthly Investment test failed with error:', err);
  process.exit(1);
});
