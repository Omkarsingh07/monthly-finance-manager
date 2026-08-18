// src/tests/test-monthly-investments.ts
import 'dotenv/config';
import { monthlyInvestmentService } from '../services/monthlyInvestment.service';
import { investmentPlanService } from '../services/investmentPlan.service';
import { googleSheetsService, SHEET_TABS } from '../services/googleSheets.service';
import { calculateWholeShares } from '../utils/money';

async function runMonthlyInvestmentsTestSuite() {
  console.log('======================================================');
  console.log('  STOCK-WISE SIP ACCUMULATION & WHOLE-SHARE SUITE');
  console.log('======================================================\n');

  console.log('0. Cleaning test tabs for pristine test execution...');
  await Promise.all([
    googleSheetsService.clearDataRows(SHEET_TABS.SETTINGS),
    googleSheetsService.clearDataRows(SHEET_TABS.INVESTMENT_PLAN),
    googleSheetsService.clearDataRows(SHEET_TABS.MONTHLY_INVESTMENTS),
    googleSheetsService.clearDataRows(SHEET_TABS.PLAN_HISTORY),
  ]);
  console.log('✅ Cleaned previous test rows via clearDataRows.\n');

  // Plan: 2000/month (Reliance 40%, HDFC 25%, Infosys 20%, TCS 15%) starting July 2026
  console.log('Setting up investment plan (₹2,000/month: Reliance 40%, HDFC 25%, Infosys 20%, TCS 15%) effective from July 2026...');
  const planResult = await investmentPlanService.savePlan({
    monthlyAmount: 2000,
    effectiveFromMonth: 7,
    effectiveFromYear: 2026,
    investments: [
      { name: 'Reliance', category: 'STOCK', weightage: 40 },
      { name: 'HDFC', category: 'STOCK', weightage: 25 },
      { name: 'Infosys', category: 'STOCK', weightage: 20 },
      { name: 'TCS', category: 'STOCK', weightage: 15 },
    ],
  });

  const relId = planResult.investments.find((i: any) => i.name === 'Reliance')?.id!;
  const hdfcId = planResult.investments.find((i: any) => i.name === 'HDFC')?.id!;
  const infyId = planResult.investments.find((i: any) => i.name === 'Infosys')?.id!;
  const tcsId = planResult.investments.find((i: any) => i.name === 'TCS')?.id!;

  console.log(`✅ Plan saved! Reliance=${relId}, HDFC=${hdfcId}, Infosys=${infyId}, TCS=${tcsId}\n`);

  try {
    // ----------------------------------------------------
    // TEST 1: July 2026 — No previous pending
    // ----------------------------------------------------
    console.log('1. Test 1: July 2026 — No previous pending balance...');
    const julyPrices = new Map<string, number>([
      [relId, 1400],
      [hdfcId, 1600],
      [infyId, 1500],
      [tcsId, 3000],
    ]);

    const julyBreakdown = await monthlyInvestmentService.getMonthlyBreakdown(7, 2026, julyPrices);

    console.log(`   July Base SIP Amount: ₹${julyBreakdown.baseMonthlyAmount} (Expected: 2000)`);
    console.log(`   July Carry Forward:   ₹${julyBreakdown.previousCarryForward} (Expected: 0)`);
    console.log(`   July Target:          ₹${julyBreakdown.currentMonthTarget} (Expected: 2000)`);

    const julyRel = julyBreakdown.investments.find((i) => i.id === relId)!;
    const julyHdfc = julyBreakdown.investments.find((i) => i.id === hdfcId)!;
    const julyInfy = julyBreakdown.investments.find((i) => i.id === infyId)!;
    const julyTcs = julyBreakdown.investments.find((i) => i.id === tcsId)!;

    console.log(`   July Reliance: Allocation=₹${julyRel.monthlyAllocation}, PrevPending=₹${julyRel.previousPending}, Available=₹${julyRel.availableAmount}, Shares=${julyRel.sharesToBuy}, Cost=₹${julyRel.plannedPurchaseAmount}`);

    if (
      julyRel.monthlyAllocation !== 800 ||
      julyRel.previousPending !== 0 ||
      julyRel.availableAmount !== 800 ||
      julyRel.sharesToBuy !== 0 ||
      julyRel.plannedPurchaseAmount !== 0 ||
      julyRel.pendingAmount !== 800
    ) {
      console.error('❌ Test 1 Failed on Reliance July calculations!', julyRel);
      process.exit(1);
    }

    if (julyHdfc.availableAmount !== 500 || julyInfy.availableAmount !== 400 || julyTcs.availableAmount !== 300) {
      console.error('❌ Test 1 Failed on other July asset allocations!');
      process.exit(1);
    }
    console.log('✅ Test 1 PASS: July allocations correct (Reliance=800, HDFC=500, Infosys=400, TCS=300). Available = 800, Shares = 0, Pending = 800.\n');

    // ----------------------------------------------------
    // TEST 2 & 3: Whole Shares & Fractional Share Prevention
    // ----------------------------------------------------
    console.log('2. Test 2 & 3: Whole Share Purchases & Fractional Share Prevention...');
    const shareTest1 = calculateWholeShares(800, 1400);
    if (shareTest1.shares !== 0 || shareTest1.totalCost !== 0 || shareTest1.remaining !== 800) {
      console.error('❌ Fractional shares allowed on 800 / 1400!', shareTest1);
      process.exit(1);
    }
    console.log(`   Available ₹800, Price ₹1,400 -> Shares: ${shareTest1.shares} (never fractional 0.5714), Cost: ₹${shareTest1.totalCost}, Pending: ₹${shareTest1.remaining}`);

    const shareTest2 = calculateWholeShares(1600, 1400);
    if (shareTest2.shares !== 1 || shareTest2.totalCost !== 1400 || shareTest2.remaining !== 200) {
      console.error('❌ Whole shares calculation failed on 1600 / 1400!', shareTest2);
      process.exit(1);
    }
    console.log(`   Available ₹1,600, Price ₹1,400 -> Shares: ${shareTest2.shares}, Cost: ₹${shareTest2.totalCost}, Pending: ₹${shareTest2.remaining}`);
    console.log('✅ Test 2 & 3 PASS: Strict whole share purchase enforced (floor).\n');

    // ----------------------------------------------------
    // TEST 4 & 6: August 2026 — Accumulation & Purchase Execution
    // ----------------------------------------------------
    console.log('3. Test 4 & 6: August 2026 — Stock-Wise Pending Accumulation & Purchase Execution...');
    // In July, all actuals were ₹0 (no purchases made)
    await monthlyInvestmentService.batchUpsertActualAmounts(2026, 7, [
      { planInvestmentId: relId, actualAmount: 0 },
      { planInvestmentId: hdfcId, actualAmount: 0 },
      { planInvestmentId: infyId, actualAmount: 0 },
      { planInvestmentId: tcsId, actualAmount: 0 },
    ]);

    const augustPrices = new Map<string, number>([
      [relId, 1400],
      [hdfcId, 1600],
      [infyId, 1500],
      [tcsId, 3000],
    ]);

    const augustBreakdown = await monthlyInvestmentService.getMonthlyBreakdown(8, 2026, augustPrices);

    console.log(`   August Base SIP Target: ₹${augustBreakdown.baseMonthlyAmount} (Expected: 2000, NOT 4000)`);
    console.log(`   August Total Available: ₹${augustBreakdown.totalAvailableAmount} (Expected: 4000)`);

    const augRel = augustBreakdown.investments.find((i) => i.id === relId)!;
    const augHdfc = augustBreakdown.investments.find((i) => i.id === hdfcId)!;
    const augInfy = augustBreakdown.investments.find((i) => i.id === infyId)!;
    const augTcs = augustBreakdown.investments.find((i) => i.id === tcsId)!;

    console.log(`   August Reliance: Alloc=₹${augRel.monthlyAllocation}, PrevPending=₹${augRel.previousPending}, Available=₹${augRel.availableAmount}, SharesToBuy=${augRel.sharesToBuy}, Cost=₹${augRel.plannedPurchaseAmount}`);
    console.log(`   August HDFC:     Alloc=₹${augHdfc.monthlyAllocation}, PrevPending=₹${augHdfc.previousPending}, Available=₹${augHdfc.availableAmount}, SharesToBuy=${augHdfc.sharesToBuy}`);
    console.log(`   August Infosys:  Alloc=₹${augInfy.monthlyAllocation}, PrevPending=₹${augInfy.previousPending}, Available=₹${augInfy.availableAmount}, SharesToBuy=${augInfy.sharesToBuy}`);
    console.log(`   August TCS:      Alloc=₹${augTcs.monthlyAllocation}, PrevPending=₹${augTcs.previousPending}, Available=₹${augTcs.availableAmount}, SharesToBuy=${augTcs.sharesToBuy}`);

    if (
      augRel.availableAmount !== 1600 ||
      augRel.sharesToBuy !== 1 ||
      augRel.plannedPurchaseAmount !== 1400 ||
      augHdfc.availableAmount !== 1000 ||
      augHdfc.sharesToBuy !== 0 ||
      augInfy.availableAmount !== 800 ||
      augTcs.availableAmount !== 600
    ) {
      console.error('❌ Test 4/6 Failed on August available / shares calculation!', augustBreakdown);
      process.exit(1);
    }
    console.log('✅ August Targets PASS: Reliance Available=1600 (Buy 1 @ 1400), HDFC Available=1000 (Buy 0 @ 1600).\n');

    // Now execute August purchase: Reliance buys 1 share (₹1,400), others ₹0
    console.log('4. Recording August actual purchase (Reliance buys 1 share at ₹1,400)...');
    const augAfterPurchase = await monthlyInvestmentService.batchUpsertActualAmounts(2026, 8, [
      { planInvestmentId: relId, actualAmount: 1400 },
      { planInvestmentId: hdfcId, actualAmount: 0 },
      { planInvestmentId: infyId, actualAmount: 0 },
      { planInvestmentId: tcsId, actualAmount: 0 },
    ]);

    const augRelAfter = augAfterPurchase.investments.find((i) => i.id === relId)!;
    console.log(`   August Reliance New Pending: ₹${augRelAfter.pendingAmount} (Expected: 200 = 1600 - 1400)`);
    if (augRelAfter.pendingAmount !== 200) {
      console.error('❌ August Reliance pending after purchase is not 200!', augRelAfter);
      process.exit(1);
    }
    console.log('✅ August Purchase PASS: Reliance pending = ₹200.\n');

    // ----------------------------------------------------
    // TEST 5 & 7: September 2026 — Price Change & Stock Isolation
    // ----------------------------------------------------
    console.log('5. Test 5 & 7: September 2026 — Price Change & Continuous Stock Isolation...');
    const septPrices = new Map<string, number>([
      [relId, 900], // Reliance price dropped to ₹900
      [hdfcId, 1600],
      [infyId, 1500],
      [tcsId, 3000],
    ]);

    const septBreakdown = await monthlyInvestmentService.getMonthlyBreakdown(9, 2026, septPrices);

    const septRel = septBreakdown.investments.find((i) => i.id === relId)!;
    const septHdfc = septBreakdown.investments.find((i) => i.id === hdfcId)!;

    console.log(`   September Reliance: New Alloc=₹${septRel.monthlyAllocation}, PrevPending=₹${septRel.previousPending}, Available=₹${septRel.availableAmount}`);
    console.log(`   September Reliance at ₹900/share: SharesToBuy=${septRel.sharesToBuy}, Cost=₹${septRel.plannedPurchaseAmount}`);
    console.log(`   September HDFC:     New Alloc=₹${septHdfc.monthlyAllocation}, PrevPending=₹${septHdfc.previousPending}, Available=₹${septHdfc.availableAmount}`);

    if (
      septRel.previousPending !== 200 ||
      septRel.availableAmount !== 1000 ||
      septRel.sharesToBuy !== 1 ||
      septRel.plannedPurchaseAmount !== 900 ||
      septHdfc.previousPending !== 1000 ||
      septHdfc.availableAmount !== 1500
    ) {
      console.error('❌ Test 5/7 Failed on September state!', { septRel, septHdfc });
      process.exit(1);
    }
    console.log('✅ September PASS: Reliance Available=1000 -> Buys 1 @ 900 -> Pending=100. HDFC Available=1500.\n');

    // ----------------------------------------------------
    // TEST 8: Total Actual Investment & Monthly SIP Stability
    // ----------------------------------------------------
    console.log('6. Test 8: Total Actual Investment across history...');
    const totalActual = await monthlyInvestmentService.getTotalActualInvestment();
    console.log(`   Total Actual Investment: ₹${totalActual} (Expected: 1400 = July 0 + August 1400)`);
    if (totalActual !== 1400) {
      console.error(`❌ Total actual investment mismatch! Got ${totalActual}, expected 1400`);
      process.exit(1);
    }
    console.log('✅ Total Actual Investment PASS: ₹1400.\n');

    // ----------------------------------------------------
    // Duplicate Prevention Test
    // ----------------------------------------------------
    console.log('7. Testing Duplicate Prevention in Google Sheets...');
    await monthlyInvestmentService.upsertActualAmount(relId, 2026, 8, 1400);
    const allRows = await monthlyInvestmentService.getAllMonthlyInvestments();
    const augRelRows = allRows.filter((r) => r.record.planInvestmentId === relId && r.record.year === 2026 && r.record.month === 8);
    if (augRelRows.length !== 1) {
      console.error(`❌ Duplicate rows found for Reliance in August! Count: ${augRelRows.length}`);
      process.exit(1);
    }
    console.log('✅ Duplicate Prevention PASS: exactly 1 row found in Google Sheet.\n');

    // Clean up
    console.log('8. Cleaning up test data from Google Sheets...');
    await Promise.all([
      googleSheetsService.clearDataRows(SHEET_TABS.SETTINGS),
      googleSheetsService.clearDataRows(SHEET_TABS.INVESTMENT_PLAN),
      googleSheetsService.clearDataRows(SHEET_TABS.MONTHLY_INVESTMENTS),
      googleSheetsService.clearDataRows(SHEET_TABS.PLAN_HISTORY),
    ]);
    console.log('✅ Pristine Google Sheets state restored.\n');
  } catch (err) {
    console.error('❌ Test suite execution failed:', err);
    process.exit(1);
  }

  console.log('======================================================');
  console.log('🎉 ALL STOCK-WISE SIP & WHOLE-SHARE TESTS PASSED!');
  console.log('======================================================');
}

runMonthlyInvestmentsTestSuite().catch((err) => {
  console.error('Fatal error running monthly investments test suite:', err);
  process.exit(1);
});
