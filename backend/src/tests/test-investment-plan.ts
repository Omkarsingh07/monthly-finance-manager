// src/tests/test-investment-plan.ts
import 'dotenv/config';
import { investmentPlanService } from '../services/investmentPlan.service';
import { googleSheetsService, SHEET_TABS } from '../services/googleSheets.service';
import { SaveInvestmentPlanSchema } from '../validators/investmentPlan.validator';

async function runPhaseBTests() {
  console.log('====================================================');
  console.log('  PHASE B — INVESTMENT PLAN GOOGLE SHEETS TEST SUITE');
  console.log('====================================================\n');

  try {
    // Step 0: Ensure spreadsheet schema & start with clean state
    console.log('0. Ensuring Google Sheet tabs and schema...');
    await googleSheetsService.ensureSpreadsheetSchema();
    await googleSheetsService.clearDataRows(SHEET_TABS.INVESTMENT_PLAN);
    await googleSheetsService.clearDataRows(SHEET_TABS.PLAN_HISTORY);
    await googleSheetsService.clearDataRows(SHEET_TABS.SETTINGS);
    console.log('✅ Schema verified.\n');

    // Step 1: Verify 100% weightage validation fails on invalid total
    console.log('1. Testing 100% weightage validation failure (95% total)...');
    const invalidPlan = {
      monthlyAmount: 2000,
      effectiveFromMonth: 8,
      effectiveFromYear: 2026,
      investments: [
        { name: 'Nifty 50 ETF', category: 'ETF' as const, weightage: 40 },
        { name: 'Next 50 ETF', category: 'ETF' as const, weightage: 25 },
        { name: 'Midcap ETF', category: 'ETF' as const, weightage: 20 },
        { name: 'Smallcap ETF', category: 'ETF' as const, weightage: 10 }, // total = 95%
      ],
    };

    const validationResult = SaveInvestmentPlanSchema.safeParse(invalidPlan);
    if (validationResult.success) {
      console.error('❌ Validation should have failed for 95% total weightage!');
      process.exit(1);
    } else {
      console.log('✅ Correctly rejected invalid weightage sum (95%):', validationResult.error.issues[0]?.message);
    }

    // Step 2: Create a valid investment plan (100% total)
    console.log('\n2. Creating a valid investment plan (2000/month, 100% allocation across 4 ETFs)...');
    const validPlan = {
      monthlyAmount: 2000,
      effectiveFromMonth: 8,
      effectiveFromYear: 2026,
      investments: [
        { name: 'Nippon India Nifty 50 ETF', category: 'ETF' as const, weightage: 40 },
        { name: 'ICICI Prudential Nifty Next 50 ETF', category: 'ETF' as const, weightage: 25 },
        { name: 'Mirae Asset Nifty Midcap 150 ETF', category: 'ETF' as const, weightage: 20 },
        { name: 'HDFC Nifty Smallcap 250 ETF', category: 'ETF' as const, weightage: 15 },
      ],
    };

    const savedPlan = await investmentPlanService.savePlan(validPlan);
    console.log(`✅ Plan saved! Version=${savedPlan.planVersion}, MonthlyAmount=${savedPlan.monthlyAmount}`);

    // Step 3: Verify data in Google Sheets directly
    console.log('\n3. Verifying persisted rows in real Google Sheets...');
    const planRows = await googleSheetsService.readRawRows(SHEET_TABS.INVESTMENT_PLAN);
    const settingsRows = await googleSheetsService.readRawRows(SHEET_TABS.SETTINGS);
    const historyRows = await googleSheetsService.readRawRows(SHEET_TABS.PLAN_HISTORY);

    const monthlyAmountSetting = settingsRows.find((r) => r.values[0] === 'monthlyInvestmentAmount');
    if (!monthlyAmountSetting || monthlyAmountSetting.values[1] !== '2000') {
      console.error('❌ Settings sheet does not contain monthlyInvestmentAmount = 2000', monthlyAmountSetting);
      process.exit(1);
    }
    console.log(`   ✅ monthlyInvestmentAmount in Settings sheet is: "${monthlyAmountSetting.values[1]}"`);

    const matchingHistory = historyRows.find(
      (r) => parseInt(r.values[0], 10) === savedPlan.planVersion && r.values[1] === '2000'
    );
    if (!matchingHistory) {
      console.error('❌ PlanHistory sheet does not contain matching version row');
      process.exit(1);
    }
    console.log(`   ✅ PlanHistory row found for Version ${savedPlan.planVersion}`);

    const matchingPlanItems = planRows.filter(
      (r) => parseInt(r.values[6], 10) === savedPlan.planVersion
    );
    if (matchingPlanItems.length !== 4) {
      console.error(`❌ Expected 4 investment items in InvestmentPlan sheet, found ${matchingPlanItems.length}`);
      process.exit(1);
    }
    console.log(`   ✅ All 4 items found in InvestmentPlan sheet with stable IDs`);

    // Step 4: Read active plan back through service / API
    console.log('\n4. Reading active plan back for August 2026 (month=8, year=2026)...');
    const activePlan = await investmentPlanService.getActivePlan(8, 2026);
    if (!activePlan) {
      console.error('❌ Failed to retrieve active plan!');
      process.exit(1);
    }
    console.log(`✅ Retrieved active plan: Version=${activePlan.planVersion}, Amount=${activePlan.monthlyAmount}`);

    // Step 5: Update an investment (change weightages: 50%, 20%, 20%, 10%)
    console.log('\n5. Updating investment plan (adjusting allocation: 50% Nifty 50, 20% Next 50, 20% Midcap, 10% Smallcap)...');
    const updatedPlanInput = {
      monthlyAmount: 2500,
      effectiveFromMonth: 8,
      effectiveFromYear: 2026,
      investments: [
        { id: savedPlan.investments[0].id, name: 'Nippon India Nifty 50 ETF', category: 'ETF' as const, weightage: 50 },
        { id: savedPlan.investments[1].id, name: 'ICICI Prudential Nifty Next 50 ETF', category: 'ETF' as const, weightage: 20 },
        { id: savedPlan.investments[2].id, name: 'Mirae Asset Nifty Midcap 150 ETF', category: 'ETF' as const, weightage: 20 },
        { id: savedPlan.investments[3].id, name: 'HDFC Nifty Smallcap 250 ETF', category: 'ETF' as const, weightage: 10 },
      ],
    };

    const updatedPlan = await investmentPlanService.savePlan(updatedPlanInput);
    console.log(`✅ Plan updated! Version=${updatedPlan.planVersion}, Amount=${updatedPlan.monthlyAmount}`);

    // Step 6: Verify updated values in real Google Sheet
    console.log('\n6. Verifying update in real Google Sheets...');
    const refreshedPlanRows = await googleSheetsService.readRawRows(SHEET_TABS.INVESTMENT_PLAN);
    const niftyRow = refreshedPlanRows.find((r) => r.values[0] === savedPlan.investments[0].id);
    if (!niftyRow || parseFloat(niftyRow.values[3]) !== 50) {
      console.error('❌ InvestmentPlan sheet does not reflect updated weightage 50%!', niftyRow);
      process.exit(1);
    }
    console.log(`✅ Verified updated weightage in sheet: ${niftyRow.values[3]}%`);

    // Step 7: Delete an investment item and verify deletion in real Google Sheet
    console.log('\n7. Testing item deletion on real Google Sheet...');
    const itemToDelete = updatedPlan.investments[3]; // Smallcap
    const deleted = await investmentPlanService.deletePlanItem(itemToDelete.id);
    if (!deleted) {
      console.error('❌ deletePlanItem returned false!');
      process.exit(1);
    }
    console.log('✅ deletePlanItem succeeded');

    const rowsAfterDelete = await googleSheetsService.readRawRows(SHEET_TABS.INVESTMENT_PLAN);
    const deletedStillExists = rowsAfterDelete.find((r) => r.values[0] === itemToDelete.id);
    if (deletedStillExists) {
      console.error('❌ Item still exists in sheet after deletion!');
      process.exit(1);
    }
    console.log('✅ Verified deletion: item no longer in Google Sheet.');
  } finally {
    // Step 8: Self-clean test records so real Google Sheet is left pristine
    console.log('\n8. Self-cleaning all test records from Google Sheets...');
    await googleSheetsService.clearDataRows(SHEET_TABS.INVESTMENT_PLAN);
    await googleSheetsService.clearDataRows(SHEET_TABS.PLAN_HISTORY);
    await googleSheetsService.clearDataRows(SHEET_TABS.SETTINGS);
    console.log('✅ Test rows cleaned up completely.');
  }

  console.log('\n====================================================');
  console.log('🎉 ALL PHASE B INVESTMENT PLAN TESTS PASSED (CLEAN)!');
  console.log('====================================================');
}

runPhaseBTests().catch((err) => {
  console.error('❌ Phase B test failed with error:', err);
  process.exit(1);
});
