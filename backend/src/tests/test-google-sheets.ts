// src/tests/test-google-sheets.ts
import 'dotenv/config';
import { googleSheetsService, SHEET_TABS } from '../services/googleSheets.service';
import { v4 as uuidv4 } from 'uuid';

async function runTest() {
  console.log('--- Google Sheets Integration Test ---');
  console.log('1. Checking connection to Google Sheets...');

  const health = await googleSheetsService.checkHealth();
  if (!health.connected) {
    console.error('❌ Failed to connect to Google Sheets:', health.error);
    process.exit(1);
  }

  console.log(`✅ Connected! Spreadsheet Title: "${health.title}"`);
  console.log(`   Existing Tabs: ${health.tabs?.join(', ')}`);

  console.log('\n2. Ensuring schema (required tabs and headers)...');
  await googleSheetsService.ensureSpreadsheetSchema();

  const refreshedHealth = await googleSheetsService.checkHealth();
  console.log(`✅ Required tabs verified: ${refreshedHealth.tabs?.join(', ')}`);

  const testId = `test_${uuidv4().substring(0, 8)}`;
  const now = new Date().toISOString();

  console.log(`\n3. Appending temporary test row in "${SHEET_TABS.SETTINGS}" tab...`);
  // Settings sheet schema: key, value, updatedAt
  await googleSheetsService.appendRow(SHEET_TABS.SETTINGS, [testId, 'initial_value', now]);
  console.log(`✅ Appended test row with key="${testId}"`);

  console.log('\n4. Reading back rows to find test row...');
  let rows = await googleSheetsService.readRawRows(SHEET_TABS.SETTINGS);
  let found = rows.find((r) => r.values[0] === testId);

  if (!found) {
    console.error('❌ Test row not found after append!');
    process.exit(1);
  }
  console.log(`✅ Found test row at rowIndex=${found.rowIndex}, value="${found.values[1]}"`);

  console.log('\n5. Updating test row...');
  const updatedNow = new Date().toISOString();
  await googleSheetsService.updateRow(SHEET_TABS.SETTINGS, found.rowIndex, [testId, 'updated_value', updatedNow]);
  console.log('✅ Updated test row');

  console.log('\n6. Verifying updated value...');
  rows = await googleSheetsService.readRawRows(SHEET_TABS.SETTINGS);
  found = rows.find((r) => r.values[0] === testId);
  if (!found || found.values[1] !== 'updated_value') {
    console.error('❌ Test row does not reflect updated value!', found);
    process.exit(1);
  }
  console.log(`✅ Verified update: value is "${found.values[1]}"`);

  console.log('\n7. Cleaning up (deleting test row)...');
  await googleSheetsService.deleteRow(SHEET_TABS.SETTINGS, found.rowIndex);
  console.log('✅ Deleted test row');

  console.log('\n8. Verifying cleanup...');
  rows = await googleSheetsService.readRawRows(SHEET_TABS.SETTINGS);
  found = rows.find((r) => r.values[0] === testId);
  if (found) {
    console.error('❌ Test row was not cleaned up!');
    process.exit(1);
  }
  console.log('✅ Verified cleanup: test row no longer exists in Google Sheets');

  console.log('\n========================================');
  console.log('🎉 ALL GOOGLE SHEETS INTEGRATION TESTS PASSED!');
  console.log('========================================');
}

runTest().catch((err) => {
  console.error('❌ Unhandled error in Google Sheets test:', err);
  process.exit(1);
});
